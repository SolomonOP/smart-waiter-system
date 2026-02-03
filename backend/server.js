const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Security and performance middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Socket.io configuration for production
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_waiter';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => console.log('✅ MongoDB Atlas Connected'))
.catch(err => {
  console.error('❌ MongoDB Connection Error:', err.message);
  console.log('⚠️  Using in-memory database for demo...');
});

// ==================== ROOT ROUTE ====================
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 Smart Waiter System - Live Production API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString(),
    endpoints: {
      api: '/api',
      health: '/health',
      menu: '/api/menu',
      login: 'POST /api/auth/login'
    },
    realtime: {
      socket: true,
      events: ['order-update', 'status-change', 'service-request']
    }
  });
});

// Health check endpoint (required by Render)
app.get('/health', (req, res) => {
  const healthcheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    memory: process.memoryUsage()
  };
  res.status(200).json(healthcheck);
});

// ==================== API ROUTES ====================

// Demo menu endpoint
app.get('/api/menu', (req, res) => {
  const menuItems = [
    {
      id: 1,
      name: 'Classic Burger',
      description: 'Juicy beef patty with lettuce, tomato, and special sauce',
      price: 12.99,
      category: 'main',
      image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
      available: true
    },
    {
      id: 2,
      name: 'Caesar Salad',
      description: 'Fresh romaine lettuce with Caesar dressing, croutons, and parmesan',
      price: 9.99,
      category: 'appetizer',
      image: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
      available: true
    },
    {
      id: 3,
      name: 'Grilled Salmon',
      description: 'Atlantic salmon with lemon butter sauce and seasonal vegetables',
      price: 22.99,
      category: 'main',
      image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
      available: true
    }
  ];
  
  res.json({
    success: true,
    count: menuItems.length,
    menuItems
  });
});

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  // Demo accounts
  const demoAccounts = {
    'customer@demo.com': { 
      password: '123456', 
      user: {
        id: 1,
        firstName: 'John',
        lastName: 'Doe',
        email: 'customer@demo.com',
        role: 'customer',
        phone: '555-1234'
      }
    },
    'chef@demo.com': { 
      password: '123456', 
      user: {
        id: 2,
        firstName: 'Master',
        lastName: 'Chef',
        email: 'chef@demo.com',
        role: 'chef',
        phone: '555-5678'
      }
    },
    'admin@demo.com': { 
      password: '123456', 
      user: {
        id: 3,
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@demo.com',
        role: 'admin',
        phone: '555-9012'
      }
    }
  };
  
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }
  
  const account = demoAccounts[email];
  
  if (account && account.password === password) {
    res.json({
      success: true,
      message: 'Login successful',
      token: 'demo_jwt_token_' + Date.now(),
      user: account.user
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid email or password'
    });
  }
});

// Order endpoint
app.post('/api/orders', (req, res) => {
  const { tableNumber, items, totalAmount, customerName } = req.body;
  
  if (!tableNumber || !items || !totalAmount) {
    return res.status(400).json({
      success: false,
      message: 'Table number, items, and total amount are required'
    });
  }
  
  const order = {
    orderId: 'ORD' + Date.now().toString().slice(-6),
    tableNumber,
    items,
    totalAmount,
    customerName: customerName || 'Guest',
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  
  // Emit real-time event
  io.emit('new-order', order);
  
  res.status(201).json({
    success: true,
    message: 'Order placed successfully',
    order
  });
});

// ==================== SOCKET.IO REAL-TIME ====================

const connectedUsers = new Map();
const activeOrders = new Map();

io.on('connection', (socket) => {
  console.log(`🔌 New connection: ${socket.id}`);
  
  // User registration
  socket.on('register-user', (userData) => {
    connectedUsers.set(socket.id, {
      ...userData,
      socketId: socket.id,
      connectedAt: new Date().toISOString()
    });
    
    // Join role-specific room
    socket.join(`role-${userData.role}`);
    
    // Join table room if customer
    if (userData.tableNumber) {
      socket.join(`table-${userData.tableNumber}`);
    }
    
    console.log(`👤 ${userData.role.toUpperCase()} connected: ${userData.email}`);
    
    // Send welcome message
    socket.emit('welcome', {
      message: `Welcome ${userData.name}!`,
      role: userData.role,
      serverTime: new Date().toISOString()
    });
  });
  
  // Customer places order
  socket.on('place-order', (orderData) => {
    const order = {
      ...orderData,
      orderId: 'ORD' + Date.now().toString().slice(-6),
      status: 'pending',
      timestamp: new Date().toISOString()
    };
    
    activeOrders.set(order.orderId, order);
    
    console.log('📦 New order placed:', order.orderId);
    
    // Notify all chefs
    io.to('role-chef').emit('new-order', {
      ...order,
      notification: `New order from Table ${order.tableNumber}`
    });
    
    // Notify all admins
    io.to('role-admin').emit('order-placed', order);
    
    // Confirm to customer
    socket.emit('order-confirmed', {
      success: true,
      orderId: order.orderId,
      message: 'Order received! Chef has been notified.',
      estimatedTime: '15-20 minutes'
    });
  });
  
  // Chef updates order status
  socket.on('update-order-status', (data) => {
    const { orderId, status, chefName } = data;
    const order = activeOrders.get(orderId);
    
    if (order) {
      order.status = status;
      order.updatedAt = new Date().toISOString();
      order.chefName = chefName;
      
      console.log(`🔄 Order ${orderId} status: ${status}`);
      
      // Notify customer
      io.to(`table-${order.tableNumber}`).emit('order-status-update', {
        orderId,
        status,
        message: getStatusMessage(status),
        chefName,
        timestamp: new Date().toISOString()
      });
      
      // Notify all chefs
      io.to('role-chef').emit('order-updated', {
        orderId,
        status,
        tableNumber: order.tableNumber
      });
      
      // Notify admin
      io.to('role-admin').emit('order-status-changed', {
        orderId,
        status,
        tableNumber: order.tableNumber,
        chefName
      });
    }
  });
  
  // Service requests
  socket.on('request-service', (serviceData) => {
    const { type, tableNumber, details } = serviceData;
    
    console.log(`🛎️  Service request: ${type} for Table ${tableNumber}`);
    
    io.to('role-chef').emit('service-request', {
      type,
      tableNumber,
      details,
      timestamp: new Date().toISOString(),
      priority: type === 'bill' ? 'high' : 'medium'
    });
    
    // Acknowledge to customer
    socket.emit('service-acknowledged', {
      type,
      tableNumber,
      message: `${getServiceName(type)} request sent to kitchen`,
      estimatedResponse: '5 minutes'
    });
  });
  
  // Real-time chat
  socket.on('send-message', (messageData) => {
    const { to, message, tableNumber, fromName } = messageData;
    
    if (to === 'chef') {
      io.to('role-chef').emit('customer-message', {
        tableNumber,
        message,
        fromName,
        timestamp: new Date().toISOString()
      });
    } else if (to === 'customer') {
      io.to(`table-${tableNumber}`).emit('chef-message', {
        message,
        fromName: 'Chef',
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Disconnect
  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      console.log(`👋 ${user.role.toUpperCase()} disconnected: ${user.email}`);
      connectedUsers.delete(socket.id);
    }
  });
});

function getStatusMessage(status) {
  const messages = {
    'pending': 'Order received and waiting for chef',
    'preparing': 'Chef is preparing your order',
    'ready': 'Your order is ready for pickup!',
    'completed': 'Order completed. Thank you!',
    'rejected': 'Order cannot be processed'
  };
  return messages[status] || 'Order status updated';
}

function getServiceName(type) {
  const services = {
    'water': 'Water Refill',
    'cleaning': 'Table Cleaning',
    'bill': 'Bill Payment',
    'utensils': 'Extra Utensils'
  };
  return services[type] || 'Service';
}

// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.url} not found`,
    availableEndpoints: ['/', '/health', '/api/menu', '/api/auth/login', '/api/orders']
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 SMART WAITER SYSTEM - PRODUCTION SERVER');
  console.log('='.repeat(60));
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`📍 URL: ${process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`}`);
  console.log(`📍 MongoDB: ${MONGODB_URI.includes('mongodb+srv') ? 'Atlas' : 'Local'}`);
  console.log('='.repeat(60));
  console.log('\n✅ Server is running! Real-time features enabled.');
  console.log('='.repeat(60));
});
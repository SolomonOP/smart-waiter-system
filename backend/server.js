// Production-ready server.js for Render
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Production CORS configuration
const allowedOrigins = [
  'https://smart-waiter-frontend.onrender.com',
  'http://localhost:3000',
  'http://localhost:5500'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend')));
}

// MongoDB Atlas Connection
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
  console.log('⚠️  Using in-memory storage for demo');
});

// Socket.io for Real-time Communication
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// ==================== ROOT ROUTE ====================
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 Smart Waiter System API - Live on Render',
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    deployment: 'Render.com',
    realtime: 'Socket.io Active',
    endpoints: {
      api: '/api',
      health: '/health',
      demo: '/api/demo',
      menu: '/api/menu'
    },
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ==================== HEALTH CHECK ====================
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'smart-waiter-backend',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    memory: {
      used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
    }
  });
});

// ==================== API ROUTES ====================

// Demo accounts data
const demoAccounts = {
  'customer@demo.com': {
    password: '123456',
    user: {
      id: 1,
      firstName: 'John',
      lastName: 'Doe',
      email: 'customer@demo.com',
      role: 'customer',
      phone: '555-1234',
      tableNumber: 5
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

// Menu items
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
  }
];

// API: Get demo info
app.get('/api/demo', (req, res) => {
  res.json({
    success: true,
    message: 'Demo accounts available',
    accounts: Object.keys(demoAccounts).map(email => ({
      email,
      role: demoAccounts[email].user.role,
      password: '123456'
    })),
    frontendUrl: process.env.FRONTEND_URL || 'https://smart-waiter-frontend.onrender.com'
  });
});

// API: Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
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
      token: 'render_jwt_' + Date.now(),
      user: account.user
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid email or password'
    });
  }
});

// API: Get menu
app.get('/api/menu', (req, res) => {
  res.json({
    success: true,
    count: menuItems.length,
    menuItems
  });
});

// API: Place order
const orders = [];
app.post('/api/orders', (req, res) => {
  const { tableNumber, items, customerId } = req.body;
  
  const order = {
    id: 'ORD-' + Date.now(),
    tableNumber,
    items,
    customerId,
    status: 'pending',
    createdAt: new Date().toISOString(),
    total: items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  };
  
  orders.push(order);
  
  // Emit real-time event
  io.emit('new-order', order);
  
  res.status(201).json({
    success: true,
    message: 'Order placed successfully',
    order
  });
});

// API: Get orders
app.get('/api/orders', (req, res) => {
  res.json({
    success: true,
    count: orders.length,
    orders
  });
});

// ==================== SOCKET.IO REAL-TIME ====================

const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log(`🔌 New connection: ${socket.id} from ${socket.handshake.address}`);
  
  // Register user
  socket.on('register', (userData) => {
    connectedUsers.set(socket.id, userData);
    console.log(`👤 ${userData.role.toUpperCase()} connected: ${userData.email || 'Anonymous'}`);
    
    // Join role room
    socket.join(`role-${userData.role}`);
    
    // Join table room if customer
    if (userData.tableNumber) {
      socket.join(`table-${userData.tableNumber}`);
    }
    
    // Send welcome message
    socket.emit('welcome', {
      message: `Welcome ${userData.role}! Real-time connection established.`,
      serverTime: new Date().toISOString(),
      connectedUsers: connectedUsers.size
    });
  });
  
  // Place order (real-time)
  socket.on('place-order', (orderData) => {
    const order = {
      ...orderData,
      id: 'RT-' + Date.now(),
      status: 'pending',
      timestamp: new Date().toISOString()
    };
    
    // Store order
    orders.push(order);
    
    // Real-time notifications
    io.to('role-chef').emit('new-order-realtime', order);
    io.to('role-admin').emit('order-created', order);
    
    // Confirmation to customer
    socket.emit('order-confirmed', {
      ...order,
      message: 'Your order has been received!'
    });
    
    console.log(`📦 New order placed: ${order.id} for table ${order.tableNumber}`);
  });
  
  // Update order status
  socket.on('update-order-status', (data) => {
    const { orderId, status, chefName } = data;
    const order = orders.find(o => o.id === orderId);
    
    if (order) {
      order.status = status;
      order.updatedAt = new Date().toISOString();
      order.chefName = chefName;
      
      // Notify customer
      io.to(`table-${order.tableNumber}`).emit('order-status-updated', order);
      
      // Notify all chefs
      io.to('role-chef').emit('order-status-changed', order);
      
      // Notify admin
      io.to('role-admin').emit('order-updated', order);
      
      console.log(`🔄 Order ${orderId} status changed to: ${status}`);
    }
  });
  
  // Service requests
  socket.on('request-service', (serviceData) => {
    const request = {
      ...serviceData,
      id: 'SRV-' + Date.now(),
      timestamp: new Date().toISOString(),
      status: 'pending'
    };
    
    io.to('role-chef').emit('service-requested', request);
    io.to('role-admin').emit('service-log', request);
    
    socket.emit('service-acknowledged', {
      ...request,
      message: 'Service request sent to kitchen'
    });
    
    console.log(`🛎️  Service request: ${request.type} for table ${request.tableNumber}`);
  });
  
  // Real-time chat
  socket.on('send-message', (messageData) => {
    const { to, message, from, tableNumber } = messageData;
    
    if (to === 'chef') {
      io.to('role-chef').emit('customer-message', {
        from: from || 'Customer',
        tableNumber,
        message,
        timestamp: new Date().toISOString()
      });
    } else if (to === 'customer' && tableNumber) {
      io.to(`table-${tableNumber}`).emit('chef-message', {
        from: from || 'Chef',
        message,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Ping/Pong for connection monitoring
  socket.on('ping', (callback) => {
    if (typeof callback === 'function') {
      callback({
        serverTime: new Date().toISOString(),
        uptime: process.uptime()
      });
    }
  });
  
  // Disconnect
  socket.on('disconnect', () => {
    const userData = connectedUsers.get(socket.id);
    if (userData) {
      console.log(`👋 ${userData.role} disconnected: ${userData.email || socket.id}`);
      connectedUsers.delete(socket.id);
    }
  });
});

// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.url}`,
    suggestion: 'Try GET / for available endpoints'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 SMART WAITER SYSTEM - DEPLOYED ON RENDER');
  console.log('='.repeat(60));
  console.log(`📍 Port: ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📍 Database: ${MONGODB_URI.includes('mongodb+srv') ? 'MongoDB Atlas' : 'Local'}`);
  console.log(`📍 Frontend URL: ${process.env.FRONTEND_URL || 'Not set'}`);
  console.log('='.repeat(60));
  console.log('\n✅ Server is LIVE and ready for real-time connections!');
  console.log('='.repeat(60));
});
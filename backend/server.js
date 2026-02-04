const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();

// Import middleware
const securityMiddleware = require('./middleware/security');

// Import routes
const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customer');
const chefRoutes = require('./routes/chef');
const adminRoutes = require('./routes/admin');
const demoRoutes = require('./routes/demo');

const app = express();
const server = http.createServer(app);

// Security Middleware
securityMiddleware(app);

// Enhanced CORS Configuration
const allowedOrigins = [
  'https://smart-waiter-frontend.onrender.com',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://localhost:5173'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Spidy:Spidy%401129@cluster0.euzsakw.mongodb.net/smart_waiter?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  retryWrites: true,
  w: 'majority'
})
.then(() => {
  console.log('✅ MongoDB Atlas Connected Successfully');
  
  // Create indexes after connection
  mongoose.connection.db.collection('users').createIndex({ email: 1 }, { unique: true });
  mongoose.connection.db.collection('tables').createIndex({ tableNumber: 1 }, { unique: true });
  mongoose.connection.db.collection('orders').createIndex({ orderNumber: 1 }, { unique: true });
  
})
.catch(err => {
  console.error('❌ MongoDB Connection Error:', err.message);
  console.log('⚠️  Using demo mode with in-memory storage');
});

// Make io accessible to routes via app.set()
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

// Attach io to app
app.set('io', io);

// API Routes with proper middleware
app.use('/api/auth', authRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/chef', chefRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/demo', demoRoutes);

// Root Route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 Smart Waiter System API v2.0',
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    status: 'operational',
    endpoints: {
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register'
      },
      customer: 'GET /api/customer/menu | POST /api/customer/order',
      chef: 'GET /api/chef/orders',
      admin: 'GET /api/admin/stats',
      demo: 'GET /api/demo'
    },
    realtime: 'Socket.io Active',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Health Check
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const statusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  res.json({
    status: 'healthy',
    service: 'smart-waiter-backend',
    database: statusMap[dbStatus] || 'unknown',
    uptime: process.uptime(),
    memory: {
      used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
    },
    connections: io.engine.clientsCount || 0,
    timestamp: new Date().toISOString()
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

// Socket.io Real-time Communication
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log(`🔌 New Socket.io Connection: ${socket.id}`);
  
  // User registration
  socket.on('register-user', (userData) => {
    connectedUsers.set(socket.id, {
      ...userData,
      socketId: socket.id,
      connectedAt: new Date()
    });
    
    // Join role-specific rooms
    socket.join(`role:${userData.role}`);
    if (userData.tableNumber) {
      socket.join(`table:${userData.tableNumber}`);
    }
    if (userData.userId) {
      socket.join(`user:${userData.userId}`);
    }
    
    console.log(`👤 User Registered: ${userData.email || userData.role} (${socket.id})`);
    
    // Broadcast user count
    io.emit('users-count', { count: connectedUsers.size });
  });
  
  // Place new order
  socket.on('place-order', (orderData) => {
    console.log(`📦 New Order via Socket:`, orderData);
    
    // Broadcast to chefs
    io.to('role:chef').emit('new-order', {
      ...orderData,
      timestamp: new Date().toISOString(),
      socketId: socket.id
    });
    
    // Broadcast to admin
    io.to('role:admin').emit('order-placed', {
      ...orderData,
      timestamp: new Date().toISOString()
    });
    
    // Confirm to customer
    socket.emit('order-confirmed', {
      message: 'Order received and being processed',
      orderId: orderData.orderNumber,
      estimatedTime: '15-20 minutes'
    });
  });
  
  // Update order status
  socket.on('update-order-status', (data) => {
    const { orderId, status, chefName, tableNumber } = data;
    
    console.log(`🔄 Order Status Update: ${orderId} -> ${status}`);
    
    // Notify specific table
    if (tableNumber) {
      io.to(`table:${tableNumber}`).emit('order-status-changed', {
        orderId,
        status,
        chefName,
        timestamp: new Date().toISOString(),
        message: `Your order is now ${status}`
      });
    }
    
    // Notify all chefs and admin
    io.to('role:chef').emit('order-updated', data);
    io.to('role:admin').emit('order-status-update', data);
  });
  
  // Service requests
  socket.on('request-service', (requestData) => {
    console.log(`🛎️  Service Request:`, requestData);
    
    // Notify chefs and admin
    io.to('role:chef').emit('service-request', {
      ...requestData,
      timestamp: new Date().toISOString(),
      requestId: `SRV-${Date.now()}`
    });
    
    io.to('role:admin').emit('service-log', requestData);
    
    // Confirm to customer
    socket.emit('service-acknowledged', {
      message: 'Service request received',
      type: requestData.type,
      estimatedResponse: '5 minutes'
    });
  });
  
  // Real-time chat
  socket.on('send-message', (messageData) => {
    const { to, message, from, tableNumber, type } = messageData;
    
    const messageObj = {
      from,
      message,
      timestamp: new Date().toISOString(),
      type: type || 'chat'
    };
    
    if (to === 'chef') {
      io.to('role:chef').emit('customer-message', {
        ...messageObj,
        tableNumber
      });
    } else if (to === 'admin') {
      io.to('role:admin').emit('customer-message', messageObj);
    } else if (to === 'customer' && tableNumber) {
      io.to(`table:${tableNumber}`).emit('staff-message', messageObj);
    }
  });
  
  // Disconnect
  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      console.log(`👋 User Disconnected: ${user.email || user.role} (${socket.id})`);
      connectedUsers.delete(socket.id);
      
      // Update user count
      io.emit('users-count', { count: connectedUsers.size });
    }
  });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.stack);
  
  const statusCode = err.status || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    success: false,
    message: message,
    error: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    timestamp: new Date().toISOString()
  });
});

// 404 Handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`,
    availableEndpoints: [
      'GET /',
      'GET /health',
      'POST /api/auth/login',
      'POST /api/auth/register',
      'GET /api/customer/menu'
    ]
  });
});

// Start Server
const PORT = process.env.PORT || 10000;

server.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(70));
  console.log('🚀 SMART WAITER SYSTEM BACKEND - DEPLOYED ON RENDER');
  console.log('='.repeat(70));
  console.log(`📍 Server URL: https://smart-waiter.onrender.com`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📍 Frontend URL: ${process.env.FRONTEND_URL || 'Not configured'}`);
  console.log(`📍 Database: ${MONGODB_URI.includes('mongodb+srv') ? 'MongoDB Atlas' : 'Local'}`);
  console.log('='.repeat(70));
  console.log('✅ Server is LIVE and ready for connections!');
  console.log('✅ Socket.io Real-time Service: ACTIVE');
  console.log('✅ API Documentation: https://smart-waiter.onrender.com');
  console.log('='.repeat(70));
});
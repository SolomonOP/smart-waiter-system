const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ['https://smart-waiter-frontend.onrender.com', 'http://localhost:3000'],
    credentials: true
  }
});

// Store io instance for use in routes
app.set('io', io);

// Enhanced CORS configuration
app.use(cors({
  origin: ['https://smart-waiter-frontend.onrender.com', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple request logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Spidy:Spidy%401129@cluster0.euzsakw.mongodb.net/smart_waiter?retryWrites=true&w=majority';

console.log('🔗 Connecting to MongoDB...');

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
})
.then(() => {
  console.log('✅ MongoDB Connected Successfully');
})
.catch(err => {
  console.error('❌ MongoDB Connection Failed:', err.message);
  console.log('⚠️  Running in demo mode with in-memory storage');
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);

  // Join role-based rooms
  socket.on('join-role', (role) => {
    socket.join(`role:${role}`);
    console.log(`👤 Socket ${socket.id} joined role: ${role}`);
  });

  // Join table-specific room
  socket.on('join-table', (tableNumber) => {
    socket.join(`table:${tableNumber}`);
    console.log(`🪑 Socket ${socket.id} joined table: ${tableNumber}`);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// Import models
const models = require('./models');

// Import middleware
const auth = require('./middleware/auth');

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const chefRoutes = require('./routes/chef');
const customerRoutes = require('./routes/customer');
const demoRoutes = require('./routes/demo');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', auth, adminRoutes);
app.use('/api/chef', auth, chefRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/demo', demoRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 Smart Waiter API v2.0',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        profile: 'GET /api/auth/me (auth required)'
      },
      customer: {
        menu: 'GET /api/customer/menu',
        placeOrder: 'POST /api/customer/order (auth required)'
      },
      demo: 'GET /api/demo'
    },
    status: {
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      websocket: io.engine.clientsCount,
      uptime: process.uptime()
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      websocket: 'running',
      api: 'running'
    },
    system: {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      node: process.version
    }
  };
  
  res.json(health);
});

// Test Socket.io endpoint
app.get('/api/socket-test', (req, res) => {
  io.emit('test', { message: 'Test broadcast', timestamp: new Date() });
  res.json({ success: true, message: 'Test message sent to all connected clients' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  
  res.status(statusCode).json({
    success: false,
    message: message,
    error: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
});

const PORT = process.env.PORT || 10000;

server.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(60));
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 MongoDB: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Demo Mode'}`);
  console.log(`🔌 WebSocket: Ready (${io.engine.clientsCount} connections)`);
  console.log('='.repeat(60));
  console.log('✅ API Endpoints:');
  console.log(`   http://localhost:${PORT}/`);
  console.log(`   http://localhost:${PORT}/health`);
  console.log(`   http://localhost:${PORT}/api/auth/login`);
  console.log('='.repeat(60));
});
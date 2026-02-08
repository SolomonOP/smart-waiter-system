const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

// Import middleware
const securityMiddleware = require('./middleware/security');

const app = express();
const server = http.createServer(app);

// In your app.js or server.js, add:
const chefRoutes = require('./routes/chef');
app.use('/api/chef', chefRoutes);

// Make sure JWT secret is available
if (!process.env.JWT_SECRET) {
    console.warn('⚠️  JWT_SECRET not found in environment variables, using default');
    process.env.JWT_SECRET = '3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855a3d9f7c9';
}

// Enhanced CORS configuration
const allowedOrigins = [
  'https://smart-waiter-frontend.onrender.com',
  'http://localhost:3000',
  'https://smart-waiter-backend.onrender.com'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Apply security middleware
securityMiddleware(app);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Simple request logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${req.ip} - ${new Date().toISOString()}`);
  next();
});

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Spidy:Spidy%401129@cluster0.euzsakw.mongodb.net/smart_waiter?retryWrites=true&w=majority';

console.log('🔗 Connecting to MongoDB...');

// Global variable to track DB connection
let isDatabaseConnected = false;

const connectDB = async () => {
  try {
    console.log('🔗 Attempting MongoDB connection...');
    console.log('📊 Using URI:', MONGODB_URI.replace(/:[^:]*@/, ':****@'));
    
    const conn = await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      retryWrites: true,
      w: 'majority'
    });
    
    isDatabaseConnected = true;
    console.log('✅ MongoDB Connected Successfully');
    console.log('📊 Host:', conn.connection.host);
    console.log('📊 Database:', conn.connection.name);
    console.log('📊 Ready State:', conn.connection.readyState);
    
    return conn;
  } catch (err) {
    console.error('❌ MongoDB Connection Failed:', err.message);
    console.error('🔧 Error details:', {
      name: err.name,
      code: err.code,
      codeName: err.codeName
    });
    console.log('🔄 Retrying connection in 5 seconds...');
    setTimeout(connectDB, 5000);
    throw err; // Re-throw to handle in the main flow
  }
};

// Database connection middleware
const checkDatabase = (req, res, next) => {
  if (!isDatabaseConnected || mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: 'Database is not ready. Please try again in a moment.',
      databaseStatus: mongoose.connection.readyState,
      connected: isDatabaseConnected
    });
  }
  next();
};

// Apply database check to all API routes except health check
app.use('/api', checkDatabase);
app.use('/health', (req, res, next) => next()); // Skip for health check

// Initialize Socket.io with proper configuration
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Store io instance for use in routes
app.set('io', io);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);

  // Join role-based rooms
  socket.on('register', (data) => {
    if (data.role) {
      socket.join(`role:${data.role}`);
      console.log(`👤 Socket ${socket.id} registered as ${data.role}`);
    }
    if (data.userId) {
      socket.join(`user:${data.userId}`);
    }
  });

  // Join table-specific room
  socket.on('join-table', (tableNumber) => {
    socket.join(`table:${tableNumber}`);
    console.log(`🪑 Socket ${socket.id} joined table: ${tableNumber}`);
  });

  // Handle custom events from frontend
  socket.on('new-order', (data) => {
    console.log('📦 New order via socket:', data);
    io.to('role:chef').to('role:admin').emit('new-order', data);
  });

  socket.on('order-status-change', (data) => {
    console.log('🔄 Order status change via socket:', data);
    io.to(`table:${data.tableNumber}`).emit('order-status-change', data);
    io.to('role:admin').emit('order-status-update', data);
  });

  socket.on('service-request', (data) => {
    console.log('🛎️ Service request via socket:', data);
    io.to('role:chef').to('role:admin').emit('new-service-request', data);
  });

  // Ping-pong for connection health
  socket.on('ping', (data, callback) => {
    callback({ pong: Date.now(), data });
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Client disconnected:', socket.id, 'Reason:', reason);
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const chefRoutes = require('./routes/chef');
const customerRoutes = require('./routes/customer');
const demoRoutes = require('./routes/demo');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chef', chefRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/demo', demoRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 Smart Waiter API v2.0',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        verify: 'GET /api/auth/verify',
        me: 'GET /api/auth/me'
      },
      customer: {
        menu: 'GET /api/customer/menu',
        order: 'POST /api/customer/order',
        orders: 'GET /api/customer/orders',
        serviceRequest: 'POST /api/customer/service-request'
      },
      chef: {
        orders: 'GET /api/chef/orders',
        menu: 'GET /api/chef/menu',
        serviceRequests: 'GET /api/chef/service-requests'
      },
      admin: {
        stats: 'GET /api/admin/stats',
        orders: 'GET /api/admin/orders',
        menu: 'GET /api/admin/menu',
        tables: 'GET /api/admin/tables',
        staff: 'GET /api/admin/staff',
        sales: 'GET /api/admin/sales'
      },
      demo: 'GET /api/demo'
    },
    status: {
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      websocket: io.engine.clientsCount,
      uptime: process.uptime(),
      memory: {
        rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`
      }
    }
  });
});

// Health check endpoint (for Render)
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbStatusText = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  }[dbStatus] || 'unknown';
  
  const health = {
    status: dbStatus === 1 ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: {
        status: dbStatusText,
        readyState: dbStatus,
        host: mongoose.connection.host,
        name: mongoose.connection.name
      },
      websocket: 'running',
      api: 'running'
    },
    system: {
      node: process.version,
      platform: process.platform,
      uptime: Math.floor(process.uptime()),
      memory: {
        rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`
      }
    },
    connections: {
      websocket: io.engine.clientsCount,
      database: mongoose.connection.readyState === 1 ? 'ok' : 'error'
    },
    isDatabaseConnected
  };
  
  res.json(health);
});

// Socket test endpoint
app.get('/api/socket-test', (req, res) => {
  const testData = {
    message: 'Test broadcast from server',
    timestamp: new Date().toISOString(),
    clients: io.engine.clientsCount
  };
  
  io.emit('system-message', testData);
  res.json({ 
    success: true, 
    message: 'Test message sent to all connected clients',
    data: testData
  });
});

// Verify token endpoint
app.get('/api/auth/verify', async (req, res) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // For demo accounts
    if (token.includes('demo_')) {
      return res.json({
        success: true,
        message: 'Demo token valid',
        user: {
          isDemo: true,
          role: token.split('_')[2]
        }
      });
    }
    
    // For JWT tokens, you'd verify here
    // This is a placeholder - in production, use jwt.verify
    return res.json({
      success: true,
      message: 'Token is valid',
      valid: true
    });
    
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl,
    availableEndpoints: ['/api/auth/*', '/api/customer/*', '/api/chef/*', '/api/admin/*', '/health']
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.stack || err);
  
  const statusCode = err.status || 500;
  const message = err.message || 'Internal server error';
  
  const response = {
    success: false,
    message: message,
    error: process.env.NODE_ENV === 'production' ? undefined : {
      name: err.name,
      message: err.message,
      stack: err.stack
    }
  };
  
  // If it's a validation error
  if (err.name === 'ValidationError') {
    response.errors = Object.values(err.errors).map(e => e.message);
  }
  
  // If it's a duplicate key error
  if (err.code === 11000) {
    response.message = 'Duplicate entry found';
    const field = Object.keys(err.keyPattern)[0];
    response.field = field;
  }
  
  res.status(statusCode).json(response);
});

const PORT = process.env.PORT || 10000;

// Start server only after database connection
const startServer = async () => {
  try {
    console.log('🔄 Starting server initialization...');
    
    // Connect to database first
    await connectDB();
    
    // Now start the server
    server.listen(PORT, '0.0.0.0', () => {
      console.log('='.repeat(60));
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 MongoDB State: ${mongoose.connection.readyState === 1 ? 'Connected ✅' : 'Disconnected ❌'}`);
      console.log(`🔌 WebSocket: Ready`);
      console.log(`🌐 CORS Allowed Origins: ${allowedOrigins.join(', ')}`);
      console.log('='.repeat(60));
      console.log('✅ API Endpoints:');
      console.log(`   Health: http://localhost:${PORT}/health`);
      console.log(`   Main: http://localhost:${PORT}/`);
      console.log(`   Auth: http://localhost:${PORT}/api/auth/login`);
      console.log(`   Demo: http://localhost:${PORT}/api/demo`);
      console.log('='.repeat(60));
    });
    
  } catch (error) {
    console.error('💥 Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Starting graceful shutdown...');
  server.close(() => {
    console.log('HTTP server closed.');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed.');
      process.exit(0);
    });
  });
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Add this to your backend in a test route
// In your backend app.js or server.js

app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'Backend is working',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

app.post('/api/test/login', (req, res) => {
    console.log('Test login attempt:', req.body);
    res.json({
        success: true,
        message: 'Login endpoint is reachable',
        data: req.body
    });
});
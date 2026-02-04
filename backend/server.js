const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Basic CORS
app.use(cors({
  origin: ['https://smart-waiter-frontend.onrender.com', 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection with fallback
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Spidy:Spidy%401129@cluster0.euzsakw.mongodb.net/smart_waiter?retryWrites=true&w=majority';

console.log('🔗 Attempting MongoDB connection...');

// Connect with timeout
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => {
  console.log('✅ MongoDB Connected Successfully');
})
.catch(err => {
  console.error('❌ MongoDB Connection Failed:', err.message);
  console.log('⚠️  Running in demo mode without database');
});

// Simple in-memory storage for demo
let demoUsers = [
  {
    id: 1,
    email: 'admin@demo.com',
    password: '123456',
    firstName: 'Admin',
    lastName: 'User',
    phone: '1234567890',
    role: 'admin'
  },
  {
    id: 2,
    email: 'chef@demo.com',
    password: '123456',
    firstName: 'Master',
    lastName: 'Chef',
    phone: '0987654321',
    role: 'chef'
  },
  {
    id: 3,
    email: 'customer@demo.com',
    password: '123456',
    firstName: 'John',
    lastName: 'Doe',
    phone: '5551234567',
    role: 'customer'
  }
];

let demoMenu = [
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
    category: 'salad',
    image: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    available: true
  },
  {
    id: 3,
    name: 'Chocolate Cake',
    description: 'Rich chocolate cake with ganache frosting',
    price: 7.99,
    category: 'dessert',
    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    available: true
  }
];

let orders = [];

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 Smart Waiter API is running!',
    version: '1.0.0',
    endpoints: {
      login: 'POST /api/login',
      register: 'POST /api/register',
      menu: 'GET /api/menu',
      demoAccounts: 'GET /api/demo-accounts'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Login endpoint
app.post('/api/login', (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
    
    const user = demoUsers.find(u => u.email === email && u.password === password);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      message: 'Login successful',
      token: `demo_token_${Date.now()}`,
      user: userWithoutPassword
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Register endpoint
app.post('/api/register', (req, res) => {
  try {
    const { firstName, lastName, email, password, phone } = req.body;
    
    // Basic validation
    if (!firstName || !lastName || !email || !password || !phone) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }
    
    // Check if email already exists
    const existingUser = demoUsers.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }
    
    // Create new user
    const newUser = {
      id: demoUsers.length + 1,
      firstName,
      lastName,
      email,
      password,
      phone,
      role: 'customer',
      createdAt: new Date().toISOString()
    };
    
    demoUsers.push(newUser);
    
    // Remove password from response
    const { password: _, ...userResponse } = newUser;
    
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token: `reg_token_${Date.now()}`,
      user: userResponse
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get menu
app.get('/api/menu', (req, res) => {
  res.json({
    success: true,
    count: demoMenu.length,
    menu: demoMenu
  });
});

// Get demo accounts
app.get('/api/demo-accounts', (req, res) => {
  const accounts = demoUsers.filter(u => u.email.includes('@demo.com'))
    .map(({ password, ...user }) => ({
      ...user,
      password: '123456' // Show password for demo
    }));
  
  res.json({
    success: true,
    accounts
  });
});

// Place order
app.post('/api/orders', (req, res) => {
  try {
    const { tableNumber, items, customerEmail } = req.body;
    
    if (!tableNumber || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Table number and items are required'
      });
    }
    
    const order = {
      id: `ORD-${Date.now()}`,
      orderNumber: `ORD${String(orders.length + 1).padStart(6, '0')}`,
      tableNumber,
      items,
      customerEmail: customerEmail || 'guest@example.com',
      status: 'pending',
      total: items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0),
      createdAt: new Date().toISOString()
    };
    
    orders.push(order);
    
    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order
    });
    
  } catch (error) {
    console.error('Order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get orders
app.get('/api/orders', (req, res) => {
  res.json({
    success: true,
    count: orders.length,
    orders
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
});

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 MongoDB: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Demo Mode'}`);
  console.log('='.repeat(60));
  console.log('✅ API is ready to accept requests!');
  console.log('='.repeat(60));
});
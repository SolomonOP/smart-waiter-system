const express = require('express');
const router = express.Router();

// Demo menu items
const demoMenu = [
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

// Demo endpoints
router.get('/menu', (req, res) => {
  res.json({
    success: true,
    count: demoMenu.length,
    menuItems: demoMenu
  });
});

router.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  const demoAccounts = {
    'customer@demo.com': { password: '123456', role: 'customer', name: 'John Doe' },
    'chef@demo.com': { password: '123456', role: 'chef', name: 'Master Chef' },
    'admin@demo.com': { password: '123456', role: 'admin', name: 'Admin User' }
  };
  
  const account = demoAccounts[email];
  
  if (account && account.password === password) {
    res.json({
      success: true,
      message: 'Login successful',
      token: 'demo_token_' + Date.now(),
      user: {
        email,
        name: account.name,
        role: account.role
      }
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
});

router.post('/orders', (req, res) => {
  const { tableNumber, items } = req.body;
  
  const order = {
    orderId: 'ORD-' + Date.now(),
    tableNumber,
    items,
    total: items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
    status: 'pending',
    timestamp: new Date().toISOString()
  };
  
  res.json({
    success: true,
    message: 'Order placed successfully',
    order
  });
});

module.exports = router;
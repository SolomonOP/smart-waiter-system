const express = require('express');
const router = express.Router();

// Demo data
const demoMenu = [
    {
        id: 1,
        name: 'Classic Burger',
        description: 'Juicy beef patty with lettuce, tomato, pickles, and special sauce in a sesame seed bun',
        price: 12.99,
        originalPrice: 14.99,
        category: 'main',
        subCategory: 'burgers',
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
        available: true,
        popular: true,
        vegetarian: false,
        vegan: false,
        glutenFree: false,
        preparationTime: 15,
        ingredients: ['Beef patty', 'Lettuce', 'Tomato', 'Pickles', 'Special sauce', 'Sesame bun'],
        allergens: ['Gluten', 'Dairy'],
        orderCount: 156,
        rating: 4.5,
        reviewCount: 89
    },
    {
        id: 2,
        name: 'Caesar Salad',
        description: 'Fresh romaine lettuce with Caesar dressing, croutons, and parmesan cheese',
        price: 9.99,
        category: 'salad',
        subCategory: 'salads',
        image: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
        available: true,
        popular: true,
        vegetarian: true,
        vegan: false,
        glutenFree: false,
        preparationTime: 10,
        ingredients: ['Romaine lettuce', 'Caesar dressing', 'Croutons', 'Parmesan cheese'],
        allergens: ['Gluten', 'Dairy'],
        orderCount: 124,
        rating: 4.3,
        reviewCount: 67
    },
    {
        id: 3,
        name: 'Chocolate Lava Cake',
        description: 'Warm chocolate cake with a molten chocolate center, served with vanilla ice cream',
        price: 7.99,
        category: 'dessert',
        subCategory: 'cakes',
        image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
        available: true,
        popular: true,
        vegetarian: true,
        vegan: false,
        glutenFree: false,
        preparationTime: 12,
        ingredients: ['Chocolate', 'Flour', 'Eggs', 'Butter', 'Sugar', 'Vanilla ice cream'],
        allergens: ['Gluten', 'Dairy', 'Eggs'],
        orderCount: 98,
        rating: 4.7,
        reviewCount: 45
    }
];

const demoTables = [
    {
        id: 1,
        tableNumber: 1,
        tableName: 'Window View',
        status: 'available',
        capacity: 4,
        location: 'indoor',
        section: 'Main Hall',
        qrCode: 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://smart-waiter.onrender.com/table/1'
    },
    {
        id: 2,
        tableNumber: 2,
        tableName: 'Corner Table',
        status: 'occupied',
        capacity: 6,
        location: 'indoor',
        section: 'Main Hall',
        qrCode: 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://smart-waiter.onrender.com/table/2',
        customerName: 'John Doe',
        occupiedAt: '2024-01-15T18:30:00Z'
    },
    {
        id: 3,
        tableNumber: 3,
        tableName: 'Garden View',
        status: 'available',
        capacity: 2,
        location: 'outdoor',
        section: 'Garden',
        qrCode: 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://smart-waiter.onrender.com/table/3'
    }
];

const demoOrders = [
    {
        id: 1,
        orderNumber: 'ORD240115001',
        tableNumber: 2,
        customerName: 'John Doe',
        customerEmail: 'customer@demo.com',
        items: [
            { name: 'Classic Burger', price: 12.99, quantity: 2 },
            { name: 'Caesar Salad', price: 9.99, quantity: 1 },
            { name: 'Coca Cola', price: 2.99, quantity: 3 }
        ],
        subtotal: 41.95,
        tax: 4.20,
        serviceCharge: 2.10,
        totalAmount: 48.25,
        status: 'preparing',
        paymentMethod: 'card',
        paymentStatus: 'paid',
        assignedChef: 'chef@demo.com',
        chefName: 'Master Chef',
        estimatedPrepTime: 20,
        createdAt: '2024-01-15T18:30:00Z',
        updatedAt: '2024-01-15T18:32:00Z'
    },
    {
        id: 2,
        orderNumber: 'ORD240115002',
        tableNumber: 5,
        customerName: 'Jane Smith',
        customerEmail: 'jane@example.com',
        items: [
            { name: 'Chocolate Lava Cake', price: 7.99, quantity: 2 },
            { name: 'Coffee', price: 3.99, quantity: 2 }
        ],
        subtotal: 23.96,
        tax: 2.40,
        serviceCharge: 1.20,
        totalAmount: 27.56,
        status: 'ready',
        paymentMethod: 'cash',
        paymentStatus: 'pending',
        assignedChef: 'chef@demo.com',
        chefName: 'Master Chef',
        estimatedPrepTime: 15,
        createdAt: '2024-01-15T18:45:00Z',
        updatedAt: '2024-01-15T18:55:00Z'
    }
];

// Demo accounts information
const demoAccounts = [
    {
        email: 'admin@demo.com',
        password: '123456',
        firstName: 'Admin',
        lastName: 'User',
        phone: '1234567890',
        role: 'admin',
        description: 'Full system access - manage everything'
    },
    {
        email: 'chef@demo.com',
        password: '123456',
        firstName: 'Master',
        lastName: 'Chef',
        phone: '0987654321',
        role: 'chef',
        description: 'Kitchen dashboard - manage orders and menu'
    },
    {
        email: 'customer@demo.com',
        password: '123456',
        firstName: 'John',
        lastName: 'Doe',
        phone: '5551234567',
        role: 'customer',
        description: 'Customer app - browse menu and place orders'
    }
];

// @route   GET /api/demo
// @desc    Get demo information
// @access  Public
router.get('/', (req, res) => {
    res.json({
        success: true,
        message: '🚀 Smart Waiter System - Demo API',
        version: '2.0.0',
        description: 'This is a demo endpoint showing sample data structure',
        note: 'For production, use the actual endpoints with authentication',
        endpoints: {
            menu: 'GET /api/customer/menu',
            login: 'POST /api/auth/login',
            register: 'POST /api/auth/register',
            orders: 'GET /api/customer/orders (requires auth)',
            admin: 'GET /api/admin/stats (requires admin auth)',
            chef: 'GET /api/chef/orders (requires chef auth)'
        },
        demoAccounts: demoAccounts.map(acc => ({
            email: acc.email,
            password: acc.password,
            role: acc.role,
            description: acc.description
        })),
        sampleData: {
            menuItems: demoMenu.length,
            tables: demoTables.length,
            orders: demoOrders.length
        },
        quickStart: [
            '1. Use demo accounts above to login',
            '2. Customer: Browse menu and place orders',
            '3. Chef: View and manage orders',
            '4. Admin: View analytics and manage system'
        ]
    });
});

// @route   GET /api/demo/menu
// @desc    Get demo menu items
// @access  Public
router.get('/menu', (req, res) => {
    res.json({
        success: true,
        message: 'Demo menu items',
        count: demoMenu.length,
        menuItems: demoMenu,
        note: 'In production, use GET /api/customer/menu'
    });
});

// @route   GET /api/demo/tables
// @desc    Get demo tables
// @access  Public
router.get('/tables', (req, res) => {
    res.json({
        success: true,
        message: 'Demo tables',
        count: demoTables.length,
        tables: demoTables,
        note: 'In production, use GET /api/admin/tables (admin only)'
    });
});

// @route   GET /api/demo/orders
// @desc    Get demo orders
// @access  Public
router.get('/orders', (req, res) => {
    res.json({
        success: true,
        message: 'Demo orders',
        count: demoOrders.length,
        orders: demoOrders,
        note: 'In production, use role-specific endpoints with authentication'
    });
});

// @route   GET /api/demo/accounts
// @desc    Get demo accounts information
// @access  Public
router.get('/accounts', (req, res) => {
    res.json({
        success: true,
        message: 'Demo accounts for testing',
        accounts: demoAccounts,
        instructions: 'Use these credentials to login to different roles'
    });
});

// @route   POST /api/demo/login
// @desc    Demo login (for testing without database)
// @access  Public
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Email and password are required'
        });
    }
    
    const account = demoAccounts.find(acc => acc.email === email && acc.password === password);
    
    if (!account) {
        return res.status(401).json({
            success: false,
            message: 'Invalid credentials'
        });
    }
    
    // Create a simple demo token
    const demoToken = `demo_${Date.now()}_${account.role}`;
    
    res.json({
        success: true,
        message: 'Demo login successful',
        token: demoToken,
        user: {
            id: account.email,
            firstName: account.firstName,
            lastName: account.lastName,
            email: account.email,
            phone: account.phone,
            role: account.role,
            isDemo: true
        },
        note: 'This is a demo token. In production, use JWT authentication.'
    });
});

// @route   POST /api/demo/order
// @desc    Place demo order (for testing)
// @access  Public
router.post('/order', (req, res) => {
    const { tableNumber, items, customerEmail } = req.body;
    
    if (!tableNumber || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Table number and items are required'
        });
    }
    
    const orderNumber = `DEMO${Date.now().toString().slice(-6)}`;
    const subtotal = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
    const tax = subtotal * 0.1;
    const serviceCharge = subtotal * 0.05;
    const totalAmount = subtotal + tax + serviceCharge;
    
    const order = {
        id: Date.now(),
        orderNumber,
        tableNumber: parseInt(tableNumber),
        customerName: customerEmail ? customerEmail.split('@')[0] : 'Demo Customer',
        customerEmail: customerEmail || 'demo@example.com',
        items,
        subtotal: parseFloat(subtotal.toFixed(2)),
        tax: parseFloat(tax.toFixed(2)),
        serviceCharge: parseFloat(serviceCharge.toFixed(2)),
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        status: 'pending',
        paymentMethod: 'demo',
        paymentStatus: 'pending',
        estimatedPrepTime: 20,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    res.status(201).json({
        success: true,
        message: 'Demo order placed successfully',
        order,
        note: 'This is a demo order. In production, use POST /api/customer/order with authentication.'
    });
});

// @route   GET /api/demo/system-status
// @desc    Get demo system status
// @access  Public
router.get('/system-status', (req, res) => {
    const now = new Date();
    
    res.json({
        success: true,
        message: 'Demo System Status',
        status: 'online',
        timestamp: now.toISOString(),
        uptime: Math.floor(process.uptime()),
        components: {
            api: { status: 'online', responseTime: '50ms' },
            database: { status: 'demo_mode', note: 'Using demo data' },
            realtime: { status: 'available', connections: 0 },
            authentication: { status: 'demo_mode', note: 'Using demo accounts' }
        },
        metrics: {
            activeUsers: 0,
            activeOrders: demoOrders.filter(o => ['pending', 'preparing'].includes(o.status)).length,
            availableTables: demoTables.filter(t => t.status === 'available').length,
            menuItemsAvailable: demoMenu.filter(m => m.available).length
        },
        nextSteps: [
            '1. Deploy to Render with MongoDB',
            '2. Configure environment variables',
            '3. Set up email service',
            '4. Configure payment gateway'
        ]
    });
});

module.exports = router;
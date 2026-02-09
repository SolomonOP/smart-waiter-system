const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { MenuItem, Order, Table, User } = require('../models');

// @route   GET /api/customer/menu
// @desc    Get available menu items
// @access  Public
router.get('/menu', async (req, res) => {
    try {
        const { category, available = true } = req.query;
        
        // Build query
        let query = {};
        
        if (available === 'true' || available === true) {
            query.available = true;
        }
        
        if (category) {
            query.category = category;
        }
        
        const menuItems = await MenuItem.find(query)
            .sort({ category: 1, name: 1 })
            .limit(100);
        
        // Also send grouped by category for frontend
        const groupedMenu = {};
        menuItems.forEach(item => {
            if (!groupedMenu[item.category]) {
                groupedMenu[item.category] = [];
            }
            groupedMenu[item.category].push(item);
        });
        
        res.json({
            success: true,
            count: menuItems.length,
            menuItems: menuItems,
            groupedMenu: groupedMenu,
            message: `Found ${menuItems.length} menu items`
        });
        
    } catch (error) {
        console.error('Get menu error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error loading menu',
            error: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});

// @route   GET /api/customer/menu/:id
// @desc    Get single menu item
// @access  Public
router.get('/menu/:id', async (req, res) => {
    try {
        const menuItem = await MenuItem.findById(req.params.id);
        
        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: 'Menu item not found'
            });
        }
        
        res.json({
            success: true,
            menuItem
        });
        
    } catch (error) {
        console.error('Get menu item error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   POST /api/customer/order
// @desc    Place a new order
// @access  Private
router.post('/order', auth, [
    check('tableNumber', 'Table number is required').isInt({ min: 1 }),
    check('items', 'Items are required').isArray({ min: 1 }),
    check('items.*.menuItem', 'Menu item ID is required').not().isEmpty(),
    check('items.*.quantity', 'Quantity must be at least 1').isInt({ min: 1 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }
        
        const { tableNumber, items, specialInstructions, paymentMethod } = req.body;
        
        console.log('Order received for table:', tableNumber);
        console.log('Items:', items);
        
        // Get user info
        let customerEmail, customerName;
        
        // Simple user handling - remove demo checks
        if (req.user && req.user.email) {
            customerEmail = req.user.email;
            customerName = req.user.firstName + ' ' + req.user.lastName;
        } else {
            // Fallback for demo or testing
            customerEmail = 'customer@example.com';
            customerName = 'Customer';
        }
        
        // Check table exists and is active
        const table = await Table.findOne({ tableNumber: parseInt(tableNumber) });
        if (!table) {
            return res.status(400).json({
                success: false,
                message: `Table ${tableNumber} not found`
            });
        }
        
        if (!table.isActive) {
            return res.status(400).json({
                success: false,
                message: `Table ${tableNumber} is not active`
            });
        }
        
        // Get menu items and validate
        const orderItems = [];
        let totalAmount = 0;
        
        for (const item of items) {
            const menuItem = await MenuItem.findById(item.menuItem);
            
            if (!menuItem) {
                return res.status(400).json({
                    success: false,
                    message: `Menu item ${item.menuItem} not found`
                });
            }
            
            if (!menuItem.available) {
                return res.status(400).json({
                    success: false,
                    message: `${menuItem.name} is currently unavailable`
                });
            }
            
            const itemTotal = menuItem.price * item.quantity;
            totalAmount += itemTotal;
            
            orderItems.push({
                menuItem: menuItem._id,
                name: menuItem.name,
                price: menuItem.price,
                quantity: item.quantity,
                specialInstructions: item.specialInstructions || '',
                itemTotal
            });
        }
        
        // Create order
        const order = new Order({
            tableNumber: parseInt(tableNumber),
            customer: req.userId,
            customerName,
            customerEmail,
            items: orderItems,
            subtotal: totalAmount,
            totalAmount,
            paymentMethod: paymentMethod || 'pending',
            specialInstructions,
            estimatedPrepTime: 15 // Default 15 minutes
        });
        
        await order.save();
        
        // Update table status
        table.status = 'occupied';
        table.currentOrder = order._id;
        table.currentCustomer = req.userId;
        table.customerName = customerName;
        table.occupiedAt = new Date();
        await table.save();
        
        // Real-time notification
        const io = req.app.get('io');
        if (io) {
            io.to('role:chef').emit('new-order', {
                orderId: order._id,
                orderNumber: order.orderNumber,
                tableNumber: order.tableNumber,
                items: order.items,
                customerName: order.customerName,
                estimatedPrepTime: order.estimatedPrepTime,
                timestamp: new Date().toISOString()
            });
        }
        
        res.status(201).json({
            success: true,
            message: 'Order placed successfully!',
            order: {
                id: order._id,
                orderNumber: order.orderNumber,
                tableNumber: order.tableNumber,
                items: order.items,
                totalAmount: order.totalAmount,
                status: order.status,
                estimatedPrepTime: order.estimatedPrepTime,
                createdAt: order.createdAt
            }
        });
        
    } catch (error) {
        console.error('Place order error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Server error while placing order',
            error: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});

// Generate table buttons
function generateTableButtons() {
    const tableButtonsContainer = document.getElementById('tableButtons');
    if (!tableButtonsContainer) return;
    
    tableButtonsContainer.innerHTML = '';
    
    // Show status indicators
    const statusHtml = `
        <div class="d-flex justify-content-center mb-3">
            <div class="me-3">
                <span class="badge bg-success me-1">●</span> Available
            </div>
            <div class="me-3">
                <span class="badge bg-warning me-1">●</span> Occupied
            </div>
            <div>
                <span class="badge bg-secondary me-1">●</span> Reserved
            </div>
        </div>
    `;
    tableButtonsContainer.innerHTML = statusHtml;
    
    // Sort tables numerically
    const sortedTables = [...activeTables].sort((a, b) => a - b);
    
    sortedTables.forEach(tableNum => {
        // Create button with status indicator
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `btn btn-outline-primary table-btn ${tableNum === currentTable ? 'active' : ''}`;
        button.textContent = tableNum;
        button.onclick = () => selectTable(tableNum);
        tableButtonsContainer.appendChild(button);
    });
    
    // Add note
    const note = document.createElement('div');
    note.className = 'mt-3 text-muted small';
    note.textContent = 'Click on your table number. You can order from occupied tables too.';
    tableButtonsContainer.appendChild(note);
    
    // Update table input
    const tableInput = document.getElementById('tableNumber');
    if (tableInput) {
        tableInput.value = currentTable;
    }
    
    // Update cart table number
    const cartTableNumber = document.getElementById('cartTableNumber');
    if (cartTableNumber) {
        cartTableNumber.textContent = currentTable;
    }
}

// @route   GET /api/customer/orders
// @desc    Get customer orders
// @access  Private
router.get('/orders', auth, async (req, res) => {
    try {
        const { status, limit = 20, page = 1 } = req.query;
        
        let query = {};
        
        if (req.user && req.user.isDemo) {
            // Demo user - get by email
            query.customerEmail = req.userId;
        } else {
            query.customer = req.userId;
        }
        
        if (status) {
            query.status = status;
        }
        
        const pageNumber = parseInt(page);
        const pageSize = parseInt(limit);
        const skip = (pageNumber - 1) * pageSize;
        
        const orders = await Order.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize)
            .populate('items.menuItem', 'name image category')
            .populate('assignedChef', 'firstName lastName');
        
        const totalOrders = await Order.countDocuments(query);
        
        res.json({
            success: true,
            count: orders.length,
            total: totalOrders,
            page: pageNumber,
            pages: Math.ceil(totalOrders / pageSize),
            orders
        });
        
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   GET /api/customer/orders/:id
// @desc    Get order details
// @access  Private
router.get('/orders/:id', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('items.menuItem')
            .populate('assignedChef', 'firstName lastName');
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        // Check authorization
        const isAuthorized = req.userId.includes('@demo.com') 
            ? order.customerEmail === req.userId
            : order.customer && order.customer.toString() === req.userId;
        
        if (!isAuthorized && req.userRole !== 'admin' && req.userRole !== 'chef') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this order'
            });
        }
        
        res.json({
            success: true,
            order
        });
        
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   POST /api/customer/service-request
// @desc    Request service (water, cleaning, bill, etc.)
// @access  Private
router.post('/service-request', auth, [
    check('tableNumber', 'Table number is required').isInt({ min: 1 }),
    check('type', 'Service type is required').isIn(['water', 'cleaning', 'bill', 'cutlery', 'napkin', 'extra_sauce', 'other']),
    check('description', 'Description cannot exceed 200 characters').optional().isLength({ max: 200 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }
        
        const { tableNumber, type, description } = req.body;
        
        // Get user info
        let customerName;
        if (req.user && req.user.isDemo){
            customerName = req.user.firstName + ' ' + req.user.lastName;
        } else {
            const user = await User.findById(req.userId);
            customerName = user ? user.firstName + ' ' + user.lastName : 'Customer';
        }
        
        // Check if table exists and is active
        const table = await Table.findOne({ tableNumber, isActive: true });
        if (!table) {
            return res.status(400).json({
                success: false,
                message: 'Table not found or inactive'
            });
        }
        
        // Find any order for this table (not just active ones)
        const order = await Order.findOne({ tableNumber })
            .sort({ createdAt: -1 });
        
        // Create service request
        const serviceRequest = {
            type,
            tableNumber,
            customerName,
            description: description || `${type} request`,
            status: 'pending',
            createdAt: new Date()
        };
        
        // Real-time notification
        const io = req.app.get('io');
        if (io) {
            io.to('role:chef').to('role:admin').emit('new-service-request', {
                ...serviceRequest,
                timestamp: new Date().toISOString(),
                orderNumber: order ? order.orderNumber : 'N/A'
            });
            
            // Also notify the specific table
            io.to(`table:${tableNumber}`).emit('service-request-sent', {
                ...serviceRequest,
                message: 'Your service request has been sent'
            });
        }
        
        res.json({
            success: true,
            message: 'Service request sent successfully',
            request: serviceRequest,
            estimatedResponse: '5-10 minutes'
        });
        
    } catch (error) {
        console.error('Service request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   POST /api/customer/cancel-order/:id
// @desc    Cancel an order
// @access  Private
router.post('/cancel-order/:id', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        // Check authorization
        const isAuthorized = req.userId.includes('@demo.com') 
            ? order.customerEmail === req.userId
            : order.customer && order.customer.toString() === req.userId;
        
        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to cancel this order'
            });
        }
        
        // Check if order can be cancelled
        if (!['pending', 'confirmed'].includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: `Order cannot be cancelled in ${order.status} status`
            });
        }
        
        // Update order
        order.status = 'cancelled';
        order.cancelledAt = new Date();
        await order.save();
        
        // Update table if no other active orders
        const activeOrder = await Order.findOne({
            tableNumber: order.tableNumber,
            status: { $nin: ['completed', 'cancelled', 'rejected'] }
        });
        
        if (!activeOrder) {
            const table = await Table.findOne({ tableNumber: order.tableNumber });
            if (table) {
                table.status = 'available';
                table.currentOrder = null;
                table.currentCustomer = null;
                table.customerName = null;
                await table.save();
            }
        }
        
        res.json({
            success: true,
            message: 'Order cancelled successfully',
            order
        });
        
    } catch (error) {
        console.error('Cancel order error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   POST /api/customer/feedback/:id
// @desc    Submit feedback for an order
// @access  Private
router.post('/feedback/:id', auth, [
    check('rating', 'Rating is required and must be between 1 and 5').isInt({ min: 1, max: 5 }),
    check('feedback', 'Feedback cannot exceed 500 characters').optional().isLength({ max: 500 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }
        
        const { rating, feedback } = req.body;
        
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        // Check authorization
        const isAuthorized = req.userId.includes('@demo.com') 
            ? order.customerEmail === req.userId
            : order.customer && order.customer.toString() === req.userId;
        
        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to provide feedback for this order'
            });
        }
        
        // Check if order is completed
        if (order.status !== 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Feedback can only be provided for completed orders'
            });
        }
        
        // Update order
        order.rating = rating;
        order.feedback = feedback;
        await order.save();
        
        res.json({
            success: true,
            message: 'Thank you for your feedback!',
            order: {
                id: order._id,
                orderNumber: order.orderNumber,
                rating: order.rating,
                feedback: order.feedback
            }
        });
        
    } catch (error) {
        console.error('Feedback error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Add to routes/customer.js or create new file routes/seed.js
router.post('/menu/seed', async (req, res) => {
    try {
        const demoMenu = [
            {
                name: 'Classic Burger',
                description: 'Juicy beef patty with lettuce, tomato, pickles, and special sauce in a sesame seed bun',
                price: 12.99,
                category: 'main',
                available: true,
                popular: true,
                vegetarian: false,
                image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
            },
            {
                name: 'Caesar Salad',
                description: 'Fresh romaine lettuce with Caesar dressing, croutons, and parmesan cheese',
                price: 9.99,
                category: 'salad',
                available: true,
                popular: true,
                vegetarian: true,
                image: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
            },
            {
                name: 'Chocolate Lava Cake',
                description: 'Warm chocolate cake with a molten chocolate center, served with vanilla ice cream',
                price: 7.99,
                category: 'dessert',
                available: true,
                popular: true,
                vegetarian: true,
                image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
            },
            {
                name: 'Margarita Pizza',
                description: 'Classic pizza with tomato sauce, mozzarella, and fresh basil',
                price: 14.99,
                category: 'main',
                available: true,
                vegetarian: true,
                image: 'https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
            },
            {
                name: 'French Fries',
                description: 'Crispy golden fries with sea salt',
                price: 4.99,
                category: 'appetizer',
                available: true,
                vegetarian: true,
                image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
            },
            {
                name: 'Iced Coffee',
                description: 'Cold brew coffee with milk and vanilla syrup',
                price: 3.99,
                category: 'drink',
                available: true,
                image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
            }
        ];

        // Clear existing menu
        await MenuItem.deleteMany({});
        
        // Add demo menu
        await MenuItem.insertMany(demoMenu);
        
        res.json({
            success: true,
            message: 'Demo menu items added successfully',
            count: demoMenu.length
        });
        
    } catch (error) {
        console.error('Seed error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to seed menu',
            error: error.message
        });
    }
});


// @route   GET /api/customer/tables
// @desc    Get available tables for customers
// @access  Private (Customer)
router.get('/tables', auth, async (req, res) => {
    try {
        // Get all active tables that are not marked as inactive
        const tables = await Table.find({ 
            isActive: true,
            status: { $in: ['available', 'occupied'] }
        })
        .sort({ tableNumber: 1 })
        .select('tableNumber capacity location section status');
        
        res.json({
            success: true,
            count: tables.length,
            tables: tables
        });
        
    } catch (error) {
        console.error('Get customer tables error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   GET /api/customer/tables
// @desc    Get available tables for customers
// @access  Private (Customer)
router.get('/tables', auth, async (req, res) => {
    try {
        // Get all tables that are active and can accept orders
        // 'occupied' tables can still accept orders (multiple orders per table)
        const tables = await Table.find({ 
            isActive: true
        })
        .sort({ tableNumber: 1 })
        .select('tableNumber capacity location section status');
        
        console.log('Available tables for customer:', tables.map(t => ({
            number: t.tableNumber,
            status: t.status,
            capacity: t.capacity
        })));
        
        res.json({
            success: true,
            count: tables.length,
            tables: tables
        });
        
    } catch (error) {
        console.error('Get customer tables error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router;
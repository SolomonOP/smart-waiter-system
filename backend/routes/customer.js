const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const mongoose = require('mongoose'); // ADD THIS LINE
const { MenuItem, Order, Table, User } = require('../models');

// @route   GET /api/customer/menu
// @desc    Get available menu items
// @access  Public
router.get('/menu', async (req, res) => {
    try {
        const { category, available = true } = req.query;
        
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
            message: 'Server error loading menu'
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
// @desc    Place a new order - SIMPLIFIED VERSION
// @access  Private
router.post('/order', auth, async (req, res) => {
    try {
        const { tableNumber, items, instructions, customerName, customerEmail } = req.body;
        
        console.log('=== ORDER REQUEST ===');
        console.log('Table:', tableNumber);
        console.log('Items:', JSON.stringify(items, null, 2));
        console.log('=====================');
        
        // Basic validation
        if (!tableNumber || tableNumber < 1) {
            return res.status(400).json({
                success: false,
                message: 'Valid table number is required'
            });
        }
        
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one item is required'
            });
        }
        
        // Check table
        const table = await Table.findOne({ tableNumber: parseInt(tableNumber) });
        if (!table) {
            return res.status(400).json({
                success: false,
                message: `Table ${tableNumber} not found`
            });
        }
        
        // Validate and process menu items
        const orderItems = [];
        let totalAmount = 0;
        
        for (const item of items) {
            try {
                // Skip if no menuItem ID
                if (!item.menuItem) {
                    return res.status(400).json({
                        success: false,
                        message: `Menu item ID is missing for "${item.name}"`
                    });
                }
                
                // Try to find menu item
                let menuItem;
                
                // First try by ID
                try {
                    menuItem = await MenuItem.findById(item.menuItem);
                } catch (idError) {
                    console.log('ID lookup failed:', idError.message);
                }
                
                // If not found by ID, try by name
                if (!menuItem && item.name) {
                    menuItem = await MenuItem.findOne({ 
                        name: { $regex: new RegExp(item.name, 'i') } 
                    });
                    
                    if (menuItem) {
                        console.log(`Found menu item by name: ${item.name}`);
                    }
                }
                
                // If still not found, return error
                if (!menuItem) {
                    return res.status(400).json({
                        success: false,
                        message: `Menu item "${item.name}" not found`
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
                    itemTotal: itemTotal
                });
                
            } catch (error) {
                console.error('Error processing menu item:', error);
                return res.status(400).json({
                    success: false,
                    message: `Error with item: ${item.name}`
                });
            }
        }
        
        // Generate order number
        const now = new Date();
        const year = now.getFullYear().toString().slice(-2);
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const timestamp = Date.now().toString().slice(-6);
        const orderNumber = `ORD${year}${month}${day}${timestamp}`;
        
        // Get customer info
        const customer = await User.findById(req.userId);
        
        // Create order
        const orderData = {
            orderNumber: orderNumber,
            tableNumber: parseInt(tableNumber),
            customer: req.userId,
            customerName: customerName || (customer ? customer.firstName + ' ' + customer.lastName : 'Customer'),
            customerEmail: customerEmail || (customer ? customer.email : 'customer@example.com'),
            items: orderItems,
            subtotal: totalAmount,
            totalAmount: totalAmount,
            specialInstructions: instructions || '',
            estimatedPrepTime: 15
        };
        
        console.log('Creating order:', orderData);
        
        const order = new Order(orderData);
        
        try {
            await order.save();
            console.log('Order saved successfully:', order._id);
        } catch (saveError) {
            console.error('Save error:', saveError);
            
            // Handle duplicate order number
            if (saveError.code === 11000) {
                const newTimestamp = Date.now().toString().slice(-6);
                order.orderNumber = `ORD${year}${month}${day}${newTimestamp}`;
                await order.save();
            } else {
                throw saveError;
            }
        }
        
        // Update table
        table.status = 'occupied';
        table.currentOrder = order._id;
        table.currentCustomer = req.userId;
        table.customerName = orderData.customerName;
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
                createdAt: order.createdAt
            }
        });
        
    } catch (error) {
        console.error('=== ORDER ERROR ===');
        console.error('Error:', error);
        console.error('Stack:', error.stack);
        console.error('===================');
        
        res.status(500).json({
            success: false,
            message: 'Server error while placing order',
            error: error.message
        });
    }
});

// @route   GET /api/customer/orders
// @desc    Get customer orders
// @access  Private
router.get('/orders', auth, async (req, res) => {
    try {
        const { status, limit = 20, page = 1 } = req.query;
        
        let query = { customer: req.userId };
        
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
        const isAuthorized = order.customer && order.customer.toString() === req.userId;
        
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
        
        const { tableNumber, type, description, customerName } = req.body;
        
        console.log('=== SERVICE REQUEST ===');
        console.log('Table:', tableNumber);
        console.log('Type:', type);
        console.log('Customer:', customerName);
        console.log('=======================');
        
        // Get user info
        let customer = customerName;
        let customerId = req.userId;
        
        if (!customer) {
            const user = await User.findById(req.userId);
            customer = user ? user.firstName + ' ' + user.lastName : 'Customer';
        }
        
        // Check if table exists
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
        
        // Create service request object
        const serviceRequest = {
            type: type,
            tableNumber: parseInt(tableNumber),
            description: description || `${getServiceTypeName(type)} request from table ${tableNumber}`,
            customerName: customer,
            customerId: customerId,
            status: 'pending',
            priority: getServicePriority(type),
            createdAt: new Date()
        };
        
        // Add to table's serviceRequests array
        if (!table.serviceRequests) {
            table.serviceRequests = [];
        }
        
        table.serviceRequests.push(serviceRequest);
        await table.save();
        
        const savedRequest = table.serviceRequests[table.serviceRequests.length - 1];
        console.log('Service request saved to table:', savedRequest);
        
        // Real-time notification
        const io = req.app.get('io');
        if (io) {
            // Notify chefs
            io.to('role:chef').emit('new-service-request', {
                requestId: savedRequest._id,
                type: type,
                tableNumber: tableNumber,
                description: savedRequest.description,
                customerName: customer,
                priority: savedRequest.priority,
                timestamp: new Date().toISOString()
            });
            
            // Notify admins
            io.to('role:admin').emit('service-request-created', {
                requestId: savedRequest._id,
                type: type,
                tableNumber: tableNumber,
                customerName: customer,
                timestamp: new Date().toISOString()
            });
            
            // Notify the specific table
            io.to(`table:${tableNumber}`).emit('service-request-confirmation', {
                type: type,
                tableNumber: tableNumber,
                message: 'Your service request has been received',
                requestId: savedRequest._id,
                estimatedResponse: '5-10 minutes'
            });
        }
        
        res.json({
            success: true,
            message: 'Service request sent successfully',
            request: {
                id: savedRequest._id,
                type: savedRequest.type,
                tableNumber: savedRequest.tableNumber,
                description: savedRequest.description,
                status: savedRequest.status,
                priority: savedRequest.priority,
                createdAt: savedRequest.createdAt,
                estimatedResponse: '5-10 minutes'
            }
        });
        
    } catch (error) {
        console.error('Service request error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Server error while processing service request',
            error: error.message
        });
    }
});

// Helper functions
function getServiceTypeName(type) {
    const typeNames = {
        'water': 'Water Refill',
        'cleaning': 'Table Cleaning',
        'bill': 'Bill Payment',
        'cutlery': 'Cutlery Request',
        'napkin': 'Napkin Request',
        'extra_sauce': 'Extra Sauce',
        'other': 'Other Service'
    };
    return typeNames[type] || type;
}

function getServicePriority(type) {
    const priorityMap = {
        'bill': 'high',       // Bill payment is high priority
        'water': 'normal',    // Water refill is normal
        'cleaning': 'normal', // Cleaning is normal
        'other': 'low'        // Other services are low priority
    };
    return priorityMap[type] || 'normal';
}

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
        const isAuthorized = order.customer && order.customer.toString() === req.userId;
        
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
        const isAuthorized = order.customer && order.customer.toString() === req.userId;
        
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

// Seed menu (for development)
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
            }
        ];

        await MenuItem.deleteMany({});
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
        // Get all tables that are active
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
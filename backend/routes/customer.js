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
        
        // Get user info
        let user;
        let customerEmail, customerName;
        
        if (req.userId.includes('@demo.com')) {
            // Demo user
            customerEmail = req.userId;
            customerName = req.user.firstName + ' ' + req.user.lastName;
        } else {
            // Database user
            user = await User.findById(req.userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
            customerEmail = user.email;
            customerName = user.firstName + ' ' + user.lastName;
        }
        
        // Check table availability
        const table = await Table.findOne({ tableNumber, isActive: true });
        if (!table) {
            return res.status(400).json({
                success: false,
                message: 'Table not found or inactive'
            });
        }
        
        if (table.status !== 'available' && table.status !== 'occupied') {
            return res.status(400).json({
                success: false,
                message: `Table is currently ${table.status}`
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
            
            // Increment order count
            menuItem.orderCount += item.quantity;
            await menuItem.save();
        }
        
        // Create order
        const order = new Order({
            tableNumber,
            customer: req.userId.includes('@demo.com') ? null : req.userId,
            customerName,
            customerEmail,
            items: orderItems,
            subtotal: totalAmount,
            totalAmount,
            paymentMethod: paymentMethod || 'pending',
            specialInstructions,
            estimatedPrepTime: Math.max(...orderItems.map(item => {
                const prepTime = item.quantity * 10; // 10 minutes per item
                return Math.min(prepTime, 60); // Max 60 minutes
            }))
        });
        
        await order.save();
        
        // Update table status
        table.status = 'occupied';
        table.currentOrder = order._id;
        table.currentCustomer = req.userId.includes('@demo.com') ? null : req.userId;
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
            
            io.to('role:admin').emit('order-placed', {
                orderId: order._id,
                orderNumber: order.orderNumber,
                tableNumber: order.tableNumber,
                totalAmount: order.totalAmount,
                customerName: order.customerName,
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
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});

// @route   GET /api/customer/orders
// @desc    Get customer orders
// @access  Private
router.get('/orders', auth, async (req, res) => {
    try {
        const { status, limit = 20, page = 1 } = req.query;
        
        let query = {};
        
        if (req.userId.includes('@demo.com')) {
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
        
        // Find active order for this table
        const order = await Order.findOne({
            tableNumber,
            status: { $nin: ['completed', 'cancelled', 'rejected'] }
        }).sort({ createdAt: -1 });
        
        if (!order) {
            return res.status(400).json({
                success: false,
                message: 'No active order found for this table'
            });
        }
        
        // Add service request
        order.serviceRequests.push({
            type,
            tableNumber,
            description,
            status: 'pending'
        });
        
        await order.save();
        
        // Real-time notification
        const io = req.app.get('io');
        if (io) {
            io.to('role:chef').emit('service-request', {
                requestId: order.serviceRequests[order.serviceRequests.length - 1]._id,
                type,
                tableNumber,
                description,
                orderNumber: order.orderNumber,
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({
            success: true,
            message: 'Service request sent successfully',
            request: {
                type,
                tableNumber,
                status: 'pending',
                estimatedResponse: '5 minutes'
            }
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

module.exports = router;
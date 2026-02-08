const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { Order, MenuItem, Table, User } = require('../models');

// Middleware to check if user is a chef
const isChef = (req, res, next) => {
    if (req.user.role !== 'chef' && req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Chef role required.'
        });
    }
    next();
};

// @route   GET /api/chef/orders
// @desc    Get orders for chef dashboard
// @access  Private (Chef)
router.get('/orders', auth, isChef, async (req, res) => {
    try {
        const { status } = req.query;
        
        let query = {
            status: { $in: ['pending', 'confirmed', 'preparing', 'ready'] }
        };
        
        if (status) {
            query.status = status;
        }
        
        const orders = await Order.find(query)
            .sort({ createdAt: -1 })
            .populate('items.menuItem', 'name category preparationTime')
            .populate('customer', 'firstName lastName')
            .populate('assignedChef', 'firstName lastName');
        
        res.json({
            success: true,
            count: orders.length,
            orders
        });
        
    } catch (error) {
        console.error('Get chef orders error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   GET /api/chef/orders/stats
// @desc    Get chef order statistics
// @access  Private (Chef)
router.get('/orders/stats', auth, isChef, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Get today's orders
        const todayOrders = await Order.find({
            createdAt: { $gte: today, $lt: tomorrow }
        });
        
        // Calculate stats
        const stats = {
            pending: todayOrders.filter(o => o.status === 'pending' || o.status === 'confirmed').length,
            preparing: todayOrders.filter(o => o.status === 'preparing').length,
            ready: todayOrders.filter(o => o.status === 'ready').length,
            totalToday: todayOrders.length
        };
        
        res.json({
            success: true,
            stats
        });
        
    } catch (error) {
        console.error('Get chef stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   POST /api/chef/orders/:id/accept
// @desc    Chef accepts an order
// @access  Private (Chef)
router.post('/orders/:id/accept', auth, isChef, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        if (order.status !== 'pending' && order.status !== 'confirmed') {
            return res.status(400).json({
                success: false,
                message: `Order cannot be accepted in ${order.status} status`
            });
        }
        
        // Update order
        order.status = 'preparing';
        order.assignedChef = req.user.id;
        order.chefName = req.user.firstName + ' ' + req.user.lastName;
        order.preparingAt = new Date();
        await order.save();
        
        // Real-time notification
        const io = req.app.get('io');
        if (io) {
            io.emit('order-status-update', {
                orderId: order._id,
                orderNumber: order.orderNumber,
                status: order.status,
                chefName: order.chefName,
                timestamp: new Date().toISOString()
            });
            
            // Notify specific table
            io.to(`table:${order.tableNumber}`).emit('order-updated', {
                message: `Chef ${order.chefName} has started preparing your order`,
                status: order.status,
                orderId: order._id
            });
        }
        
        res.json({
            success: true,
            message: 'Order accepted and preparation started',
            order: {
                id: order._id,
                orderNumber: order.orderNumber,
                status: order.status,
                chefName: order.chefName,
                preparingAt: order.preparingAt
            }
        });
        
    } catch (error) {
        console.error('Accept order error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   POST /api/chef/orders/:id/ready
// @desc    Mark order as ready
// @access  Private (Chef)
router.post('/orders/:id/ready', auth, isChef, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        if (order.status !== 'preparing') {
            return res.status(400).json({
                success: false,
                message: `Order cannot be marked as ready in ${order.status} status`
            });
        }
        
        // Check if chef is assigned to this order
        if (order.assignedChef && order.assignedChef.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this order'
            });
        }
        
        // Update order
        order.status = 'ready';
        order.readyAt = new Date();
        
        // Calculate actual preparation time
        if (order.preparingAt) {
            order.actualPrepTime = Math.round((order.readyAt - order.preparingAt) / 60000); // minutes
        }
        
        await order.save();
        
        // Real-time notification
        const io = req.app.get('io');
        if (io) {
            io.emit('order-status-update', {
                orderId: order._id,
                orderNumber: order.orderNumber,
                status: order.status,
                message: 'Order is ready!',
                timestamp: new Date().toISOString()
            });
            
            // Notify specific table
            io.to(`table:${order.tableNumber}`).emit('order-ready', {
                message: 'Your order is ready! Please wait for server.',
                status: order.status,
                orderId: order._id
            });
        }
        
        res.json({
            success: true,
            message: 'Order marked as ready',
            order: {
                id: order._id,
                orderNumber: order.orderNumber,
                status: order.status,
                readyAt: order.readyAt,
                actualPrepTime: order.actualPrepTime
            }
        });
        
    } catch (error) {
        console.error('Mark order ready error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   POST /api/chef/orders/:id/complete
// @desc    Mark order as completed (served)
// @access  Private (Chef)
router.post('/orders/:id/complete', auth, isChef, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        if (order.status !== 'ready') {
            return res.status(400).json({
                success: false,
                message: `Order cannot be completed in ${order.status} status`
            });
        }
        
        // Update order
        order.status = 'completed';
        order.completedAt = new Date();
        order.servedAt = new Date();
        await order.save();
        
        // Update table status
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
                
                // Notify table is available
                const io = req.app.get('io');
                if (io) {
                    io.emit('table-updated', {
                        tableNumber: table.tableNumber,
                        status: table.status
                    });
                }
            }
        }
        
        // Real-time notification
        const io = req.app.get('io');
        if (io) {
            io.emit('order-status-update', {
                orderId: order._id,
                orderNumber: order.orderNumber,
                status: order.status,
                message: 'Order completed',
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({
            success: true,
            message: 'Order marked as completed',
            order: {
                id: order._id,
                orderNumber: order.orderNumber,
                status: order.status,
                completedAt: order.completedAt
            }
        });
        
    } catch (error) {
        console.error('Complete order error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   GET /api/chef/service-requests
// @desc    Get service requests for chef
// @access  Private (Chef)
router.get('/service-requests', auth, isChef, async (req, res) => {
    try {
        // Get orders with pending service requests
        const orders = await Order.find({
            'serviceRequests.status': 'pending'
        })
        .select('orderNumber tableNumber serviceRequests customerName')
        .sort({ createdAt: -1 });
        
        // Extract service requests
        const serviceRequests = [];
        orders.forEach(order => {
            order.serviceRequests.forEach(request => {
                if (request.status === 'pending') {
                    serviceRequests.push({
                        id: request._id,
                        type: request.type,
                        tableNumber: request.tableNumber,
                        description: request.description,
                        orderNumber: order.orderNumber,
                        customerName: order.customerName,
                        createdAt: request.createdAt,
                        orderId: order._id
                    });
                }
            });
        });
        
        res.json({
            success: true,
            count: serviceRequests.length,
            requests: serviceRequests
        });
        
    } catch (error) {
        console.error('Get service requests error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   POST /api/chef/service-requests/:id/accept
// @desc    Accept a service request
// @access  Private (Chef)
router.post('/service-requests/:id/accept', auth, isChef, async (req, res) => {
    try {
        const order = await Order.findOne({
            'serviceRequests._id': req.params.id
        });
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }
        
        // Find the specific service request
        const serviceRequest = order.serviceRequests.id(req.params.id);
        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }
        
        if (serviceRequest.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Service request is already ${serviceRequest.status}`
            });
        }
        
        serviceRequest.status = 'assigned';
        serviceRequest.assignedTo = req.user.id;
        await order.save();
        
        res.json({
            success: true,
            message: 'Service request accepted',
            request: serviceRequest
        });
        
    } catch (error) {
        console.error('Accept service request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   POST /api/chef/service-requests/:id/complete
// @desc    Complete a service request
// @access  Private (Chef)
router.post('/service-requests/:id/complete', auth, isChef, async (req, res) => {
    try {
        const order = await Order.findOne({
            'serviceRequests._id': req.params.id
        });
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }
        
        // Find the specific service request
        const serviceRequest = order.serviceRequests.id(req.params.id);
        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }
        
        if (serviceRequest.status !== 'assigned') {
            return res.status(400).json({
                success: false,
                message: 'Service request must be assigned first'
            });
        }
        
        serviceRequest.status = 'completed';
        serviceRequest.completedAt = new Date();
        await order.save();
        
        res.json({
            success: true,
            message: 'Service request completed',
            request: serviceRequest
        });
        
    } catch (error) {
        console.error('Complete service request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   GET /api/chef/menu
// @desc    Get menu items for chef
// @access  Private (Chef)
router.get('/menu', auth, isChef, async (req, res) => {
    try {
        const { category, available } = req.query;
        
        let query = {};
        
        if (category && category !== 'all') {
            query.category = category;
        }
        
        if (available !== undefined) {
            query.available = available === 'true';
        }
        
        const menuItems = await MenuItem.find(query)
            .sort({ category: 1, name: 1 });
        
        res.json({
            success: true,
            count: menuItems.length,
            menuItems
        });
        
    } catch (error) {
        console.error('Get chef menu error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   PUT /api/chef/menu/:id/availability
// @desc    Update menu item availability
// @access  Private (Chef)
router.put('/menu/:id/availability', auth, isChef, [
    check('available', 'Available status is required').isBoolean()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }
        
        const { available } = req.body;
        
        const menuItem = await MenuItem.findById(req.params.id);
        
        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: 'Menu item not found'
            });
        }
        
        menuItem.available = available;
        await menuItem.save();
        
        // Real-time update
        const io = req.app.get('io');
        if (io) {
            io.emit('menu-item-updated', {
                itemId: menuItem._id,
                available: menuItem.available,
                name: menuItem.name
            });
        }
        
        res.json({
            success: true,
            message: `Menu item ${available ? 'enabled' : 'disabled'} successfully`,
            menuItem: {
                id: menuItem._id,
                name: menuItem.name,
                available: menuItem.available
            }
        });
        
    } catch (error) {
        console.error('Update menu availability error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   POST /api/chef/orders/new
// @desc    Create new order directly (for walk-ins)
// @access  Private (Chef)
router.post('/orders/new', auth, isChef, [
    check('tableNumber', 'Table number is required').isInt({ min: 1 }),
    check('items', 'Items are required').isArray({ min: 1 }),
    check('items.*.itemId', 'Item ID is required').not().isEmpty(),
    check('items.*.name', 'Item name is required').not().isEmpty(),
    check('items.*.price', 'Price must be at least 0').isFloat({ min: 0 }),
    check('items.*.quantity', 'Quantity must be at least 1').isInt({ min: 1 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array());
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }
        
        const { tableNumber, items, specialInstructions, customerName } = req.body;
        
        console.log('Creating new order for table:', tableNumber);
        console.log('Items:', items);
        
        // Check table
        const table = await Table.findOne({ tableNumber, isActive: true });
        if (!table) {
            console.log('Table not found:', tableNumber);
            return res.status(400).json({
                success: false,
                message: 'Table not found or inactive'
            });
        }
        
        console.log('Table status:', table.status);
        
        if (table.status === 'occupied') {
            return res.status(400).json({
                success: false,
                message: 'Table is currently occupied'
            });
        }
        
        // Validate menu items
        const orderItems = [];
        let totalAmount = 0;
        
        for (const item of items) {
            const menuItem = await MenuItem.findById(item.itemId);
            
            if (!menuItem) {
                console.log('Menu item not found:', item.itemId);
                return res.status(400).json({
                    success: false,
                    message: `Menu item ${item.itemId} not found`
                });
            }
            
            console.log('Menu item found:', menuItem.name, 'Available:', menuItem.available);
            
            if (!menuItem.available) {
                return res.status(400).json({
                    success: false,
                    message: `${menuItem.name} is currently unavailable`
                });
            }
            
            const itemTotal = item.price * item.quantity;
            totalAmount += itemTotal;
            
            orderItems.push({
                menuItem: menuItem._id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                specialInstructions: item.specialInstructions || '',
                itemTotal
            });
            
            // Increment order count
            menuItem.orderCount += item.quantity;
            await menuItem.save();
        }
        
        // Calculate estimated prep time (simplified)
        const estimatedPrepTime = 15; // Default 15 minutes
        
        // Get next order number
        const lastOrder = await Order.findOne().sort({ orderNumber: -1 });
        const orderNumber = lastOrder ? lastOrder.orderNumber + 1 : 1000;
        
        // Calculate totals
        const subtotal = totalAmount;
        const tax = subtotal * 0.1; // 10% tax
        const serviceCharge = subtotal * 0.05; // 5% service charge
        const finalTotal = subtotal + tax + serviceCharge;
        
        // Create order
        const order = new Order({
            orderNumber,
            tableNumber,
            customerName: customerName || 'Walk-in Customer',
            items: orderItems,
            subtotal,
            tax,
            serviceCharge,
            totalAmount: finalTotal,
            paymentMethod: 'pending',
            specialInstructions: specialInstructions || '',
            estimatedPrepTime,
            status: 'pending',
            assignedChef: req.user.id,
            chefName: req.user.firstName + ' ' + req.user.lastName,
            orderType: 'walk-in'
        });
        
        console.log('Saving order...');
        await order.save();
        console.log('Order saved:', order._id);
        
        // Update table status
        table.status = 'occupied';
        table.currentOrder = order._id;
        table.customerName = customerName || 'Walk-in Customer';
        table.occupiedAt = new Date();
        await table.save();
        console.log('Table updated');
        
        // Real-time notification
        const io = req.app.get('io');
        if (io) {
            io.emit('new-order', {
                orderId: order._id,
                orderNumber: order.orderNumber,
                tableNumber: order.tableNumber,
                customerName: order.customerName,
                items: order.items,
                totalAmount: order.totalAmount,
                estimatedPrepTime: order.estimatedPrepTime,
                timestamp: new Date().toISOString()
            });
        }
        
        res.status(201).json({
            success: true,
            message: 'Walk-in order created successfully!',
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
        console.error('Create new order error:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// @route   GET /api/chef/dashboard-stats
// @desc    Get comprehensive dashboard stats
// @access  Private (Chef)
router.get('/dashboard-stats', auth, isChef, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Get today's orders
        const todayOrders = await Order.find({
            createdAt: { $gte: today, $lt: tomorrow }
        });
        
        // Calculate stats
        const stats = {
            pending: todayOrders.filter(o => o.status === 'pending' || o.status === 'confirmed').length,
            preparing: todayOrders.filter(o => o.status === 'preparing').length,
            ready: todayOrders.filter(o => o.status === 'ready').length,
            totalToday: todayOrders.length
        };
        
        // Get recent orders (last 5)
        const recentOrders = await Order.find({
            status: { $in: ['pending', 'confirmed', 'preparing', 'ready'] }
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('items.menuItem', 'name');
        
        // Get service requests from orders
        const ordersWithRequests = await Order.find({
            'serviceRequests.status': 'pending',
            'serviceRequests.type': { $in: ['chef_attention'] }
        })
        .sort({ createdAt: -1 })
        .limit(5);
        
        // Extract service requests
        const serviceRequests = [];
        ordersWithRequests.forEach(order => {
            order.serviceRequests.forEach(request => {
                if (request.status === 'pending' && request.type === 'chef_attention') {
                    serviceRequests.push({
                        id: request._id,
                        type: request.type,
                        tableNumber: request.tableNumber,
                        description: request.description,
                        orderNumber: order.orderNumber,
                        customerName: order.customerName,
                        createdAt: request.createdAt,
                        orderId: order._id
                    });
                }
            });
        });
        
        res.json({
            success: true,
            stats,
            recentOrders,
            serviceRequests
        });
        
    } catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router;
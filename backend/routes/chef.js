const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { Order, MenuItem, Table, User } = require('../models');

// Middleware to check if user is a chef
const isChef = (req, res, next) => {
    if (req.userRole !== 'chef' && req.userRole !== 'admin') {
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
        const { status, assigned, limit = 50 } = req.query;
        
        let query = {
            status: { $in: ['pending', 'confirmed', 'preparing', 'ready'] }
        };
        
        if (status) {
            query.status = status;
        }
        
        if (assigned === 'me') {
            query.assignedChef = req.userId;
        } else if (assigned === 'unassigned') {
            query.assignedChef = { $exists: false };
        }
        
        const orders = await Order.find(query)
            .sort({ createdAt: 1 })
            .limit(parseInt(limit))
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
        
        // Today's stats
        const todayQuery = {
            updatedAt: { $gte: today, $lt: tomorrow },
            assignedChef: req.userId
        };
        
        const totalToday = await Order.countDocuments(todayQuery);
        const completedToday = await Order.countDocuments({
            ...todayQuery,
            status: 'completed'
        });
        const preparingToday = await Order.countDocuments({
            ...todayQuery,
            status: 'preparing'
        });
        
        // Average preparation time
        const completedOrders = await Order.find({
            assignedChef: req.userId,
            status: 'completed',
            preparingAt: { $exists: true },
            readyAt: { $exists: true }
        }).limit(100);
        
        let avgPrepTime = 0;
        if (completedOrders.length > 0) {
            const totalTime = completedOrders.reduce((sum, order) => {
                return sum + ((order.readyAt - order.preparingAt) / 60000); // minutes
            }, 0);
            avgPrepTime = Math.round(totalTime / completedOrders.length);
        }
        
        res.json({
            success: true,
            stats: {
                today: {
                    total: totalToday,
                    completed: completedToday,
                    preparing: preparingToday
                },
                averagePreparationTime: avgPrepTime,
                chefName: req.user.firstName + ' ' + req.user.lastName
            }
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
        
        if (order.assignedChef && order.assignedChef.toString() !== req.userId) {
            return res.status(400).json({
                success: false,
                message: 'Order is already assigned to another chef'
            });
        }
        
        // Update order
        order.status = 'preparing';
        order.assignedChef = req.userId;
        order.chefName = req.user.firstName + ' ' + req.user.lastName;
        order.preparingAt = new Date();
        await order.save();
        
        // Real-time notification
        const io = req.app.get('io');
        if (io) {
            io.to(`table:${order.tableNumber}`).emit('order-status-changed', {
                orderId: order._id,
                orderNumber: order.orderNumber,
                status: order.status,
                chefName: order.chefName,
                message: `Chef ${order.chefName} has started preparing your order`,
                timestamp: new Date().toISOString()
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

// @route   POST /api/chef/orders/:id/reject
// @desc    Chef rejects an order
// @access  Private (Chef)
router.post('/orders/:id/reject', auth, isChef, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        if (order.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Cannot reject order in ${order.status} status`
            });
        }
        
        // Update order
        order.status = 'rejected';
        order.rejectedAt = new Date();
        
        await order.save();
        
        // Real-time notification
        const io = req.app.get('io');
        if (io) {
            io.to('role:admin').emit('order-rejected', {
                orderId: order._id,
                orderNumber: order.orderNumber,
                tableNumber: order.tableNumber,
                chefName: req.user.firstName + ' ' + req.user.lastName,
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({
            success: true,
            message: 'Order rejected successfully',
            order
        });
        
    } catch (error) {
        console.error('Reject order error:', error);
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
        if (order.assignedChef && order.assignedChef.toString() !== req.userId) {
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
            io.to(`table:${order.tableNumber}`).emit('order-status-changed', {
                orderId: order._id,
                orderNumber: order.orderNumber,
                status: order.status,
                chefName: order.chefName,
                message: 'Your order is ready! Please wait for server.',
                timestamp: new Date().toISOString()
            });
            
            // Notify all staff
            io.emit('order-ready', {
                orderId: order._id,
                orderNumber: order.orderNumber,
                tableNumber: order.tableNumber,
                chefName: order.chefName,
                timestamp: new Date().toISOString()
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
            }
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
// @desc    Get pending service requests
// @access  Private (Chef)
router.get('/service-requests', auth, isChef, async (req, res) => {
    try {
        const orders = await Order.find({
            'serviceRequests.status': 'pending'
        })
        .select('orderNumber tableNumber serviceRequests customerName')
        .sort({ createdAt: 1 });
        
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

// @route   POST /api/chef/service-requests/:requestId/accept
// @desc    Accept a service request
// @access  Private (Chef)
router.post('/service-requests/:requestId/accept', auth, isChef, async (req, res) => {
    try {
        const { requestId } = req.params;
        
        const order = await Order.findOne({
            'serviceRequests._id': requestId
        });
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }
        
        // Find and update the specific request
        const request = order.serviceRequests.id(requestId);
        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }
        
        if (request.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Service request is already ${request.status}`
            });
        }
        
        request.status = 'assigned';
        request.assignedTo = req.userId;
        await order.save();
        
        res.json({
            success: true,
            message: 'Service request accepted',
            request: {
                id: request._id,
                type: request.type,
                tableNumber: request.tableNumber,
                status: request.status,
                assignedTo: request.assignedTo
            }
        });
        
    } catch (error) {
        console.error('Accept service request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   POST /api/chef/service-requests/:requestId/complete
// @desc    Complete a service request
// @access  Private (Chef)
router.post('/service-requests/:requestId/complete', auth, isChef, async (req, res) => {
    try {
        const { requestId } = req.params;
        
        const order = await Order.findOne({
            'serviceRequests._id': requestId
        });
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }
        
        // Find and update the specific request
        const request = order.serviceRequests.id(requestId);
        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }
        
        if (request.status !== 'assigned') {
            return res.status(400).json({
                success: false,
                message: 'Service request must be assigned first'
            });
        }
        
        // Check if assigned to this chef
        if (request.assignedTo && request.assignedTo.toString() !== req.userId) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to complete this request'
            });
        }
        
        request.status = 'completed';
        request.completedAt = new Date();
        await order.save();
        
        res.json({
            success: true,
            message: 'Service request completed',
            request: {
                id: request._id,
                type: request.type,
                tableNumber: request.tableNumber,
                status: request.status,
                completedAt: request.completedAt
            }
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
// @desc    Get menu items for chef (with availability control)
// @access  Private (Chef)
router.get('/menu', auth, isChef, async (req, res) => {
    try {
        const { category, available } = req.query;
        
        let query = {};
        
        if (category) {
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
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }
        
        const { tableNumber, items, specialInstructions, chefId, chefName } = req.body;
        
        // Check table availability
        const table = await Table.findOne({ tableNumber, isActive: true });
        if (!table) {
            return res.status(400).json({
                success: false,
                message: 'Table not found or inactive'
            });
        }
        
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
                return res.status(400).json({
                    success: false,
                    message: `Menu item ${item.itemId} not found`
                });
            }
            
            if (!menuItem.isAvailable) {
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
        
        // Calculate estimated prep time
        const estimatedPrepTime = Math.max(...orderItems.map(item => {
            const prepTime = item.quantity * 10; // 10 minutes per item
            return Math.min(prepTime, 60); // Max 60 minutes
        }));
        
        // Create order
        const order = new Order({
            tableNumber,
            customer: null, // Walk-in customer
            customerName: 'Walk-in Customer',
            customerEmail: 'walkin@customer.com',
            items: orderItems,
            subtotal: totalAmount,
            totalAmount,
            paymentMethod: 'pending',
            specialInstructions,
            estimatedPrepTime,
            status: 'pending',
            assignedChef: chefId,
            chefName
        });
        
        await order.save();
        
        // Update table status
        table.status = 'occupied';
        table.currentOrder = order._id;
        table.currentCustomer = null;
        table.customerName = 'Walk-in Customer';
        table.occupiedAt = new Date();
        await table.save();
        
        // Real-time notification
        const io = req.app.get('io');
        if (io) {
            io.to('role:admin').emit('new-order', {
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
            message: 'Order created successfully!',
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
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   GET /api/chef/chefs
// @desc    Get list of chefs
// @access  Private (Chef/Admin)
router.get('/chefs', auth, isChef, async (req, res) => {
    try {
        const chefs = await User.find({ role: 'chef', isActive: true })
            .select('firstName lastName email phone')
            .sort({ firstName: 1 });
        
        res.json({
            success: true,
            count: chefs.length,
            chefs
        });
        
    } catch (error) {
        console.error('Get chefs error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   GET /api/chef/orders/queue
// @desc    Get orders in queue for chef
// @access  Private (Chef)
router.get('/orders/queue', auth, isChef, async (req, res) => {
    try {
        // Get orders assigned to this chef that are still pending/preparing
        const chefOrders = await Order.find({
            assignedChef: req.userId,
            status: { $in: ['preparing', 'pending'] }
        })
        .sort({ createdAt: 1 })
        .select('orderNumber tableNumber items status estimatedPrepTime')
        .populate('items.menuItem', 'name preparationTime');
        
        // Get unassigned pending orders
        const unassignedOrders = await Order.find({
            assignedChef: { $exists: false },
            status: 'pending'
        })
        .sort({ createdAt: 1 })
        .select('orderNumber tableNumber items estimatedPrepTime')
        .populate('items.menuItem', 'name preparationTime')
        .limit(10);
        
        res.json({
            success: true,
            chefOrders: {
                count: chefOrders.length,
                orders: chefOrders
            },
            unassignedOrders: {
                count: unassignedOrders.length,
                orders: unassignedOrders
            }
        });
        
    } catch (error) {
        console.error('Get order queue error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   GET /api/chef/ingredients/low-stock
// @desc    Get low stock ingredients
// @access  Private (Chef)
router.get('/ingredients/low-stock', auth, isChef, async (req, res) => {
    try {
        // This would typically query an Ingredients model
        // For now, return sample data or implement based on your schema
        
        const lowStockItems = await MenuItem.find({
            'ingredients.stock': { $lt: 10 } // Example threshold
        })
        .select('name ingredients')
        .sort({ 'ingredients.stock': 1 })
        .limit(20);
        
        res.json({
            success: true,
            count: lowStockItems.length,
            items: lowStockItems
        });
        
    } catch (error) {
        console.error('Get low stock ingredients error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   POST /api/chef/broadcast
// @desc    Broadcast message to all customers
// @access  Private (Chef/Admin)
router.post('/broadcast', auth, isChef, [
    check('message', 'Message is required').not().isEmpty(),
    check('type', 'Type must be info, warning, or success').isIn(['info', 'warning', 'success'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }
        
        const { message, type } = req.body;
        
        // Real-time broadcast
        const io = req.app.get('io');
        if (io) {
            io.emit('broadcast-message', {
                message,
                type,
                from: `Chef ${req.user.firstName} ${req.user.lastName}`,
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({
            success: true,
            message: 'Broadcast sent successfully'
        });
        
    } catch (error) {
        console.error('Broadcast message error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   POST /api/chef/orders/:id/update
// @desc    Update order details (add/remove items)
// @access  Private (Chef)
router.post('/orders/:id/update', auth, isChef, [
    check('action', 'Action is required').isIn(['add_item', 'remove_item', 'update_quantity']),
    check('itemId', 'Item ID is required').not().isEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }
        
        const { action, itemId, quantity, reason } = req.body;
        
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        if (order.status !== 'pending' && order.status !== 'preparing') {
            return res.status(400).json({
                success: false,
                message: `Cannot update order in ${order.status} status`
            });
        }
        
        // Check if chef is assigned to this order
        if (order.assignedChef && order.assignedChef.toString() !== req.userId) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this order'
            });
        }
        
        let updateMessage = '';
        
        switch (action) {
            case 'add_item':
                const menuItem = await MenuItem.findById(itemId);
                if (!menuItem) {
                    return res.status(404).json({
                        success: false,
                        message: 'Menu item not found'
                    });
                }
                
                if (!menuItem.isAvailable) {
                    return res.status(400).json({
                        success: false,
                        message: `${menuItem.name} is currently unavailable`
                    });
                }
                
                order.items.push({
                    menuItem: itemId,
                    name: menuItem.name,
                    price: menuItem.price,
                    quantity: quantity || 1,
                    specialInstructions: reason || ''
                });
                
                // Update total
                const newItemTotal = menuItem.price * (quantity || 1);
                order.totalAmount += newItemTotal;
                
                updateMessage = `Added ${quantity || 1} x ${menuItem.name}`;
                break;
                
            case 'remove_item':
                const itemIndex = order.items.findIndex(item => 
                    item.menuItem.toString() === itemId || item._id.toString() === itemId
                );
                
                if (itemIndex === -1) {
                    return res.status(404).json({
                        success: false,
                        message: 'Item not found in order'
                    });
                }
                
                // Update total
                const removedItem = order.items[itemIndex];
                order.totalAmount -= removedItem.price * removedItem.quantity;
                
                order.items.splice(itemIndex, 1);
                updateMessage = `Removed ${removedItem.name}`;
                break;
                
            case 'update_quantity':
                const updateItemIndex = order.items.findIndex(item => 
                    item.menuItem.toString() === itemId || item._id.toString() === itemId
                );
                
                if (updateItemIndex === -1) {
                    return res.status(404).json({
                        success: false,
                        message: 'Item not found in order'
                    });
                }
                
                const itemToUpdate = order.items[updateItemIndex];
                const oldQuantity = itemToUpdate.quantity;
                const newQuantity = quantity;
                
                // Update total
                const quantityDiff = newQuantity - oldQuantity;
                order.totalAmount += itemToUpdate.price * quantityDiff;
                
                itemToUpdate.quantity = newQuantity;
                itemToUpdate.specialInstructions = reason || itemToUpdate.specialInstructions;
                
                updateMessage = `Updated ${itemToUpdate.name} quantity from ${oldQuantity} to ${newQuantity}`;
                break;
        }
        
        // Add update note
        order.notes = order.notes || [];
        order.notes.push({
            type: 'update',
            message: updateMessage,
            updatedBy: req.userId,
            updatedByName: req.user.firstName + ' ' + req.user.lastName,
            timestamp: new Date()
        });
        
        await order.save();
        
        // Real-time notification
        const io = req.app.get('io');
        if (io) {
            io.to(`table:${order.tableNumber}`).emit('order-updated', {
                orderId: order._id,
                orderNumber: order.orderNumber,
                action,
                message: updateMessage,
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({
            success: true,
            message: 'Order updated successfully',
            order: {
                id: order._id,
                orderNumber: order.orderNumber,
                items: order.items,
                totalAmount: order.totalAmount,
                status: order.status
            }
        });
        
    } catch (error) {
        console.error('Update order error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   GET /api/chef/performance
// @desc    Get chef performance metrics
// @access  Private (Chef)
router.get('/performance', auth, isChef, async (req, res) => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        // Get chef's completed orders in last 30 days
        const completedOrders = await Order.find({
            assignedChef: req.userId,
            status: 'completed',
            completedAt: { $gte: thirtyDaysAgo }
        });
        
        // Calculate metrics
        const totalOrders = completedOrders.length;
        const totalRevenue = completedOrders.reduce((sum, order) => sum + order.totalAmount, 0);
        
        // Average preparation time
        const prepTimes = completedOrders
            .filter(order => order.actualPrepTime)
            .map(order => order.actualPrepTime);
        
        const avgPrepTime = prepTimes.length > 0 
            ? Math.round(prepTimes.reduce((sum, time) => sum + time, 0) / prepTimes.length)
            : 0;
        
        // Most prepared items
        const itemCounts = {};
        completedOrders.forEach(order => {
            order.items.forEach(item => {
                const itemName = item.name;
                itemCounts[itemName] = (itemCounts[itemName] || 0) + item.quantity;
            });
        });
        
        const topItems = Object.entries(itemCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        
        // Daily performance
        const dailyStats = {};
        completedOrders.forEach(order => {
            const date = order.completedAt.toISOString().split('T')[0];
            if (!dailyStats[date]) {
                dailyStats[date] = { orders: 0, revenue: 0 };
            }
            dailyStats[date].orders++;
            dailyStats[date].revenue += order.totalAmount;
        });
        
        const dailyPerformance = Object.entries(dailyStats)
            .map(([date, stats]) => ({
                date,
                orders: stats.orders,
                revenue: stats.revenue
            }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        res.json({
            success: true,
            performance: {
                chefName: req.user.firstName + ' ' + req.user.lastName,
                period: 'Last 30 days',
                metrics: {
                    totalOrders,
                    totalRevenue,
                    averageOrderValue: totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : 0,
                    averagePrepTime: avgPrepTime,
                    efficiency: avgPrepTime > 0 ? Math.min(100, Math.round(150 / avgPrepTime * 100)) : 0 // Score out of 100
                },
                topItems,
                dailyPerformance
            }
        });
        
    } catch (error) {
        console.error('Get chef performance error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router;
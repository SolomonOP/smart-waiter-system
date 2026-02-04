const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { Order, MenuItem, Table } = require('../models');

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

module.exports = router;
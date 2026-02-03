const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { check, validationResult } = require('express-validator');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const User = require('../models/User');

// Get all orders for chef
router.get('/orders', auth, async (req, res) => {
    try {
        const orders = await Order.find({
            status: { $in: ['pending', 'preparing', 'ready'] }
        })
        .populate('customer', 'firstName lastName email')
        .sort({ createdAt: -1 });
        
        res.json({ orders });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get service requests
router.get('/service-requests', auth, async (req, res) => {
    try {
        // In a real system, you would have a ServiceRequest model
        // For now, we'll get service requests from orders
        const orders = await Order.find({
            'serviceRequests.status': 'pending'
        });
        
        const serviceRequests = [];
        orders.forEach(order => {
            order.serviceRequests.forEach(request => {
                if (request.status === 'pending') {
                    serviceRequests.push({
                        _id: `${order._id}-${request.type}`,
                        type: request.type,
                        tableNumber: request.tableNumber,
                        orderId: order._id,
                        createdAt: order.createdAt
                    });
                }
            });
        });
        
        res.json({ requests: serviceRequests });
    } catch (error) {
        console.error('Error fetching service requests:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Accept order
router.post('/orders/:id/accept', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        order.status = 'preparing';
        order.assignedChef = req.body.chefId;
        order.updatedAt = Date.now();
        
        await order.save();
        
        res.json({ message: 'Order accepted', order });
    } catch (error) {
        console.error('Error accepting order:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Reject order
router.post('/orders/:id/reject', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        order.status = 'rejected';
        order.updatedAt = Date.now();
        
        await order.save();
        
        res.json({ message: 'Order rejected', order });
    } catch (error) {
        console.error('Error rejecting order:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Mark order as ready
router.post('/orders/:id/ready', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        order.status = 'ready';
        order.updatedAt = Date.now();
        
        await order.save();
        
        res.json({ message: 'Order marked as ready', order });
    } catch (error) {
        console.error('Error marking order as ready:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Complete order
router.post('/orders/:id/complete', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        order.status = 'completed';
        order.updatedAt = Date.now();
        
        await order.save();
        
        res.json({ message: 'Order completed', order });
    } catch (error) {
        console.error('Error completing order:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Assign service request
router.post('/service-requests/:id/assign', auth, async (req, res) => {
    try {
        // In a real system, you would update the service request status
        // For now, we'll simulate the assignment
        res.json({ message: 'Service request assigned' });
    } catch (error) {
        console.error('Error assigning service request:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get menu items
router.get('/menu', auth, async (req, res) => {
    try {
        const available = req.query.available;
        let query = {};
        
        if (available !== undefined) {
            query.available = available === 'true';
        }
        
        const menuItems = await MenuItem.find(query).sort({ category: 1, name: 1 });
        res.json({ menuItems });
    } catch (error) {
        console.error('Error fetching menu:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update menu item status
router.put('/menu/:id/status', auth, async (req, res) => {
    try {
        const { available } = req.body;
        
        const menuItem = await MenuItem.findById(req.params.id);
        if (!menuItem) {
            return res.status(404).json({ message: 'Menu item not found' });
        }
        
        menuItem.available = available;
        await menuItem.save();
        
        res.json({ message: 'Menu item updated', menuItem });
    } catch (error) {
        console.error('Error updating menu item:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create new order (for phone users)
router.post('/orders/new', auth, async (req, res) => {
    try {
        const { tableNumber, items, totalAmount, chefId } = req.body;
        
        // Generate order number
        const orderCount = await Order.countDocuments();
        const orderNumber = `ORD${String(orderCount + 1).padStart(6, '0')}`;
        
        const order = new Order({
            orderNumber,
            tableNumber,
            items,
            totalAmount,
            status: 'pending',
            assignedChef: chefId,
            customer: null // Walk-in customer
        });
        
        await order.save();
        
        res.status(201).json({ message: 'Order created', order });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
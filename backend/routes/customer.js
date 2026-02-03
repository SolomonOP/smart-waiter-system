const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { check, validationResult } = require('express-validator');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const User = require('../models/User');

// Get menu items (available only)
router.get('/menu', auth, async (req, res) => {
    try {
        const available = req.query.available !== 'false';
        const menuItems = await MenuItem.find({ available }).sort({ category: 1, name: 1 });
        res.json({ menuItems });
    } catch (error) {
        console.error('Error fetching menu:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Place order
router.post('/order', auth, [
    check('tableNumber', 'Table number is required').isInt({ min: 1 }),
    check('items', 'Items are required').isArray({ min: 1 }),
    check('totalAmount', 'Total amount is required').isFloat({ min: 0 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const { tableNumber, items, totalAmount, instructions } = req.body;
        const customerId = req.user.userId;
        
        // Generate order number
        const orderCount = await Order.countDocuments();
        const orderNumber = `ORD${String(orderCount + 1).padStart(6, '0')}`;
        
        const order = new Order({
            orderNumber,
            tableNumber,
            items,
            totalAmount,
            instructions,
            customer: customerId,
            status: 'pending'
        });
        
        await order.save();
        
        // Populate customer info for response
        await order.populate('customer', 'firstName lastName email');
        
        res.status(201).json({ 
            message: 'Order placed successfully', 
            order 
        });
    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get customer orders
router.get('/orders', auth, async (req, res) => {
    try {
        const orders = await Order.find({ 
            customer: req.user.userId,
            status: { $nin: ['completed', 'rejected'] }
        }).sort({ createdAt: -1 });
        
        res.json({ orders });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Send contact message
router.post('/contact', auth, [
    check('message', 'Message is required').not().isEmpty(),
    check('subject', 'Subject is required').not().isEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const { subject, message } = req.body;
        const customer = await User.findById(req.user.userId);
        
        // In a real system, you would:
        // 1. Save the message to a database
        // 2. Send email to admin
        
        console.log('Contact message received:', {
            from: `${customer.firstName} ${customer.lastName} <${customer.email}>`,
            subject,
            message,
            timestamp: new Date()
        });
        
        res.json({ message: 'Message sent successfully' });
    } catch (error) {
        console.error('Error sending contact message:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Request service (water, cleaning, bill)
router.post('/service-request', auth, [
    check('type', 'Service type is required').isIn(['water', 'cleaning', 'bill']),
    check('tableNumber', 'Table number is required').isInt({ min: 1 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const { type, tableNumber } = req.body;
        
        // Find or create an order for this table
        let order = await Order.findOne({
            tableNumber,
            customer: req.user.userId,
            status: { $nin: ['completed', 'rejected'] }
        });
        
        if (!order) {
            // Create a minimal order for service request
            const orderCount = await Order.countDocuments();
            const orderNumber = `SRV${String(orderCount + 1).padStart(6, '0')}`;
            
            order = new Order({
                orderNumber,
                tableNumber,
                items: [],
                totalAmount: 0,
                customer: req.user.userId,
                status: 'pending'
            });
        }
        
        // Add service request
        order.serviceRequests.push({
            type,
            tableNumber,
            status: 'pending'
        });
        
        await order.save();
        
        res.json({ 
            message: 'Service request sent successfully',
            request: { type, tableNumber }
        });
    } catch (error) {
        console.error('Error sending service request:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
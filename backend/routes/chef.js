const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { Order, MenuItem, Table, User,ServiceRequest } = require('../models');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');

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

// Create PDF bill
const createPDFBill = (order) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const chunks = [];
            
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);
                resolve(pdfBuffer);
            });
            
            // Restaurant header
            doc.fontSize(24).text('SMART WAITER RESTAURANT', { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(12).text('123 Restaurant Street, Food City', { align: 'center' });
            doc.fontSize(12).text('Phone: (123) 456-7890 | Email: info@smartwaiter.com', { align: 'center' });
            doc.moveDown();
            
            // Order details
            doc.fontSize(16).text('ORDER RECEIPT', { align: 'center' });
            doc.moveDown();
            
            doc.fontSize(12);
            doc.text(`Order Number: ${order.orderNumber}`);
            doc.text(`Table Number: ${order.tableNumber}`);
            doc.text(`Customer: ${order.customerName}`);
            doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`);
            doc.text(`Time: ${new Date(order.createdAt).toLocaleTimeString()}`);
            doc.moveDown();
            
            // Items table header
            doc.text('ITEMS', { underline: true });
            doc.moveDown(0.5);
            
            // Items table
            let yPos = doc.y;
            doc.font('Helvetica-Bold');
            doc.text('Item', 50, yPos);
            doc.text('Qty', 300, yPos);
            doc.text('Price', 350, yPos);
            doc.text('Total', 400, yPos);
            
            doc.font('Helvetica');
            yPos += 20;
            
            order.items.forEach(item => {
                doc.text(item.name, 50, yPos, { width: 240 });
                doc.text(item.quantity.toString(), 300, yPos);
                doc.text(`$${item.price.toFixed(2)}`, 350, yPos);
                doc.text(`$${(item.price * item.quantity).toFixed(2)}`, 400, yPos);
                yPos += 20;
                
                // Add special instructions if any
                if (item.specialInstructions) {
                    doc.fontSize(10).text(`  Note: ${item.specialInstructions}`, 60, yPos, { width: 280 });
                    yPos += 20;
                    doc.fontSize(12);
                }
            });
            
            doc.moveDown(2);
            
            // Totals
            const totalsY = doc.y;
            doc.text(`Subtotal:`, 300, totalsY);
            doc.text(`$${order.subtotal.toFixed(2)}`, 400, totalsY);
            
            doc.text(`Tax (10%):`, 300, totalsY + 20);
            doc.text(`$${order.tax.toFixed(2)}`, 400, totalsY + 20);
            
            doc.text(`Service Charge (5%):`, 300, totalsY + 40);
            doc.text(`$${order.serviceCharge.toFixed(2)}`, 400, totalsY + 40);
            
            if (order.discount > 0) {
                doc.text(`Discount:`, 300, totalsY + 60);
                doc.text(`-$${order.discount.toFixed(2)}`, 400, totalsY + 60);
            }
            
            doc.font('Helvetica-Bold');
            doc.text(`Total Amount:`, 300, totalsY + 80);
            doc.text(`$${order.totalAmount.toFixed(2)}`, 400, totalsY + 80);
            
            doc.moveDown(3);
            doc.font('Helvetica');
            doc.fontSize(10).text('Thank you for dining with us!', { align: 'center' });
            doc.text('Please visit us again soon!', { align: 'center' });
            doc.moveDown();
            doc.text(`Chef: ${order.chefName || 'Kitchen Staff'}`, { align: 'center' });
            doc.text(`Order Status: ${order.status.toUpperCase()}`, { align: 'center' });
            
            doc.end();
            
        } catch (error) {
            reject(error);
        }
    });
};

// Send email with bill
const sendBillEmail = async (order, pdfBuffer) => {
    try {
        // Create transporter
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        
        const mailOptions = {
            from: `"Smart Waiter Restaurant" <${process.env.EMAIL_USER}>`,
            to: order.customerEmail || 'customer@example.com',
            subject: `Your Order Receipt - ${order.orderNumber}`,
            text: `Thank you for dining with us!\n\nOrder Number: ${order.orderNumber}\nTable: ${order.tableNumber}\nTotal: $${order.totalAmount.toFixed(2)}\n\nPlease find your receipt attached.\n\nWe hope to see you again soon!`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2c3e50;">Thank you for dining with us!</h2>
                    <p>Your order has been completed successfully.</p>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="margin-top: 0;">Order Details</h3>
                        <p><strong>Order Number:</strong> ${order.orderNumber}</p>
                        <p><strong>Table Number:</strong> ${order.tableNumber}</p>
                        <p><strong>Customer Name:</strong> ${order.customerName}</p>
                        <p><strong>Total Amount:</strong> $${order.totalAmount.toFixed(2)}</p>
                        <p><strong>Status:</strong> ${order.status.toUpperCase()}</p>
                        <p><strong>Chef:</strong> ${order.chefName || 'Kitchen Staff'}</p>
                    </div>
                    
                    <p>Please find your detailed receipt attached to this email.</p>
                    <p>We hope to see you again soon!</p>
                    <br>
                    <p>Best regards,<br>
                    <strong>Smart Waiter Restaurant</strong></p>
                </div>
            `,
            attachments: [
                {
                    filename: `receipt-${order.orderNumber}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };
        
        await transporter.sendMail(mailOptions);
        console.log(`Email sent for order ${order.orderNumber}`);
        
    } catch (error) {
        console.error('Email sending error:', error);
        throw error;
    }
};

// @route   GET /api/chef/orders
// @desc    Get orders for chef dashboard
// @access  Private (Chef)
router.get('/orders', auth, isChef, async (req, res) => {
    try {
        const { status } = req.query;
        
        let query = {
            status: { $in: ['pending', 'confirmed', 'preparing', 'ready', 'finished'] }
        };
        
        if (status) {
            query.status = status;
        }
        
        const orders = await Order.find(query)
            .sort({ createdAt: -1 })
            .populate('items.menuItem', 'name category preparationTime')
            .populate('customer', 'firstName lastName email')
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
            completed: todayOrders.filter(o => o.status === 'completed').length,
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
        
        order.status = 'preparing';
        order.assignedChef = req.user.id;
        order.chefName = req.user.firstName + ' ' + req.user.lastName;
        order.preparingAt = new Date();
        await order.save();
        
        const io = req.app.get('io');
        if (io) {
            io.emit('order-status-update', {
                orderId: order._id,
                orderNumber: order.orderNumber,
                status: order.status,
                chefName: order.chefName,
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({
            success: true,
            message: 'Order accepted and moved to preparing status',
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

// @route   POST /api/chef/orders/:id/complete
// @desc    Chef completes preparing order
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
        
        if (order.status !== 'preparing') {
            return res.status(400).json({
                success: false,
                message: `Order cannot be completed in ${order.status} status. Must be in 'preparing' status.`
            });
        }
        
        order.status = 'ready';
        order.readyAt = new Date();
        
        if (order.preparingAt) {
            order.actualPrepTime = Math.round((order.readyAt - order.preparingAt) / 60000);
        }
        
        await order.save();
        
        const io = req.app.get('io');
        if (io) {
            io.emit('order-status-update', {
                orderId: order._id,
                orderNumber: order.orderNumber,
                status: order.status,
                chefName: order.chefName,
                timestamp: new Date().toISOString(),
                message: 'Order is ready!'
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
        console.error('Complete order error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   GET /api/chef/orders/:id/bill
// @desc    Download bill as PDF
// @access  Private (Chef)
router.get('/orders/:id/bill', auth, isChef, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('customer', 'firstName lastName email');
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ margin: 50 });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="receipt-${order.orderNumber}.pdf"`);
        
        doc.pipe(res);
        
        // Restaurant header
        doc.fontSize(20).text('SMART WAITER RESTAURANT', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(12).text('123 Restaurant Street, Food City', { align: 'center' });
        doc.fontSize(12).text('Phone: (123) 456-7890 | Email: info@smartwaiter.com', { align: 'center' });
        doc.moveDown();
        
        // Order details
        doc.fontSize(16).text('ORDER RECEIPT', { align: 'center' });
        doc.moveDown();
        
        doc.fontSize(12);
        doc.text(`Order Number: ${order.orderNumber}`);
        doc.text(`Table Number: ${order.tableNumber}`);
        doc.text(`Customer: ${order.customerName}`);
        doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`);
        doc.text(`Time: ${new Date(order.createdAt).toLocaleTimeString()}`);
        doc.moveDown();
        
        // Items table
        doc.fontSize(14).text('Items', { underline: true });
        doc.moveDown(0.5);
        
        let yPos = doc.y;
        doc.font('Helvetica-Bold');
        doc.text('Item', 50, yPos);
        doc.text('Qty', 300, yPos);
        doc.text('Price', 350, yPos);
        doc.text('Total', 420, yPos);
        
        doc.font('Helvetica');
        yPos += 20;
        
        order.items.forEach(item => {
            doc.text(item.name, 50, yPos, { width: 240 });
            doc.text(item.quantity.toString(), 300, yPos);
            doc.text(`$${item.price.toFixed(2)}`, 350, yPos);
            doc.text(`$${(item.price * item.quantity).toFixed(2)}`, 420, yPos);
            yPos += 20;
        });
        
        doc.moveDown(2);
        
        // Totals
        const totalsY = doc.y;
        doc.text(`Subtotal:`, 300, totalsY);
        doc.text(`$${order.subtotal.toFixed(2)}`, 400, totalsY);
        
        doc.text(`Tax (10%):`, 300, totalsY + 20);
        doc.text(`$${order.tax.toFixed(2)}`, 400, totalsY + 20);
        
        doc.text(`Service Charge (5%):`, 300, totalsY + 40);
        doc.text(`$${order.serviceCharge.toFixed(2)}`, 400, totalsY + 40);
        
        if (order.discount > 0) {
            doc.text(`Discount:`, 300, totalsY + 60);
            doc.text(`-$${order.discount.toFixed(2)}`, 400, totalsY + 60);
        }
        
        doc.font('Helvetica-Bold');
        doc.text(`Total Amount:`, 300, totalsY + 80);
        doc.text(`$${order.totalAmount.toFixed(2)}`, 400, totalsY + 80);
        
        doc.moveDown(3);
        doc.font('Helvetica');
        doc.fontSize(10).text('Thank you for dining with us!', { align: 'center' });
        doc.text('Please visit us again soon!', { align: 'center' });
        
        doc.end();
        
    } catch (error) {
        console.error('Download bill error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate bill'
        });
    }
});

// @route   POST /api/chef/orders/:id/final-complete
// @desc    Final complete order with email (from ready to completed)
// @access  Private (Chef)
router.post('/orders/:id/final-complete', auth, isChef, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('customer', 'firstName lastName email');
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        if (order.status !== 'finished') {
            return res.status(400).json({
                success: false,
                message: `Order cannot be completed in ${order.status} status. Must be 'finished'.`
            });
        }
        
        // Create PDF bill first
        const pdfBuffer = await createPDFBill(order);
        
        // Send email with bill
        if (order.customer?.email) {
            try {
                await sendBillEmail(order, pdfBuffer);
            } catch (emailError) {
                console.error('Email sending failed:', emailError);
                // Continue with order completion even if email fails
            }
        }
        
        // Update order to completed status
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
            // Notify customer
            io.to(`table:${order.tableNumber}`).emit('order-completed', {
                message: 'Thank you for dining with us! Your bill has been sent to your email.',
                status: order.status,
                orderId: order._id
            });
            
            // Notify chefs to remove from their lists
            io.emit('order-status-update', {
                orderId: order._id,
                orderNumber: order.orderNumber,
                status: order.status,
                message: 'Order completed successfully',
                timestamp: new Date().toISOString()
            });
            
            // Emit specific event to remove order from chefs' dashboards
            io.emit('order-completed-by-chef', {
                orderId: order._id,
                orderNumber: order.orderNumber,
                message: 'Order completed and removed'
            });
        }
        
        res.json({
            success: true,
            message: 'Order completed successfully. Bill sent to customer email.',
            order: {
                id: order._id,
                orderNumber: order.orderNumber,
                status: order.status,
                completedAt: order.completedAt
            }
        });
        
    } catch (error) {
        console.error('Final complete error:', error);
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
        const serviceRequests = await ServiceRequest.find({
            status: 'pending'
        })
        .populate('table', 'tableNumber')
        .populate('customer', 'firstName lastName email')
        .populate('order', 'orderNumber')
        .sort({ createdAt: -1 });
        
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
        const serviceRequest = await ServiceRequest.findById(req.params.id);
        
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
        serviceRequest.assignedToName = req.user.firstName + ' ' + req.user.lastName;
        await serviceRequest.save();
        
        const io = req.app.get('io');
        if (io) {
            io.to(`table:${serviceRequest.tableNumber}`).emit('service-request-accepted', {
                message: `Chef ${serviceRequest.assignedToName} is handling your request`,
                requestType: serviceRequest.type,
                requestId: serviceRequest._id
            });
        }
        
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
        const serviceRequest = await ServiceRequest.findById(req.params.id);
        
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
        await serviceRequest.save();
        
        const io = req.app.get('io');
        if (io) {
            io.to(`table:${serviceRequest.tableNumber}`).emit('service-request-completed', {
                message: 'Your service request has been completed',
                requestType: serviceRequest.type,
                requestId: serviceRequest._id
            });
        }
        
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
// @desc    Get menu items for chef (including unavailable)
// @access  Private (Chef)
router.get('/menu', auth, isChef, async (req, res) => {
    try {
        const { category, available, showUnavailable = 'true' } = req.query;
        
        let query = {};
        
        if (category && category !== 'all') {
            query.category = category;
        }
        
        // Show both available and unavailable items by default
        if (available !== undefined) {
            query.available = available === 'true';  // FIXED: Use 'available'
        }
        
        const menuItems = await MenuItem.find(query)
            .sort({ available: -1, category: 1, name: 1 });
        
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
    check('available', 'Available status is required').isBoolean()  // FIXED
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }
        
        const { available } = req.body;  // FIXED: Use 'available'
        
        const menuItem = await MenuItem.findById(req.params.id);
        
        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: 'Menu item not found'
            });
        }
        
        menuItem.available = available;  // FIXED: Use 'available'
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
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }
        
        const { tableNumber, items, specialInstructions, customerName, customerEmail } = req.body;
        
        // Check table exists
        const table = await Table.findOne({ tableNumber, isActive: true });
        if (!table) {
            return res.status(400).json({
                success: false,
                message: 'Table not found or inactive'
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
            
            if (!menuItem.available) {  // FIXED: Use 'available'
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
        const estimatedPrepTime = 15;
        
        // Calculate totals
        const subtotal = totalAmount;
        const tax = subtotal * 0.1;
        const serviceCharge = subtotal * 0.05;
        const finalTotal = subtotal + tax + serviceCharge;
        
        // Create order
        const order = new Order({
            tableNumber,
            customerName: customerName || 'Walk-in Customer',
            customerEmail: customerEmail || null,
            items: orderItems,
            subtotal,
            tax,
            serviceCharge,
            totalAmount: finalTotal,
            paymentMethod: 'pending',
            paymentStatus: 'pending',
            specialInstructions: specialInstructions || '',
            estimatedPrepTime,
            status: 'pending',
            assignedChef: req.user.id,
            chefName: req.user.firstName + ' ' + req.user.lastName,
            orderType: 'walk-in'
        });
        
        // Generate order number
        const now = new Date();
        const year = now.getFullYear().toString().slice(-2);
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const timestamp = Date.now().toString().slice(-6);
        order.orderNumber = `ORD${year}${month}${day}${timestamp}`;
        
        await order.save();
        
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
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// @route   POST /api/chef/orders/:id/finish
// @desc    Chef finishes a ready order (ready -> finished)
// @access  Private (Chef)
router.post('/orders/:id/finish', auth, isChef, async (req, res) => {
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
                message: `Order cannot be finished in ${order.status} status. Must be 'ready'.`
            });
        }
        
        order.status = 'finished';
        order.finishedAt = new Date();
        await order.save();
        
        const io = req.app.get('io');
        if (io) {
            io.emit('order-status-update', {
                orderId: order._id,
                orderNumber: order.orderNumber,
                status: order.status,
                chefName: order.chefName,
                timestamp: new Date().toISOString(),
                message: 'Order finished and ready for payment'
            });
        }
        
        res.json({
            success: true,
            message: 'Order marked as finished. Ready for payment.',
            order: {
                id: order._id,
                orderNumber: order.orderNumber,
                status: order.status,
                finishedAt: order.finishedAt
            }
        });
        
    } catch (error) {
        console.error('Finish order error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
});

// @route   POST /api/chef/orders/:id/mark-paid
// @desc    Mark order as paid and complete it
// @access  Private (Chef)
router.post('/orders/:id/mark-paid', auth, isChef, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('customer', 'firstName lastName email');
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        if (order.status !== 'finished') {
            return res.status(400).json({
                success: false,
                message: `Order cannot be marked as paid in ${order.status} status. Must be 'finished'.`
            });
        }
        
        // Update order to completed status
        order.status = 'completed';
        order.paymentMethod = 'cash';
        order.paymentStatus = 'paid';
        order.completedAt = new Date();
        order.paidAt = new Date();
        await order.save();
        
        const io = req.app.get('io');
        if (io) {
            io.emit('order-completed-by-chef', {
                orderId: order._id,
                orderNumber: order.orderNumber,
                tableNumber: order.tableNumber,
                status: order.status,
                message: 'Order marked as paid and completed',
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({
            success: true,
            message: 'Order marked as paid and completed successfully.',
            order: {
                id: order._id,
                orderNumber: order.orderNumber,
                status: order.status,
                paymentMethod: order.paymentMethod,
                paymentStatus: order.paymentStatus,
                completedAt: order.completedAt,
                paidAt: order.paidAt
            }
        });
        
    } catch (error) {
        console.error('Mark as paid error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
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
        
        const todayOrders = await Order.find({
            createdAt: { $gte: today, $lt: tomorrow }
        });
        
        const stats = {
            pending: todayOrders.filter(o => o.status === 'pending' || o.status === 'confirmed').length,
            preparing: todayOrders.filter(o => o.status === 'preparing').length,
            ready: todayOrders.filter(o => o.status === 'ready').length,
            finished: todayOrders.filter(o => o.status === 'finished').length,
            completed: todayOrders.filter(o => o.status === 'completed').length,
            totalToday: todayOrders.length
        };
        
        const recentOrders = await Order.find({
            status: { $in: ['pending', 'confirmed', 'preparing', 'ready', 'finished'] }
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('items.menuItem', 'name')
        .populate('customer', 'firstName lastName email');
        
        const serviceRequests = await ServiceRequest.find({
            status: 'pending'
        })
        .populate('table', 'tableNumber')
        .populate('customer', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(5);
        
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

// @route   GET /api/chef/service-requests
// @desc    Get all pending service requests
// @access  Private (Chef)
router.get('/service-requests', auth, async (req, res) => {
    try {
        // Check if user is chef or admin
        if (req.userRole !== 'chef' && req.userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }
        
        // Get tables with pending service requests
        const tables = await Table.find({
            'serviceRequests.status': 'pending',
            isActive: true
        })
        .select('tableNumber status serviceRequests')
        .sort({ 'serviceRequests.createdAt': 1 });
        
        // Extract and flatten service requests
        const serviceRequests = [];
        tables.forEach(table => {
            table.serviceRequests.forEach(request => {
                if (request.status === 'pending') {
                    serviceRequests.push({
                        _id: request._id,
                        type: request.type,
                        tableNumber: table.tableNumber,
                        description: request.description,
                        customerName: request.customerName,
                        priority: request.priority,
                        createdAt: request.createdAt,
                        tableStatus: table.status
                    });
                }
            });
        });
        
        // Sort by priority and creation time
        serviceRequests.sort((a, b) => {
            const priorityOrder = { 'urgent': 0, 'high': 1, 'normal': 2, 'low': 3 };
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            }
            return new Date(a.createdAt) - new Date(b.createdAt);
        });
        
        res.json({
            success: true,
            count: serviceRequests.length,
            serviceRequests: serviceRequests
        });
        
    } catch (error) {
        console.error('Get service requests error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   PUT /api/chef/service-requests/:requestId/acknowledge
// @desc    Acknowledge a service request
// @access  Private (Chef)
router.put('/service-requests/:requestId/acknowledge', auth, async (req, res) => {
    try {
        // Check if user is chef or admin
        if (req.userRole !== 'chef' && req.userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }
        
        const { requestId } = req.params;
        
        // Find table with this service request
        const table = await Table.findOne({
            'serviceRequests._id': requestId
        });
        
        if (!table) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }
        
        // Update the specific service request
        const serviceRequest = table.serviceRequests.id(requestId);
        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }
        
        serviceRequest.status = 'acknowledged';
        serviceRequest.assignedTo = req.userId;
        serviceRequest.acknowledgedAt = new Date();
        
        await table.save();
        
        // Real-time notification
        const io = req.app.get('io');
        if (io) {
            io.to(`table:${table.tableNumber}`).emit('service-request-acknowledged', {
                requestId: requestId,
                type: serviceRequest.type,
                tableNumber: table.tableNumber,
                message: `Your ${getServiceTypeName(serviceRequest.type)} request has been acknowledged`,
                chefName: req.user.firstName + ' ' + req.user.lastName,
                timestamp: new Date().toISOString()
            });
            
            io.to('role:chef').emit('service-request-updated', {
                requestId: requestId,
                tableNumber: table.tableNumber,
                status: 'acknowledged',
                assignedTo: req.user.firstName + ' ' + req.user.lastName
            });
        }
        
        res.json({
            success: true,
            message: 'Service request acknowledged',
            request: {
                id: serviceRequest._id,
                type: serviceRequest.type,
                tableNumber: table.tableNumber,
                status: serviceRequest.status,
                assignedTo: req.user.firstName + ' ' + req.user.lastName
            }
        });
        
    } catch (error) {
        console.error('Acknowledge service request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   PUT /api/chef/service-requests/:requestId/complete
// @desc    Complete a service request
// @access  Private (Chef)
router.put('/service-requests/:requestId/complete', auth, async (req, res) => {
    try {
        // Check if user is chef or admin
        if (req.userRole !== 'chef' && req.userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }
        
        const { requestId } = req.params;
        const { notes } = req.body;
        
        // Find table with this service request
        const table = await Table.findOne({
            'serviceRequests._id': requestId
        });
        
        if (!table) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }
        
        // Update the specific service request
        const serviceRequest = table.serviceRequests.id(requestId);
        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }
        
        serviceRequest.status = 'completed';
        serviceRequest.completedAt = new Date();
        if (notes) {
            serviceRequest.notes = notes;
        }
        
        await table.save();
        
        // Real-time notification
        const io = req.app.get('io');
        if (io) {
            io.to(`table:${table.tableNumber}`).emit('service-request-completed', {
                requestId: requestId,
                type: serviceRequest.type,
                tableNumber: table.tableNumber,
                message: `Your ${getServiceTypeName(serviceRequest.type)} request has been completed`,
                timestamp: new Date().toISOString()
            });
            
            io.to('role:chef').emit('service-request-removed', {
                requestId: requestId,
                tableNumber: table.tableNumber
            });
        }
        
        res.json({
            success: true,
            message: 'Service request completed',
            request: {
                id: serviceRequest._id,
                type: serviceRequest.type,
                tableNumber: table.tableNumber,
                status: serviceRequest.status,
                completedAt: serviceRequest.completedAt
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

module.exports = router;
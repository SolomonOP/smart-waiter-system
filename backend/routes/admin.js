const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { Order, MenuItem, Table, User } = require('../models');

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (req.userRole !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Admin role required.'
        });
    }
    next();
};

// @route   GET /api/admin/stats
// @desc    Get admin dashboard statistics
// @access  Private (Admin)
router.get('/stats', auth, isAdmin, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        // Today's revenue
        const todayOrders = await Order.find({
            createdAt: { $gte: today, $lt: tomorrow },
            status: 'completed'
        });
        
        const todayRevenue = todayOrders.reduce((sum, order) => sum + order.totalAmount, 0);
        
        // Yesterday's revenue for comparison
        const yesterdayOrders = await Order.find({
            createdAt: { $gte: yesterday, $lt: today },
            status: 'completed'
        });
        
        const yesterdayRevenue = yesterdayOrders.reduce((sum, order) => sum + order.totalAmount, 0);
        
        // Revenue change percentage
        let revenueChange = 0;
        if (yesterdayRevenue > 0) {
            revenueChange = ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
        }
        
        // Today's orders count
        const todayOrdersCount = await Order.countDocuments({
            createdAt: { $gte: today, $lt: tomorrow }
        });
        
        // Yesterday's orders count
        const yesterdayOrdersCount = await Order.countDocuments({
            createdAt: { $gte: yesterday, $lt: today }
        });
        
        // Orders change percentage
        let ordersChange = 0;
        if (yesterdayOrdersCount > 0) {
            ordersChange = ((todayOrdersCount - yesterdayOrdersCount) / yesterdayOrdersCount) * 100;
        }
        
        // Today's customers (unique)
        const todayCustomerEmails = [...new Set(todayOrders.map(order => order.customerEmail))];
        const todayCustomers = todayCustomerEmails.length;
        
        // Active tables
        const totalTables = await Table.countDocuments({ isActive: true });
        const occupiedTables = await Table.countDocuments({ 
            status: 'occupied',
            isActive: true 
        });
        
        // Pending orders
        const pendingOrders = await Order.countDocuments({
            status: { $in: ['pending', 'confirmed', 'preparing'] }
        });
        
        // Menu items availability
        const totalMenuItems = await MenuItem.countDocuments();
        const availableMenuItems = await MenuItem.countDocuments({ available: true });
        
        // Staff counts
        const totalStaff = await User.countDocuments({ 
            role: { $in: ['chef', 'admin'] },
            isActive: true 
        });
        
        res.json({
            success: true,
            stats: {
                revenue: {
                    today: todayRevenue,
                    yesterday: yesterdayRevenue,
                    change: revenueChange
                },
                orders: {
                    today: todayOrdersCount,
                    yesterday: yesterdayOrdersCount,
                    change: ordersChange,
                    pending: pendingOrders
                },
                customers: {
                    today: todayCustomers
                },
                tables: {
                    total: totalTables,
                    occupied: occupiedTables,
                    available: totalTables - occupiedTables
                },
                menu: {
                    total: totalMenuItems,
                    available: availableMenuItems,
                    unavailable: totalMenuItems - availableMenuItems
                },
                staff: {
                    total: totalStaff
                }
            }
        });
        
    } catch (error) {
        console.error('Get admin stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   GET /api/admin/revenue/daily
// @desc    Get daily revenue for last 7 days
// @access  Private (Admin)
router.get('/revenue/daily', auth, isAdmin, async (req, res) => {
    try {
        const days = 7;
        const revenueData = [];
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);
            
            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);
            
            const dayOrders = await Order.find({
                createdAt: { $gte: date, $lt: nextDate },
                status: 'completed'
            });
            
            const dayRevenue = dayOrders.reduce((sum, order) => sum + order.totalAmount, 0);
            const dayOrdersCount = dayOrders.length;
            
            revenueData.push({
                date: date.toISOString().split('T')[0],
                day: date.toLocaleDateString('en-US', { weekday: 'short' }),
                revenue: dayRevenue,
                orders: dayOrdersCount,
                averageOrderValue: dayOrdersCount > 0 ? dayRevenue / dayOrdersCount : 0
            });
        }
        
        res.json({
            success: true,
            period: '7days',
            data: revenueData
        });
        
    } catch (error) {
        console.error('Get daily revenue error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   GET /api/admin/orders/recent
// @desc    Get recent orders
// @access  Private (Admin)
router.get('/orders/recent', auth, isAdmin, async (req, res) => {
    try {
        const { limit = 20 } = req.query;
        
        const orders = await Order.find()
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .populate('customer', 'firstName lastName email')
            .populate('assignedChef', 'firstName lastName');
        
        res.json({
            success: true,
            count: orders.length,
            orders
        });
        
    } catch (error) {
        console.error('Get recent orders error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   GET /api/admin/orders
// @desc    Get all orders with filters
// @access  Private (Admin)
router.get('/orders', auth, isAdmin, async (req, res) => {
    try {
        const { 
            status, 
            startDate, 
            endDate, 
            tableNumber,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            limit = 50,
            page = 1 
        } = req.query;
        
        // Build query
        let query = {};
        
        if (status) {
            query.status = status;
        }
        
        if (tableNumber) {
            query.tableNumber = parseInt(tableNumber);
        }
        
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                query.createdAt.$gte = start;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.createdAt.$lte = end;
            }
        }
        
        // Pagination
        const pageNumber = parseInt(page);
        const pageSize = parseInt(limit);
        const skip = (pageNumber - 1) * pageSize;
        
        // Sort
        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
        
        const orders = await Order.find(query)
            .sort(sort)
            .skip(skip)
            .limit(pageSize)
            .populate('customer', 'firstName lastName email')
            .populate('assignedChef', 'firstName lastName')
            .populate('items.menuItem', 'name category');
        
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

// @route   GET /api/admin/orders/:id
// @desc    Get order details
// @access  Private (Admin)
router.get('/orders/:id', auth, isAdmin, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('customer', 'firstName lastName email phone')
            .populate('assignedChef', 'firstName lastName email')
            .populate('items.menuItem', 'name description price category image');
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        res.json({
            success: true,
            order
        });
        
    } catch (error) {
        console.error('Get order details error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   PUT /api/admin/orders/:id/status
// @desc    Update order status
// @access  Private (Admin)
router.put('/orders/:id/status', auth, isAdmin, [
    check('status', 'Valid status is required').isIn([
        'pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled', 'rejected'
    ])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }
        
        const { status } = req.body;
        
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        // Update order
        order.status = status;
        order.updatedAt = new Date();
        
        // Set timestamps based on status
        if (status === 'preparing' && !order.preparingAt) {
            order.preparingAt = new Date();
        } else if (status === 'ready' && !order.readyAt) {
            order.readyAt = new Date();
        } else if (status === 'completed' && !order.completedAt) {
            order.completedAt = new Date();
            order.servedAt = new Date();
        } else if (status === 'cancelled' && !order.cancelledAt) {
            order.cancelledAt = new Date();
        }
        
        await order.save();
        
        // Real-time notification
        const io = req.app.get('io');
        if (io) {
            io.to(`table:${order.tableNumber}`).emit('order-status-changed', {
                orderId: order._id,
                orderNumber: order.orderNumber,
                status: order.status,
                message: `Order status updated to ${status}`,
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({
            success: true,
            message: 'Order status updated',
            order: {
                id: order._id,
                orderNumber: order.orderNumber,
                status: order.status,
                updatedAt: order.updatedAt
            }
        });
        
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   GET /api/admin/menu
// @desc    Get all menu items
// @access  Private (Admin)
router.get('/menu', auth, isAdmin, async (req, res) => {
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
        console.error('Get menu error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   POST /api/admin/menu
// @desc    Create new menu item
// @access  Private (Admin)
router.post('/menu', auth, isAdmin, [
    check('name', 'Name is required').not().isEmpty().trim().escape(),
    check('description', 'Description is required').not().isEmpty().trim().escape(),
    check('price', 'Valid price is required').isFloat({ min: 0 }),
    check('category', 'Valid category is required').isIn([
        'appetizer', 'main', 'dessert', 'drink', 'soup', 'salad'
    ])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }
        
        const { 
            name, 
            description, 
            price, 
            category, 
            subCategory,
            available = true,
            vegetarian = false,
            vegan = false,
            glutenFree = false,
            popular = false,
            preparationTime = 15,
            ingredients = [],
            allergens = []
        } = req.body;
        
        const menuItem = new MenuItem({
            name,
            description,
            price,
            originalPrice: price,
            category,
            subCategory,
            available,
            vegetarian,
            vegan,
            glutenFree,
            popular,
            preparationTime,
            ingredients,
            allergens
        });
        
        await menuItem.save();
        
        res.status(201).json({
            success: true,
            message: 'Menu item created successfully',
            menuItem
        });
        
    } catch (error) {
        console.error('Create menu item error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   PUT /api/admin/menu/:id
// @desc    Update menu item
// @access  Private (Admin)
router.put('/menu/:id', auth, isAdmin, [
    check('name', 'Name is required').optional().not().isEmpty().trim().escape(),
    check('description', 'Description is required').optional().not().isEmpty().trim().escape(),
    check('price', 'Valid price is required').optional().isFloat({ min: 0 }),
    check('category', 'Valid category is required').optional().isIn([
        'appetizer', 'main', 'dessert', 'drink', 'soup', 'salad'
    ]),
    check('available', 'Available must be boolean').optional().isBoolean()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }
        
        const menuItem = await MenuItem.findById(req.params.id);
        
        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: 'Menu item not found'
            });
        }
        
        // Update fields
        const updates = req.body;
        
        // Remove restricted fields
        delete updates._id;
        delete updates.createdAt;
        delete updates.orderCount;
        
        Object.keys(updates).forEach(key => {
            menuItem[key] = updates[key];
        });
        
        menuItem.updatedAt = new Date();
        await menuItem.save();
        
        res.json({
            success: true,
            message: 'Menu item updated successfully',
            menuItem
        });
        
    } catch (error) {
        console.error('Update menu item error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   DELETE /api/admin/menu/:id
// @desc    Delete menu item
// @access  Private (Admin)
router.delete('/menu/:id', auth, isAdmin, async (req, res) => {
    try {
        const menuItem = await MenuItem.findById(req.params.id);
        
        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: 'Menu item not found'
            });
        }
        
        // Check if menu item is referenced in any orders
        const orderWithItem = await Order.findOne({ 'items.menuItem': req.params.id });
        if (orderWithItem) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete menu item that is referenced in orders. Disable it instead.'
            });
        }
        
        await menuItem.deleteOne();
        
        res.json({
            success: true,
            message: 'Menu item deleted successfully'
        });
        
    } catch (error) {
        console.error('Delete menu item error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   GET /api/admin/tables
// @desc    Get all tables
// @access  Private (Admin)
router.get('/tables', auth, isAdmin, async (req, res) => {
    try {
        const tables = await Table.find()
            .sort({ tableNumber: 1 })
            .populate('currentOrder', 'orderNumber status totalAmount')
            .populate('currentCustomer', 'firstName lastName');
        
        res.json({
            success: true,
            count: tables.length,
            tables
        });
        
    } catch (error) {
        console.error('Get tables error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   POST /api/admin/tables
// @desc    Create new table(s)
// @access  Private (Admin)
router.post('/tables', auth, isAdmin, [
    check('tableNumber', 'Table number is required').isInt({ min: 1 }),
    check('capacity', 'Capacity must be between 1 and 20').isInt({ min: 1, max: 20 }),
    check('location', 'Location is required').optional().isIn(['indoor', 'outdoor', 'terrace', 'private', 'vip']),
    check('section', 'Section cannot exceed 50 characters').optional().isLength({ max: 50 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }
        
        const { tableNumber, capacity, location, section, tableName } = req.body;
        
        // Check if table number already exists
        const existingTable = await Table.findOne({ tableNumber });
        if (existingTable) {
            return res.status(400).json({
                success: false,
                message: `Table number ${tableNumber} already exists`
            });
        }
        
        const table = new Table({
            tableNumber,
            tableName,
            capacity,
            location: location || 'indoor',
            section,
            status: 'available'
        });
        
        await table.save();
        
        res.status(201).json({
            success: true,
            message: 'Table created successfully',
            table
        });
        
    } catch (error) {
        console.error('Create table error:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Table number already exists'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   PUT /api/admin/tables/:id
// @desc    Update table
// @access  Private (Admin)
router.put('/tables/:id', auth, isAdmin, [
    check('tableNumber', 'Table number must be at least 1').optional().isInt({ min: 1 }),
    check('capacity', 'Capacity must be between 1 and 20').optional().isInt({ min: 1, max: 20 }),
    check('status', 'Valid status is required').optional().isIn([
        'available', 'occupied', 'reserved', 'maintenance', 'cleaning'
    ]),
    check('isActive', 'isActive must be boolean').optional().isBoolean()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }
        
        const table = await Table.findById(req.params.id);
        
        if (!table) {
            return res.status(404).json({
                success: false,
                message: 'Table not found'
            });
        }
        
        // Update fields
        const updates = req.body;
        
        // Check if table number is being changed and if it already exists
        if (updates.tableNumber && updates.tableNumber !== table.tableNumber) {
            const existingTable = await Table.findOne({ tableNumber: updates.tableNumber });
            if (existingTable) {
                return res.status(400).json({
                    success: false,
                    message: `Table number ${updates.tableNumber} already exists`
                });
            }
        }
        
        Object.keys(updates).forEach(key => {
            table[key] = updates[key];
        });
        
        table.updatedAt = new Date();
        await table.save();
        
        res.json({
            success: true,
            message: 'Table updated successfully',
            table
        });
        
    } catch (error) {
        console.error('Update table error:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Table number already exists'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   DELETE /api/admin/tables/:id
// @desc    Delete table
// @access  Private (Admin)
router.delete('/tables/:id', auth, isAdmin, async (req, res) => {
    try {
        const table = await Table.findById(req.params.id);
        
        if (!table) {
            return res.status(404).json({
                success: false,
                message: 'Table not found'
            });
        }
        
        // Check if table is occupied
        if (table.status === 'occupied') {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete occupied table'
            });
        }
        
        // Check if table has active order
        if (table.currentOrder) {
            const activeOrder = await Order.findById(table.currentOrder);
            if (activeOrder && !['completed', 'cancelled', 'rejected'].includes(activeOrder.status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete table with active order'
                });
            }
        }
        
        await table.deleteOne();
        
        res.json({
            success: true,
            message: 'Table deleted successfully'
        });
        
    } catch (error) {
        console.error('Delete table error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   GET /api/admin/staff
// @desc    Get all staff members
// @access  Private (Admin)
router.get('/staff', auth, isAdmin, async (req, res) => {
    try {
        const { role, isActive } = req.query;
        
        let query = { role: { $in: ['chef', 'admin'] } };
        
        if (role) {
            query.role = role;
        }
        
        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }
        
        const staff = await User.find(query)
            .select('-password')
            .sort({ role: 1, firstName: 1 });
        
        res.json({
            success: true,
            count: staff.length,
            staff
        });
        
    } catch (error) {
        console.error('Get staff error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   POST /api/admin/staff
// @desc    Create new staff member
// @access  Private (Admin)
router.post('/staff', auth, isAdmin, [
    check('firstName', 'First name is required').not().isEmpty().trim().escape(),
    check('lastName', 'Last name is required').not().isEmpty().trim().escape(),
    check('email', 'Valid email is required').isEmail().normalizeEmail(),
    check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
    check('phone', 'Phone number is required').not().isEmpty().trim().escape(),
    check('role', 'Valid role is required').isIn(['chef', 'admin'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }
        
        const { firstName, lastName, email, password, phone, role } = req.body;
        
        // Check if user already exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            });
        }
        
        // Check if email is a demo account
        const demoEmails = ['admin@demo.com', 'chef@demo.com', 'customer@demo.com'];
        if (demoEmails.includes(email)) {
            return res.status(400).json({
                success: false,
                message: 'Email is reserved for demo accounts'
            });
        }
        
        user = new User({
            firstName,
            lastName,
            email,
            password,
            phone,
            role,
            isActive: true
        });
        
        await user.save();
        
        // Remove password from response
        user = user.toObject();
        delete user.password;
        
        res.status(201).json({
            success: true,
            message: 'Staff member created successfully',
            user
        });
        
    } catch (error) {
        console.error('Create staff error:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   PUT /api/admin/staff/:id
// @desc    Update staff member
// @access  Private (Admin)
router.put('/staff/:id', auth, isAdmin, [
    check('firstName', 'First name is required').optional().not().isEmpty().trim().escape(),
    check('lastName', 'Last name is required').optional().not().isEmpty().trim().escape(),
    check('phone', 'Phone number is required').optional().not().isEmpty().trim().escape(),
    check('role', 'Valid role is required').optional().isIn(['chef', 'admin']),
    check('isActive', 'isActive must be boolean').optional().isBoolean()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }
        
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Staff member not found'
            });
        }
        
        // Check if trying to update demo accounts
        const demoEmails = ['admin@demo.com', 'chef@demo.com', 'customer@demo.com'];
        if (demoEmails.includes(user.email)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot modify demo accounts'
            });
        }
        
        // Update fields
        const updates = req.body;
        
        // Remove restricted fields
        delete updates.email;
        delete updates.password;
        delete updates.createdAt;
        
        Object.keys(updates).forEach(key => {
            user[key] = updates[key];
        });
        
        user.updatedAt = new Date();
        await user.save();
        
        // Remove password from response
        const userResponse = user.toObject();
        delete userResponse.password;
        
        res.json({
            success: true,
            message: 'Staff member updated successfully',
            user: userResponse
        });
        
    } catch (error) {
        console.error('Update staff error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   DELETE /api/admin/staff/:id
// @desc    Delete staff member
// @access  Private (Admin)
router.delete('/staff/:id', auth, isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Staff member not found'
            });
        }
        
        // Check if trying to delete demo accounts
        const demoEmails = ['admin@demo.com', 'chef@demo.com', 'customer@demo.com'];
        if (demoEmails.includes(user.email)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete demo accounts'
            });
        }
        
        // Check if chef has assigned orders
        if (user.role === 'chef') {
            const assignedOrders = await Order.findOne({
                assignedChef: user._id,
                status: { $in: ['pending', 'confirmed', 'preparing'] }
            });
            
            if (assignedOrders) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete chef with assigned orders. Reassign orders first.'
                });
            }
        }
        
        // Soft delete - deactivate instead of deleting
        user.isActive = false;
        await user.save();
        
        res.json({
            success: true,
            message: 'Staff member deactivated successfully'
        });
        
    } catch (error) {
        console.error('Delete staff error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   GET /api/admin/analytics/sales
// @desc    Get sales analytics
// @access  Private (Admin)
router.get('/analytics/sales', auth, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate, groupBy = 'day' } = req.query;
        
        // Set date range
        let start = new Date();
        start.setDate(start.getDate() - 30); // Default: last 30 days
        start.setHours(0, 0, 0, 0);
        
        let end = new Date();
        end.setHours(23, 59, 59, 999);
        
        if (startDate) {
            start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
        }
        
        if (endDate) {
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
        }
        
        const orders = await Order.find({
            createdAt: { $gte: start, $lte: end },
            status: 'completed'
        }).sort({ createdAt: 1 });
        
        // Group orders
        const groupedData = {};
        const categories = {};
        const popularItems = {};
        
        orders.forEach(order => {
            // Group by date
            const dateKey = groupBy === 'day' 
                ? order.createdAt.toISOString().split('T')[0]
                : order.createdAt.toISOString().substring(0, 7); // month
            
            if (!groupedData[dateKey]) {
                groupedData[dateKey] = {
                    date: dateKey,
                    revenue: 0,
                    orders: 0,
                    items: 0,
                    averageOrderValue: 0
                };
            }
            
            groupedData[dateKey].revenue += order.totalAmount;
            groupedData[dateKey].orders += 1;
            groupedData[dateKey].items += order.items.reduce((sum, item) => sum + item.quantity, 0);
            
            // Track categories
            order.items.forEach(item => {
                if (item.menuItem && item.menuItem.category) {
                    const category = item.menuItem.category;
                    categories[category] = (categories[category] || 0) + item.quantity;
                }
                
                // Track popular items
                const itemName = item.name;
                popularItems[itemName] = (popularItems[itemName] || 0) + item.quantity;
            });
        });
        
        // Calculate averages
        Object.values(groupedData).forEach(data => {
            data.averageOrderValue = data.orders > 0 ? data.revenue / data.orders : 0;
        });
        
        // Sort grouped data by date
        const sortedData = Object.values(groupedData).sort((a, b) => a.date.localeCompare(b.date));
        
        // Get top categories
        const topCategories = Object.entries(categories)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));
        
        // Get top items
        const topItems = Object.entries(popularItems)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));
        
        // Calculate totals
        const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
        const totalOrders = orders.length;
        const totalItems = orders.reduce((sum, order) => 
            sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
        
        res.json({
            success: true,
            period: {
                start: start.toISOString(),
                end: end.toISOString(),
                days: Math.ceil((end - start) / (1000 * 60 * 60 * 24))
            },
            summary: {
                totalRevenue,
                totalOrders,
                totalItems,
                averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0
            },
            trends: sortedData,
            categories: topCategories,
            popularItems: topItems
        });
        
    } catch (error) {
        console.error('Get sales analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router;
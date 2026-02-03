const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { check, validationResult } = require('express-validator');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const User = require('../models/User');
const Table = require('../models/Table');

// Get admin statistics
router.get('/stats', auth, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Today's revenue
        const todayOrders = await Order.find({
            createdAt: { $gte: today, $lt: tomorrow },
            status: 'completed'
        });
        
        const todayRevenue = todayOrders.reduce((sum, order) => sum + order.totalAmount, 0);
        
        // Today's customers (unique customers who placed orders)
        const todayCustomerIds = [...new Set(todayOrders.map(order => order.customer?.toString()).filter(Boolean))];
        const todayCustomers = todayCustomerIds.length;
        
        // Today's orders
        const todayOrdersCount = await Order.countDocuments({
            createdAt: { $gte: today, $lt: tomorrow }
        });
        
        // Table statistics
        const totalTables = await Table.countDocuments();
        const occupiedTables = await Table.countDocuments({ status: 'occupied' });
        
        res.json({
            todayRevenue,
            todayCustomers,
            todayOrders: todayOrdersCount,
            totalTables,
            tablesOccupied: occupiedTables
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get recent orders
router.get('/orders/recent', auth, async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('customer', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .limit(10);
        
        res.json({ orders });
    } catch (error) {
        console.error('Error fetching recent orders:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get weekly revenue
router.get('/revenue/weekly', auth, async (req, res) => {
    try {
        const days = [];
        const revenue = [];
        
        for (let i = 6; i >= 0; i--) {
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
            
            days.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
            revenue.push(dayRevenue);
        }
        
        res.json({
            labels: days,
            data: revenue
        });
    } catch (error) {
        console.error('Error fetching weekly revenue:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Menu Management
// Get all menu items
router.get('/menu', auth, async (req, res) => {
    try {
        const menuItems = await MenuItem.find().sort({ category: 1, name: 1 });
        res.json({ menuItems });
    } catch (error) {
        console.error('Error fetching menu:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get single menu item
router.get('/menu/:id', auth, async (req, res) => {
    try {
        const menuItem = await MenuItem.findById(req.params.id);
        if (!menuItem) {
            return res.status(404).json({ message: 'Menu item not found' });
        }
        res.json(menuItem);
    } catch (error) {
        console.error('Error fetching menu item:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create menu item
router.post('/menu', auth, [
    check('name', 'Name is required').not().isEmpty(),
    check('description', 'Description is required').not().isEmpty(),
    check('price', 'Valid price is required').isFloat({ min: 0 }),
    check('category', 'Valid category is required').isIn(['appetizer', 'main', 'dessert', 'drink']),
    check('available', 'Availability status is required').isBoolean()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const { name, description, price, category, available, image } = req.body;
        
        const menuItem = new MenuItem({
            name,
            description,
            price,
            category,
            available,
            image: image || 'default-food.jpg'
        });
        
        await menuItem.save();
        
        res.status(201).json({ message: 'Menu item created', menuItem });
    } catch (error) {
        console.error('Error creating menu item:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update menu item
router.put('/menu/:id', auth, [
    check('name', 'Name is required').not().isEmpty(),
    check('description', 'Description is required').not().isEmpty(),
    check('price', 'Valid price is required').isFloat({ min: 0 }),
    check('category', 'Valid category is required').isIn(['appetizer', 'main', 'dessert', 'drink']),
    check('available', 'Availability status is required').isBoolean()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const { name, description, price, category, available, image } = req.body;
        
        const menuItem = await MenuItem.findById(req.params.id);
        if (!menuItem) {
            return res.status(404).json({ message: 'Menu item not found' });
        }
        
        menuItem.name = name;
        menuItem.description = description;
        menuItem.price = price;
        menuItem.category = category;
        menuItem.available = available;
        menuItem.image = image || menuItem.image;
        
        await menuItem.save();
        
        res.json({ message: 'Menu item updated', menuItem });
    } catch (error) {
        console.error('Error updating menu item:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update menu item availability
router.put('/menu/:id/availability', auth, [
    check('available', 'Availability status is required').isBoolean()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const { available } = req.body;
        
        const menuItem = await MenuItem.findById(req.params.id);
        if (!menuItem) {
            return res.status(404).json({ message: 'Menu item not found' });
        }
        
        menuItem.available = available;
        await menuItem.save();
        
        res.json({ message: 'Menu item availability updated', menuItem });
    } catch (error) {
        console.error('Error updating menu item availability:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete menu item
router.delete('/menu/:id', auth, async (req, res) => {
    try {
        const menuItem = await MenuItem.findById(req.params.id);
        if (!menuItem) {
            return res.status(404).json({ message: 'Menu item not found' });
        }
        
        // Check if menu item is referenced in any orders
        const orderWithItem = await Order.findOne({ 'items.menuItem': req.params.id });
        if (orderWithItem) {
            return res.status(400).json({ 
                message: 'Cannot delete menu item that is referenced in orders' 
            });
        }
        
        await menuItem.deleteOne();
        
        res.json({ message: 'Menu item deleted' });
    } catch (error) {
        console.error('Error deleting menu item:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Table Management
// Get all tables
router.get('/tables', auth, async (req, res) => {
    try {
        const tables = await Table.find().sort({ tableNumber: 1 });
        res.json({ tables });
    } catch (error) {
        console.error('Error fetching tables:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Add tables
router.post('/tables', auth, [
    check('count', 'Valid count is required').isInt({ min: 1, max: 20 }),
    check('capacity', 'Valid capacity is required').isInt({ min: 2, max: 10 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const { count, capacity } = req.body;
        
        // Get the highest table number
        const highestTable = await Table.findOne().sort({ tableNumber: -1 });
        let startNumber = highestTable ? highestTable.tableNumber + 1 : 1;
        
        const tables = [];
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        
        for (let i = 0; i < count; i++) {
            const tableNumber = startNumber + i;
            const table = new Table({
                tableNumber,
                status: 'available',
                capacity,
                qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${baseUrl}/table/${tableNumber}`
            });
            tables.push(table);
        }
        
        await Table.insertMany(tables);
        
        res.status(201).json({ 
            message: `${count} table(s) added successfully`, 
            tables 
        });
    } catch (error) {
        console.error('Error adding tables:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Remove tables
router.post('/tables/remove', auth, [
    check('tableIds', 'Table IDs are required').isArray()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const { tableIds } = req.body;
        
        // Check if any tables are occupied
        const occupiedTables = await Table.find({
            _id: { $in: tableIds },
            status: 'occupied'
        });
        
        if (occupiedTables.length > 0) {
            return res.status(400).json({ 
                message: 'Cannot remove occupied tables',
                occupiedTables: occupiedTables.map(t => t.tableNumber)
            });
        }
        
        // Delete tables
        await Table.deleteMany({ _id: { $in: tableIds } });
        
        res.json({ 
            message: `${tableIds.length} table(s) removed successfully` 
        });
    } catch (error) {
        console.error('Error removing tables:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Staff Management
// Get all staff (chefs)
router.get('/staff', auth, async (req, res) => {
    try {
        const staff = await User.find({ role: 'chef' })
            .select('-password')
            .sort({ createdAt: -1 });
        
        res.json({ staff });
    } catch (error) {
        console.error('Error fetching staff:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Add staff member
router.post('/staff', auth, [
    check('firstName', 'First name is required').not().isEmpty(),
    check('lastName', 'Last name is required').not().isEmpty(),
    check('email', 'Valid email is required').isEmail(),
    check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
    check('phone', 'Phone number is required').not().isEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const { firstName, lastName, email, password, phone } = req.body;
        
        // Check if user already exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }
        
        // Create new staff member with chef role
        user = new User({
            firstName,
            lastName,
            email,
            password,
            phone,
            role: 'chef'
        });
        
        await user.save();
        
        // Remove password from response
        user = user.toObject();
        delete user.password;
        
        res.status(201).json({ 
            message: 'Staff member added successfully', 
            user 
        });
    } catch (error) {
        console.error('Error adding staff:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Remove staff member
router.delete('/staff/:id', auth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Check if user is a chef
        if (user.role !== 'chef') {
            return res.status(400).json({ message: 'Can only remove chef staff' });
        }
        
        // Check if chef has assigned orders
        const assignedOrders = await Order.findOne({ 
            assignedChef: req.params.id,
            status: { $in: ['pending', 'preparing'] }
        });
        
        if (assignedOrders) {
            return res.status(400).json({ 
                message: 'Cannot remove chef with assigned orders' 
            });
        }
        
        await user.deleteOne();
        
        res.json({ message: 'Staff member removed successfully' });
    } catch (error) {
        console.error('Error removing staff:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Sales Analytics
router.get('/sales', auth, async (req, res) => {
    try {
        const { from, to } = req.query;
        
        const fromDate = new Date(from);
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        
        // Get all orders in date range
        const orders = await Order.find({
            createdAt: { $gte: fromDate, $lte: toDate },
            status: 'completed'
        }).populate('customer', 'firstName lastName');
        
        // Group orders by date
        const ordersByDate = {};
        orders.forEach(order => {
            const date = order.createdAt.toISOString().split('T')[0];
            if (!ordersByDate[date]) {
                ordersByDate[date] = {
                    date,
                    orders: [],
                    revenue: 0
                };
            }
            ordersByDate[date].orders.push(order);
            ordersByDate[date].revenue += order.totalAmount;
        });
        
        // Calculate summary
        const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
        const totalOrders = orders.length;
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        
        // Find most popular item (simplified)
        const itemCount = {};
        orders.forEach(order => {
            order.items.forEach(item => {
                if (!itemCount[item.name]) {
                    itemCount[item.name] = 0;
                }
                itemCount[item.name] += item.quantity;
            });
        });
        
        let popularItem = '';
        let maxCount = 0;
        Object.entries(itemCount).forEach(([item, count]) => {
            if (count > maxCount) {
                maxCount = count;
                popularItem = item;
            }
        });
        
        // Prepare daily reports
        const dailyReports = Object.values(ordersByDate).map(report => ({
            date: report.date,
            orders: report.orders.length,
            revenue: report.revenue,
            avgOrder: report.orders.length > 0 ? report.revenue / report.orders.length : 0
        })).sort((a, b) => new Date(a.date) - new Date(b.date));
        
        res.json({
            summary: {
                totalRevenue,
                totalOrders,
                avgOrderValue,
                popularItem: popularItem || 'No items'
            },
            dailyReports
        });
    } catch (error) {
        console.error('Error fetching sales data:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get sales details for specific date
router.get('/sales/:date', auth, async (req, res) => {
    try {
        const date = new Date(req.params.date);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        
        const orders = await Order.find({
            createdAt: { $gte: date, $lt: nextDate },
            status: 'completed'
        }).populate('customer', 'firstName lastName')
          .sort({ createdAt: -1 });
        
        res.json({ orders });
    } catch (error) {
        console.error('Error fetching sales details:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
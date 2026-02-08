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
        
        const todayRevenue = todayOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
        
        // Yesterday's revenue for comparison
        const yesterdayOrders = await Order.find({
            createdAt: { $gte: yesterday, $lt: today },
            status: 'completed'
        });
        
        const yesterdayRevenue = yesterdayOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
        
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
        const todayCustomerEmails = [...new Set(todayOrders.map(order => order.customerEmail || order.customer))];
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
        const availableMenuItems = await MenuItem.countDocuments({ isAvailable: true });
        
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

// @route   GET /api/admin/revenue/weekly
// @desc    Get weekly revenue data
// @access  Private (Admin)
router.get('/revenue/weekly', auth, isAdmin, async (req, res) => {
    try {
        // Get last 7 days
        const days = 7;
        const labels = [];
        const data = [];
        
        // Generate last 7 days
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);
            
            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);
            
            // Get day name
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            labels.push(dayNames[date.getDay()]);
            
            // Get revenue for this day
            const dayOrders = await Order.find({
                createdAt: { $gte: date, $lt: nextDate },
                status: 'completed'
            });
            
            const dayRevenue = dayOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
            data.push(dayRevenue);
        }
        
        res.json({
            success: true,
            labels,
            data
        });
        
    } catch (error) {
        console.error('Get weekly revenue error:', error);
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
        const { limit = 10 } = req.query;
        
        const orders = await Order.find()
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .select('orderNumber tableNumber customerName totalAmount status createdAt');
        
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
            query.isAvailable = available === 'true';
        }
        
        const menuItems = await MenuItem.find(query)
            .sort({ category: 1, name: 1 })
            .select('name description price category isAvailable preparationTime image');
        
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
    check('description', 'Description is required').optional().trim().escape(),
    check('price', 'Valid price is required').isFloat({ min: 0 }),
    check('category', 'Valid category is required').isIn([
        'appetizer', 'main', 'dessert', 'drink', 'soup', 'salad'
    ]),
    check('preparationTime', 'Preparation time must be a number').optional().isInt({ min: 1 }),
    check('isAvailable', 'isAvailable must be boolean').optional().isBoolean()
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
        
        const { 
            name, 
            description = '', 
            price, 
            category, 
            isAvailable = true,
            preparationTime = 15,
            image = 'https://via.placeholder.com/400x300/667eea/ffffff?text=' + encodeURIComponent(name)
        } = req.body;
        
        console.log('Creating menu item:', { name, price, category, isAvailable });
        
        const menuItem = new MenuItem({
            name,
            description,
            price: parseFloat(price),
            category,
            isAvailable: isAvailable === true || isAvailable === 'true',
            preparationTime: parseInt(preparationTime),
            image
        });
        
        await menuItem.save();
        
        console.log('Menu item created:', menuItem._id);
        
        res.status(201).json({
            success: true,
            message: 'Menu item created successfully',
            menuItem
        });
        
    } catch (error) {
        console.error('Create menu item error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
});

// @route   GET /api/admin/menu/:id
// @desc    Get menu item by ID
// @access  Private (Admin)
router.get('/menu/:id', auth, isAdmin, async (req, res) => {
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

// @route   PUT /api/admin/menu/:id
// @desc    Update menu item
// @access  Private (Admin)
router.put('/menu/:id', auth, isAdmin, [
    check('name', 'Name is required').optional().not().isEmpty().trim().escape(),
    check('description', 'Description is required').optional().trim().escape(),
    check('price', 'Valid price is required').optional().isFloat({ min: 0 }),
    check('category', 'Valid category is required').optional().isIn([
        'appetizer', 'main', 'dessert', 'drink', 'soup', 'salad'
    ]),
    check('isAvailable', 'isAvailable must be boolean').optional().isBoolean()
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
            .select('tableNumber capacity status location section currentOrder');
        
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
// @desc    Create new table
// @access  Private (Admin)
router.post('/tables', auth, isAdmin, [
    check('tableNumber', 'Table number is required').isInt({ min: 1 }),
    check('capacity', 'Capacity must be between 1 and 20').isInt({ min: 1, max: 20 }),
    check('section', 'Section is required').optional().isIn(['main', 'terrace', 'private', 'outdoor']),
    check('location', 'Location cannot exceed 100 characters').optional().isLength({ max: 100 })
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
        
        const { tableNumber, capacity, location = 'near entrance', section = 'main' } = req.body;
        
        console.log('Creating table:', { tableNumber, capacity, location, section });
        
        // Check if table number already exists
        const existingTable = await Table.findOne({ tableNumber });
        if (existingTable) {
            return res.status(400).json({
                success: false,
                message: `Table number ${tableNumber} already exists`
            });
        }
        
        // Convert location to lowercase for enum compatibility
        const locationLower = location.toLowerCase().trim();
        
        // Validate location against enum (optional validation)
        const validLocations = ['near entrance', 'window side', 'center', 'corner', 'bar area', 'patio', 'Window Side', 'Near Entrance'];
        if (!validLocations.includes(locationLower) && !validLocations.includes(location)) {
            console.warn(`Location "${location}" is not in standard enum values, but will be saved.`);
        }
        
        // QR code will be auto-generated by the pre-save middleware in Table model
        const table = new Table({
            tableNumber: parseInt(tableNumber),
            capacity: parseInt(capacity),
            location: locationLower, // Use lowercase version
            section,
            status: 'available',
            isActive: true
        });
        
        // QR code will be auto-generated by pre-save middleware
        
        await table.save();
        
        console.log('Table created:', table._id);
        
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
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: `Validation error: ${error.message}`
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
});

// @route   POST /api/admin/tables/bulk
// @desc    Create multiple tables at once
// @access  Private (Admin)
router.post('/tables/bulk', auth, isAdmin, [
    check('startNumber', 'Start number is required').isInt({ min: 1 }),
    check('tableCount', 'Table count must be between 1 and 50').isInt({ min: 1, max: 50 }),
    check('capacity', 'Capacity must be between 1 and 20').isInt({ min: 1, max: 20 }),
    check('section', 'Section is required').optional().isIn(['main', 'terrace', 'private'])
], async (req, res) => {
    try {
        const validationErrors = validationResult(req);
        if (!validationErrors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: validationErrors.array()
            });
        }
        
        const { startNumber, tableCount, capacity, section = 'main', locationPrefix = '' } = req.body;
        
        const createdTables = [];
        const errors = [];
        
        for (let i = 0; i < tableCount; i++) {
            try {
                const tableNumber = parseInt(startNumber) + i;
                
                // Check if table number already exists
                const existingTable = await Table.findOne({ tableNumber });
                if (existingTable) {
                    errors.push(`Table ${tableNumber} already exists`);
                    continue;
                }
                
                // Generate location
                let location = 'near entrance';
                if (locationPrefix) {
                    location = locationPrefix.toLowerCase() + ' area';
                }
                
                const table = new Table({
                    tableNumber,
                    capacity: parseInt(capacity),
                    location: location,
                    section,
                    status: 'available',
                    isActive: true
                    // QR code will be auto-generated by pre-save middleware
                });
                
                await table.save();
                createdTables.push(table);
            } catch (error) {
                errors.push(`Error creating table ${parseInt(startNumber) + i}: ${error.message}`);
            }
        }
        
        res.status(201).json({
            success: true,
            message: `Created ${createdTables.length} tables successfully`,
            created: createdTables.length,
            tables: createdTables,
            errors: errors.length > 0 ? errors : undefined
        });
        
    } catch (error) {
        console.error('Bulk create tables error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   GET /api/admin/tables/:id
// @desc    Get table by ID
// @access  Private (Admin)
router.get('/tables/:id', auth, isAdmin, async (req, res) => {
    try {
        const table = await Table.findById(req.params.id);
        
        if (!table) {
            return res.status(404).json({
                success: false,
                message: 'Table not found'
            });
        }
        
        res.json({
            success: true,
            table
        });
        
    } catch (error) {
        console.error('Get table error:', error);
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
        
        let query = { role: { $in: ['chef', 'waiter', 'manager', 'cashier', 'admin'] } };
        
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
    check('role', 'Valid role is required').isIn(['chef', 'waiter', 'manager', 'cashier'])
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

// @route   GET /api/admin/staff/:id
// @desc    Get staff member by ID
// @access  Private (Admin)
router.get('/staff/:id', auth, isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Staff member not found'
            });
        }
        
        res.json({
            success: true,
            user
        });
        
    } catch (error) {
        console.error('Get staff member error:', error);
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
    check('role', 'Valid role is required').optional().isIn(['chef', 'waiter', 'manager', 'cashier', 'admin']),
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
        const { startDate, endDate } = req.query;
        
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
        
        // Group orders by date
        const dailySales = [];
        const currentDate = new Date(start);
        
        while (currentDate <= end) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const dayOrders = orders.filter(order => 
                order.createdAt.toISOString().split('T')[0] === dateStr
            );
            
            const revenue = dayOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
            
            dailySales.push({
                date: dateStr,
                revenue,
                orders: dayOrders.length,
                averageOrderValue: dayOrders.length > 0 ? revenue / dayOrders.length : 0
            });
            
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // Calculate totals
        const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
        const totalOrders = orders.length;
        
        // Get top selling items
        const itemCounts = {};
        orders.forEach(order => {
            order.items.forEach(item => {
                const itemName = item.name || 'Unknown Item';
                itemCounts[itemName] = (itemCounts[itemName] || 0) + item.quantity;
            });
        });
        
        const topItems = Object.entries(itemCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));
        
        res.json({
            success: true,
            period: {
                start: start.toISOString(),
                end: end.toISOString()
            },
            summary: {
                totalRevenue,
                totalOrders,
                averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0
            },
            dailySales,
            topItems
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
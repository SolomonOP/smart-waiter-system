const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { check, validationResult } = require('express-validator');
const User = require('../models/User');

// Validation rules
const registerValidation = [
    check('firstName', 'First name is required').not().isEmpty().trim().escape(),
    check('lastName', 'Last name is required').not().isEmpty().trim().escape(),
    check('email', 'Please include a valid email').isEmail().normalizeEmail(),
    check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
    check('phone', 'Phone number is required').not().isEmpty().trim().escape(),
    check('role', 'Role must be customer, chef, or admin').optional().isIn(['customer', 'chef', 'admin'])
];

const loginValidation = [
    check('email', 'Please include a valid email').isEmail().normalizeEmail(),
    check('password', 'Password is required').exists()
];

// Generate JWT token function
const generateToken = (user) => {
    return jwt.sign(
        {
            userId: user._id || user.id,
            email: user.email,
            role: user.role,
            firstName: user.firstName,
            lastName: user.lastName,
            isDemo: user.isDemo || false
        },
        process.env.JWT_SECRET || 'smartwaiter_production_secret_2024',
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
};

// Verify token middleware
const verifyToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET || 'smartwaiter_production_secret_2024');
    } catch (error) {
        console.error('❌ Token verification failed:', error.message);
        return null;
    }
};

// Auth middleware for protected routes
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            console.log('❌ No token provided in auth middleware');
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }
        
        const decoded = verifyToken(token);
        
        if (!decoded) {
            console.log('❌ Invalid or expired token');
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }
        
        req.userId = decoded.userId;
        req.userEmail = decoded.email;
        req.userRole = decoded.role;
        req.isDemo = decoded.isDemo || false;
        
        console.log('✅ Auth middleware passed for user:', decoded.email);
        next();
    } catch (error) {
        console.error('💥 Auth middleware error:', error);
        res.status(401).json({
            success: false,
            message: 'Authentication failed'
        });
    }
};

// Hardcoded demo accounts
const DEMO_ACCOUNTS = [
    {
        _id: '65f1a2b3c4d5e6f7a8b9c0d1',
        email: 'admin@demo.com',
        password: '123456',
        firstName: 'Admin',
        lastName: 'User',
        phone: '1234567890',
        role: 'admin',
        avatar: 'admin-avatar.png',
        isActive: true,
        createdAt: new Date('2024-01-01'),
        isDemo: true
    },
    {
        _id: '65f1a2b3c4d5e6f7a8b9c0d2',
        email: 'chef@demo.com',
        password: '123456',
        firstName: 'Master',
        lastName: 'Chef',
        phone: '0987654321',
        role: 'chef',
        avatar: 'chef-avatar.png',
        isActive: true,
        createdAt: new Date('2024-01-01'),
        isDemo: true
    },
    {
        _id: '65f1a2b3c4d5e6f7a8b9c0d3',
        email: 'customer@demo.com',
        password: '123456',
        firstName: 'John',
        lastName: 'Doe',
        phone: '5551234567',
        role: 'customer',
        avatar: 'customer-avatar.png',
        isActive: true,
        createdAt: new Date('2024-01-01'),
        isDemo: true
    }
];

// ==================== HEALTH CHECK ====================
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Authentication service is operational',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
    });
});

// ==================== DEMO ACCOUNTS ====================
router.get('/demo-accounts', (req, res) => {
    res.json({
        success: true,
        accounts: DEMO_ACCOUNTS.map(acc => ({
            _id: acc._id,
            email: acc.email,
            password: acc.password,
            firstName: acc.firstName,
            lastName: acc.lastName,
            role: acc.role,
            description: `${acc.role.charAt(0).toUpperCase() + acc.role.slice(1)} Demo Account`,
            note: 'Use password: 123456'
        }))
    });
});

// ==================== TEST ENDPOINTS ====================

// 🔧 TEST: Verify bcrypt directly
router.post('/test-bcrypt', async (req, res) => {
    try {
        const { password } = req.body;
        const hash = '$2a$10$gNkuieq666RtcAmiU2M2EuuZ/Qyvk7/h1l5sd2TvkG7Pbf0gCOvqC'; // Your admin hash
        
        console.log('🧪 Testing bcrypt with provided password');
        console.log('📊 Password provided:', password ? 'Yes (' + password.length + ' chars)' : 'No');
        console.log('📊 Hash to compare:', hash.substring(0, 30) + '...');
        console.log('📊 Hash algorithm:', hash.substring(0, 4));
        
        const match = await bcrypt.compare(password, hash);
        
        console.log('✅ Bcrypt test result:', match);
        
        res.json({ 
            success: true,
            match,
            hashAlgorithm: hash.substring(0, 4),
            hashLength: hash.length,
            note: match ? 'Password matches hash!' : 'Password does NOT match hash'
        });
    } catch (error) {
        console.error('💥 Bcrypt test error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// 🔧 TEST: Check user by email
router.post('/check-user', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }
        
        const normalizedEmail = email.toLowerCase().trim();
        
        console.log('🔍 Checking user in database:', normalizedEmail);
        
        // Try different ways to query
        const userWithoutPassword = await User.findOne({ email: normalizedEmail });
        const userWithPassword = await User.findOne({ email: normalizedEmail })
            .select('+password +firstName +lastName +role +phone +avatar +isActive');
        
        console.log('📊 User found (without password):', userWithoutPassword ? 'Yes' : 'No');
        console.log('📊 User found (with password):', userWithPassword ? 'Yes' : 'No');
        
        if (userWithPassword) {
            console.log('📊 User details:');
            console.log('- ID:', userWithPassword._id);
            console.log('- Email:', userWithPassword.email);
            console.log('- Role:', userWithPassword.role);
            console.log('- Has password field:', !!userWithPassword.password);
            console.log('- Password length:', userWithPassword.password ? userWithPassword.password.length : 0);
            if (userWithPassword.password) {
                console.log('- Password first 30 chars:', userWithPassword.password.substring(0, 30) + '...');
                console.log('- Password algorithm:', userWithPassword.password.substring(0, 4));
            }
        }
        
        res.json({
            success: true,
            userExists: !!userWithPassword,
            userDetails: userWithPassword ? {
                _id: userWithPassword._id,
                email: userWithPassword.email,
                role: userWithPassword.role,
                firstName: userWithPassword.firstName,
                lastName: userWithPassword.lastName,
                hasPasswordField: !!userWithPassword.password,
                passwordLength: userWithPassword.password ? userWithPassword.password.length : 0,
                passwordAlgorithm: userWithPassword.password ? userWithPassword.password.substring(0, 4) : null
            } : null
        });
    } catch (error) {
        console.error('💥 Check user error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 🔧 TEST: Create new admin (if needed)
router.post('/create-admin', async (req, res) => {
    try {
        const { email, password, firstName, lastName, phone } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }
        
        const normalizedEmail = email.toLowerCase().trim();
        
        console.log('👨‍💼 Creating new admin user:', normalizedEmail);
        
        // Check if user exists
        const existing = await User.findOne({ email: normalizedEmail });
        if (existing) {
            console.log('❌ User already exists:', normalizedEmail);
            return res.status(400).json({
                success: false,
                message: 'User already exists. Try a different email.'
            });
        }
        
        // Create new admin
        const admin = new User({
            firstName: firstName || 'Admin',
            lastName: lastName || 'User',
            email: normalizedEmail,
            password: password,
            phone: phone || '1234567890',
            role: 'admin'
        });
        
        await admin.save();
        
        console.log('✅ Admin user created successfully:', admin.email);
        
        // Generate token for immediate use
        const token = admin.generateAuthToken();
        
        res.json({
            success: true,
            message: 'Admin user created successfully!',
            token,
            user: {
                id: admin._id,
                email: admin.email,
                role: admin.role,
                firstName: admin.firstName,
                lastName: admin.lastName
            }
        });
    } catch (error) {
        console.error('💥 Create admin error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            code: error.code
        });
    }
});

// 🔧 TEST: Database connection
router.get('/test-db', async (req, res) => {
    try {
        console.log('🧪 Testing database connection...');
        
        // Test user count
        const userCount = await User.countDocuments();
        
        // Test finding admin user
        const adminUser = await User.findOne({ email: 'solomonraja332@gmail.com' })
            .select('+password');
        
        res.json({
            success: true,
            database: 'connected',
            userCount,
            adminUserExists: !!adminUser,
            adminUser: adminUser ? {
                email: adminUser.email,
                role: adminUser.role,
                hasPassword: !!adminUser.password,
                passwordLength: adminUser.password ? adminUser.password.length : 0,
                passwordAlgorithm: adminUser.password ? adminUser.password.substring(0, 4) : null
            } : null
        });
    } catch (error) {
        console.error('💥 Database test error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== MAIN LOGIN ENDPOINT ====================
router.post('/login', loginValidation, async (req, res) => {
    try {
        console.log('\n' + '='.repeat(60));
        console.log('🔐 LOGIN ATTEMPT STARTED');
        console.log('='.repeat(60));
        console.log('📅 Timestamp:', new Date().toISOString());
        console.log('🌐 IP:', req.ip);
        console.log('📧 Email received:', req.body.email);
        console.log('🔑 Password received:', req.body.password ? 'Yes (' + req.body.password.length + ' chars)' : 'No');
        
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('❌ Validation errors:', errors.array());
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array().map(err => err.msg)
            });
        }
        
        const { email, password } = req.body;
        const normalizedEmail = email.toLowerCase().trim();
        
        console.log('\n🔍 Step 1: Checking demo accounts...');
        
        // Check demo accounts first
        const demoAccount = DEMO_ACCOUNTS.find(acc => 
            acc.email.toLowerCase() === normalizedEmail
        );
        
        if (demoAccount) {
            console.log('🎭 Demo account found:', normalizedEmail);
            console.log('📊 Demo password expected:', demoAccount.password);
            console.log('📊 Password provided:', password);
            
            if (password !== demoAccount.password) {
                console.log('❌ Demo password mismatch');
                return res.status(401).json({
                    success: false,
                    message: 'Invalid credentials. For demo accounts, use password: 123456'
                });
            }
            
            // Generate token for demo account
            const token = generateToken(demoAccount);
            
            console.log('✅ Demo login successful!');
            console.log('📊 User role:', demoAccount.role);
            console.log('🔑 Token generated (first 30 chars):', token.substring(0, 30) + '...');
            
            return res.json({
                success: true,
                message: 'Demo login successful',
                token,
                user: {
                    _id: demoAccount._id,
                    firstName: demoAccount.firstName,
                    lastName: demoAccount.lastName,
                    email: demoAccount.email,
                    phone: demoAccount.phone,
                    role: demoAccount.role,
                    avatar: demoAccount.avatar,
                    isDemo: true,
                    isActive: demoAccount.isActive,
                    createdAt: demoAccount.createdAt
                }
            });
        }
        
        console.log('\n🔍 Step 2: Checking database...');
        console.log('📧 Searching for email:', normalizedEmail);
        
        // Database user authentication - EXPLICIT field selection
        const user = await User.findOne({ email: normalizedEmail })
            .select('+password +firstName +lastName +role +phone +avatar +isActive +failedLoginAttempts +lastLogin');
        
        if (!user) {
            console.log('❌ User not found in database');
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
                suggestion: 'Try using demo accounts for testing'
            });
        }
        
        console.log('✅ User found in database');
        console.log('📊 User ID:', user._id);
        console.log('📊 User email:', user.email);
        console.log('📊 User role:', user.role);
        console.log('📊 Has password field?', !!user.password);
        console.log('📊 Is active?', user.isActive);
        
        if (user.password) {
            console.log('📊 Password field length:', user.password.length);
            console.log('📊 Password first 30 chars:', user.password.substring(0, 30) + '...');
            console.log('📊 Password algorithm:', user.password.substring(0, 4));
        } else {
            console.log('⚠️  WARNING: Password field is null or undefined!');
        }
        
        // Check if user is active
        if (!user.isActive) {
            console.log('❌ Account is inactive');
            return res.status(403).json({
                success: false,
                message: 'Account is deactivated. Please contact administrator.'
            });
        }
        
        console.log('\n🔍 Step 3: Verifying password...');
        console.log('📊 Password provided length:', password.length);
        
        // Verify password - try multiple methods
        let isPasswordValid = false;
        let errorMessage = null;
        
        try {
            console.log('🔄 Method 1: Using user.comparePassword()');
            isPasswordValid = await user.comparePassword(password);
            console.log('✅ Method 1 result:', isPasswordValid);
        } catch (method1Error) {
            console.log('❌ Method 1 failed:', method1Error.message);
            errorMessage = method1Error.message;
            
            // Try direct bcrypt comparison
            try {
                console.log('🔄 Method 2: Direct bcrypt.compare()');
                if (user.password) {
                    isPasswordValid = await bcrypt.compare(password, user.password);
                    console.log('✅ Method 2 result:', isPasswordValid);
                } else {
                    console.log('❌ Method 2 failed: No password hash to compare');
                }
            } catch (method2Error) {
                console.log('❌ Method 2 failed:', method2Error.message);
                errorMessage += ' | ' + method2Error.message;
            }
        }
        
        if (!isPasswordValid) {
            console.log('❌ Password validation failed');
            
            // Log failed attempt
            user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
            user.lastFailedLogin = Date.now();
            await user.save();
            
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
                debug: process.env.NODE_ENV === 'development' ? {
                    error: errorMessage,
                    hashExists: !!user.password,
                    hashLength: user.password ? user.password.length : 0,
                    hashAlgorithm: user.password ? user.password.substring(0, 4) : null
                } : undefined
            });
        }
        
        console.log('✅ Password verified successfully!');
        
        // Reset failed login attempts on successful login
        user.failedLoginAttempts = 0;
        user.lastLogin = Date.now();
        await user.save();
        
        console.log('\n🔍 Step 4: Generating token...');
        
        // Generate JWT token using user method
        const token = user.generateAuthToken();
        
        console.log('✅ Token generated successfully');
        console.log('📊 Token preview:', token.substring(0, 30) + '...');
        
        console.log('\n' + '='.repeat(60));
        console.log('🎉 LOGIN SUCCESSFUL!');
        console.log('='.repeat(60));
        console.log('👤 User:', user.email);
        console.log('🎭 Role:', user.role);
        console.log('🆔 ID:', user._id);
        console.log('⏰ Last login updated');
        console.log('='.repeat(60));
        
        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone: user.phone,
                role: user.role,
                avatar: user.avatar,
                isDemo: false,
                isActive: user.isActive,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin
            }
        });
        
    } catch (error) {
        console.error('\n' + '💥'.repeat(20));
        console.error('💥 LOGIN ENDPOINT ERROR');
        console.error('💥'.repeat(20));
        console.error('📅 Timestamp:', new Date().toISOString());
        console.error('❌ Error message:', error.message);
        console.error('📝 Error stack:', error.stack);
        console.error('🔧 Error code:', error.code);
        console.error('📊 Error name:', error.name);
        console.error('💥'.repeat(20) + '\n');
        
        res.status(500).json({
            success: false,
            message: 'Internal server error during authentication',
            error: process.env.NODE_ENV === 'development' ? {
                message: error.message,
                code: error.code,
                name: error.name
            } : undefined
        });
    }
});

// ==================== REGISTER ENDPOINT ====================
router.post('/register', registerValidation, async (req, res) => {
    try {
        console.log('\n📝 REGISTRATION ATTEMPT');
        console.log('📧 Email:', req.body.email);
        
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('❌ Validation errors:', errors.array());
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array().map(err => ({
                    field: err.param,
                    message: err.msg
                }))
            });
        }
        
        const { firstName, lastName, email, password, phone, role = 'customer' } = req.body;
        const normalizedEmail = email.toLowerCase().trim();
        
        // Check if email is a demo account
        const isDemoAccount = DEMO_ACCOUNTS.some(acc => 
            acc.email.toLowerCase() === normalizedEmail
        );
        
        if (isDemoAccount) {
            console.log('❌ Attempt to register demo account email');
            return res.status(409).json({
                success: false,
                message: 'This email is reserved for system demo accounts. Please use a different email.'
            });
        }
        
        // Check if user already exists
        const existingUser = await User.findOne({ email: normalizedEmail });
        
        if (existingUser) {
            console.log('❌ Email already registered');
            return res.status(409).json({
                success: false,
                message: 'Email address is already registered. Please use a different email or login.'
            });
        }
        
        console.log('✅ Email available, creating new user...');
        
        // Create new user
        const user = new User({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: normalizedEmail,
            password: password,
            phone: phone.trim(),
            role: role
        });
        
        // Save user to database
        await user.save();
        
        console.log('✅ User saved to database');
        
        // Generate JWT token
        const token = user.generateAuthToken();
        
        console.log('🎉 Registration successful!');
        console.log('👤 User ID:', user._id);
        console.log('🎭 Role:', user.role);
        
        res.status(201).json({
            success: true,
            message: 'Account created successfully! Welcome to Smart Waiter.',
            token,
            user: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone: user.phone,
                role: user.role,
                avatar: user.avatar,
                isActive: user.isActive,
                createdAt: user.createdAt
            }
        });
        
    } catch (error) {
        console.error('💥 Registration error:', error.message);
        
        // Handle MongoDB duplicate key error
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Email address is already registered'
            });
        }
        
        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => ({
                field: err.path,
                message: err.message
            }));
            
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Internal server error during registration',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ==================== GET CURRENT USER ====================
router.get('/me', authMiddleware, async (req, res) => {
    try {
        console.log('👤 Profile request for:', {
            userId: req.userId,
            email: req.userEmail,
            isDemo: req.isDemo
        });
        
        // Handle demo accounts
        if (req.isDemo) {
            const demoAccount = DEMO_ACCOUNTS.find(acc => 
                acc._id === req.userId || acc.email === req.userEmail
            );
            
            if (!demoAccount) {
                return res.status(404).json({
                    success: false,
                    message: 'Demo account not found'
                });
            }
            
            return res.json({
                success: true,
                user: {
                    _id: demoAccount._id,
                    firstName: demoAccount.firstName,
                    lastName: demoAccount.lastName,
                    email: demoAccount.email,
                    phone: demoAccount.phone,
                    role: demoAccount.role,
                    avatar: demoAccount.avatar,
                    isDemo: true,
                    isActive: demoAccount.isActive,
                    createdAt: demoAccount.createdAt
                }
            });
        }
        
        // Handle database users
        const user = await User.findById(req.userId).select('-password');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        res.json({
            success: true,
            user: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone: user.phone,
                role: user.role,
                avatar: user.avatar,
                isDemo: false,
                isActive: user.isActive,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin
            }
        });
        
    } catch (error) {
        console.error('💥 Profile fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// ==================== VERIFY TOKEN ====================
router.post('/verify-token', (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token is required'
            });
        }
        
        console.log('🔍 Verifying token...');
        const decoded = verifyToken(token);
        
        if (!decoded) {
            console.log('❌ Token verification failed');
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }
        
        console.log('✅ Token is valid for user:', decoded.email);
        
        res.json({
            success: true,
            message: 'Token is valid',
            decoded
        });
        
    } catch (error) {
        console.error('💥 Token verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// ==================== UPDATE PROFILE ====================
router.put('/update', authMiddleware, [
    check('firstName', 'First name is required').optional().not().isEmpty().trim().escape(),
    check('lastName', 'Last name is required').optional().not().isEmpty().trim().escape(),
    check('phone', 'Phone number is required').optional().not().isEmpty().trim().escape(),
    check('avatar', 'Avatar URL is invalid').optional().isURL()
], async (req, res) => {
    try {
        // Demo accounts cannot be updated
        if (req.isDemo) {
            return res.status(403).json({
                success: false,
                message: 'Demo accounts cannot be modified. Please create a real account to customize your profile.'
            });
        }
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        
        const { firstName, lastName, phone, avatar } = req.body;
        const updates = {};
        
        // Build update object
        if (firstName) updates.firstName = firstName.trim();
        if (lastName) updates.lastName = lastName.trim();
        if (phone) updates.phone = phone.trim();
        if (avatar) updates.avatar = avatar;
        updates.updatedAt = Date.now();
        
        // Update user in database
        const user = await User.findByIdAndUpdate(
            req.userId,
            { $set: updates },
            { new: true, runValidators: true }
        ).select('-password');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        console.log('✅ Profile updated for user:', user.email);
        
        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone: user.phone,
                role: user.role,
                avatar: user.avatar,
                updatedAt: user.updatedAt
            }
        });
        
    } catch (error) {
        console.error('💥 Profile update error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// ==================== CHANGE PASSWORD ====================
router.post('/change-password', authMiddleware, [
    check('currentPassword', 'Current password is required').not().isEmpty(),
    check('newPassword', 'New password must be at least 6 characters').isLength({ min: 6 })
], async (req, res) => {
    try {
        // Demo accounts cannot change password
        if (req.isDemo) {
            return res.status(403).json({
                success: false,
                message: 'Demo accounts cannot change password. Please create a real account.'
            });
        }
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        
        const { currentPassword, newPassword } = req.body;
        
        // Find user with password field
        const user = await User.findById(req.userId).select('+password');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Verify current password
        const isPasswordValid = await user.comparePassword(currentPassword);
        
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }
        
        // Update password
        user.password = newPassword;
        await user.save();
        
        // Generate new token
        const token = user.generateAuthToken();
        
        console.log('✅ Password changed for user:', user.email);
        
        res.json({
            success: true,
            message: 'Password changed successfully',
            token
        });
        
    } catch (error) {
        console.error('💥 Password change error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// ==================== FORGOT PASSWORD ====================
router.post('/forgot-password', [
    check('email', 'Please include a valid email').isEmail().normalizeEmail()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }
        
        const { email } = req.body;
        const normalizedEmail = email.toLowerCase().trim();
        
        // Check if it's a demo account
        const isDemoAccount = DEMO_ACCOUNTS.some(acc => 
            acc.email.toLowerCase() === normalizedEmail
        );
        
        if (isDemoAccount) {
            return res.status(400).json({
                success: false,
                message: 'Cannot reset password for demo accounts. Use the default password: 123456'
            });
        }
        
        // Find user in database
        const user = await User.findOne({ email: normalizedEmail });
        
        if (!user) {
            // Return generic response for security
            return res.json({
                success: true,
                message: 'If your email is registered, you will receive a password reset link shortly.'
            });
        }
        
        // Generate reset token
        const resetToken = user.generateResetPasswordToken();
        await user.save();
        
        // Create reset URL
        const resetUrl = `${process.env.FRONTEND_URL || 'https://smart-waiter-frontend.onrender.com'}/reset-password/${resetToken}`;
        
        console.log('📧 Password reset initiated:', {
            email: user.email,
            resetTokenPreview: resetToken.substring(0, 30) + '...',
            resetUrl: resetUrl
        });
        
        // TODO: Implement email sending service
        // await sendPasswordResetEmail(user.email, user.firstName, resetUrl);
        
        res.json({
            success: true,
            message: 'Password reset email sent',
            note: process.env.NODE_ENV === 'development' ? 
                `Development mode: Reset URL - ${resetUrl}` : 
                'Check your email for the reset link'
        });
        
    } catch (error) {
        console.error('💥 Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// ==================== RESET PASSWORD ====================
router.post('/reset-password/:token', [
    check('password', 'Password must be at least 6 characters').isLength({ min: 6 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }
        
        const { password } = req.body;
        const { token } = req.params;
        
        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(
                token, 
                process.env.JWT_SECRET || 'smartwaiter_production_secret_2024'
            );
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }
        
        // Find user with valid reset token
        const user = await User.findOne({
            _id: decoded.userId,
            resetPasswordToken: token,
            resetPasswordExpire: { $gt: Date.now() }
        });
        
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }
        
        // Update password
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();
        
        // Generate new auth token
        const authToken = user.generateAuthToken();
        
        console.log('✅ Password reset successful for user:', user.email);
        
        res.json({
            success: true,
            message: 'Password has been reset successfully',
            token: authToken
        });
        
    } catch (error) {
        console.error('💥 Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// ==================== LOGOUT ====================
router.post('/logout', authMiddleware, (req, res) => {
    try {
        // In a real implementation, you might want to:
        // 1. Add token to a blacklist
        // 2. Update user's last logout time
        // 3. Clear any server-side sessions
        
        console.log('👋 User logout:', {
            userId: req.userId,
            email: req.userEmail,
            timestamp: new Date().toISOString()
        });
        
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
        
    } catch (error) {
        console.error('💥 Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// ==================== ADMIN: GET ALL USERS ====================
router.get('/admin/users', authMiddleware, async (req, res) => {
    try {
        // Check if user is admin
        if (req.userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin privileges required.'
            });
        }
        
        const users = await User.find({})
            .select('-password -resetPasswordToken -resetPasswordExpire')
            .sort({ createdAt: -1 });
        
        // Add demo accounts to the list
        const allUsers = [
            ...DEMO_ACCOUNTS.map(acc => ({ ...acc, source: 'demo' })),
            ...users.map(user => ({ ...user.toObject(), source: 'database' }))
        ];
        
        res.json({
            success: true,
            count: allUsers.length,
            users: allUsers
        });
        
    } catch (error) {
        console.error('💥 Admin users fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// ==================== ADMIN: UPDATE USER STATUS ====================
router.put('/admin/users/:userId/status', authMiddleware, async (req, res) => {
    try {
        // Check if user is admin
        if (req.userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin privileges required.'
            });
        }
        
        const { userId } = req.params;
        const { isActive } = req.body;
        
        // Cannot modify demo accounts
        const isDemoAccount = DEMO_ACCOUNTS.some(acc => acc._id === userId);
        if (isDemoAccount) {
            return res.status(400).json({
                success: false,
                message: 'Cannot modify demo accounts'
            });
        }
        
        const user = await User.findByIdAndUpdate(
            userId,
            { isActive, updatedAt: Date.now() },
            { new: true }
        ).select('-password');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        console.log('👨‍💼 User status updated by admin:', {
            admin: req.userEmail,
            target: user.email,
            isActive: user.isActive
        });
        
        res.json({
            success: true,
            message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
            user
        });
        
    } catch (error) {
        console.error('💥 Admin user status update error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// ==================== DIRECT PASSWORD RESET (Emergency) ====================
router.post('/admin/reset-user-password', authMiddleware, async (req, res) => {
    try {
        // Check if user is admin
        if (req.userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin privileges required.'
            });
        }
        
        const { userId, newPassword } = req.body;
        
        if (!userId || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'User ID and new password are required'
            });
        }
        
        const user = await User.findById(userId).select('+password');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        console.log('🔧 Admin resetting password for user:', user.email);
        
        // Update password
        user.password = newPassword;
        await user.save();
        
        res.json({
            success: true,
            message: 'Password reset successfully',
            user: {
                email: user.email,
                role: user.role
            }
        });
        
    } catch (error) {
        console.error('💥 Admin password reset error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;
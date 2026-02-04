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
        return null;
    }
};

// Auth middleware for protected routes
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }
        
        const decoded = verifyToken(token);
        
        if (!decoded) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }
        
        req.userId = decoded.userId;
        req.userEmail = decoded.email;
        req.userRole = decoded.role;
        req.isDemo = decoded.isDemo || false;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
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

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Authentication service is operational',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
    });
});

// Demo accounts endpoint
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

// Login endpoint
router.post('/login', loginValidation, async (req, res) => {
    try {
        console.log('🔐 Login attempt:', { 
            email: req.body.email, 
            timestamp: new Date().toISOString(),
            ip: req.ip
        });
        
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
        
        const { email, password, rememberMe } = req.body;
        const normalizedEmail = email.toLowerCase().trim();
        
        // Check demo accounts first
        const demoAccount = DEMO_ACCOUNTS.find(acc => 
            acc.email.toLowerCase() === normalizedEmail
        );
        
        if (demoAccount) {
            console.log('🎭 Processing demo account:', normalizedEmail);
            
            if (password !== demoAccount.password) {
                console.log('❌ Invalid password for demo account');
                return res.status(401).json({
                    success: false,
                    message: 'Invalid credentials. For demo accounts, use password: 123456'
                });
            }
            
            // Generate token for demo account
            const token = generateToken(demoAccount);
            
            console.log('✅ Demo login successful:', {
                email: demoAccount.email,
                role: demoAccount.role,
                tokenPreview: token.substring(0, 30) + '...'
            });
            
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
        
        // Database user authentication
        console.log('🔍 Checking database for user:', normalizedEmail);
        
        // Find user by email
        const user = await User.findOne({ email: normalizedEmail }).select('+password +isActive');
        
        if (!user) {
            console.log('❌ User not found in database:', normalizedEmail);
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
                suggestion: 'Try using demo accounts for testing'
            });
        }
        
        // Check if user is active
        if (!user.isActive) {
            console.log('❌ Account is inactive:', normalizedEmail);
            return res.status(403).json({
                success: false,
                message: 'Account is deactivated. Please contact administrator.'
            });
        }
        
        // Verify password
        console.log('🔑 Verifying password for user:', user.email);
        const isPasswordValid = await user.comparePassword(password);
        
        if (!isPasswordValid) {
            console.log('❌ Invalid password for user:', user.email);
            
            // Log failed attempt (you could add rate limiting here)
            user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
            user.lastFailedLogin = Date.now();
            await user.save();
            
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        
        // Reset failed login attempts on successful login
        user.failedLoginAttempts = 0;
        user.lastLogin = Date.now();
        await user.save();
        
        // Generate JWT token
        const token = user.generateAuthToken();
        
        console.log('✅ Database login successful:', {
            email: user.email,
            role: user.role,
            userId: user._id,
            tokenPreview: token.substring(0, 30) + '...'
        });
        
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
        console.error('💥 Login endpoint error:', {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
        
        res.status(500).json({
            success: false,
            message: 'Internal server error during authentication',
            error: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});

// Register endpoint
router.post('/register', registerValidation, async (req, res) => {
    try {
        console.log('📝 Registration request:', {
            email: req.body.email,
            timestamp: new Date().toISOString()
        });
        
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('❌ Registration validation failed:', errors.array());
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
            console.log('❌ Attempt to register demo account email:', normalizedEmail);
            return res.status(409).json({
                success: false,
                message: 'This email is reserved for system demo accounts. Please use a different email.'
            });
        }
        
        // Check if user already exists
        const existingUser = await User.findOne({ email: normalizedEmail });
        
        if (existingUser) {
            console.log('❌ Email already registered:', normalizedEmail);
            return res.status(409).json({
                success: false,
                message: 'Email address is already registered. Please use a different email or login.'
            });
        }
        
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
        
        // Generate JWT token
        const token = user.generateAuthToken();
        
        console.log('✅ User registered successfully:', {
            email: user.email,
            userId: user._id,
            role: user.role
        });
        
        // Send welcome email (optional - you can implement this later)
        // await sendWelcomeEmail(user.email, user.firstName);
        
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
        console.error('💥 Registration error:', {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
        
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
            error: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});

// Get current user profile (protected)
router.get('/me', authMiddleware, async (req, res) => {
    try {
        console.log('👤 Profile request for user:', {
            userId: req.userId,
            isDemo: req.isDemo,
            timestamp: new Date().toISOString()
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

// Update user profile (protected)
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

// Change password (protected)
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

// Forgot password endpoint
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

// Reset password with token
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

// Verify token endpoint
router.post('/verify-token', (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token is required'
            });
        }
        
        const decoded = verifyToken(token);
        
        if (!decoded) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }
        
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

// Logout endpoint (client-side token invalidation)
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

// Admin-only: Get all users (protected + admin check)
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

// Admin-only: Update user status (activate/deactivate)
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

module.exports = router;
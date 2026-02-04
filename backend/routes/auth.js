const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
const { User } = require('../models');
const auth = require('../middleware/auth');

// Validation rules
const registerValidation = [
    check('firstName', 'First name is required').not().isEmpty().trim().escape(),
    check('lastName', 'Last name is required').not().isEmpty().trim().escape(),
    check('email', 'Please include a valid email').isEmail().normalizeEmail(),
    check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
    check('phone', 'Phone number is required').not().isEmpty().trim().escape()
];

const loginValidation = [
    check('email', 'Please include a valid email').isEmail().normalizeEmail(),
    check('password', 'Password is required').exists()
];

// Hardcoded demo accounts (fallback)
const DEMO_ACCOUNTS = [
    {
        email: 'admin@demo.com',
        password: '123456',
        firstName: 'Admin',
        lastName: 'User',
        phone: '1234567890',
        role: 'admin'
    },
    {
        email: 'chef@demo.com',
        password: '123456',
        firstName: 'Master',
        lastName: 'Chef',
        phone: '0987654321',
        role: 'chef'
    },
    {
        email: 'customer@demo.com',
        password: '123456',
        firstName: 'John',
        lastName: 'Doe',
        phone: '5551234567',
        role: 'customer'
    }
];

// @route   POST /api/auth/register
// @desc    Register user
// @access  Public
router.post('/register', registerValidation, async (req, res) => {
    try {
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { firstName, lastName, email, password, phone } = req.body;

        // Check if user already exists in database
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            });
        }

        // Check if email is a demo account
        const isDemoAccount = DEMO_ACCOUNTS.some(acc => acc.email === email);
        if (isDemoAccount) {
            return res.status(400).json({
                success: false,
                message: 'Email is reserved for demo accounts. Please use a different email.'
            });
        }

        // Create new user
        user = new User({
            firstName,
            lastName,
            email,
            password,
            phone,
            role: 'customer'
        });

        await user.save();

        // Generate JWT token
        const token = user.generateAuthToken();

        // Update last login
        user.lastLogin = Date.now();
        await user.save();

        res.status(201).json({
            success: true,
            message: 'Registration successful! Welcome to Smart Waiter System.',
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone: user.phone,
                role: user.role,
                avatar: user.avatar,
                createdAt: user.createdAt
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        
        // Handle duplicate key error
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Server error during registration',
            error: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', loginValidation, async (req, res) => {
    try {
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { email, password } = req.body;

        // First check demo accounts
        const demoAccount = DEMO_ACCOUNTS.find(acc => acc.email === email);
        if (demoAccount && demoAccount.password === password) {
            // Create token for demo account
            const token = jwt.sign(
                {
                    userId: email,
                    email: demoAccount.email,
                    role: demoAccount.role,
                    firstName: demoAccount.firstName,
                    lastName: demoAccount.lastName
                },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRE || '7d' }
            );

            return res.json({
                success: true,
                message: 'Demo login successful',
                token,
                user: {
                    id: email,
                    firstName: demoAccount.firstName,
                    lastName: demoAccount.lastName,
                    email: demoAccount.email,
                    phone: demoAccount.phone,
                    role: demoAccount.role,
                    isDemo: true
                }
            });
        }

        // Check database users
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated. Please contact administrator.'
            });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate token
        const token = user.generateAuthToken();

        // Update last login
        user.lastLogin = Date.now();
        await user.save();

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone: user.phone,
                role: user.role,
                avatar: user.avatar,
                createdAt: user.createdAt
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login',
            error: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req, res) => {
    try {
        // For demo accounts
        if (req.userId.includes('@demo.com')) {
            const demoAccount = DEMO_ACCOUNTS.find(acc => acc.email === req.userId);
            if (demoAccount) {
                return res.json({
                    success: true,
                    user: {
                        id: demoAccount.email,
                        firstName: demoAccount.firstName,
                        lastName: demoAccount.lastName,
                        email: demoAccount.email,
                        phone: demoAccount.phone,
                        role: demoAccount.role,
                        isDemo: true
                    }
                });
            }
        }

        // For database users
        const user = await User.findById(req.userId).select('-password');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   PUT /api/auth/update
// @desc    Update user profile
// @access  Private
router.put('/update', auth, [
    check('firstName', 'First name is required').optional().not().isEmpty().trim().escape(),
    check('lastName', 'Last name is required').optional().not().isEmpty().trim().escape(),
    check('phone', 'Phone number is required').optional().not().isEmpty().trim().escape()
], async (req, res) => {
    try {
        // Demo accounts cannot be updated
        if (req.userId.includes('@demo.com')) {
            return res.status(400).json({
                success: false,
                message: 'Demo accounts cannot be modified'
            });
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const updates = req.body;
        
        // Remove restricted fields
        delete updates.email;
        delete updates.password;
        delete updates.role;

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

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   POST /api/auth/change-password
// @desc    Change password
// @access  Private
router.post('/change-password', auth, [
    check('currentPassword', 'Current password is required').not().isEmpty(),
    check('newPassword', 'New password must be at least 6 characters').isLength({ min: 6 })
], async (req, res) => {
    try {
        // Demo accounts cannot change password
        if (req.userId.includes('@demo.com')) {
            return res.status(400).json({
                success: false,
                message: 'Demo accounts cannot change password'
            });
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(req.userId).select('+password');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
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

        res.json({
            success: true,
            message: 'Password changed successfully',
            token
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   POST /api/auth/forgot-password
// @desc    Forgot password - send reset email
// @access  Public
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

        // Check if it's a demo account
        const isDemoAccount = DEMO_ACCOUNTS.some(acc => acc.email === email);
        if (isDemoAccount) {
            return res.status(400).json({
                success: false,
                message: 'Cannot reset password for demo accounts. Use password: 123456'
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            // Return generic response for security
            return res.json({
                success: true,
                message: 'If your email is registered, you will receive a password reset link'
            });
        }

        // Generate reset token
        const resetToken = user.generateResetPasswordToken();
        await user.save();

        // TODO: Send email with reset link
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

        console.log('Password reset link:', resetUrl);

        res.json({
            success: true,
            message: 'Password reset email sent',
            note: 'Email service not configured. Reset token generated.',
            resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   POST /api/auth/reset-password/:token
// @desc    Reset password with token
// @access  Public
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
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }

        const user = await User.findOne({
            _id: decoded.userId,
            resetPasswordToken: token,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }

        // Update password
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        // Generate new token
        const authToken = user.generateAuthToken();

        res.json({
            success: true,
            message: 'Password reset successful',
            token: authToken
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   GET /api/auth/demo-accounts
// @desc    Get demo accounts info
// @access  Public
router.get('/demo-accounts', (req, res) => {
    res.json({
        success: true,
        accounts: DEMO_ACCOUNTS.map(acc => ({
            email: acc.email,
            password: acc.password,
            role: acc.role,
            description: `${acc.role.charAt(0).toUpperCase() + acc.role.slice(1)} account for testing`
        }))
    });
});

module.exports = router;
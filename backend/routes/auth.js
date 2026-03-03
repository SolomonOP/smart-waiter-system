const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }
        
        const normalizedEmail = email.toLowerCase().trim();
        
        // Check demo accounts
        const demoAccounts = [
            {email: 'admin@demo.com', password: '123456', role: 'admin', firstName: 'Admin', lastName: 'Demo'},
            {email: 'chef@demo.com', password: '123456', role: 'chef', firstName: 'Master', lastName: 'Chef'},
            {email: 'customer@demo.com', password: '123456', role: 'customer', firstName: 'John', lastName: 'Doe'}
        ];
        
        const demo = demoAccounts.find(d => d.email === normalizedEmail);
        if (demo && password === demo.password) {
            const token = jwt.sign(
                {
                    userId: demo.email,
                    email: demo.email,
                    role: demo.role,
                    firstName: demo.firstName,
                    lastName: demo.lastName,
                    isDemo: true
                },
                process.env.JWT_SECRET,
                {expiresIn: '7d'}
            );
            
            return res.json({
                success: true, 
                token, 
                user: {
                    email: demo.email, 
                    role: demo.role,
                    firstName: demo.firstName,
                    lastName: demo.lastName,
                    isDemo: true
                }
            });
        }
        
        // Find user in database
        const user = await User.findOne({ email: normalizedEmail });
        
        if (!user) {
            return res.status(401).json({
                success: false, 
                message: 'Invalid email or password'
            });
        }
        
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated. Please contact admin.'
            });
        }
        
        const isMatch = await user.comparePassword(password);
        
        if (!isMatch) {
            user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
            user.lastFailedLogin = new Date();
            await user.save();
            
            return res.status(401).json({
                success: false, 
                message: 'Invalid email or password'
            });
        }
        
        // Reset failed attempts on successful login
        user.failedLoginAttempts = 0;
        user.lastLogin = new Date();
        await user.save();
        
        const token = user.generateAuthToken();
        
        res.json({
            success: true,
            token,
            user: {
                _id: user._id,
                email: user.email,
                role: user.role,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                avatar: user.avatar
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login'
        });
    }
});

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res) => {
    try {
        const { firstName, lastName, email, password, phone } = req.body;
        
        if (!email || !password || !firstName || !lastName || !phone) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields'
            });
        }
        
        const normalizedEmail = email.toLowerCase().trim();
        
        // Check if user already exists
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Email already registered. Please login instead.'
            });
        }
        
        // Create new user
        const newUser = new User({
            firstName,
            lastName,
            email: normalizedEmail,
            password,
            phone,
            role: 'customer',
            isActive: true
        });
        
        await newUser.save();
        
        const token = newUser.generateAuthToken();
        
        res.status(201).json({
            success: true,
            message: 'Registration successful',
            token,
            user: {
                _id: newUser._id,
                email: newUser.email,
                role: newUser.role,
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                phone: newUser.phone,
                avatar: newUser.avatar
            }
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        
        let errorMessage = 'Registration failed. Please try again.';
        let statusCode = 500;
        
        if (error.name === 'ValidationError') {
            errorMessage = Object.values(error.errors).map(e => e.message).join(', ');
            statusCode = 400;
        } else if (error.code === 11000) {
            errorMessage = 'Email already registered. Please login instead.';
            statusCode = 409;
        }
        
        res.status(statusCode).json({
            success: false,
            message: errorMessage
        });
    }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', (req, res) => {
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// @route   GET /api/auth/verify-token
// @desc    Verify token validity
// @access  Public
router.get('/verify-token', (req, res) => {
    try {
        const authHeader = req.header('Authorization');
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'No token provided',
                valid: false
            });
        }
        
        const token = authHeader.replace('Bearer ', '');
        
        if (token.startsWith('demo_')) {
            return res.json({
                success: true,
                valid: true,
                isDemo: true
            });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        res.json({
            success: true,
            valid: true,
            user: {
                userId: decoded.userId,
                email: decoded.email,
                role: decoded.role
            }
        });
        
    } catch (error) {
        res.status(401).json({
            success: false,
            valid: false,
            message: 'Invalid or expired token'
        });
    }
});

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }
        
        const normalizedEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: normalizedEmail });
        
        if (!user) {
            return res.json({
                success: true,
                message: 'If this email exists, you will receive a password reset link.'
            });
        }
        
        const resetToken = user.generateResetPasswordToken();
        await user.save();
        
        console.log('Password reset token for', user.email + ':', resetToken);
        
        res.json({
            success: true,
            message: 'Password reset link sent to your email.',
            resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
        });
        
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process password reset request'
        });
    }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.header('Authorization');
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }
        
        const token = authHeader.replace('Bearer ', '');
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (decoded.isDemo) {
            return res.json({
                success: true,
                user: {
                    email: decoded.email,
                    role: decoded.role,
                    firstName: decoded.firstName,
                    lastName: decoded.lastName,
                    isDemo: true
                }
            });
        }
        
        const user = await User.findById(decoded.userId).select('-password');
        
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
                email: user.email,
                role: user.role,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                avatar: user.avatar,
                createdAt: user.createdAt
            }
        });
        
    } catch (error) {
        console.error('Get user error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token has expired'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        
        if (!token || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Token and new password are required'
            });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const user = await User.findById(decoded.userId);
        
        if (!user || user.resetPasswordToken !== token || user.resetPasswordExpire < Date.now()) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }
        
        user.password = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();
        
        res.json({
            success: true,
            message: 'Password reset successful. You can now login with your new password.'
        });
        
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset password'
        });
    }
});

// @route   GET /api/auth/health
// @desc    Health check
// @access  Public
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Auth service is running',
        timestamp: new Date().toISOString()
    });
});

// ==================== VERIFY TOKEN ====================
router.post('/verify', (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token is required'
            });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'smartwaiter_production_secret_2024');
        
        res.json({
            success: true,
            valid: true,
            user: decoded
        });
        
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({
            success: false,
            valid: false,
            message: 'Invalid or expired token'
        });
    }
});

module.exports = router;
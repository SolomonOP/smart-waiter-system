const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// ==================== LOGIN ENDPOINT ====================
router.post('/login', async (req, res) => {
    try {
        console.log('=== LOGIN REQUEST ===');
        console.log('Email:', req.body.email);
        console.log('Password length:', req.body.password ? req.body.password.length : 0);
        
        const { email, password } = req.body;
        
        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }
        
        const normalizedEmail = email.toLowerCase().trim();
        
        // Check demo accounts first
        const demoAccounts = [
            {email: 'admin@demo.com', password: '123456', role: 'admin'},
            {email: 'chef@demo.com', password: '123456', role: 'chef'},
            {email: 'customer@demo.com', password: '123456', role: 'customer'}
        ];
        
        const demo = demoAccounts.find(d => d.email === normalizedEmail);
        if (demo) {
            console.log('✅ Demo account found:', demo.role);
            if (password === demo.password) {
                const token = jwt.sign(
                    {email: demo.email, role: demo.role, isDemo: true},
                    process.env.JWT_SECRET || 'smartwaiter_production_secret_2024',
                    {expiresIn: '7d'}
                );
                return res.json({
                    success: true, 
                    token, 
                    user: {
                        email: demo.email, 
                        role: demo.role,
                        firstName: demo.role.charAt(0).toUpperCase() + demo.role.slice(1),
                        lastName: 'Demo'
                    }
                });
            }
        }
        
        // Find user in database
        console.log('🔍 Searching for user in database:', normalizedEmail);
        const user = await User.findOne({ email: normalizedEmail });
        
        if (!user) {
            console.log('❌ User not found in database');
            return res.status(401).json({
                success: false, 
                message: 'Invalid email or password'
            });
        }
        
        console.log('✅ User found:', user.email);
        console.log('🔑 Comparing passwords...');
        
        // Use the model method to compare password
        const isMatch = await user.comparePassword(password);
        
        if (!isMatch) {
            console.log('❌ Password does not match');
            return res.status(401).json({
                success: false, 
                message: 'Invalid email or password'
            });
        }
        
        console.log('✅ Password matched');
        
        // Update last login
        user.lastLogin = new Date();
        await user.save();
        
        // Generate token using model method
        const token = user.generateAuthToken();
        
        console.log('🎫 Login successful for user:', user.email);
        console.log('=== LOGIN COMPLETE ===');
        
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
        console.error('❌ LOGIN ERROR:');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        
        res.status(500).json({
            success: false,
            message: 'Server error during login',
            error: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});

// ==================== REGISTER ENDPOINT ====================
router.post('/register', async (req, res) => {
    try {
        console.log('=== REGISTER REQUEST ===');
        console.log('Registration data:', {
            email: req.body.email,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            phone: req.body.phone
        });
        
        const { firstName, lastName, email, password, phone } = req.body;
        
        // Validate required fields
        if (!email || !password || !firstName || !lastName || !phone) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields: firstName, lastName, email, password, phone'
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
            role: 'customer'
        });
        
        console.log('💾 Saving user to database...');
        
        // Save user (password will be hashed automatically by pre-save hook)
        await newUser.save();
        
        console.log('✅ User saved successfully:', newUser.email);
        
        // Generate token
        const token = newUser.generateAuthToken();
        
        console.log('🎫 Registration successful');
        console.log('=== REGISTER COMPLETE ===');
        
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
        console.error('❌ REGISTER ERROR:');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        
        let errorMessage = 'Registration failed. Please try again.';
        let statusCode = 500;
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            errorMessage = Object.values(error.errors).map(e => e.message).join(', ');
            statusCode = 400;
        }
        
        // Handle duplicate email error
        if (error.code === 11000) {
            errorMessage = 'Email already registered. Please login instead.';
            statusCode = 409;
        }
        
        res.status(statusCode).json({
            success: false,
            message: errorMessage,
            error: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});

// ==================== FORGOT PASSWORD ====================
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
            // For security, don't reveal if email exists
            return res.json({
                success: true,
                message: 'If this email exists, you will receive a password reset link.'
            });
        }
        
        // Generate reset token
        const resetToken = user.generateResetPasswordToken();
        await user.save();
        
        // In production, you would send an email here
        console.log('📧 Password reset token for', user.email + ':', resetToken);
        
        res.json({
            success: true,
            message: 'Password reset link sent to your email.',
            resetToken // Only for testing, remove in production
        });
        
    } catch (error) {
        console.error('❌ Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process password reset request'
        });
    }
});

// ==================== GET CURRENT USER ====================
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
        
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'smartwaiter_production_secret_2024');
        
        if (decoded.isDemo) {
            return res.json({
                success: true,
                user: {
                    email: decoded.email,
                    role: decoded.role,
                    firstName: decoded.role.charAt(0).toUpperCase() + decoded.role.slice(1),
                    lastName: 'Demo',
                    isDemo: true
                }
            });
        }
        
        // Find user in database
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
        console.error('❌ Get user error:', error);
        
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

// ==================== HEALTH CHECK ====================
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
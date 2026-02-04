const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// SIMPLIFIED LOGIN - REMOVE ALL COMPLEXITY
router.post('/login', async (req, res) => {
    try {
        console.log('=== SIMPLIFIED LOGIN START ===');
        console.log('Email:', req.body.email);
        
        const { email, password } = req.body;
        const normalizedEmail = email.toLowerCase().trim();
        
        // Check demo accounts first
        const demoAccounts = [
            {email: 'admin@demo.com', password: '123456', role: 'admin'},
            {email: 'chef@demo.com', password: '123456', role: 'chef'},
            {email: 'customer@demo.com', password: '123456', role: 'customer'}
        ];
        
        const demo = demoAccounts.find(d => d.email === normalizedEmail);
        if (demo) {
            console.log('Demo account found');
            if (password === demo.password) {
                const token = jwt.sign(
                    {email: demo.email, role: demo.role, isDemo: true},
                    process.env.JWT_SECRET || 'default_secret',
                    {expiresIn: '7d'}
                );
                return res.json({success: true, token, user: {email: demo.email, role: demo.role}});
            }
        }
        
        // Database user
        console.log('Checking database for:', normalizedEmail);
        const user = await User.findOne({email: normalizedEmail});
        
        if (!user) {
            console.log('User not found');
            return res.status(401).json({success: false, message: 'Invalid credentials'});
        }
        
        console.log('User found:', user.email);
        console.log('Has password field?', !!user.password);
        
        // Direct bcrypt compare (bypass model method)
        const isMatch = await bcrypt.compare(password, user.password);
        console.log('Password match:', isMatch);
        
        if (!isMatch) {
            return res.status(401).json({success: false, message: 'Invalid credentials'});
        }
        
        const token = jwt.sign(
            {userId: user._id, email: user.email, role: user.role},
            process.env.JWT_SECRET || 'default_secret',
            {expiresIn: '7d'}
        );
        
        console.log('Login successful');
        console.log('=== SIMPLIFIED LOGIN END ===');
        
        res.json({
            success: true,
            token,
            user: {
                _id: user._id,
                email: user.email,
                role: user.role,
                firstName: user.firstName,
                lastName: user.lastName
            }
        });
        
    } catch (error) {
        console.error('=== LOGIN ERROR ===');
        console.error('Full error:', error);
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
});

// Keep other routes minimal or remove temporarily
router.get('/health', (req, res) => {
    res.json({success: true, message: 'Auth service running'});
});

module.exports = router;
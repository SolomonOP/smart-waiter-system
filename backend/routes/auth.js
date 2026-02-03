const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Hardcoded admin and chef accounts (for demo)
const HARDCODED_USERS = [
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
    }
];

// Register customer
router.post('/register', async (req, res) => {
    try {
        const { firstName, lastName, email, phone, password } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }
        
        // Create new user with customer role
        const user = new User({
            firstName,
            lastName,
            email,
            phone,
            password,
            role: 'customer'
        });
        
        await user.save();
        
        // Create JWT token
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.status(201).json({
            message: 'Registration successful',
            token,
            user: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login all users
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Check hardcoded users first
        const hardcodedUser = HARDCODED_USERS.find(user => user.email === email);
        if (hardcodedUser && hardcodedUser.password === password) {
            const token = jwt.sign(
                { userId: email, role: hardcodedUser.role },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );
            
            return res.json({
                message: 'Login successful',
                token,
                user: {
                    _id: email,
                    firstName: hardcodedUser.firstName,
                    lastName: hardcodedUser.lastName,
                    email: hardcodedUser.email,
                    role: hardcodedUser.role
                }
            });
        }
        
        // Check database users
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        
        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        
        // Create JWT token
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            message: 'Login successful',
            token,
            user: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
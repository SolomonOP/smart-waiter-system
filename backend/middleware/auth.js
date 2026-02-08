const jwt = require('jsonwebtoken');

module.exports = async function(req, res, next) {
    try {
        // Get token from header
        const authHeader = req.header('Authorization');
        
        if (!authHeader) {
            return res.status(401).json({ 
                success: false,
                message: 'No token, authorization denied' 
            });
        }
        
        // Check if it's a Bearer token
        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false,
                message: 'Access denied. No token provided.' 
            });
        }
        
        const token = authHeader.replace('Bearer ', '');
        
        // Check if it's a demo token
        if (token.startsWith('demo_')) {
            const parts = token.split('_');
            if (parts.length === 3) {
                req.user = {
                    id: `demo_${parts[1]}`,
                    userId: `demo_${parts[1]}`,
                    email: `${parts[2]}@demo.com`,
                    role: parts[2],
                    isDemo: true
                };
                req.userId = req.user.userId;
                req.userRole = req.user.role;
                return next();
            }
        }
        
        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this_in_production');
        
        // Handle both JWT structures (your original and the new one)
        if (decoded.user) {
            // New structure: { user: { id, role, ... } }
            req.user = decoded.user;
            req.userId = decoded.user.id;
            req.userRole = decoded.user.role;
        } else {
            // Original structure: { userId, role, ... } directly in decoded
            req.user = decoded;
            req.userId = decoded.userId || decoded.id;
            req.userRole = decoded.role;
        }
        
        next();
    } catch (err) {
        // Handle specific JWT errors
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false,
                message: 'Token is not valid' 
            });
        }
        
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false,
                message: 'Token has expired.' 
            });
        }
        
        console.error('Auth middleware error:', err.message || err);
        res.status(401).json({ 
            success: false,
            message: 'Token is not valid'
        });
    }
};
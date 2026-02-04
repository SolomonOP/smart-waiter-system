const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
    try {
        // Get token from header
        const authHeader = req.header('Authorization');
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
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
        
        // Attach user to request
        req.user = decoded;
        req.userId = decoded.userId;
        req.userRole = decoded.role;
        
        next();
    } catch (err) {
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false,
                message: 'Invalid token.' 
            });
        }
        
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false,
                message: 'Token has expired.' 
            });
        }
        
        console.error('Auth middleware error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Server error during authentication.' 
        });
    }
};
const jwt = require('jsonwebtoken');

module.exports = async function(req, res, next) {
    try {
        const authHeader = req.header('Authorization');
        
        if (!authHeader) {
            return res.status(401).json({ 
                success: false,
                message: 'No token, authorization denied' 
            });
        }
        
        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false,
                message: 'Invalid token format' 
            });
        }
        
        const token = authHeader.replace('Bearer ', '');
        
        // Check for demo token
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
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // STANDARDIZED: Always extract user data consistently
        const userData = decoded.user || decoded;
        
        req.user = {
            id: userData.userId || userData.id || userData._id,
            userId: userData.userId || userData.id || userData._id,
            email: userData.email,
            role: userData.role,
            firstName: userData.firstName,
            lastName: userData.lastName
        };
        
        req.userId = req.user.userId;
        req.userRole = req.user.role;
        
        next();
    } catch (err) {
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false,
                message: 'Token is not valid' 
            });
        }
        
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false,
                message: 'Token has expired' 
            });
        }
        
        console.error('Auth middleware error:', err.message);
        res.status(401).json({ 
            success: false,
            message: 'Authentication failed'
        });
    }
};
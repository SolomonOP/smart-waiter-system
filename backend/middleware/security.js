const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const compression = require('compression');

// Stricter rate limit for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: {
        success: false,
        message: 'Too many login attempts, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// General API rate limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

const securityMiddleware = (app) => {
    // Set security HTTP headers
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                fontSrc: ["'self'", "https://fonts.gstatic.com"],
                imgSrc: ["'self'", "data:", "https:", "http:"],
                connectSrc: ["'self'", process.env.BACKEND_URL || "https://smart-waiter-backend.onrender.com"]
            }
        },
        crossOriginEmbedderPolicy: false
    }));
    
    // Compression
    app.use(compression());
    
    // Apply rate limiting
    app.use('/api/auth/login', authLimiter);
    app.use('/api/auth/register', authLimiter);
    app.use('/api', apiLimiter);
    
    // Data sanitization against NoSQL query injection
    app.use(mongoSanitize({
        replaceWith: '_',
        onSanitize: ({ req, key }) => {
            console.warn(`⚠️ Attempted NoSQL injection: ${key}`);
        }
    }));
    
    // Data sanitization against XSS
    app.use(xss());
    
    // Prevent parameter pollution
    app.use(hpp({
        whitelist: [
            'price',
            'rating',
            'category',
            'sort',
            'limit',
            'page',
            'status',
            'tableNumber'
        ]
    }));
    
    // Additional security headers
    app.use((req, res, next) => {
        res.header('X-Content-Type-Options', 'nosniff');
        res.header('X-Frame-Options', 'DENY');
        res.header('X-XSS-Protection', '1; mode=block');
        res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        next();
    });
};

module.exports = securityMiddleware;
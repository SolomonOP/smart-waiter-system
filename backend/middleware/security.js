const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const compression = require('compression');

// Security middleware setup
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
                connectSrc: ["'self'", "https://smart-waiter.onrender.com", "ws://smart-waiter.onrender.com", "wss://smart-waiter.onrender.com"]
            }
        },
        crossOriginEmbedderPolicy: false
    }));
    
    // Compression
    app.use(compression());
    
    // Rate limiting
    const limiter = rateLimit({
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
        max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
        message: {
            success: false,
            message: 'Too many requests from this IP, please try again later.'
        },
        standardHeaders: true,
        legacyHeaders: false
    });
    
    // Apply rate limiting to API routes
    app.use('/api', limiter);
    
    // Data sanitization against NoSQL query injection
    app.use(mongoSanitize({
        replaceWith: '_',
        onSanitize: ({ req, key }) => {
            console.warn(`Attempted NoSQL injection: ${key}`, req.body);
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
            'page'
        ]
    }));
    
    // CORS configuration (already in server.js, but adding additional headers)
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
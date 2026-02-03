const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

// Security middleware setup
const securityMiddleware = (app) => {
    // Set security HTTP headers
    app.use(helmet());
    
    // Rate limiting
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit each IP to 100 requests per windowMs
        message: 'Too many requests from this IP, please try again later.'
    });
    app.use('/api', limiter);
    
    // Data sanitization against NoSQL query injection
    app.use(mongoSanitize());
    
    // Data sanitization against XSS
    app.use(xss());
    
    // Prevent parameter pollution
    app.use(hpp());
    
    // CORS configuration
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', process.env.NODE_ENV === 'production' 
            ? process.env.BASE_URL 
            : 'http://localhost:3000');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        next();
    });
};

module.exports = securityMiddleware;
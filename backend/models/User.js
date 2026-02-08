const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
        minlength: [2, 'First name must be at least 2 characters'],
        maxlength: [50, 'First name cannot exceed 50 characters']
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
        minlength: [2, 'Last name must be at least 2 characters'],
        maxlength: [50, 'Last name cannot exceed 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters']
        // REMOVED: select: false - This was causing the issue!
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        match: [/^[0-9]{10,15}$/, 'Please enter a valid phone number']
    },
    role: {
        type: String,
        enum: {
            values: ['customer', 'chef', 'admin'],
            message: 'Role must be either customer, chef, or admin'
        },
        default: 'customer'
    },
    avatar: {
        type: String,
        default: 'default-avatar.png'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date
    },
    failedLoginAttempts: {
        type: Number,
        default: 0
    },
    lastFailedLogin: {
        type: Date
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    emailVerificationToken: String,
    emailVerified: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for full name
UserSchema.virtual('fullName').get(function() {
    return `${this.firstName} ${this.lastName}`;
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
    // Only hash the password if it's modified (or new)
    if (!this.isModified('password')) return next();
    
    try {
        console.log('🔐 Hashing password for user:', this.email);
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        console.log('✅ Password hashed successfully');
        next();
    } catch (error) {
        console.error('❌ Password hashing error:', error);
        next(error);
    }
});

// Update timestamp before saving
UserSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Method to compare password
UserSchema.methods.comparePassword = async function(enteredPassword) {
    try {
        console.log('🔑 Comparing password for user:', this.email);
        const result = await bcrypt.compare(enteredPassword, this.password);
        console.log('✅ Bcrypt compare result:', result);
        return result;
    } catch (error) {
        console.error('❌ Password comparison error:', error);
        return false;
    }
};

// Method to generate JWT token
UserSchema.methods.generateAuthToken = function() {
    try {
        console.log('🎫 Generating auth token for user:', this.email);
        const token = jwt.sign(
            { 
                userId: this._id, 
                email: this.email, 
                role: this.role,
                firstName: this.firstName,
                lastName: this.lastName
            },
            process.env.JWT_SECRET || 'smartwaiter_production_secret_2024',
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );
        console.log('✅ Token generated');
        return token;
    } catch (error) {
        console.error('❌ Token generation error:', error);
        throw error;
    }
};

// Method to generate reset password token
UserSchema.methods.generateResetPasswordToken = function() {
    try {
        const resetToken = jwt.sign(
            { userId: this._id },
            process.env.JWT_SECRET || 'smartwaiter_production_secret_2024',
            { expiresIn: '1h' }
        );
        
        this.resetPasswordToken = resetToken;
        this.resetPasswordExpire = Date.now() + 3600000; // 1 hour
        
        console.log('🔑 Generated reset token for user:', this.email);
        return resetToken;
    } catch (error) {
        console.error('❌ Reset token generation error:', error);
        throw error;
    }
};

// Indexes
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1 });
UserSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', UserSchema);
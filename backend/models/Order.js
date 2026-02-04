const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    tableNumber: {
        type: Number,
        required: [true, 'Table number is required'],
        min: [1, 'Table number must be at least 1']
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    customerName: {
        type: String,
        required: true
    },
    customerEmail: {
        type: String,
        required: true
    },
    items: [{
        menuItem: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'MenuItem',
            required: true
        },
        name: {
            type: String,
            required: true
        },
        price: {
            type: Number,
            required: true,
            min: [0, 'Price cannot be negative']
        },
        quantity: {
            type: Number,
            required: true,
            min: [1, 'Quantity must be at least 1'],
            default: 1
        },
        specialInstructions: {
            type: String,
            maxlength: [200, 'Special instructions cannot exceed 200 characters']
        },
        itemTotal: {
            type: Number,
            required: true,
            min: [0, 'Item total cannot be negative']
        }
    }],
    subtotal: {
        type: Number,
        required: true,
        min: [0, 'Subtotal cannot be negative']
    },
    tax: {
        type: Number,
        default: 0,
        min: [0, 'Tax cannot be negative']
    },
    serviceCharge: {
        type: Number,
        default: 0,
        min: [0, 'Service charge cannot be negative']
    },
    discount: {
        type: Number,
        default: 0,
        min: [0, 'Discount cannot be negative']
    },
    totalAmount: {
        type: Number,
        required: true,
        min: [0, 'Total amount cannot be negative']
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'card', 'upi', 'wallet', 'pending'],
        default: 'pending'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending'
    },
    paymentId: String,
    status: {
        type: String,
        enum: {
            values: ['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled', 'rejected'],
            message: 'Please select a valid status'
        },
        default: 'pending'
    },
    assignedChef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    chefName: String,
    estimatedPrepTime: {
        type: Number, // in minutes
        default: 20
    },
    actualPrepTime: {
        type: Number // in minutes
    },
    specialInstructions: {
        type: String,
        maxlength: [500, 'Special instructions cannot exceed 500 characters']
    },
    serviceRequests: [{
        type: {
            type: String,
            enum: ['water', 'cleaning', 'bill', 'cutlery', 'napkin', 'extra_sauce', 'other'],
            required: true
        },
        tableNumber: {
            type: Number,
            required: true
        },
        description: {
            type: String,
            maxlength: [200, 'Description cannot exceed 200 characters']
        },
        status: {
            type: String,
            enum: ['pending', 'assigned', 'completed', 'cancelled'],
            default: 'pending'
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        completedAt: Date,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    rating: {
        type: Number,
        min: 1,
        max: 5
    },
    feedback: {
        type: String,
        maxlength: [500, 'Feedback cannot exceed 500 characters']
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    confirmedAt: Date,
    preparingAt: Date,
    readyAt: Date,
    servedAt: Date,
    completedAt: Date,
    cancelledAt: Date
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for order duration
OrderSchema.virtual('duration').get(function() {
    if (this.completedAt && this.createdAt) {
        return Math.round((this.completedAt - this.createdAt) / 60000); // minutes
    }
    return null;
});

// Virtual for isActive
OrderSchema.virtual('isActive').get(function() {
    return !['completed', 'cancelled', 'rejected'].includes(this.status);
});

// Pre-save middleware to calculate totals
OrderSchema.pre('save', function(next) {
    // Calculate item totals
    this.items.forEach(item => {
        item.itemTotal = item.price * item.quantity;
    });
    
    // Calculate subtotal
    this.subtotal = this.items.reduce((sum, item) => sum + item.itemTotal, 0);
    
    // Calculate tax (10%)
    this.tax = this.subtotal * 0.1;
    
    // Calculate service charge (5%)
    this.serviceCharge = this.subtotal * 0.05;
    
    // Calculate total
    this.totalAmount = this.subtotal + this.tax + this.serviceCharge - this.discount;
    
    // Update timestamp
    this.updatedAt = Date.now();
    
    next();
});

// Pre-save middleware to generate order number
OrderSchema.pre('save', async function(next) {
    if (!this.isNew) return next();
    
    try {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        
        // Get count of today's orders
        const startOfDay = new Date(date.setHours(0, 0, 0, 0));
        const endOfDay = new Date(date.setHours(23, 59, 59, 999));
        
        const count = await this.constructor.countDocuments({
            createdAt: { $gte: startOfDay, $lte: endOfDay }
        });
        
        const sequence = (count + 1).toString().padStart(4, '0');
        this.orderNumber = `ORD${year}${month}${day}${sequence}`;
        
        next();
    } catch (error) {
        next(error);
    }
});

// Indexes for better query performance
OrderSchema.index({ orderNumber: 1 }, { unique: true });
OrderSchema.index({ customer: 1, createdAt: -1 });
OrderSchema.index({ tableNumber: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ assignedChef: 1, status: 1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ 'serviceRequests.status': 1 });
OrderSchema.index({ totalAmount: 1 });

module.exports = mongoose.model('Order', OrderSchema);
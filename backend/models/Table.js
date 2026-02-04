const mongoose = require('mongoose');

const TableSchema = new mongoose.Schema({
    tableNumber: {
        type: Number,
        required: [true, 'Table number is required'],
        unique: true,
        min: [1, 'Table number must be at least 1'],
        max: [999, 'Table number cannot exceed 999']
    },
    tableName: {
        type: String,
        trim: true,
        maxlength: [50, 'Table name cannot exceed 50 characters']
    },
    status: {
        type: String,
        enum: {
            values: ['available', 'occupied', 'reserved', 'maintenance', 'cleaning'],
            message: 'Please select a valid table status'
        },
        default: 'available'
    },
    capacity: {
        type: Number,
        required: [true, 'Capacity is required'],
        min: [1, 'Capacity must be at least 1'],
        max: [20, 'Capacity cannot exceed 20'],
        default: 4
    },
    location: {
        type: String,
        enum: ['indoor', 'outdoor', 'terrace', 'private', 'vip'],
        default: 'indoor'
    },
    section: {
        type: String,
        trim: true,
        maxlength: [50, 'Section cannot exceed 50 characters']
    },
    qrCode: {
        type: String,
        required: true
    },
    qrCodeData: {
        type: String
    },
    currentOrder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },
    currentCustomer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    customerName: String,
    occupiedAt: Date,
    reservedUntil: Date,
    notes: {
        type: String,
        maxlength: [500, 'Notes cannot exceed 500 characters']
    },
    isActive: {
        type: Boolean,
        default: true
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

// Virtual for occupancy duration
TableSchema.virtual('occupancyDuration').get(function() {
    if (this.status === 'occupied' && this.occupiedAt) {
        return Math.round((Date.now() - this.occupiedAt) / 60000); // minutes
    }
    return null;
});

// Pre-save middleware to generate QR code
TableSchema.pre('save', function(next) {
    if (this.isNew || this.isModified('tableNumber')) {
        const baseUrl = process.env.BASE_URL || 'https://smart-waiter.onrender.com';
        this.qrCodeData = `${baseUrl}/table/${this.tableNumber}`;
        this.qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(this.qrCodeData)}`;
    }
    
    this.updatedAt = Date.now();
    next();
});

// Indexes
TableSchema.index({ tableNumber: 1 }, { unique: true });
TableSchema.index({ status: 1 });
TableSchema.index({ location: 1, capacity: 1 });
TableSchema.index({ section: 1 });
TableSchema.index({ isActive: 1 });

module.exports = mongoose.model('Table', TableSchema);
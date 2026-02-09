const mongoose = require('mongoose');

const TableSchema = new mongoose.Schema({
    tableNumber: {
        type: Number,
        required: true,
        unique: true
    },
    capacity: {
        type: Number,
        required: true,
        min: [1, 'Capacity must be at least 1']
    },
    location: {
        type: String,
        default: 'indoor'
    },
    section: String,
    status: {
        type: String,
        enum: ['available', 'occupied', 'reserved', 'cleaning', 'maintenance'],
        default: 'available'
    },
    isActive: {
        type: Boolean,
        default: true
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
    
    // Service requests array - FIXED ENUM VALUES
    serviceRequests: [{
        type: {
            type: String,
            enum: ['water', 'cleaning', 'bill', 'cutlery', 'napkin', 'extra_sauce', 'other', 'chef_attention'],
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
        customerName: String,
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        status: {
            type: String,
            enum: ['pending', 'acknowledged', 'in-progress', 'completed', 'cancelled'],
            default: 'pending'
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        priority: {
            type: String,
            enum: ['low', 'normal', 'high', 'urgent'],
            default: 'normal'
        },
        notes: String,
        completedAt: Date,
        acknowledgedAt: Date,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    
    metadata: {
        lastCleaned: Date,
        notes: String
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for pending service requests count
TableSchema.virtual('pendingRequests').get(function() {
    if (!this.serviceRequests) return 0;
    return this.serviceRequests.filter(req => req.status === 'pending').length;
});

// Virtual for active service requests
TableSchema.virtual('activeRequests').get(function() {
    if (!this.serviceRequests) return [];
    return this.serviceRequests.filter(req => 
        ['pending', 'acknowledged', 'in-progress'].includes(req.status)
    );
});

// Indexes
TableSchema.index({ tableNumber: 1 }, { unique: true });
TableSchema.index({ status: 1 });
TableSchema.index({ location: 1 });
TableSchema.index({ isActive: 1 });
TableSchema.index({ 'serviceRequests.status': 1 });
TableSchema.index({ 'serviceRequests.createdAt': -1 });

module.exports = mongoose.model('Table', TableSchema);
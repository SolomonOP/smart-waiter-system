const mongoose = require('mongoose');

const TableSchema = new mongoose.Schema({
    tableNumber: {
        type: Number,
        required: true,
        unique: true
    },
    capacity: {
        type: Number,
        default: 4
    },
    status: {
        type: String,
        enum: ['available', 'occupied', 'reserved', 'cleaning'],
        default: 'available'
    },
    location: {
        type: String,
        default: 'Main Hall'
    },
    section: {
        type: String,
        default: 'A'
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
    customerName: {
        type: String
    },
    // Service requests array
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
            default: ''
        },
        customerName: {
            type: String,
            default: 'Customer'
        },
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        status: {
            type: String,
            enum: ['pending', 'acknowledged', 'completed', 'cancelled'],
            default: 'pending'
        },
        priority: {
            type: String,
            enum: ['urgent', 'high', 'normal', 'low'],
            default: 'normal'
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        assignedToName: {
            type: String
        },
        notes: {
            type: String
        },
        completionNotes: {
            type: String
        },
        acknowledgedAt: {
            type: Date
        },
        completedAt: {
            type: Date
        },
        createdAt: {
            type: Date,
            default: Date.now
        },
        updatedAt: {
            type: Date,
            default: Date.now
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
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
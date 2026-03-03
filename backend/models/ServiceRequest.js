const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['water', 'cleaning', 'bill', 'cutlery', 'napkin', 'extra_sauce', 'other', 'chef_attention'],
        required: true
    },
    table: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Table',
        required: true
    },
    tableNumber: {
        type: Number,
        required: true
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    customerName: {
        type: String,
        required: true
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },
    description: {
        type: String,
        trim: true
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
});

// Update timestamp before saving
serviceRequestSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Indexes
serviceRequestSchema.index({ status: 1 });
serviceRequestSchema.index({ tableNumber: 1 });
serviceRequestSchema.index({ customer: 1 });
serviceRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);
const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  tableNumber: {
    type: Number,
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [{
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem'
    },
    name: String,
    price: Number,
    quantity: Number
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'preparing', 'ready', 'completed', 'rejected'],
    default: 'pending'
  },
  assignedChef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  serviceRequests: [{
    type: {
      type: String,
      enum: ['water', 'cleaning', 'bill']
    },
    tableNumber: Number,
    status: {
      type: String,
      enum: ['pending', 'assigned', 'completed'],
      default: 'pending'
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

module.exports = mongoose.model('Order', OrderSchema);
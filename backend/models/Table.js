const mongoose = require('mongoose');

const TableSchema = new mongoose.Schema({
  tableNumber: {
    type: Number,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['available', 'occupied', 'reserved'],
    default: 'available'
  },
  capacity: {
    type: Number,
    default: 4
  },
  qrCode: {
    type: String,
    required: true
  }
});

module.exports = mongoose.model('Table', TableSchema);
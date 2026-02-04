// models/index.js
const mongoose = require('mongoose');

// Central export point for all models
const User = require('./User');
const MenuItem = require('./MenuItem');
const Order = require('./Order');
const Table = require('./Table');

module.exports = {
  User,
  MenuItem,
  Order,
  Table,
  mongoose
};
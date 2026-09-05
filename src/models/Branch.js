const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Branch name is required'],
      trim: true,
      unique: true
    },
    code: {
      type: String,
      required: [true, 'Branch code is required'],
      unique: true,
      uppercase: true,
      trim: true
    },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true }
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required']
    },
    email: {
      type: String,
      required: [true, 'Branch email is required'],
      lowercase: true,
      trim: true
    },
    totalSeatingCapacity: {
      type: Number,
      required: true,
      min: [1, 'Capacity must be at least 1']
    },
    openingTime: {
      type: String,
      default: '11:00', // HH:mm format
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Please provide a valid time in HH:mm format']
    },
    closingTime: {
      type: String,
      default: '23:00', // HH:mm format
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Please provide a valid time in HH:mm format']
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Branch', branchSchema);

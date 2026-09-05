const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch ID is required']
    },
    tableNumber: {
      type: String,
      required: [true, 'Table number/name is required'],
      trim: true
    },
    capacity: {
      type: Number,
      required: [true, 'Seating capacity is required'],
      min: [1, 'Capacity must be at least 1 person']
    },
    location: {
      type: String,
      enum: ['indoor', 'outdoor', 'rooftop', 'private_dining', 'balcony', 'window_side'],
      default: 'indoor'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    description: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Unique table number per branch
tableSchema.index({ branchId: 1, tableNumber: 1 }, { unique: true });
tableSchema.index({ branchId: 1, capacity: 1, isActive: 1 });

module.exports = mongoose.model('Table', tableSchema);

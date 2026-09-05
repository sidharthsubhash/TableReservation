const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer ID is required']
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch ID is required']
    },
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Table',
      required: [true, 'Table ID is required']
    },
    partySize: {
      type: Number,
      required: [true, 'Party size / guest count is required'],
      min: [1, 'Party size must be at least 1']
    },
    reservationDate: {
      type: String, // Format: YYYY-MM-DD
      required: [true, 'Reservation date (YYYY-MM-DD) is required']
    },
    timeSlot: {
      startTime: {
        type: String, // Format: HH:mm
        required: [true, 'Start time (HH:mm) is required']
      },
      endTime: {
        type: String, // Format: HH:mm
        required: [true, 'End time (HH:mm) is required']
      }
    },
    startDateTime: {
      type: Date,
      required: true
    },
    endDateTime: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED'],
      default: 'CONFIRMED'
    },
    specialRequests: {
      type: String,
      default: ''
    },
    cancellationReason: {
      type: String,
      default: null
    },
    cancelledAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Indexes for high performance conflict lookups and analytics
reservationSchema.index({ tableId: 1, startDateTime: 1, endDateTime: 1, status: 1 });
reservationSchema.index({ branchId: 1, reservationDate: 1, status: 1 });
reservationSchema.index({ customerId: 1, startDateTime: -1 });

module.exports = mongoose.model('Reservation', reservationSchema);

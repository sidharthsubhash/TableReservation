const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
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
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null
    },
    reservationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reservation',
      default: null
    },
    rating: {
      type: Number,
      required: [true, 'Overall rating is required (1-5)'],
      min: [1, 'Minimum rating is 1'],
      max: [5, 'Maximum rating is 5']
    },
    foodRating: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    serviceRating: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    ambienceRating: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [500, 'Comment cannot exceed 500 characters']
    },
    isPublic: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

feedbackSchema.index({ branchId: 1, rating: -1 });
feedbackSchema.index({ customerId: 1, createdAt: -1 });

module.exports = mongoose.model('Feedback', feedbackSchema);

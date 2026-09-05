const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    menuItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    specialInstructions: {
      type: String,
      default: ''
    },
    itemStatus: {
      type: String,
      enum: ['PENDING', 'PREPARING', 'READY', 'SERVED'],
      default: 'PENDING'
    }
  },
  { _id: true }
);

const billingSchema = new mongoose.Schema(
  {
    subtotal: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    discountedSubtotal: { type: Number, default: 0 },
    taxRatePercent: { type: Number, default: 5 },
    taxAmount: { type: Number, default: 0 },
    serviceChargeRatePercent: { type: Number, default: 5 },
    serviceChargeAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ['UNPAID', 'PAID', 'REFUNDED'],
      default: 'UNPAID'
    },
    paymentMethod: {
      type: String,
      enum: ['PENDING', 'CASH', 'CARD', 'UPI', 'ONLINE'],
      default: 'PENDING'
    },
    paidAt: { type: Date, default: null },
    transactionRef: { type: String, default: null }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true
    },
    orderType: {
      type: String,
      enum: ['DINE_IN', 'TAKEAWAY'],
      default: 'DINE_IN'
    },
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
    reservationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reservation',
      default: null
    },
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Table',
      default: null
    },
    items: [orderItemSchema],
    status: {
      type: String,
      enum: ['PLACED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED'],
      default: 'PLACED'
    },
    billing: billingSchema,
    estimatedPrepTimeMinutes: {
      type: Number,
      default: 20
    },
    notes: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

orderSchema.index({ branchId: 1, status: 1, createdAt: 1 });
orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ 'billing.paymentStatus': 1 });

module.exports = mongoose.model('Order', orderSchema);

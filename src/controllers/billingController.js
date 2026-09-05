const Order = require('../models/Order');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { calculateBill } = require('../utils/billCalculator');

// @desc    Get order bill and itemized invoice breakdown
// @route   GET /api/billing/:orderId
// @access  Private
const getOrderBill = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.orderId)
    .populate('branchId', 'name code address phone email')
    .populate('tableId', 'tableNumber capacity location')
    .populate('customerId', 'name email phone');

  if (!order) {
    return next(new AppError(`Order not found with ID ${req.params.orderId}`, 404));
  }

  if (req.user.role === 'customer' && order.customerId._id.toString() !== req.user._id.toString()) {
    return next(new AppError('Not authorized to access this bill.', 403));
  }

  // Recalculate bill in case of any updates
  const billSummary = calculateBill(order.items, {
    taxRate: order.billing.taxRatePercent,
    serviceChargeRate: order.billing.serviceChargeRatePercent,
    discountPercent: order.billing.discountPercent
  });

  const invoice = {
    invoiceNumber: `INV-${order.orderNumber.replace('ORD-', '')}`,
    orderNumber: order.orderNumber,
    orderType: order.orderType,
    orderStatus: order.status,
    restaurant: {
      branchName: order.branchId ? order.branchId.name : 'Main Branch',
      branchCode: order.branchId ? order.branchId.code : 'MAIN',
      address: order.branchId ? order.branchId.address : null,
      phone: order.branchId ? order.branchId.phone : null
    },
    table: order.tableId ? `Table ${order.tableId.tableNumber} (${order.tableId.location})` : 'N/A',
    customer: {
      name: order.customerId ? order.customerId.name : 'Guest',
      phone: order.customerId ? order.customerId.phone : 'N/A',
      email: order.customerId ? order.customerId.email : 'N/A'
    },
    items: order.items.map((i) => ({
      name: i.name,
      unitPrice: i.price,
      quantity: i.quantity,
      itemTotal: Number((i.price * i.quantity).toFixed(2))
    })),
    breakdown: {
      subtotal: billSummary.subtotal,
      discountPercent: billSummary.discountPercent,
      discountAmount: billSummary.discountAmount,
      discountedSubtotal: billSummary.discountedSubtotal,
      taxRatePercent: billSummary.taxRatePercent,
      taxAmount: billSummary.taxAmount,
      serviceChargeRatePercent: billSummary.serviceChargeRatePercent,
      serviceChargeAmount: billSummary.serviceChargeAmount,
      grandTotal: billSummary.grandTotal
    },
    payment: {
      status: order.billing.paymentStatus,
      method: order.billing.paymentMethod,
      paidAt: order.billing.paidAt,
      transactionRef: order.billing.transactionRef
    },
    issuedAt: new Date()
  };

  res.status(200).json({
    success: true,
    data: {
      invoice
    }
  });
});

// @desc    Process payment for an order
// @route   POST /api/billing/:orderId/pay
// @access  Private
const processPayment = asyncHandler(async (req, res, next) => {
  const { paymentMethod = 'CARD', transactionRef } = req.body;
  const allowedMethods = ['CASH', 'CARD', 'UPI', 'ONLINE'];

  if (!allowedMethods.includes(paymentMethod)) {
    return next(new AppError(`Invalid payment method. Allowed methods: ${allowedMethods.join(', ')}`, 400));
  }

  const order = await Order.findById(req.params.orderId);
  if (!order) {
    return next(new AppError(`Order not found with ID ${req.params.orderId}`, 404));
  }

  if (order.status === 'CANCELLED') {
    return next(new AppError('Cannot pay for a cancelled order.', 400));
  }

  if (order.billing.paymentStatus === 'PAID') {
    return next(new AppError('This order is already paid.', 400));
  }

  order.billing.paymentStatus = 'PAID';
  order.billing.paymentMethod = paymentMethod;
  order.billing.paidAt = new Date();
  order.billing.transactionRef = transactionRef || `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // If order is currently SERVED, payment can advance it to COMPLETED
  if (order.status === 'SERVED') {
    order.status = 'COMPLETED';
  }

  await order.save();

  res.status(200).json({
    success: true,
    message: 'Payment processed successfully! Receipt generated.',
    data: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      grandTotal: order.billing.grandTotal,
      paymentStatus: order.billing.paymentStatus,
      paymentMethod: order.billing.paymentMethod,
      transactionRef: order.billing.transactionRef,
      paidAt: order.billing.paidAt
    }
  });
});

// @desc    Apply discount to order
// @route   PATCH /api/billing/:orderId/discount
// @access  Private (Manager, Admin)
const applyDiscount = asyncHandler(async (req, res, next) => {
  const { discountPercent } = req.body;

  if (discountPercent === undefined || discountPercent < 0 || discountPercent > 100) {
    return next(new AppError('Please provide a valid discount percentage (0-100).', 400));
  }

  const order = await Order.findById(req.params.orderId);
  if (!order) {
    return next(new AppError(`Order not found with ID ${req.params.orderId}`, 404));
  }

  if (order.billing.paymentStatus === 'PAID') {
    return next(new AppError('Cannot modify discount on an already paid order.', 400));
  }

  const billSummary = calculateBill(order.items, {
    taxRate: order.billing.taxRatePercent,
    serviceChargeRate: order.billing.serviceChargeRatePercent,
    discountPercent: Number(discountPercent)
  });

  order.billing.discountPercent = billSummary.discountPercent;
  order.billing.discountAmount = billSummary.discountAmount;
  order.billing.discountedSubtotal = billSummary.discountedSubtotal;
  order.billing.taxAmount = billSummary.taxAmount;
  order.billing.serviceChargeAmount = billSummary.serviceChargeAmount;
  order.billing.grandTotal = billSummary.grandTotal;

  await order.save();

  res.status(200).json({
    success: true,
    message: `Discount of ${discountPercent}% applied successfully`,
    data: {
      billing: order.billing
    }
  });
});

module.exports = {
  getOrderBill,
  processPayment,
  applyDiscount
};

const Order = require('../models/Order');
const Reservation = require('../models/Reservation');
const Feedback = require('../models/Feedback');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Get customer order history
// @route   GET /api/customers/history/orders
// @access  Private (Customer, or Manager/Admin viewing specific customer)
const getCustomerOrderHistory = asyncHandler(async (req, res, next) => {
  const customerId = req.user.role === 'customer' ? req.user._id : (req.query.customerId || req.user._id);

  const orders = await Order.find({ customerId })
    .populate('branchId', 'name code address')
    .populate('tableId', 'tableNumber location')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: orders.length,
    data: {
      orders
    }
  });
});

// @desc    Get customer reservation history
// @route   GET /api/customers/history/reservations
// @access  Private (Customer, or Manager/Admin viewing specific customer)
const getCustomerReservationHistory = asyncHandler(async (req, res, next) => {
  const customerId = req.user.role === 'customer' ? req.user._id : (req.query.customerId || req.user._id);

  const reservations = await Reservation.find({ customerId })
    .populate('branchId', 'name code address phone')
    .populate('tableId', 'tableNumber capacity location')
    .sort({ startDateTime: -1 });

  res.status(200).json({
    success: true,
    count: reservations.length,
    data: {
      reservations
    }
  });
});

// @desc    Get aggregated customer dining profile summary
// @route   GET /api/customers/summary
// @access  Private
const getCustomerSummary = asyncHandler(async (req, res, next) => {
  const customerId = req.user.role === 'customer' ? req.user._id : (req.query.customerId || req.user._id);

  const [totalOrders, paidOrders, totalReservations, feedbackGiven] = await Promise.all([
    Order.countDocuments({ customerId }),
    Order.find({ customerId, 'billing.paymentStatus': 'PAID' }),
    Reservation.countDocuments({ customerId }),
    Feedback.countDocuments({ customerId })
  ]);

  const totalSpent = paidOrders.reduce((acc, curr) => acc + (curr.billing.grandTotal || 0), 0);

  res.status(200).json({
    success: true,
    data: {
      customerId,
      totalOrders,
      completedOrdersCount: paidOrders.length,
      totalSpent: Number(totalSpent.toFixed(2)),
      totalReservations,
      feedbackGiven
    }
  });
});

module.exports = {
  getCustomerOrderHistory,
  getCustomerReservationHistory,
  getCustomerSummary
};

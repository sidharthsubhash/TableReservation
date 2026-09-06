const Order = require('../models/Order');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Get real-time kitchen order queue (Pending, Preparing, Ready)
// @route   GET /api/kitchen/queue
// @access  Private (Kitchen Staff, Manager, Admin)
const getKitchenQueue = asyncHandler(async (req, res, next) => {
  const { branchId } = req.query;
  const filter = {
    status: { $in: ['PLACED', 'PREPARING', 'READY'] }
  };

  // If staff has an assigned branch, default to their branch
  if (req.user.branchId) {
    filter.branchId = req.user.branchId;
  } else if (branchId) {
    filter.branchId = branchId;
  }

  const orders = await Order.find(filter)
    .populate('branchId', 'name code')
    .populate('tableId', 'tableNumber location')
    .populate('customerId', 'name phone')
    .sort({ createdAt: 1 }); // FIFO - oldest orders first

  const now = Date.now();
  const queueItems = orders.map((order) => {
    const elapsedMinutes = Math.floor((now - new Date(order.createdAt).getTime()) / 60000);
    const isDelayed = elapsedMinutes > order.estimatedPrepTimeMinutes;

    return {
      orderId: order._id,
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      table: order.tableId ? { id: order.tableId._id, tableNumber: order.tableId.tableNumber } : null,
      customer: order.customerId ? { name: order.customerId.name, phone: order.customerId.phone } : null,
      branch: order.branchId ? { id: order.branchId._id, name: order.branchId.name } : null,
      status: order.status,
      items: order.items,
      notes: order.notes,
      estimatedPrepTimeMinutes: order.estimatedPrepTimeMinutes,
      elapsedMinutes,
      isDelayed,
      createdAt: order.createdAt
    };
  });

  res.status(200).json({
    success: true,
    totalQueueCount: queueItems.length,
    placedCount: queueItems.filter((o) => o.status === 'PLACED').length,
    preparingCount: queueItems.filter((o) => o.status === 'PREPARING').length,
    readyCount: queueItems.filter((o) => o.status === 'READY').length,
    data: {
      queue: queueItems
    }
  });
});

// @desc    Advance kitchen order status to next lifecycle step (1-click action)
// @route   PATCH /api/kitchen/orders/:id/advance
// @access  Private (Kitchen Staff, Manager, Admin)
const advanceOrderStatus = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    return next(new AppError(`Order not found with ID ${req.params.id}`, 404));
  }

  let nextStatus;
  switch (order.status) {
    case 'PLACED':
      nextStatus = 'PREPARING';
      order.items.forEach((item) => (item.itemStatus = 'PREPARING'));
      break;
    case 'PREPARING':
      nextStatus = 'READY';
      order.items.forEach((item) => (item.itemStatus = 'READY'));
      break;
    case 'READY':
      nextStatus = 'SERVED';
      order.items.forEach((item) => (item.itemStatus = 'SERVED'));
      break;
    case 'SERVED':
      nextStatus = 'COMPLETED';
      break;
    default:
      return next(new AppError(`Order is in '${order.status}' state and cannot be advanced.`, 409));
  }

  order.status = nextStatus;
  await order.save();

  res.status(200).json({
    success: true,
    message: `Order status advanced to ${nextStatus}`,
    data: {
      order
    }
  });
});

// @desc    Update single item preparation status within an order
// @route   PATCH /api/kitchen/orders/:orderId/items/:itemId
// @access  Private (Kitchen Staff, Manager, Admin)
const updateItemStatus = asyncHandler(async (req, res, next) => {
  const { orderId, itemId } = req.params;
  const { itemStatus } = req.body;

  if (!['PENDING', 'PREPARING', 'READY', 'SERVED'].includes(itemStatus)) {
    return next(new AppError('Invalid item status.', 400));
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return next(new AppError(`Order not found with ID ${orderId}`, 404));
  }

  const item = order.items.id(itemId);
  if (!item) {
    return next(new AppError(`Item not found with ID ${itemId}`, 404));
  }

  item.itemStatus = itemStatus;

  // If all items are ready, automatically update order status to READY
  const allReady = order.items.every((i) => i.itemStatus === 'READY' || i.itemStatus === 'SERVED');
  if (allReady && order.status === 'PREPARING') {
    order.status = 'READY';
  }

  await order.save();

  res.status(200).json({
    success: true,
    message: `Item status updated to ${itemStatus}`,
    data: {
      order
    }
  });
});

module.exports = {
  getKitchenQueue,
  advanceOrderStatus,
  updateItemStatus
};

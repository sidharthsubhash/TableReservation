const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Branch = require('../models/Branch');
const Table = require('../models/Table');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { calculateBill } = require('../utils/billCalculator');

// @desc    Place a new food order (Dine-in / Takeaway)
// @route   POST /api/orders
// @access  Private (Customer, Staff, Manager, Admin)
const createOrder = asyncHandler(async (req, res, next) => {
  const {
    branchId,
    orderType = 'DINE_IN',
    reservationId,
    tableId,
    items,
    discountPercent = 0,
    notes
  } = req.body;

  const customerId = req.user.role === 'customer' ? req.user._id : (req.body.customerId || req.user._id);

  if (!items || !Array.isArray(items) || items.length === 0) {
    return next(new AppError('Please provide at least one item in the order.', 400));
  }

  const branch = await Branch.findById(branchId);
  if (!branch || !branch.isActive) {
    return next(new AppError('Branch not found or inactive.', 404));
  }

  // Validate table if dine-in
  if (orderType === 'DINE_IN' && tableId) {
    const table = await Table.findById(tableId);
    if (!table || !table.isActive) {
      return next(new AppError('Selected table is invalid or inactive.', 400));
    }
  }

  // Fetch all menu items referenced in the order to snapshot current price and name
  const itemIds = items.map((i) => i.menuItemId);
  const menuItems = await MenuItem.find({ _id: { $in: itemIds } });

  const menuItemMap = new Map();
  menuItems.forEach((item) => menuItemMap.set(item._id.toString(), item));

  let maxPrepTime = 10;
  const processedItems = [];

  for (const item of items) {
    const foundMenu = menuItemMap.get(item.menuItemId.toString());
    if (!foundMenu) {
      return next(new AppError(`Menu item not found with ID ${item.menuItemId}`, 404));
    }
    if (!foundMenu.isAvailable) {
      return next(new AppError(`Menu item "${foundMenu.name}" is currently sold out / unavailable.`, 400));
    }

    const quantity = Number(item.quantity) || 1;
    if (quantity <= 0) {
      return next(new AppError('Item quantity must be at least 1.', 400));
    }

    if (foundMenu.preparationTimeMinutes > maxPrepTime) {
      maxPrepTime = foundMenu.preparationTimeMinutes;
    }

    processedItems.push({
      menuItemId: foundMenu._id,
      name: foundMenu.name,
      price: foundMenu.price,
      quantity,
      specialInstructions: item.specialInstructions || '',
      itemStatus: 'PENDING'
    });
  }

  // Compute billing summary
  const billSummary = calculateBill(processedItems, {
    taxRate: Number(process.env.TAX_RATE_PERCENT) || 5,
    serviceChargeRate: Number(process.env.SERVICE_CHARGE_PERCENT) || 5,
    discountPercent: Number(discountPercent) || 0
  });

  const orderNumber = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const order = await Order.create({
    orderNumber,
    orderType,
    customerId,
    branchId,
    reservationId: reservationId || null,
    tableId: tableId || null,
    items: processedItems,
    status: 'PLACED',
    billing: {
      ...billSummary,
      paymentStatus: 'UNPAID',
      paymentMethod: 'PENDING'
    },
    estimatedPrepTimeMinutes: maxPrepTime + 5,
    notes: notes || ''
  });

  const populatedOrder = await Order.findById(order._id)
    .populate('branchId', 'name code address')
    .populate('tableId', 'tableNumber capacity location')
    .populate('customerId', 'name email phone');

  res.status(201).json({
    success: true,
    message: 'Order placed successfully and sent to the kitchen!',
    data: {
      order: populatedOrder
    }
  });
});

// @desc    Get all orders with filtering
// @route   GET /api/orders
// @access  Private
const getAllOrders = asyncHandler(async (req, res, next) => {
  const { branchId, status, orderType, paymentStatus, customerId } = req.query;
  const filter = {};

  if (req.user.role === 'customer') {
    filter.customerId = req.user._id;
  } else {
    if (customerId) filter.customerId = customerId;
  }

  if (branchId) filter.branchId = branchId;
  if (status) filter.status = status;
  if (orderType) filter.orderType = orderType;
  if (paymentStatus) filter['billing.paymentStatus'] = paymentStatus;

  const orders = await Order.find(filter)
    .populate('branchId', 'name code address')
    .populate('tableId', 'tableNumber capacity location')
    .populate('customerId', 'name email phone')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: orders.length,
    data: {
      orders
    }
  });
});

// @desc    Get single order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate('branchId', 'name code address phone')
    .populate('tableId', 'tableNumber capacity location')
    .populate('customerId', 'name email phone')
    .populate('items.menuItemId', 'category dietary imageUrl');

  if (!order) {
    return next(new AppError(`Order not found with ID ${req.params.id}`, 404));
  }

  if (req.user.role === 'customer' && order.customerId._id.toString() !== req.user._id.toString()) {
    return next(new AppError('Not authorized to access this order.', 403));
  }

  res.status(200).json({
    success: true,
    data: {
      order
    }
  });
});

// State transition mapping: each status can ONLY advance to its immediate next sequential state
const VALID_ORDER_TRANSITIONS = {
  PLACED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY'],
  READY: ['SERVED'],
  SERVED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: []
};

// @desc    Update order status workflow (Lifecycle: PLACED -> PREPARING -> READY -> SERVED -> COMPLETED)
// @route   PATCH /api/orders/:id/status
// @access  Private (Kitchen Staff, Manager, Admin)
const updateOrderStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;
  const validStatuses = ['PLACED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED'];

  if (!status || !validStatuses.includes(status)) {
    return next(new AppError(`Invalid status. Allowed statuses: ${validStatuses.join(', ')}`, 400));
  }

  const order = await Order.findById(req.params.id);
  if (!order) {
    return next(new AppError(`Order not found with ID ${req.params.id}`, 404));
  }

  // Enforce strict order lifecycle state machine
  const allowedNext = VALID_ORDER_TRANSITIONS[order.status] || [];
  if (!allowedNext.includes(status)) {
    const detail = allowedNext.length > 0
      ? `Allowed next transition: ${allowedNext.join(', ')}.`
      : `Order is in terminal state '${order.status}' and cannot be transitioned further.`;
    return next(
      new AppError(
        `Invalid order status transition from '${order.status}' to '${status}'. ${detail}`,
        409
      )
    );
  }

  // Update item statuses as well if advancing workflow
  if (status === 'PREPARING') {
    order.items.forEach((item) => {
      if (item.itemStatus === 'PENDING') item.itemStatus = 'PREPARING';
    });
  } else if (status === 'READY') {
    order.items.forEach((item) => {
      item.itemStatus = 'READY';
    });
  } else if (status === 'SERVED' || status === 'COMPLETED') {
    order.items.forEach((item) => {
      item.itemStatus = 'SERVED';
    });
  }

  order.status = status;
  await order.save();

  res.status(200).json({
    success: true,
    message: `Order status updated to ${status}`,
    data: {
      order
    }
  });
});

// @desc    Cancel order (Only allowed if order is in PLACED state)
// @route   PATCH /api/orders/:id/cancel
// @access  Private (Customer, Staff, Manager, Admin)
const cancelOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    return next(new AppError(`Order not found with ID ${req.params.id}`, 404));
  }

  if (req.user.role === 'customer' && order.customerId.toString() !== req.user._id.toString()) {
    return next(new AppError('Not authorized to cancel this order.', 403));
  }

  if (order.status !== 'PLACED') {
    return next(
      new AppError(
        `Cannot cancel order because kitchen has already started processing it (Status: ${order.status}).`,
        400
      )
    );
  }

  order.status = 'CANCELLED';
  await order.save();

  res.status(200).json({
    success: true,
    message: 'Order cancelled successfully',
    data: {
      order
    }
  });
});

module.exports = {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder
};

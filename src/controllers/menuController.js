const MenuItem = require('../models/MenuItem');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Get all menu items with filters and search
// @route   GET /api/menu
// @access  Public
const getAllMenuItems = asyncHandler(async (req, res, next) => {
  const { category, dietary, search, minPrice, maxPrice, branchId, available, isSpecial } = req.query;
  const filter = {};

  if (category) filter.category = category;
  if (dietary) filter.dietary = dietary;
  if (isSpecial !== undefined) filter.isSpecial = isSpecial === 'true';
  if (available !== undefined) filter.isAvailable = available === 'true';

  if (branchId) {
    // If item has no branchIds specified, it's available in all branches; or item contains this branchId
    filter.$or = [
      { branchIds: { $size: 0 } },
      { branchIds: branchId }
    ];
  }

  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  if (search) {
    filter.$text = { $search: search };
  }

  const menuItems = await MenuItem.find(filter)
    .populate('branchIds', 'name code')
    .sort({ category: 1, name: 1 });

  res.status(200).json({
    success: true,
    count: menuItems.length,
    data: {
      menuItems
    }
  });
});

// @desc    Get menu item by ID
// @route   GET /api/menu/:id
// @access  Public
const getMenuItemById = asyncHandler(async (req, res, next) => {
  const menuItem = await MenuItem.findById(req.params.id).populate('branchIds', 'name code');
  if (!menuItem) {
    return next(new AppError(`Menu item not found with ID ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: {
      menuItem
    }
  });
});

// @desc    Create menu item
// @route   POST /api/menu
// @access  Private (Manager, Admin)
const createMenuItem = asyncHandler(async (req, res, next) => {
  const menuItem = await MenuItem.create(req.body);

  res.status(201).json({
    success: true,
    message: 'Menu item created successfully',
    data: {
      menuItem
    }
  });
});

// @desc    Update menu item
// @route   PUT /api/menu/:id
// @access  Private (Manager, Admin)
const updateMenuItem = asyncHandler(async (req, res, next) => {
  const menuItem = await MenuItem.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!menuItem) {
    return next(new AppError(`Menu item not found with ID ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    message: 'Menu item updated successfully',
    data: {
      menuItem
    }
  });
});

// @desc    Toggle menu item availability
// @route   PATCH /api/menu/:id/toggle-availability
// @access  Private (Manager, Admin, Kitchen Staff)
const toggleAvailability = asyncHandler(async (req, res, next) => {
  const menuItem = await MenuItem.findById(req.params.id);
  if (!menuItem) {
    return next(new AppError(`Menu item not found with ID ${req.params.id}`, 404));
  }

  menuItem.isAvailable = !menuItem.isAvailable;
  await menuItem.save();

  res.status(200).json({
    success: true,
    message: `Menu item availability toggled to ${menuItem.isAvailable ? 'Available' : 'Unavailable'}`,
    data: {
      menuItem
    }
  });
});

// @desc    Delete menu item
// @route   DELETE /api/menu/:id
// @access  Private (Manager, Admin)
const deleteMenuItem = asyncHandler(async (req, res, next) => {
  const menuItem = await MenuItem.findByIdAndDelete(req.params.id);
  if (!menuItem) {
    return next(new AppError(`Menu item not found with ID ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    message: 'Menu item deleted successfully'
  });
});

module.exports = {
  getAllMenuItems,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  toggleAvailability,
  deleteMenuItem
};

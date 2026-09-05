const Table = require('../models/Table');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Get all tables
// @route   GET /api/tables
// @access  Public / Staff / Manager
const getAllTables = asyncHandler(async (req, res, next) => {
  const { branchId, minCapacity, location, active } = req.query;
  const filter = {};

  if (branchId) filter.branchId = branchId;
  if (minCapacity) filter.capacity = { $gte: Number(minCapacity) };
  if (location) filter.location = location;
  if (active !== undefined) filter.isActive = active === 'true';

  const tables = await Table.find(filter)
    .populate('branchId', 'name code')
    .sort({ branchId: 1, tableNumber: 1 });

  res.status(200).json({
    success: true,
    count: tables.length,
    data: {
      tables
    }
  });
});

// @desc    Get table by ID
// @route   GET /api/tables/:id
// @access  Public / Staff / Manager
const getTableById = asyncHandler(async (req, res, next) => {
  const table = await Table.findById(req.params.id).populate('branchId', 'name code address');
  if (!table) {
    return next(new AppError(`Table not found with ID ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: {
      table
    }
  });
});

// @desc    Create new table
// @route   POST /api/tables
// @access  Private (Manager, Admin)
const createTable = asyncHandler(async (req, res, next) => {
  const { branchId, tableNumber, capacity, location, description } = req.body;

  const existingTable = await Table.findOne({ branchId, tableNumber });
  if (existingTable) {
    return next(new AppError(`Table ${tableNumber} already exists in this branch.`, 400));
  }

  const table = await Table.create({
    branchId,
    tableNumber,
    capacity,
    location,
    description
  });

  res.status(201).json({
    success: true,
    message: 'Table created successfully',
    data: {
      table
    }
  });
});

// @desc    Update table
// @route   PUT /api/tables/:id
// @access  Private (Manager, Admin)
const updateTable = asyncHandler(async (req, res, next) => {
  const table = await Table.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!table) {
    return next(new AppError(`Table not found with ID ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    message: 'Table updated successfully',
    data: {
      table
    }
  });
});

// @desc    Delete table
// @route   DELETE /api/tables/:id
// @access  Private (Admin, Manager)
const deleteTable = asyncHandler(async (req, res, next) => {
  const table = await Table.findByIdAndDelete(req.params.id);
  if (!table) {
    return next(new AppError(`Table not found with ID ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    message: 'Table deleted successfully'
  });
});

module.exports = {
  getAllTables,
  getTableById,
  createTable,
  updateTable,
  deleteTable
};

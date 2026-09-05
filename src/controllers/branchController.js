const Branch = require('../models/Branch');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Get all branches
// @route   GET /api/branches
// @access  Public
const getAllBranches = asyncHandler(async (req, res, next) => {
  const { city, active } = req.query;
  const filter = {};

  if (city) {
    filter['address.city'] = new RegExp(city, 'i');
  }
  if (active !== undefined) {
    filter.isActive = active === 'true';
  }

  const branches = await Branch.find(filter).sort({ name: 1 });

  res.status(200).json({
    success: true,
    count: branches.length,
    data: {
      branches
    }
  });
});

// @desc    Get single branch by ID
// @route   GET /api/branches/:id
// @access  Public
const getBranchById = asyncHandler(async (req, res, next) => {
  const branch = await Branch.findById(req.params.id);
  if (!branch) {
    return next(new AppError(`Branch not found with ID ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: {
      branch
    }
  });
});

// @desc    Create new branch
// @route   POST /api/branches
// @access  Private (Manager, Admin)
const createBranch = asyncHandler(async (req, res, next) => {
  const branch = await Branch.create(req.body);

  res.status(201).json({
    success: true,
    message: 'Branch created successfully',
    data: {
      branch
    }
  });
});

// @desc    Update branch
// @route   PUT /api/branches/:id
// @access  Private (Manager, Admin)
const updateBranch = asyncHandler(async (req, res, next) => {
  const branch = await Branch.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!branch) {
    return next(new AppError(`Branch not found with ID ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    message: 'Branch updated successfully',
    data: {
      branch
    }
  });
});

// @desc    Delete (or deactivate) branch
// @route   DELETE /api/branches/:id
// @access  Private (Admin)
const deleteBranch = asyncHandler(async (req, res, next) => {
  const branch = await Branch.findByIdAndDelete(req.params.id);
  if (!branch) {
    return next(new AppError(`Branch not found with ID ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    message: 'Branch deleted successfully'
  });
});

module.exports = {
  getAllBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch
};

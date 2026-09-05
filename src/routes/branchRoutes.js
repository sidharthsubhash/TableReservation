const express = require('express');
const { body } = require('express-validator');
const {
  getAllBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch
} = require('../controllers/branchController');
const { protect, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validator');

const router = express.Router();

const branchValidation = [
  body('name').trim().notEmpty().withMessage('Branch name is required'),
  body('code').trim().notEmpty().withMessage('Branch code is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('totalSeatingCapacity').isNumeric().withMessage('Total seating capacity must be a number'),
  validate
];

router
  .route('/')
  .get(getAllBranches)
  .post(protect, authorize('admin', 'manager'), branchValidation, createBranch);

router
  .route('/:id')
  .get(getBranchById)
  .put(protect, authorize('admin', 'manager'), updateBranch)
  .delete(protect, authorize('admin'), deleteBranch);

module.exports = router;

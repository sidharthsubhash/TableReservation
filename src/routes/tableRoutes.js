const express = require('express');
const { body } = require('express-validator');
const {
  getAllTables,
  getTableById,
  createTable,
  updateTable,
  deleteTable
} = require('../controllers/tableController');
const { protect, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validator');

const router = express.Router();

const tableValidation = [
  body('branchId').isMongoId().withMessage('Valid Branch ID is required'),
  body('tableNumber').trim().notEmpty().withMessage('Table number is required'),
  body('capacity').isInt({ min: 1 }).withMessage('Capacity must be an integer >= 1'),
  validate
];

router
  .route('/')
  .get(getAllTables)
  .post(protect, authorize('admin', 'manager'), tableValidation, createTable);

router
  .route('/:id')
  .get(getTableById)
  .put(protect, authorize('admin', 'manager'), updateTable)
  .delete(protect, authorize('admin', 'manager'), deleteTable);

module.exports = router;

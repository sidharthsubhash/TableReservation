const express = require('express');
const { body } = require('express-validator');
const {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder
} = require('../controllers/orderController');
const { protect, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validator');

const router = express.Router();

const orderValidation = [
  body('branchId').isMongoId().withMessage('Valid Branch ID is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required in the order'),
  body('items.*.menuItemId').isMongoId().withMessage('Valid menu item ID is required for each item'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be an integer >= 1'),
  validate
];

router
  .route('/')
  .get(protect, getAllOrders)
  .post(protect, orderValidation, createOrder);

router
  .route('/:id')
  .get(protect, getOrderById);

router.patch('/:id/status', protect, authorize('admin', 'manager', 'kitchen_staff'), updateOrderStatus);
router.patch('/:id/cancel', protect, cancelOrder);

module.exports = router;

const express = require('express');
const { body } = require('express-validator');
const {
  getOrderBill,
  processPayment,
  applyDiscount
} = require('../controllers/billingController');
const { protect, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validator');

const router = express.Router();

const paymentValidation = [
  body('paymentMethod').isIn(['CASH', 'CARD', 'UPI', 'ONLINE']).withMessage('Payment method must be CASH, CARD, UPI, or ONLINE'),
  validate
];

router.get('/:orderId', protect, getOrderBill);
router.post('/:orderId/pay', protect, paymentValidation, processPayment);
router.patch('/:orderId/discount', protect, authorize('admin', 'manager'), applyDiscount);

module.exports = router;

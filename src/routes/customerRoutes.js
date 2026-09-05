const express = require('express');
const {
  getCustomerOrderHistory,
  getCustomerReservationHistory,
  getCustomerSummary
} = require('../controllers/customerController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.use(protect);

router.get('/history/orders', getCustomerOrderHistory);
router.get('/history/reservations', getCustomerReservationHistory);
router.get('/summary', getCustomerSummary);

module.exports = router;

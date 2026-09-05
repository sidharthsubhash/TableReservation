const express = require('express');
const { body } = require('express-validator');
const {
  checkAvailability,
  createReservation,
  getAllReservations,
  getReservationById,
  cancelReservation,
  rescheduleReservation,
  updateReservationStatus
} = require('../controllers/reservationController');
const { protect, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validator');

const router = express.Router();

const reservationValidation = [
  body('branchId').isMongoId().withMessage('Valid Branch ID is required'),
  body('tableId').isMongoId().withMessage('Valid Table ID is required'),
  body('partySize').isInt({ min: 1 }).withMessage('Party size must be >= 1'),
  body('reservationDate').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Reservation date must be YYYY-MM-DD'),
  body('startTime').matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Start time must be HH:mm format'),
  validate
];

router.get('/availability', checkAvailability);

router
  .route('/')
  .get(protect, getAllReservations)
  .post(protect, reservationValidation, createReservation);

router
  .route('/:id')
  .get(protect, getReservationById);

router.patch('/:id/cancel', protect, cancelReservation);
router.patch('/:id/reschedule', protect, rescheduleReservation);
router.patch('/:id/status', protect, authorize('admin', 'manager', 'kitchen_staff'), updateReservationStatus);

module.exports = router;

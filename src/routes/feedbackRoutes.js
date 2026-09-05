const express = require('express');
const { body } = require('express-validator');
const {
  submitFeedback,
  getFeedbackList,
  getFeedbackStats
} = require('../controllers/feedbackController');
const { protect } = require('../middlewares/auth');
const { validate } = require('../middlewares/validator');

const router = express.Router();

const feedbackValidation = [
  body('branchId').isMongoId().withMessage('Valid Branch ID is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Overall rating must be an integer between 1 and 5'),
  validate
];

router
  .route('/')
  .get(getFeedbackList)
  .post(protect, feedbackValidation, submitFeedback);

router.get('/stats', getFeedbackStats);

module.exports = router;

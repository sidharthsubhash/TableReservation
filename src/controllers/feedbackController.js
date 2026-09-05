const Feedback = require('../models/Feedback');
const Branch = require('../models/Branch');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Submit feedback & rating
// @route   POST /api/feedback
// @access  Private (Customer)
const submitFeedback = asyncHandler(async (req, res, next) => {
  const { branchId, orderId, reservationId, rating, foodRating, serviceRating, ambienceRating, comment } = req.body;
  const customerId = req.user._id;

  const branch = await Branch.findById(branchId);
  if (!branch) {
    return next(new AppError(`Branch not found with ID ${branchId}`, 404));
  }

  const feedback = await Feedback.create({
    customerId,
    branchId,
    orderId: orderId || null,
    reservationId: reservationId || null,
    rating,
    foodRating: foodRating || null,
    serviceRating: serviceRating || null,
    ambienceRating: ambienceRating || null,
    comment: comment || ''
  });

  const populatedFeedback = await Feedback.findById(feedback._id)
    .populate('customerId', 'name')
    .populate('branchId', 'name code');

  res.status(201).json({
    success: true,
    message: 'Thank you for your feedback!',
    data: {
      feedback: populatedFeedback
    }
  });
});

// @desc    Get all feedback / reviews
// @route   GET /api/feedback
// @access  Public
const getFeedbackList = asyncHandler(async (req, res, next) => {
  const { branchId, minRating } = req.query;
  const filter = { isPublic: true };

  if (branchId) filter.branchId = branchId;
  if (minRating) filter.rating = { $gte: Number(minRating) };

  const feedbacks = await Feedback.find(filter)
    .populate('customerId', 'name')
    .populate('branchId', 'name code')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: feedbacks.length,
    data: {
      feedbacks
    }
  });
});

// @desc    Get feedback aggregated stats
// @route   GET /api/feedback/stats
// @access  Public / Manager / Admin
const getFeedbackStats = asyncHandler(async (req, res, next) => {
  const { branchId } = req.query;
  const match = {};

  if (branchId) {
    const mongoose = require('mongoose');
    match.branchId = new mongoose.Types.ObjectId(branchId);
  }

  const stats = await Feedback.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        avgOverallRating: { $avg: '$rating' },
        avgFoodRating: { $avg: '$foodRating' },
        avgServiceRating: { $avg: '$serviceRating' },
        avgAmbienceRating: { $avg: '$ambienceRating' },
        fiveStar: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
        fourStar: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
        threeStar: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
        twoStar: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
        oneStar: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } }
      }
    }
  ]);

  const result = stats[0] || {
    totalReviews: 0,
    avgOverallRating: 0,
    avgFoodRating: 0,
    avgServiceRating: 0,
    avgAmbienceRating: 0,
    fiveStar: 0,
    fourStar: 0,
    threeStar: 0,
    twoStar: 0,
    oneStar: 0
  };

  res.status(200).json({
    success: true,
    data: {
      stats: {
        totalReviews: result.totalReviews,
        avgOverallRating: Number((result.avgOverallRating || 0).toFixed(2)),
        avgFoodRating: Number((result.avgFoodRating || 0).toFixed(2)),
        avgServiceRating: Number((result.avgServiceRating || 0).toFixed(2)),
        avgAmbienceRating: Number((result.avgAmbienceRating || 0).toFixed(2)),
        ratingDistribution: {
          5: result.fiveStar,
          4: result.fourStar,
          3: result.threeStar,
          2: result.twoStar,
          1: result.oneStar
        }
      }
    }
  });
});

module.exports = {
  submitFeedback,
  getFeedbackList,
  getFeedbackStats
};

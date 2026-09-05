const express = require('express');
const {
  getOverviewMetrics,
  getPopularDishes,
  getPeakHours,
  getRevenueByBranch,
  getReservationOccupancy
} = require('../controllers/analyticsController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

// Analytics accessible only by manager and admin
router.use(protect, authorize('manager', 'admin'));

router.get('/overview', getOverviewMetrics);
router.get('/popular-dishes', getPopularDishes);
router.get('/peak-hours', getPeakHours);
router.get('/revenue-by-branch', getRevenueByBranch);
router.get('/reservation-occupancy', getReservationOccupancy);

module.exports = router;

const mongoose = require('mongoose');
const Order = require('../models/Order');
const Reservation = require('../models/Reservation');
const Branch = require('../models/Branch');
const Table = require('../models/Table');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Get executive dashboard summary metrics
// @route   GET /api/analytics/overview
// @access  Private (Manager, Admin)
const getOverviewMetrics = asyncHandler(async (req, res, next) => {
  const [totalCustomers, totalBranches, totalTables, ordersStats, reservationsStats] = await Promise.all([
    User.countDocuments({ role: 'customer' }),
    Branch.countDocuments({ isActive: true }),
    Table.countDocuments({ isActive: true }),
    Order.aggregate([
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          completedOrders: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
          totalRevenue: {
            $sum: {
              $cond: [{ $eq: ['$billing.paymentStatus', 'PAID'] }, '$billing.grandTotal', 0]
            }
          },
          avgOrderValue: {
            $avg: {
              $cond: [{ $eq: ['$billing.paymentStatus', 'PAID'] }, '$billing.grandTotal', null]
            }
          }
        }
      }
    ]),
    Reservation.aggregate([
      {
        $group: {
          _id: null,
          totalReservations: { $sum: 1 },
          confirmedCount: { $sum: { $cond: [{ $eq: ['$status', 'CONFIRMED'] }, 1, 0] } },
          completedCount: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
          cancelledCount: { $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] } }
        }
      }
    ])
  ]);

  const ord = ordersStats[0] || { totalOrders: 0, completedOrders: 0, totalRevenue: 0, avgOrderValue: 0 };
  const resv = reservationsStats[0] || { totalReservations: 0, confirmedCount: 0, completedCount: 0, cancelledCount: 0 };

  res.status(200).json({
    success: true,
    data: {
      metrics: {
        totalCustomers,
        totalBranches,
        totalTables,
        orders: {
          total: ord.totalOrders,
          completed: ord.completedOrders,
          totalRevenue: Number(ord.totalRevenue.toFixed(2)),
          averageOrderValue: Number((ord.avgOrderValue || 0).toFixed(2))
        },
        reservations: {
          total: resv.totalReservations,
          confirmed: resv.confirmedCount,
          completed: resv.completedCount,
          cancelled: resv.cancelledCount
        }
      }
    }
  });
});

// @desc    Get top popular dishes by sales quantity and revenue
// @route   GET /api/analytics/popular-dishes
// @access  Private (Manager, Admin)
const getPopularDishes = asyncHandler(async (req, res, next) => {
  const { limit = 10, branchId } = req.query;
  const match = { 'billing.paymentStatus': 'PAID' };

  if (branchId) {
    match.branchId = new mongoose.Types.ObjectId(branchId);
  }

  const popularDishes = await Order.aggregate([
    { $match: match },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.menuItemId',
        dishName: { $first: '$items.name' },
        totalQuantitySold: { $sum: '$items.quantity' },
        totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        orderCount: { $sum: 1 }
      }
    },
    { $sort: { totalQuantitySold: -1 } },
    { $limit: Number(limit) },
    {
      $project: {
        menuItemId: '$_id',
        _id: 0,
        dishName: 1,
        totalQuantitySold: 1,
        totalRevenue: { $round: ['$totalRevenue', 2] },
        orderCount: 1
      }
    }
  ]);

  res.status(200).json({
    success: true,
    count: popularDishes.length,
    data: {
      popularDishes
    }
  });
});

// @desc    Get peak hours analysis for reservations and orders
// @route   GET /api/analytics/peak-hours
// @access  Private (Manager, Admin)
const getPeakHours = asyncHandler(async (req, res, next) => {
  const { branchId } = req.query;
  const matchRes = { status: { $ne: 'CANCELLED' } };
  const matchOrd = {};

  if (branchId) {
    matchRes.branchId = new mongoose.Types.ObjectId(branchId);
    matchOrd.branchId = new mongoose.Types.ObjectId(branchId);
  }

  // Reservation peak hours based on start time hour
  const reservationHours = await Reservation.aggregate([
    { $match: matchRes },
    {
      $project: {
        hour: { $substr: ['$timeSlot.startTime', 0, 2] }
      }
    },
    {
      $group: {
        _id: '$hour',
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Order peak hours based on createdAt hour
  const orderHours = await Order.aggregate([
    { $match: matchOrd },
    {
      $project: {
        hour: { $dateToString: { format: '%H', date: '$createdAt' } }
      }
    },
    {
      $group: {
        _id: '$hour',
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  res.status(200).json({
    success: true,
    data: {
      reservationPeakHours: reservationHours.map((r) => ({
        timeSlot: `${r._id}:00`,
        totalBookings: r.count
      })),
      orderPeakHours: orderHours.map((o) => ({
        timeSlot: `${o._id}:00`,
        totalOrders: o.count
      }))
    }
  });
});

// @desc    Get revenue report aggregated by branch
// @route   GET /api/analytics/revenue-by-branch
// @access  Private (Manager, Admin)
const getRevenueByBranch = asyncHandler(async (req, res, next) => {
  const branchRevenue = await Order.aggregate([
    { $match: { 'billing.paymentStatus': 'PAID' } },
    {
      $group: {
        _id: '$branchId',
        totalRevenue: { $sum: '$billing.grandTotal' },
        totalTaxCollected: { $sum: '$billing.taxAmount' },
        totalServiceCharge: { $sum: '$billing.serviceChargeAmount' },
        totalOrders: { $sum: 1 },
        avgOrderValue: { $avg: '$billing.grandTotal' }
      }
    },
    {
      $lookup: {
        from: 'branches',
        localField: '_id',
        foreignField: '_id',
        as: 'branch'
      }
    },
    { $unwind: '$branch' },
    {
      $project: {
        branchId: '$_id',
        _id: 0,
        branchName: '$branch.name',
        branchCode: '$branch.code',
        city: '$branch.address.city',
        totalRevenue: { $round: ['$totalRevenue', 2] },
        totalTaxCollected: { $round: ['$totalTaxCollected', 2] },
        totalServiceCharge: { $round: ['$totalServiceCharge', 2] },
        totalOrders: 1,
        avgOrderValue: { $round: ['$avgOrderValue', 2] }
      }
    },
    { $sort: { totalRevenue: -1 } }
  ]);

  res.status(200).json({
    success: true,
    count: branchRevenue.length,
    data: {
      branchRevenue
    }
  });
});

// @desc    Get table reservation occupancy rate
// @route   GET /api/analytics/reservation-occupancy
// @access  Private (Manager, Admin)
const getReservationOccupancy = asyncHandler(async (req, res, next) => {
  const branches = await Branch.find({ isActive: true });

  const occupancyReports = await Promise.all(
    branches.map(async (branch) => {
      const [totalTables, activeReservations, completedReservations, cancelledReservations] = await Promise.all([
        Table.countDocuments({ branchId: branch._id, isActive: true }),
        Reservation.countDocuments({ branchId: branch._id, status: { $in: ['CONFIRMED', 'SEATED'] } }),
        Reservation.countDocuments({ branchId: branch._id, status: 'COMPLETED' }),
        Reservation.countDocuments({ branchId: branch._id, status: 'CANCELLED' })
      ]);

      const totalBookings = activeReservations + completedReservations + cancelledReservations;
      const cancellationRate = totalBookings > 0 ? Number(((cancelledReservations / totalBookings) * 100).toFixed(1)) : 0;

      return {
        branchId: branch._id,
        branchName: branch.name,
        branchCode: branch.code,
        totalTables,
        seatingCapacity: branch.totalSeatingCapacity,
        activeReservations,
        completedReservations,
        cancelledReservations,
        cancellationRatePercent: cancellationRate
      };
    })
  );

  res.status(200).json({
    success: true,
    data: {
      occupancy: occupancyReports
    }
  });
});

module.exports = {
  getOverviewMetrics,
  getPopularDishes,
  getPeakHours,
  getRevenueByBranch,
  getReservationOccupancy
};

const Reservation = require('../models/Reservation');
const Table = require('../models/Table');
const Branch = require('../models/Branch');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// Helper to convert date + time string to Date object
const parseSlotDateTime = (dateStr, timeStr) => {
  // dateStr: YYYY-MM-DD, timeStr: HH:mm
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date(dateStr);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

// Helper to calculate end time string given start time and duration minutes
const calculateEndTimeString = (startTime, durationMinutes = 90) => {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60);
  const endMins = totalMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
};

// @desc    Check available tables and slots for a branch
// @route   GET /api/reservations/availability
// @access  Public / Customer
const checkAvailability = asyncHandler(async (req, res, next) => {
  const { branchId, date, startTime, partySize, durationMinutes = 90 } = req.query;

  if (!branchId || !date) {
    return next(new AppError('Please provide branchId and date (YYYY-MM-DD).', 400));
  }

  const branch = await Branch.findById(branchId);
  if (!branch) {
    return next(new AppError(`Branch not found with ID ${branchId}`, 404));
  }

  // Find all active tables for this branch matching party size
  const tableFilter = { branchId, isActive: true };
  if (partySize) {
    tableFilter.capacity = { $gte: Number(partySize) };
  }
  const tables = await Table.find(tableFilter).sort({ capacity: 1, tableNumber: 1 });

  // If a specific time is provided, evaluate availability for that specific window
  if (startTime) {
    const startDT = parseSlotDateTime(date, startTime);
    const endDT = new Date(startDT.getTime() + Number(durationMinutes) * 60000);

    // Find overlapping reservations
    const overlapping = await Reservation.find({
      branchId,
      status: { $in: ['PENDING', 'CONFIRMED', 'SEATED'] },
      startDateTime: { $lt: endDT },
      endDateTime: { $gt: startDT }
    });

    const bookedTableIds = new Set(overlapping.map((r) => r.tableId.toString()));
    const availableTables = tables.filter((t) => !bookedTableIds.has(t._id.toString()));

    return res.status(200).json({
      success: true,
      data: {
        branch: { id: branch._id, name: branch.name },
        date,
        timeSlot: {
          startTime,
          endTime: calculateEndTimeString(startTime, Number(durationMinutes))
        },
        totalTables: tables.length,
        availableCount: availableTables.length,
        availableTables,
        bookedCount: bookedTableIds.size
      }
    });
  }

  // If no specific startTime provided, generate standard slots throughout branch opening hours
  const openHour = parseInt(branch.openingTime.split(':')[0], 10);
  const closeHour = parseInt(branch.closingTime.split(':')[0], 10);
  const slotIntervalMinutes = 90;
  const slots = [];

  for (let currentHour = openHour; currentHour < closeHour; currentHour += 1.5) {
    const slotHour = Math.floor(currentHour);
    const slotMin = (currentHour % 1) * 60;
    const slotStartStr = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;
    const slotEndStr = calculateEndTimeString(slotStartStr, slotIntervalMinutes);

    const startDT = parseSlotDateTime(date, slotStartStr);
    const endDT = parseSlotDateTime(date, slotEndStr);

    slots.push({
      startTime: slotStartStr,
      endTime: slotEndStr,
      startDT,
      endDT
    });
  }

  // Check all reservations on that date
  const dayReservations = await Reservation.find({
    branchId,
    reservationDate: date,
    status: { $in: ['PENDING', 'CONFIRMED', 'SEATED'] }
  });

  const slotsAvailability = slots.map((slot) => {
    const bookedTableIds = new Set(
      dayReservations
        .filter((r) => r.startDateTime < slot.endDT && r.endDateTime > slot.startDT)
        .map((r) => r.tableId.toString())
    );
    const available = tables.filter((t) => !bookedTableIds.has(t._id.toString()));

    return {
      startTime: slot.startTime,
      endTime: slot.endTime,
      availableTablesCount: available.length,
      isAvailable: available.length > 0,
      availableTableIds: available.map((t) => ({ id: t._id, tableNumber: t.tableNumber, capacity: t.capacity, location: t.location }))
    };
  });

  res.status(200).json({
    success: true,
    data: {
      branch: { id: branch._id, name: branch.name },
      date,
      totalBranchTables: tables.length,
      slots: slotsAvailability
    }
  });
});

// @desc    Create a new table reservation (Strict Double-Booking Check)
// @route   POST /api/reservations
// @access  Private (Customer, Manager, Admin)
const createReservation = asyncHandler(async (req, res, next) => {
  const { branchId, tableId, partySize, reservationDate, startTime, durationMinutes = 90, specialRequests } = req.body;
  const customerId = req.user.role === 'customer' ? req.user._id : (req.body.customerId || req.user._id);

  const branch = await Branch.findById(branchId);
  if (!branch || !branch.isActive) {
    return next(new AppError('Selected branch is not active or does not exist.', 404));
  }

  const table = await Table.findById(tableId);
  if (!table || !table.isActive || table.branchId.toString() !== branchId.toString()) {
    return next(new AppError('Selected table is invalid or does not belong to this branch.', 400));
  }

  if (table.capacity < partySize) {
    return next(new AppError(`Selected table only seats ${table.capacity} guests, but party size is ${partySize}.`, 400));
  }

  const startDateTime = parseSlotDateTime(reservationDate, startTime);
  const endDateTime = new Date(startDateTime.getTime() + Number(durationMinutes) * 60000);
  const endTime = calculateEndTimeString(startTime, Number(durationMinutes));

  // Validate start time is in the future
  if (startDateTime.getTime() <= Date.now()) {
    return next(new AppError('Reservation must be scheduled for a future date and time.', 400));
  }

  // Conflict Check: Check if table is already reserved during this time slot
  const conflictingReservation = await Reservation.findOne({
    tableId,
    status: { $in: ['PENDING', 'CONFIRMED', 'SEATED'] },
    startDateTime: { $lt: endDateTime },
    endDateTime: { $gt: startDateTime }
  });

  if (conflictingReservation) {
    return next(
      new AppError(
        `Table ${table.tableNumber} is already booked from ${conflictingReservation.timeSlot.startTime} to ${conflictingReservation.timeSlot.endTime}. Please select another table or time slot.`,
        409
      )
    );
  }

  const reservation = await Reservation.create({
    customerId,
    branchId,
    tableId,
    partySize,
    reservationDate,
    timeSlot: {
      startTime,
      endTime
    },
    startDateTime,
    endDateTime,
    status: 'CONFIRMED',
    specialRequests
  });

  const populatedReservation = await Reservation.findById(reservation._id)
    .populate('branchId', 'name code address phone')
    .populate('tableId', 'tableNumber capacity location')
    .populate('customerId', 'name email phone');

  res.status(201).json({
    success: true,
    message: 'Table reserved successfully! Confirmation details generated.',
    data: {
      reservation: populatedReservation
    }
  });
});

// @desc    Get all reservations (with filters)
// @route   GET /api/reservations
// @access  Private (Staff, Manager, Admin, or own reservations for Customer)
const getAllReservations = asyncHandler(async (req, res, next) => {
  const { branchId, date, status, customerId } = req.query;
  const filter = {};

  if (req.user.role === 'customer') {
    filter.customerId = req.user._id;
  } else {
    if (customerId) filter.customerId = customerId;
  }

  if (branchId) filter.branchId = branchId;
  if (date) filter.reservationDate = date;
  if (status) filter.status = status;

  const reservations = await Reservation.find(filter)
    .populate('branchId', 'name code address')
    .populate('tableId', 'tableNumber capacity location')
    .populate('customerId', 'name email phone')
    .sort({ startDateTime: -1 });

  res.status(200).json({
    success: true,
    count: reservations.length,
    data: {
      reservations
    }
  });
});

// @desc    Get reservation by ID
// @route   GET /api/reservations/:id
// @access  Private
const getReservationById = asyncHandler(async (req, res, next) => {
  const reservation = await Reservation.findById(req.params.id)
    .populate('branchId', 'name code address phone')
    .populate('tableId', 'tableNumber capacity location')
    .populate('customerId', 'name email phone');

  if (!reservation) {
    return next(new AppError(`Reservation not found with ID ${req.params.id}`, 404));
  }

  // Ensure customer can only view own reservation
  if (req.user.role === 'customer' && reservation.customerId._id.toString() !== req.user._id.toString()) {
    return next(new AppError('Not authorized to access this reservation.', 403));
  }

  res.status(200).json({
    success: true,
    data: {
      reservation
    }
  });
});

// @desc    Cancel reservation (Enforce cancellation policy)
// @route   PATCH /api/reservations/:id/cancel
// @access  Private (Customer, Manager, Admin)
const cancelReservation = asyncHandler(async (req, res, next) => {
  const { cancellationReason } = req.body;
  const reservation = await Reservation.findById(req.params.id);

  if (!reservation) {
    return next(new AppError(`Reservation not found with ID ${req.params.id}`, 404));
  }

  if (req.user.role === 'customer' && reservation.customerId.toString() !== req.user._id.toString()) {
    return next(new AppError('Not authorized to cancel this reservation.', 403));
  }

  if (reservation.status === 'CANCELLED') {
    return next(new AppError('Reservation is already cancelled.', 400));
  }
  if (reservation.status === 'COMPLETED' || reservation.status === 'SEATED') {
    return next(new AppError(`Cannot cancel a reservation that is already ${reservation.status.toLowerCase()}.`, 400));
  }

  // Cancellation Policy Check: Must be cancelled at least N hours before slot
  const deadlineHours = Number(process.env.CANCELLATION_DEADLINE_HOURS) || 2;
  const hoursUntilReservation = (new Date(reservation.startDateTime).getTime() - Date.now()) / (1000 * 60 * 60);

  if (req.user.role === 'customer' && hoursUntilReservation < deadlineHours && hoursUntilReservation > 0) {
    return next(
      new AppError(
        `Late cancellation policy: Reservations cannot be cancelled within ${deadlineHours} hours of the reservation start time. Please contact the branch directly.`,
        400
      )
    );
  }

  reservation.status = 'CANCELLED';
  reservation.cancellationReason = cancellationReason || 'Cancelled by user';
  reservation.cancelledAt = new Date();
  await reservation.save();

  res.status(200).json({
    success: true,
    message: 'Reservation cancelled successfully. Table has been freed.',
    data: {
      reservation
    }
  });
});

// @desc    Reschedule reservation
// @route   PATCH /api/reservations/:id/reschedule
// @access  Private (Customer, Manager, Admin)
const rescheduleReservation = asyncHandler(async (req, res, next) => {
  const { newDate, newStartTime, durationMinutes = 90 } = req.body;
  const reservation = await Reservation.findById(req.params.id);

  if (!reservation) {
    return next(new AppError(`Reservation not found with ID ${req.params.id}`, 404));
  }

  if (req.user.role === 'customer' && reservation.customerId.toString() !== req.user._id.toString()) {
    return next(new AppError('Not authorized to reschedule this reservation.', 403));
  }

  if (reservation.status === 'CANCELLED' || reservation.status === 'COMPLETED') {
    return next(new AppError(`Cannot reschedule a ${reservation.status.toLowerCase()} reservation.`, 400));
  }

  const newStartDateTime = parseSlotDateTime(newDate, newStartTime);
  const newEndDateTime = new Date(newStartDateTime.getTime() + Number(durationMinutes) * 60000);
  const newEndTime = calculateEndTimeString(newStartTime, Number(durationMinutes));

  if (newStartDateTime.getTime() <= Date.now()) {
    return next(new AppError('New reservation slot must be in the future.', 400));
  }

  // Check conflict on the table for the new slot
  const conflict = await Reservation.findOne({
    _id: { $ne: reservation._id },
    tableId: reservation.tableId,
    status: { $in: ['PENDING', 'CONFIRMED', 'SEATED'] },
    startDateTime: { $lt: newEndDateTime },
    endDateTime: { $gt: newStartDateTime }
  });

  if (conflict) {
    return next(new AppError('The table is unavailable for the selected new date/time slot.', 409));
  }

  reservation.reservationDate = newDate;
  reservation.timeSlot = {
    startTime: newStartTime,
    endTime: newEndTime
  };
  reservation.startDateTime = newStartDateTime;
  reservation.endDateTime = newEndDateTime;
  await reservation.save();

  res.status(200).json({
    success: true,
    message: 'Reservation rescheduled successfully',
    data: {
      reservation
    }
  });
});

// @desc    Update reservation status (e.g. SEATED, COMPLETED)
// @route   PATCH /api/reservations/:id/status
// @access  Private (Kitchen Staff, Manager, Admin)
const updateReservationStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;
  if (!['CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED'].includes(status)) {
    return next(new AppError('Invalid reservation status', 400));
  }

  const reservation = await Reservation.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true, runValidators: true }
  ).populate('branchId tableId customerId');

  if (!reservation) {
    return next(new AppError(`Reservation not found with ID ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    message: `Reservation status updated to ${status}`,
    data: {
      reservation
    }
  });
});

module.exports = {
  checkAvailability,
  createReservation,
  getAllReservations,
  getReservationById,
  cancelReservation,
  rescheduleReservation,
  updateReservationStatus
};

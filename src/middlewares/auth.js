const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const protect = asyncHandler(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('You are not logged in. Please provide a valid Bearer token to gain access.', 401));
  }

  // Verify token
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_cia3_food_reservation_2026');
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Your token has expired. Please log in again.', 401));
    }
    return next(new AppError('Invalid token. Please log in again.', 401));
  }

  // Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(new AppError('The user belonging to this token no longer exists.', 401));
  }

  if (!currentUser.isActive) {
    return next(new AppError('This user account has been deactivated.', 403));
  }

  // Attach user to request
  req.user = currentUser;
  next();
});

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError(
          `User role '${req.user ? req.user.role : 'unauthenticated'}' is not authorized to access this route. Required roles: ${roles.join(', ')}`,
          403
        )
      );
    }
    next();
  };
};

module.exports = {
  protect,
  authorize
};

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/authRoutes');
const branchRoutes = require('./routes/branchRoutes');
const tableRoutes = require('./routes/tableRoutes');
const menuRoutes = require('./routes/menuRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const orderRoutes = require('./routes/orderRoutes');
const kitchenRoutes = require('./routes/kitchenRoutes');
const billingRoutes = require('./routes/billingRoutes');
const customerRoutes = require('./routes/customerRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

const AppError = require('./utils/AppError');
const globalErrorHandler = require('./middlewares/errorMiddleware');

const app = express();

// Security and HTTP logging middlewares
// Configure helmet with relaxed CSP for fonts, images, and CDNs
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes Mounting
app.use('/api/auth', authRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/kitchen', kitchenRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/analytics', analyticsRoutes);

// Fallback for Single Page Application Web App
app.get('*', (req, res, next) => {
  if (req.originalUrl.startsWith('/api/')) {
    return next(new AppError(`Cannot find API endpoint ${req.originalUrl} on this server`, 404));
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Global Centralized Error Handler
app.use(globalErrorHandler);

module.exports = app;

const express = require('express');
const { body } = require('express-validator');
const {
  getAllMenuItems,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  toggleAvailability,
  deleteMenuItem
} = require('../controllers/menuController');
const { protect, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validator');

const router = express.Router();

const menuValidation = [
  body('name').trim().notEmpty().withMessage('Menu item name is required'),
  body('category').isIn(['Appetizer', 'Main Course', 'Dessert', 'Beverage', 'Chef Special', 'Breads & Rice', 'Soups & Salads']).withMessage('Valid category is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  validate
];

router
  .route('/')
  .get(getAllMenuItems)
  .post(protect, authorize('admin', 'manager'), menuValidation, createMenuItem);

router
  .route('/:id')
  .get(getMenuItemById)
  .put(protect, authorize('admin', 'manager'), updateMenuItem)
  .delete(protect, authorize('admin', 'manager'), deleteMenuItem);

router.patch('/:id/toggle-availability', protect, authorize('admin', 'manager', 'kitchen_staff'), toggleAvailability);

module.exports = router;

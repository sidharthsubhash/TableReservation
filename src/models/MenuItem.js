const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema(
  {
    branchIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch'
      }
    ],
    name: {
      type: String,
      required: [true, 'Menu item name is required'],
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: ['Appetizer', 'Main Course', 'Dessert', 'Beverage', 'Chef Special', 'Breads & Rice', 'Soups & Salads'],
      default: 'Main Course'
    },
    dietary: {
      type: String,
      enum: ['veg', 'non-veg', 'vegan', 'egg'],
      default: 'veg'
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative']
    },
    preparationTimeMinutes: {
      type: Number,
      default: 15,
      min: [1, 'Preparation time must be at least 1 minute']
    },
    isAvailable: {
      type: Boolean,
      default: true
    },
    isSpecial: {
      type: Boolean,
      default: false
    },
    imageUrl: {
      type: String,
      default: ''
    },
    calories: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

menuItemSchema.index({ category: 1, isAvailable: 1 });
menuItemSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('MenuItem', menuItemSchema);

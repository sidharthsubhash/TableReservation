/**
 * Calculates billing totals given order items, tax rate, and service charge rate.
 * @param {Array} items - Array of items with { price, quantity }
 * @param {Object} options - { taxRate: number, serviceChargeRate: number, discountPercent: number }
 */
const calculateBill = (items = [], options = {}) => {
  const taxRate = options.taxRate !== undefined ? options.taxRate : (Number(process.env.TAX_RATE_PERCENT) || 5);
  const serviceChargeRate = options.serviceChargeRate !== undefined ? options.serviceChargeRate : (Number(process.env.SERVICE_CHARGE_PERCENT) || 5);
  const discountPercent = options.discountPercent || 0;

  const subtotal = items.reduce((acc, item) => {
    const itemPrice = Number(item.price) || 0;
    const itemQty = Number(item.quantity) || 1;
    return acc + (itemPrice * itemQty);
  }, 0);

  const discountAmount = Number(((subtotal * discountPercent) / 100).toFixed(2));
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);

  const taxAmount = Number(((discountedSubtotal * taxRate) / 100).toFixed(2));
  const serviceChargeAmount = Number(((discountedSubtotal * serviceChargeRate) / 100).toFixed(2));
  
  const grandTotal = Number((discountedSubtotal + taxAmount + serviceChargeAmount).toFixed(2));

  return {
    subtotal: Number(subtotal.toFixed(2)),
    discountPercent,
    discountAmount,
    discountedSubtotal: Number(discountedSubtotal.toFixed(2)),
    taxRatePercent: taxRate,
    taxAmount,
    serviceChargeRatePercent: serviceChargeRate,
    serviceChargeAmount,
    grandTotal
  };
};

/**
 * Validates order items before processing billing.
 * Checks for array structure, non-negative price, and positive quantity.
 * @param {Array} items - Array of items to validate
 * @returns {Object} { isValid: boolean, error?: string }
 */
const validateBillItems = (items = []) => {
  if (!Array.isArray(items)) {
    return { isValid: false, error: 'Items payload must be an array.' };
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || typeof item !== 'object') {
      return { isValid: false, error: `Invalid item format at index ${i}.` };
    }
    const price = Number(item.price);
    const quantity = Number(item.quantity);
    if (isNaN(price) || price < 0) {
      return { isValid: false, error: `Item at index ${i} has invalid or negative price.` };
    }
    if (isNaN(quantity) || quantity <= 0) {
      return { isValid: false, error: `Item at index ${i} must have quantity of at least 1.` };
    }
  }

  return { isValid: true };
};

/**
 * Utility to format monetary values into standard localized currency string (INR).
 * @param {number} amount - Amount in INR
 * @param {string} currency - Currency code, defaults to 'INR'
 * @returns {string} Formatted currency string
 */
const formatCurrency = (amount = 0, currency = 'INR') => {
  const numericAmount = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numericAmount);
};

module.exports = {
  calculateBill,
  validateBillItems,
  formatCurrency
};

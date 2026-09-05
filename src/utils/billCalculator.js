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

module.exports = {
  calculateBill
};

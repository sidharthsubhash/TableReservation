const express = require('express');
const {
  getKitchenQueue,
  advanceOrderStatus,
  updateItemStatus
} = require('../controllers/kitchenController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

// Kitchen staff, manager, admin only
router.use(protect, authorize('kitchen_staff', 'manager', 'admin'));

router.get('/queue', getKitchenQueue);
router.patch('/orders/:id/advance', advanceOrderStatus);
router.patch('/orders/:orderId/items/:itemId', updateItemStatus);

module.exports = router;

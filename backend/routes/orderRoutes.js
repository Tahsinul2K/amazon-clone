const express = require('express');
const auth = require('../middleware/auth');
const orderController = require('../controllers/orderController');

const router = express.Router();

router.post('/orders', auth.requiresBuyerAuth, orderController.postOrders);

router.post(
    '/admin/orders/:orderId/assign-delivery',
    auth.requiresAdminAuth,
    orderController.assignDeliveryBoy
);

module.exports = router;

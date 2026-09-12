const express = require('express');
const auth = require('../middleware/auth');
const orderController = require('../controllers/orderController');

const router = express.Router();

router.post('/orders', auth.requiresBuyerAuth, orderController.postOrders);

router.post(
    '/admin/orders/:orderId/complete',
    auth.requiresAdminAuth,
    orderController.completeOrder
);

module.exports = router;

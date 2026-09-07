const express = require('express');
const auth = require('../middleware/auth');
const orderController = require('../controllers/orderController');

const router = express.Router();

router.post('/orders', auth.requiresBuyerAuth, orderController.postOrders);

module.exports = router;

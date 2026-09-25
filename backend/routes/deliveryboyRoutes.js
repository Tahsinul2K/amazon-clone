const express = require('express');

const deliveryBoyController = require('../controllers/deliveryBoyController');

const auth = require('../middleware/auth');

const router = express.Router();

router.post(
    '/admin/delivery-boys',
    auth.requiresAdminAuth,
    deliveryBoyController.postDeliveryBoy
);

router.delete(
    '/admin/delivery-boys/:delivery_boy_id',
    auth.requiresAdminAuth,
    deliveryBoyController.deleteDeliveryBoy
);

router.get(
    '/admin/delivery-boys',
    auth.requiresAdminAuth,
    deliveryBoyController.getDeliveryBoys
);

module.exports = router;
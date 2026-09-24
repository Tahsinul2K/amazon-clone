const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const discountController = require('../controllers/discountController');

router.post(
    '/discounts',
    auth.requiresAdminAuth,
    discountController.createDiscount
);

router.get(
    '/discounts',
    auth.requiresAnyAuth,
    discountController.getDiscounts
);

router.get(
    '/discounts/:discountId',
    auth.requiresAnyAuth,
    discountController.getDiscountById
);

router.put(
    '/discounts/:discountId',
    auth.requiresAdminAuth,
    discountController.updateDiscount
);

router.delete(
    '/discounts/:discountId',
    auth.requiresAdminAuth,
    discountController.deleteDiscount
);

module.exports = router;
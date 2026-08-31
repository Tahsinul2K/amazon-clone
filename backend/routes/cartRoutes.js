const express = require('express');
const cartController = require('../controllers/cartController')
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/cart/items', auth.requiresBuyerAuth, cartController.postCartItems);
router.get('/cart', auth.requiresBuyerAuth, cartController.getCart);
router.delete('/cart/items/:unitId', auth.requiresBuyerAuth, cartController.deleteCartItem);


module.exports = router;
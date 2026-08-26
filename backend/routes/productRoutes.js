const express = require('express');
const auth = require('../middleware/auth');
const productController = require('../controllers/productController');

const router = express.Router();

router.get('/products', productController.getProducts);
router.get('/products/:id', productController.getProductById);

router.post('/products/create', auth.requiresSellerAuth, productController.postProductsCreate);


module.exports = router;
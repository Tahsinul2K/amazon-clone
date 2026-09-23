const express = require('express');
const auth = require('../middleware/auth');
const productController = require('../controllers/productController');
const productImageController = require('../controllers/productImageController');

const router = express.Router();

router.get('/products', productController.getProducts);
router.get('/products/:id', productController.getProductById);
router.get('/seller/products', auth.requiresSellerAuth, productController.getProductsBySellerId);

router.post(
	'/products/create',
	auth.requiresSellerAuth,
	productImageController.uploadProductImages,
	productController.postProductsCreate
);

router.put(
	'/products/:productId',
	auth.requiresSellerAuth,
	productImageController.uploadProductImages,
	productController.updateProduct
);

router.post(
    '/products/:productId/categories/:categoryId',
    auth.requiresSellerAuth,
    productController.addProductCategory
);

router.delete(
    '/products/:productId/categories/:categoryId',
    auth.requiresSellerAuth,
    productController.removeProductCategory
);

module.exports = router;
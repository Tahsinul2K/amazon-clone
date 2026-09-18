const express = require('express');
const productImageController = require('../controllers/productImageController');
const auth = require('../middleware/auth'); // Adjust path as needed
const router = express.Router();

// Upload multiple images for a product (up to 5 images)
router.post(
    '/products/:productId/images',
    auth.requiresSellerAuth,
    productImageController.uploadProductImages,
    productImageController.addProductImages
);

// Set an image as primary for a product
router.put(
    '/products/:productId/images/:imageId/primary',
    auth.requiresSellerAuth,
    productImageController.setPrimaryImage
);

// Delete a product image
router.delete(
    '/images/:imageId',
    auth.requiresSellerAuth,
    productImageController.deleteProductImage
);

module.exports = router;
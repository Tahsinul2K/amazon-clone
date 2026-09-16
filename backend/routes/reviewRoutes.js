const express = require('express');
const reviewController = require('../controllers/reviewController');
const auth = require('../middleware/auth');
const router = express.Router();

router.post('/product/:productId/review', auth.requiresBuyerAuth, reviewController.postReview);
router.get('/product/:productId/reviews', reviewController.getProductReviews);
router.put('/product/:productId/review', auth.requiresBuyerAuth, reviewController.editReview);
router.delete('/product/:productId/review', auth.requiresBuyerAuth, reviewController.deleteReview);

module.exports = router;
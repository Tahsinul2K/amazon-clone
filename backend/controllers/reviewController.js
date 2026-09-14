const pool = require('../db');

// Post a new review
const postReview = async (req, res) => {
    try {
        const buyerId = req.session.buyerId;
        const productId = Number(req.params.productId);
        const { rating, reviewText } = req.body;

        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({ error: 'Invalid product ID' });
        }

        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
        }

        // The database trigger 'review_purchase_check_trigger' will automatically 
        // throw an exception if the buyer has not purchased and received this product.
        const result = await pool.query(`
            INSERT INTO REVIEW (PRODUCT_ID, BUYER_ID, RATING, REVIEW_TEXT)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [productId, buyerId, rating, reviewText || '']);

        res.status(201).json({
            message: 'Review submitted successfully',
            review: result.rows[0]
        });
    } catch (err) {
        console.error(err);
        
        // Handle database trigger exception or unique constraint violation (duplicate review)
        if (err.code === '23505' || err.code === 'P0001') {
            return res.status(400).json({ 
                error: err.message || 'You have already reviewed this product or have not purchased/received it yet.' 
            });
        }

        res.status(500).json({ error: 'Database error' });
    }
};

// Get reviews for a product
const getProductReviews = async (req, res) => {
    try {
        const productId = Number(req.params.productId);

        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({ error: 'Invalid product ID' });
        }

        const result = await pool.query(`
            SELECT r.product_id, r.buyer_id, r.rating, r.review_text, r.reviewed_at, b.name AS buyer_name
            FROM REVIEW r
            JOIN BUYER b ON r.buyer_id = b.buyer_id
            WHERE r.product_id = $1
            ORDER BY r.reviewed_at DESC
        `, [productId]);

        res.status(200).json({ reviews: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
};

module.exports = {
    postReview,
    getProductReviews
};
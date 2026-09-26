const pool = require('../db');

// GET /api/seller/stats
const getSellerStats = async (req, res) => {
    try {
        const sellerId = req.session.sellerId;

        const [summaryResult, popularProductsResult, currentOrdersResult] = await Promise.all([
            pool.query(`
                SELECT
                    COALESCE(SUM(oi.unit_price), 0) AS total_revenue,
                    COUNT(DISTINCT oi.order_id) AS total_orders,
                    COUNT(oi.unit_id) AS total_units_sold
                FROM order_item oi
                JOIN product_unit pu
                    ON pu.unit_id = oi.unit_id
                JOIN product p
                    ON p.product_id = pu.product_id
                JOIN payment pay
                    ON pay.order_id = oi.order_id
                WHERE p.seller_id = $1
                  AND pay.payment_status = 'paid'
            `, [sellerId]),

            pool.query(`
                SELECT
                    p.product_id,
                    p.product_name,
                    COUNT(oi.unit_id) AS units_sold,
                    COALESCE(SUM(oi.unit_price), 0) AS product_revenue
                FROM order_item oi
                JOIN product_unit pu
                    ON pu.unit_id = oi.unit_id
                JOIN product p
                    ON p.product_id = pu.product_id
                JOIN payment pay
                    ON pay.order_id = oi.order_id
                WHERE p.seller_id = $1
                  AND pay.payment_status = 'paid'
                GROUP BY p.product_id, p.product_name
                ORDER BY units_sold DESC, product_revenue DESC, p.product_id
                LIMIT 5
            `, [sellerId]),

            pool.query(`
                SELECT
                    o.order_id,
                    o.status,
                    o.created_at,
                    o.receiver_name,
                    o.receiver_phone_number,
                    COALESCE(SUM(oi.unit_price), 0) AS seller_order_total,
                    COUNT(oi.unit_id) AS item_count
                FROM orders o
                JOIN order_item oi
                    ON oi.order_id = o.order_id
                JOIN product_unit pu
                    ON pu.unit_id = oi.unit_id
                JOIN product p
                    ON p.product_id = pu.product_id
                WHERE p.seller_id = $1
                  AND o.status IN ('pending', 'confirmed', 'shipped')
                GROUP BY
                    o.order_id,
                    o.status,
                    o.created_at,
                    o.receiver_name,
                    o.receiver_phone_number
                ORDER BY o.created_at DESC
            `, [sellerId])
        ]);

        res.status(200).json({
            summary: summaryResult.rows[0],
            popularProducts: popularProductsResult.rows,
            currentOrders: currentOrdersResult.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
};

module.exports = { getSellerStats };

const pool = require('../db');


// GET /api/products
const getProducts = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
            P.*,
            COUNT(PU.UNIT_ID) AS AVAILABLE_STOCK
            FROM PRODUCT P
            LEFT JOIN PRODUCT_UNIT PU
            ON P.PRODUCT_ID = PU.PRODUCT_ID
            AND PU.UNIT_STATUS = 'available'
            GROUP BY P.PRODUCT_ID
            ORDER BY P.PRODUCT_ID;
        `);

        res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
};


// GET /api/products/:id
const getProductById = async (req, res) => {
    try {
        const productId = req.params.id;

        const result = await pool.query(`
            SELECT
            P.*,
            COUNT(PU.UNIT_ID) AS AVAILABLE_STOCK
            FROM PRODUCT P
            LEFT JOIN PRODUCT_UNIT PU
            ON P.PRODUCT_ID = PU.PRODUCT_ID
            AND PU.UNIT_STATUS = 'available'
            WHERE P.PRODUCT_ID = $1
            GROUP BY P.PRODUCT_ID;
        `, [productId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product does not exist' });
        }

        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Database error' });
    }
}


// Product and ProductUnit creation must happen in one transaction
// POST /api/products/create
const postProductsCreate = async (req, res) => {
    const client = await pool.connect();
    try {


        const { name, description, price, stock } = req.body;
        const sellerId = req.session.sellerId;      // assumes we already authenticated seller

        if (!name || !description || price === undefined || stock === undefined) {
            return res.status(400).json({
                error: 'Name, description, price and stock are required'
            });
        }
        const price_ = Number(price);
        const stock_ = Number(stock);

        if (!Number.isFinite(price_) || price_ <= 0) {
            return res.status(400).json({
                error: 'Price must be a positive number'
            });
        }

        if (!Number.isInteger(stock_) || stock_ < 0) {
            return res.status(400).json({
                error: 'Stock must be a non-negative integer'
            });
        }

        await client.query('BEGIN');
        const result = await client.query(`
            INSERT INTO PRODUCT (PRODUCT_NAME, PRODUCT_DESCRIPTION, PRICE, SELLER_ID)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [name, description, price_, sellerId]);

        const productId = result.rows[0].product_id;

        // insert everything into product_unit
        const values = [];
        for (let i = 0; i < stock_; i++) {
            values.push("($1)");
        }

        await client.query(`
            INSERT INTO PRODUCT_UNIT (PRODUCT_ID)
            VALUES ${values.join(", ")}
        `, [productId]);

        await client.query('COMMIT');

        res.status(200).json({
            message: 'Product created successfully',
            product: result.rows[0],
            stock: stock_
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    } finally {
        client.release();
    }
}



module.exports = {
    getProducts,
    getProductById,
    postProductsCreate,
}
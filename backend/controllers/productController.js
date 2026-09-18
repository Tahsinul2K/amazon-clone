const pool = require('../db');


// GET /api/products
const getProducts = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                p.*,
                COUNT(DISTINCT pu.unit_id) FILTER (
                    WHERE pu.unit_status = 'available'
                ) AS available_stock,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'imageId', pi.image_id,
                            'imageUrl', pi.image_url,
                            'isPrimary', pi.is_primary
                        )
                        ORDER BY pi.is_primary DESC, pi.image_id
                    ) FILTER (WHERE pi.image_id IS NOT NULL),
                    '[]'
                ) AS images
            FROM product p
            LEFT JOIN product_unit pu
                ON p.product_id = pu.product_id
            LEFT JOIN product_image pi
                ON p.product_id = pi.product_id
            GROUP BY p.product_id
            ORDER BY p.product_id;
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
        const productId = Number(req.params.id);

        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({ error: 'Invalid product ID' });
        }

        const result = await pool.query(`
            SELECT
                p.*,
                COUNT(DISTINCT pu.unit_id) FILTER (
                    WHERE pu.unit_status = 'available'
                ) AS available_stock,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'imageId', pi.image_id,
                            'imageUrl', pi.image_url,
                            'isPrimary', pi.is_primary
                        )
                        ORDER BY pi.is_primary DESC, pi.image_id
                    ) FILTER (WHERE pi.image_id IS NOT NULL),
                    '[]'
                ) AS images
            FROM product p
            LEFT JOIN product_unit pu
                ON p.product_id = pu.product_id
            LEFT JOIN product_image pi
                ON p.product_id = pi.product_id
            WHERE p.product_id = $1
            GROUP BY p.product_id;
        `, [productId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product does not exist' });
        }

        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
};

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

        if(stock_ > 0) {
            await client.query(`
                INSERT INTO PRODUCT_UNIT (PRODUCT_ID)
                VALUES ${values.join(", ")}
            `, [productId]);
        }

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
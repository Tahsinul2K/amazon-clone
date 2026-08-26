const pool = require('../db');


// GET /api/products
const getProducts = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM PRODUCT
        `);

        res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({error: 'Database error'});
    }
};


// GET /api/products/:id
const getProductById = async (req, res) => {
    try {
        const productId = req.params.id;

        const result = await pool.query(`
            SELECT *
            FROM PRODUCT
            WHERE ID = $1
        `, [productId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({error: 'Product does not exist'});
        }

        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.log(err);
        res.status(500).json({error: 'Database error'});
    }
}


// POST /api/products/create
const postProductsCreate = async (req, res) => {
    try {
        const { name, description, price } = req.body;
        const sellerId = req.session.sellerId;

        const result = await pool.query(`
            INSERT INTO PRODUCT (PRODUCT_NAME, PRODUCT_DESCRIPTION, PRICE, SELLER_ID)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [name, description, price, sellerId]);

        res.status(200).json({
            message: 'Product created successfully',
            product: result.rows[0]
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({error: 'Database error'});
    }
}




module.exports = {
    getProducts,
    getProductById,
    postProductsCreate
}
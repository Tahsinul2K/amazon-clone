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


// use transactions here later
// POST /api/products/create
const postProductsCreate = async (req, res) => {
    try {
        const { name, description, price, stock } = req.body;
        const sellerId = req.session.sellerId;      // assumes we already authenticated seller
        const stock_ = parseInt(stock, 10) || 0;

        const result = await pool.query(`
            INSERT INTO PRODUCT (PRODUCT_NAME, PRODUCT_DESCRIPTION, PRICE, SELLER_ID)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [name, description, price, sellerId]);

        const productId = result.rows[0].product_id;

        // insert everything into product_unit
        const values = [];
        for(let i = 0; i < stock_; i++){
            values.push("($1)");
        }

        await pool.query(`
            INSERT INTO PRODUCT_UNIT (PRODUCT_ID)
            VALUES ${values.join(", ")}
        `, [productId]);

        res.status(200).json({
            message: 'Product created successfully',
            product: result.rows[0],
            stock: stock
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
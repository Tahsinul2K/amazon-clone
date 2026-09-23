const pool = require('../db');


// GET /api/products
const getProducts = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                p.*,
                (
                    SELECT COUNT(*)
                    FROM product_unit pu
                    WHERE pu.product_id = p.product_id
                      AND pu.unit_status = 'available'
                ) AS available_stock,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'imageId', pi.image_id,
                                'imageUrl', pi.image_url,
                                'isPrimary', pi.is_primary
                            )
                            ORDER BY pi.is_primary DESC, pi.image_id
                        )
                        FROM product_image pi
                        WHERE pi.product_id = p.product_id
                    ),
                    '[]'::json
                ) AS images
            FROM product p
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
                (
                    SELECT COUNT(*)
                    FROM product_unit pu
                    WHERE pu.product_id = p.product_id
                      AND pu.unit_status = 'available'
                ) AS available_stock,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'imageId', pi.image_id,
                                'imageUrl', pi.image_url,
                                'isPrimary', pi.is_primary
                            )
                            ORDER BY pi.is_primary DESC, pi.image_id
                        )
                        FROM product_image pi
                        WHERE pi.product_id = p.product_id
                    ),
                    '[]'::json
                ) AS images
            FROM product p
            WHERE p.product_id = $1;
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

// GET /api/seller/products
const getProductsBySellerId = async (req, res) => {
    try {
        const sellerId = req.session.sellerId;

        const result = await pool.query(`
            SELECT
                p.*,
                (
                    SELECT COUNT(*)
                    FROM product_unit pu
                    WHERE pu.product_id = p.product_id
                      AND pu.unit_status = 'available'
                ) AS available_stock,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'imageId', pi.image_id,
                                'imageUrl', pi.image_url,
                                'isPrimary', pi.is_primary
                            )
                            ORDER BY pi.is_primary DESC, pi.image_id
                        )
                        FROM product_image pi
                        WHERE pi.product_id = p.product_id
                    ),
                    '[]'::json
                ) AS images
            FROM product p
            WHERE p.seller_id = $1
            ORDER BY p.product_id;
        `, [sellerId]);

        res.status(200).json(result.rows);
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

        if (req.files?.length) {
            for (const [index, file] of req.files.entries()) {
                await client.query(`
                    INSERT INTO product_image (product_id, image_url, is_primary)
                    VALUES ($1, $2, $3)
                `, [productId, `/uploads/products/${file.filename}`, index === 0]);
            }
        }

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

// PUT /api/products/:productId
const updateProduct = async (req, res) => {
    const client = await pool.connect();
    try {
        const productId = Number(req.params.productId);
        const { name, description, price, additionalStock } = req.body;

        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({ error: 'Invalid product ID' });
        }

        if (!name || !description || price === undefined || additionalStock === undefined) {
            return res.status(400).json({
                error: 'Name, description, price and additional stock are required'
            });
        }

        const priceValue = Number(price);
        const stockValue = Number(additionalStock);

        if (!Number.isFinite(priceValue) || priceValue <= 0) {
            return res.status(400).json({ error: 'Price must be a positive number' });
        }

        if (!Number.isInteger(stockValue) || stockValue < 0) {
            return res.status(400).json({ error: 'Additional stock must be a non-negative integer' });
        }

        await client.query('BEGIN');

        const productResult = await client.query(`
            UPDATE product
            SET product_name = $1, product_description = $2, price = $3
            WHERE product_id = $4 AND seller_id = $5
            RETURNING *
        `, [name, description, priceValue, productId, req.session.sellerId]);

        if (productResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Product not found or does not belong to this seller' });
        }

        if (stockValue > 0) {
            const values = Array.from({ length: stockValue }, () => '($1)').join(', ');
            await client.query(`
                INSERT INTO product_unit (product_id)
                VALUES ${values}
            `, [productId]);
        }

        if (req.files?.length) {
            const existingImages = await client.query(
                'SELECT 1 FROM product_image WHERE product_id = $1 LIMIT 1',
                [productId]
            );
            const hasPrimary = await client.query(
                'SELECT 1 FROM product_image WHERE product_id = $1 AND is_primary = TRUE LIMIT 1',
                [productId]
            );

            for (const [index, file] of req.files.entries()) {
                await client.query(`
                    INSERT INTO product_image (product_id, image_url, is_primary)
                    VALUES ($1, $2, $3)
                `, [productId, `/uploads/products/${file.filename}`, !existingImages.rows.length && !hasPrimary.rows.length && index === 0]);
            }
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Product updated successfully', product: productResult.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    } finally {
        client.release();
    }
};

const addProductCategory = async (req, res) => {
    try {
        const productId = Number(req.params.productId);
        const categoryId = Number(req.params.categoryId);
        const sellerId = req.session.sellerId;

        // 1. Validate IDs
        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({
                error: 'Product ID must be a positive integer'
            });
        }

        if (!Number.isInteger(categoryId) || categoryId <= 0) {
            return res.status(400).json({
                error: 'Category ID must be a positive integer'
            });
        }

        // 2. Check that the product belongs to the logged-in seller
        const productResult = await pool.query(
            `SELECT product_id
             FROM product
             WHERE product_id = $1
               AND seller_id = $2`,
            [productId, sellerId]
        );

        if (productResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Product not found'
            });
        }

        // 3. Check that the category exists
        const categoryResult = await pool.query(
            `SELECT category_id, category_name
             FROM category
             WHERE category_id = $1`,
            [categoryId]
        );

        if (categoryResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Category not found'
            });
        }

        // 4. Add the product-category relationship
        try {
            await pool.query(
                `INSERT INTO product_category
                    (product_id, category_id)
                 VALUES ($1, $2)`,
                [productId, categoryId]
            );
        } catch (err) {
            // Primary key violation means this relationship already exists
            if (err.code === '23505') {
                return res.status(409).json({
                    error: 'Product is already assigned to this category'
                });
            }

            throw err;
        }

        return res.status(201).json({
            message: 'Category assigned to product successfully',
            productId,
            category: categoryResult.rows[0]
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            error: 'Database error'
        });
    }
};

const removeProductCategory = async (req, res) => {
    try {
        const productId = Number(req.params.productId);
        const categoryId = Number(req.params.categoryId);
        const sellerId = req.session.sellerId;

        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({
                error: 'Product ID must be a positive integer'
            });
        }

        if (!Number.isInteger(categoryId) || categoryId <= 0) {
            return res.status(400).json({
                error: 'Category ID must be a positive integer'
            });
        }

        // Check that the product belongs to the logged-in seller
        const productResult = await pool.query(
            `SELECT product_id
             FROM product
             WHERE product_id = $1
               AND seller_id = $2`,
            [productId, sellerId]
        );

        if (productResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Product not found'
            });
        }

        // Remove the category relationship
        const result = await pool.query(
            `DELETE FROM product_category
             WHERE product_id = $1
               AND category_id = $2`,
            [productId, categoryId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                error: 'Product is not assigned to this category'
            });
        }

        return res.status(200).json({
            message: 'Category removed from product successfully',
            productId,
            categoryId
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            error: 'Database error'
        });
    }
};

module.exports = {
    getProducts,
    getProductById,
    getProductsBySellerId,
    postProductsCreate,
    updateProduct,
    addProductCategory,
    removeProductCategory
}
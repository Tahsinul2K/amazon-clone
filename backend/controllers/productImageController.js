const pool = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads/products');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter (accept images only)
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter
});

// Middleware for uploading multiple product images (up to 5 images)
const uploadProductImages = upload.array('images', 5);

// Add images to an existing product
const addProductImages = async (req, res) => {
    try {
        const productId = Number(req.params.productId);

        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({ error: 'Invalid product ID' });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No image files provided' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');


            // Check if the product belongs to the seller
            const productResult = await client.query(`
                SELECT product_id
                FROM product
                WHERE product_id = $1
                AND seller_id = $2
            `, [productId, req.session.sellerId]);

            if (productResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({
                    error: 'Product not found or does not belong to this seller'
                });
            }

            const insertedImages = [];

            for (let i = 0; i < req.files.length; i++) {
                const file = req.files[i];
                const imageUrl = `/uploads/products/${file.filename}`;

                // If this is the first image being added and no primary exists, you could check or insert as primary
                const result = await client.query(`
                    INSERT INTO product_image (product_id, image_url, is_primary)
                    VALUES ($1, $2, FALSE)
                    RETURNING *
                `, [productId, imageUrl]);

                insertedImages.push(result.rows[0]);
            }

            await client.query('COMMIT');
            res.status(201).json({
                message: 'Images uploaded successfully',
                images: insertedImages
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
};

// Set a specific image as the primary image for a product
const setPrimaryImage = async (req, res) => {
    try {
        const productId = Number(req.params.productId);
        const imageId = Number(req.params.imageId);

        if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(imageId) || imageId <= 0) {
            return res.status(400).json({ error: 'Invalid product or image ID' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Check if the product belongs to the seller
            const productResult = await client.query(`
                SELECT product_id
                FROM product
                WHERE product_id = $1
                AND seller_id = $2
            `, [productId, req.session.sellerId]);

            if (productResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({
                    error: 'Product not found or does not belong to this seller'
                });
            }


            // Unset primary for all images of this product
            await client.query(`
                UPDATE product_image
                SET is_primary = FALSE
                WHERE product_id = $1
            `, [productId]);

            // Set the target image as primary
            const result = await client.query(`
                UPDATE product_image
                SET is_primary = TRUE
                WHERE image_id = $2 AND product_id = $1
                RETURNING *
            `, [productId, imageId]);

            if (result.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Image not found for this product' });
            }

            await client.query('COMMIT');
            res.status(200).json({
                message: 'Primary image updated successfully',
                image: result.rows[0]
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
};


// Delete a product image
const deleteProductImage = async (req, res) => {
    try {
        const imageId = Number(req.params.imageId);

        if (!Number.isInteger(imageId) || imageId <= 0) {
            return res.status(400).json({ error: 'Invalid image ID' });
        }

        // Confirm that the image belongs to a product owned by this seller
        const imageResult = await pool.query(`
            SELECT pi.image_url
            FROM product_image pi
            JOIN product p
                ON p.product_id = pi.product_id
            WHERE pi.image_id = $1
              AND p.seller_id = $2
        `, [imageId, req.session.sellerId]);

        if (imageResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Image not found or does not belong to this seller'
            });
        }

        const imageUrl = imageResult.rows[0].image_url;
        const fileName = path.basename(imageUrl);
        const filePath = path.join(uploadDir, fileName);

        // Delete the database record
        await pool.query(`
            DELETE FROM product_image
            WHERE image_id = $1
        `, [imageId]);

        // Delete the actual image file from disk
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        res.status(200).json({
            message: 'Image deleted successfully'
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
};

module.exports = {
    uploadProductImages,
    addProductImages,
    setPrimaryImage,
    deleteProductImage
};
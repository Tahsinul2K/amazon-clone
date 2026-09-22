const pool = require('../db');

const createCategory = async (req, res) => {
    try {
        const { categoryName, parentCategoryId } = req.body;

        // 1. Validate category name
        if (!categoryName || categoryName.trim() === '') {
            return res.status(400).json({
                error: 'Category name is required'
            });
        }

        const name = categoryName.trim();

        // 2. Validate parent category ID if provided
        let parentId = null;

        if (parentCategoryId !== undefined && parentCategoryId !== null) {
            parentId = Number(parentCategoryId);

            if (!Number.isInteger(parentId) || parentId <= 0) {
                return res.status(400).json({
                    error: 'Parent category ID must be a positive integer'
                });
            }

            // 3. Make sure the parent category exists
            const parentResult = await pool.query(
                `SELECT category_id
                 FROM category
                 WHERE category_id = $1`,
                [parentId]
            );

            if (parentResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'Parent category not found'
                });
            }
        }

        // 4. Create the category
        const result = await pool.query(
            `INSERT INTO category (category_name, parent_category_id)
             VALUES ($1, $2)
             RETURNING category_id, category_name, parent_category_id, created_at`,
            [name, parentId]
        );

        return res.status(201).json({
            message: 'Category created successfully',
            category: result.rows[0]
        });

    } catch (err) {
        // PostgreSQL unique constraint violation
        if (err.code === '23505') {
            return res.status(409).json({
                error: 'Category name already exists'
            });
        }

        console.error(err);

        return res.status(500).json({
            error: 'Database error'
        });
    }
};

const getCategories = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                category_id,
                category_name,
                parent_category_id,
                created_at
            FROM category
            ORDER BY category_id
        `);

        return res.status(200).json({
            categories: result.rows
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            error: 'Database error'
        });
    }
};

const getCategoryById = async (req, res) => {
    try {
        const categoryId = Number(req.params.categoryId);

        // 1. Validate category ID
        if (!Number.isInteger(categoryId) || categoryId <= 0) {
            return res.status(400).json({
                error: 'Category ID must be a positive integer'
            });
        }

        // 2. Find the category and its parent
        const result = await pool.query(
            `SELECT
                c.category_id,
                c.category_name,
                c.parent_category_id,
                c.created_at,
                p.category_name AS parent_category_name
             FROM category c
             LEFT JOIN category p
                ON c.parent_category_id = p.category_id
             WHERE c.category_id = $1`,
            [categoryId]
        );

        // 3. Category does not exist
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Category not found'
            });
        }

        return res.status(200).json({
            category: result.rows[0]
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            error: 'Database error'
        });
    }
};

module.exports = {
    createCategory,
    getCategories,
    getCategoryById
};
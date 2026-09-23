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

const updateCategory = async (req, res) => {
    try {
        const categoryId = Number(req.params.categoryId);
        const { categoryName, parentCategoryId } = req.body;

        // 1. Validate category ID
        if (!Number.isInteger(categoryId) || categoryId <= 0) {
            return res.status(400).json({
                error: 'Category ID must be a positive integer'
            });
        }

        // 2. Validate category name
        if (!categoryName || categoryName.trim() === '') {
            return res.status(400).json({
                error: 'Category name is required'
            });
        }

        const name = categoryName.trim();

        // 3. Validate parent category ID
        let parentId = null;

        if (parentCategoryId !== undefined && parentCategoryId !== null) {
            parentId = Number(parentCategoryId);

            if (!Number.isInteger(parentId) || parentId <= 0) {
                return res.status(400).json({
                    error: 'Parent category ID must be a positive integer'
                });
            }

            // A category cannot be its own parent
            if (parentId === categoryId) {
                return res.status(400).json({
                    error: 'A category cannot be its own parent'
                });
            }

            // 4. Check that parent exists
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

            // 5. Check for circular hierarchy
            let currentParentId = parentId;

            while (currentParentId !== null) {
                if (currentParentId === categoryId) {
                    return res.status(400).json({
                        error: 'Cannot create a circular category hierarchy'
                    });
                }

                const parentResult = await pool.query(
                    `SELECT parent_category_id
                     FROM category
                     WHERE category_id = $1`,
                    [currentParentId]
                );

                if (parentResult.rows.length === 0) {
                    break;
                }

                currentParentId = parentResult.rows[0].parent_category_id;
            }
        }

        // 6. Update category
        const result = await pool.query(
            `UPDATE category
             SET category_name = $1,
                 parent_category_id = $2
             WHERE category_id = $3
             RETURNING category_id, category_name,
                       parent_category_id, created_at`,
            [name, parentId, categoryId]
        );

        // 7. Category does not exist
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Category not found'
            });
        }

        return res.status(200).json({
            message: 'Category updated successfully',
            category: result.rows[0]
        });

    } catch (err) {
        // Duplicate category name
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

const deleteCategory = async (req, res) => {
    try {
        const categoryId = Number(req.params.categoryId);

        // 1. Validate category ID
        if (!Number.isInteger(categoryId) || categoryId <= 0) {
            return res.status(400).json({
                error: 'Category ID must be a positive integer'
            });
        }

        // 2. Try to delete the category
        const result = await pool.query(
            `DELETE FROM category
             WHERE category_id = $1
             RETURNING category_id, category_name`,
            [categoryId]
        );

        // 3. Category does not exist
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Category not found'
            });
        }

        return res.status(200).json({
            message: 'Category deleted successfully',
            category: result.rows[0]
        });

    } catch (err) {
        // Category has child categories
        if (err.code === '23001') {
            return res.status(409).json({
                error: 'Cannot delete category because it has child categories'
            });
        }

        console.error(err);

        return res.status(500).json({
            error: 'Database error'
        });
    }
};



module.exports = {
    createCategory,
    getCategories,
    getCategoryById,
    updateCategory,
    deleteCategory
};
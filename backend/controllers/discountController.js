const pool = require('../db');

const createDiscount = async (req, res) => {
    try {
        const {
            discountName,
            discountType,
            discountValue,
            startDate,
            endDate
        } = req.body;

        // Validate discount name
        if (!discountName || discountName.trim() === '') {
            return res.status(400).json({
                error: 'Discount name is required'
            });
        }

        const name = discountName.trim();

        // Validate discount type
        if (
            discountType !== 'fixed_amount' &&
            discountType !== 'percentage'
        ) {
            return res.status(400).json({
                error: 'Discount type must be fixed_amount or percentage'
            });
        }

        // Validate discount value
        const value = Number(discountValue);

        if (!Number.isFinite(value) || value <= 0) {
            return res.status(400).json({
                error: 'Discount value must be greater than 0'
            });
        }

        // Percentage cannot exceed 100
        if (discountType === 'percentage' && value > 100) {
            return res.status(400).json({
                error: 'Percentage discount cannot exceed 100'
            });
        }

        // Validate dates
        if (!startDate || !endDate) {
            return res.status(400).json({
                error: 'Start date and end date are required'
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (
            Number.isNaN(start.getTime()) ||
            Number.isNaN(end.getTime())
        ) {
            return res.status(400).json({
                error: 'Invalid start date or end date'
            });
        }

        if (end <= start) {
            return res.status(400).json({
                error: 'End date must be after start date'
            });
        }

        // Insert discount
        const result = await pool.query(
            `INSERT INTO discount
                (
                    discount_name,
                    discount_type,
                    discount_value,
                    start_date,
                    end_date
                )
             VALUES ($1, $2, $3, $4, $5)
             RETURNING
                discount_id,
                discount_name,
                discount_type,
                discount_value,
                start_date,
                end_date,
                is_active,
                created_at`,
            [name, discountType, value, start, end]
        );

        return res.status(201).json({
            message: 'Discount created successfully',
            discount: result.rows[0]
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            error: 'Database error'
        });
    }
};

const getDiscounts = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                discount_id,
                discount_name,
                discount_type,
                discount_value,
                start_date,
                end_date,
                is_active,
                created_at
            FROM discount
            ORDER BY discount_id
        `);

        return res.status(200).json({
            discounts: result.rows
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            error: 'Database error'
        });
    }
};

const getDiscountById = async (req, res) => {
    try {
        const discountId = Number(req.params.discountId);

        if (!Number.isInteger(discountId) || discountId <= 0) {
            return res.status(400).json({
                error: 'Discount ID must be a positive integer'
            });
        }

        const result = await pool.query(
            `SELECT
                discount_id,
                discount_name,
                discount_type,
                discount_value,
                start_date,
                end_date,
                is_active,
                created_at
             FROM discount
             WHERE discount_id = $1`,
            [discountId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Discount not found'
            });
        }

        return res.status(200).json({
            discount: result.rows[0]
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            error: 'Database error'
        });
    }
};

const updateDiscount = async (req, res) => {
    try {
        const discountId = Number(req.params.discountId);

        if (!Number.isInteger(discountId) || discountId <= 0) {
            return res.status(400).json({
                error: 'Discount ID must be a positive integer'
            });
        }

        const {
            discountName,
            discountType,
            discountValue,
            startDate,
            endDate,
            isActive
        } = req.body;

        // Check that the discount exists
        const existingResult = await pool.query(
            `SELECT *
             FROM discount
             WHERE discount_id = $1`,
            [discountId]
        );

        if (existingResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Discount not found'
            });
        }

        const existing = existingResult.rows[0];

        // Use existing values when a field is not provided
        const name = discountName !== undefined
            ? discountName.trim()
            : existing.discount_name;

        const type = discountType !== undefined
            ? discountType
            : existing.discount_type;

        const value = discountValue !== undefined
            ? Number(discountValue)
            : Number(existing.discount_value);

        const start = startDate !== undefined
            ? new Date(startDate)
            : new Date(existing.start_date);

        const end = endDate !== undefined
            ? new Date(endDate)
            : new Date(existing.end_date);

        const active = isActive !== undefined
            ? isActive
            : existing.is_active;

        // Validate name
        if (!name) {
            return res.status(400).json({
                error: 'Discount name is required'
            });
        }

        // Validate type
        if (
            type !== 'fixed_amount' &&
            type !== 'percentage'
        ) {
            return res.status(400).json({
                error: 'Discount type must be fixed_amount or percentage'
            });
        }

        // Validate value
        if (!Number.isFinite(value) || value <= 0) {
            return res.status(400).json({
                error: 'Discount value must be greater than 0'
            });
        }

        if (type === 'percentage' && value > 100) {
            return res.status(400).json({
                error: 'Percentage discount cannot exceed 100'
            });
        }

        // Validate dates
        if (
            Number.isNaN(start.getTime()) ||
            Number.isNaN(end.getTime())
        ) {
            return res.status(400).json({
                error: 'Invalid start date or end date'
            });
        }

        if (end <= start) {
            return res.status(400).json({
                error: 'End date must be after start date'
            });
        }

        // Validate isActive
        if (typeof active !== 'boolean') {
            return res.status(400).json({
                error: 'isActive must be true or false'
            });
        }

        const result = await pool.query(
            `UPDATE discount
             SET
                discount_name = $1,
                discount_type = $2,
                discount_value = $3,
                start_date = $4,
                end_date = $5,
                is_active = $6
             WHERE discount_id = $7
             RETURNING
                discount_id,
                discount_name,
                discount_type,
                discount_value,
                start_date,
                end_date,
                is_active,
                created_at`,
            [
                name,
                type,
                value,
                start,
                end,
                active,
                discountId
            ]
        );

        return res.status(200).json({
            message: 'Discount updated successfully',
            discount: result.rows[0]
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            error: 'Database error'
        });
    }
};

const deleteDiscount = async (req, res) => {
    try {
        const discountId = Number(req.params.discountId);

        if (!Number.isInteger(discountId) || discountId <= 0) {
            return res.status(400).json({
                error: 'Discount ID must be a positive integer'
            });
        }

        const result = await pool.query(
            `DELETE FROM discount
             WHERE discount_id = $1
             RETURNING
                discount_id,
                discount_name,
                discount_type,
                discount_value`,
            [discountId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Discount not found'
            });
        }

        return res.status(200).json({
            message: 'Discount deleted successfully',
            discount: result.rows[0]
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            error: 'Database error'
        });
    }
};

module.exports = {
    createDiscount,
    getDiscounts,
    getDiscountById,
    updateDiscount,
    deleteDiscount
};
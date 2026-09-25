const pool = require('../db');
const { assignWaitingOrderToDeliveryBoy } = require('./orderController');

const postDeliveryBoy = async (req, res) => {
    const client = await pool.connect();

    try {
        const { fullName, phoneNumber, email } = req.body;

        if (!fullName || !phoneNumber) {
            return res.status(400).json({
                error: 'Full name and phone number are required'
            });
        }

        await client.query('BEGIN');

        // 1. Insert the new delivery boy using client
        const result = await client.query(`
            INSERT INTO DELIVERY_BOY (FULL_NAME, PHONE_NUMBER, EMAIL)
            VALUES ($1, $2, $3)
            RETURNING DELIVERY_BOY_ID, FULL_NAME, PHONE_NUMBER, EMAIL, STATUS
        `, [fullName, phoneNumber, email || null]);

        const newDeliveryBoy = result.rows[0];

        // 2. Immediately assign the oldest pending order (if any)
        const assignedOrderId = await assignWaitingOrderToDeliveryBoy(
            client,
            newDeliveryBoy.delivery_boy_id
        );

        if (assignedOrderId) {
            newDeliveryBoy.status = 'assigned';
        }

        await client.query('COMMIT');

        return res.status(201).json({
            message: assignedOrderId
                ? `Delivery boy added and automatically assigned to order #${assignedOrderId}`
                : 'Delivery boy added successfully',
            assignedOrderId: assignedOrderId || null,
            deliveryBoy: newDeliveryBoy
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);

        if (err.code === '23505') {
            if (err.constraint === 'delivery_boy_phone_unique') {
                return res.status(409).json({
                    error: 'A delivery boy with this phone number already exists'
                });
            }

            if (err.constraint === 'delivery_boy_email_unique') {
                return res.status(409).json({
                    error: 'A delivery boy with this email already exists'
                });
            }
        }

        return res.status(500).json({
            error: 'Database error'
        });
    } finally {
        client.release();
    }
};


const deleteDeliveryBoy = async (req, res) => {
    try {
        const rawId = req.params.delivery_boy_id;

        if (!rawId) {
            return res.status(400).json({
                error: 'delivery_boy_id is required'
            });
        }

        const deliveryBoyId = Number(rawId);

        if (!Number.isInteger(deliveryBoyId) || deliveryBoyId <= 0) {
            return res.status(400).json({
                error: 'delivery_boy_id must be a positive integer'
            });
        }

        // Check if delivery boy exists and verify status
        const boyCheck = await pool.query(`
            SELECT DELIVERY_BOY_ID, STATUS
            FROM DELIVERY_BOY
            WHERE DELIVERY_BOY_ID = $1
        `, [deliveryBoyId]);

        if (boyCheck.rows.length === 0) {
            return res.status(404).json({
                error: 'Delivery boy not found'
            });
        }

        if (boyCheck.rows[0].status === 'assigned') {
            return res.status(400).json({
                error: 'Cannot delete delivery boy while assigned to an active order'
            });
        }

        const result = await pool.query(`
            DELETE FROM DELIVERY_BOY
            WHERE DELIVERY_BOY_ID = $1
            RETURNING DELIVERY_BOY_ID, FULL_NAME, PHONE_NUMBER, EMAIL, STATUS
        `, [deliveryBoyId]);

        return res.status(200).json({
            message: 'Delivery boy deleted successfully',
            deliveryBoy: result.rows[0]
        });

    } catch (err) {
        console.error(err);

        if (err.code === '23503') {
            return res.status(409).json({
                error: 'Cannot delete delivery boy due to related records'
            });
        }

        return res.status(500).json({
            error: 'Database error'
        });
    }
};

const getDeliveryBoys = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DELIVERY_BOY_ID, FULL_NAME, PHONE_NUMBER, EMAIL, STATUS
            FROM DELIVERY_BOY
            ORDER BY DELIVERY_BOY_ID ASC
        `);

        return res.status(200).json({
            deliveryBoys: result.rows
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            error: 'Database error'
        });
    }
};

module.exports = {
    postDeliveryBoy,
    deleteDeliveryBoy,
    getDeliveryBoys
};
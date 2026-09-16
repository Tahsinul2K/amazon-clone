const pool = require('../db');

// Add a new address
const addAddress = async (req, res) => {
    try {
        const buyerId = req.session.buyerId;
        const { label, street, city, postalCode, country, isCurrent } = req.body;

        if (!label || !street || !city || !postalCode || !country) {
            return res.status(400).json({ error: 'All address fields are required' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const shouldBeCurrent = isCurrent !== undefined ? isCurrent : false;

            // If this new address is set as current, unset is_current for all other addresses of this buyer
            if (shouldBeCurrent) {
                await client.query(`
                    UPDATE address
                    SET is_current = FALSE
                    WHERE buyer_id = $1
                `, [buyerId]);
            }

            const result = await client.query(`
                INSERT INTO address (buyer_id, label, street, city, postal_code, country, is_current)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `, [buyerId, label, street, city, postalCode, country, shouldBeCurrent]);

            await client.query('COMMIT');
            res.status(201).json({
                message: 'Address added successfully',
                address: result.rows[0]
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

// Get all addresses for the logged-in buyer
const getAddresses = async (req, res) => {
    try {
        const buyerId = req.session.buyerId;

        const result = await pool.query(`
            SELECT * FROM address
            WHERE buyer_id = $1
            ORDER BY is_current DESC, address_id DESC
        `, [buyerId]);

        res.status(200).json({ addresses: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
};


// Get the current active shipping address for the logged-in buyer
const getCurrentAddress = async (req, res) => {
    try {
        const buyerId = req.session.buyerId;

        const result = await pool.query(`
            SELECT * FROM address
            WHERE buyer_id = $1 AND is_current = TRUE
            LIMIT 1
        `, [buyerId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No current address set' });
        }

        res.status(200).json({ address: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
};



// Set an address as the current shipping address
const setCurrentAddress = async (req, res) => {
    try {
        const buyerId = req.session.buyerId;
        const addressId = Number(req.params.addressId);

        if (!Number.isInteger(addressId) || addressId <= 0) {
            return res.status(400).json({ error: 'Invalid address ID' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Unset current for all of this buyer's addresses
            await client.query(`
                UPDATE address
                SET is_current = FALSE
                WHERE buyer_id = $1
            `, [buyerId]);

            // Set the target address as current
            const updateRes = await client.query(`
                UPDATE address
                SET is_current = TRUE
                WHERE address_id = $1 AND buyer_id = $2
                RETURNING *
            `, [addressId, buyerId]);

            if (updateRes.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Address not found or unauthorized' });
            }

            await client.query('COMMIT');
            res.status(200).json({
                message: 'Current shipping address updated successfully',
                address: updateRes.rows[0]
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

// Delete an address
const deleteAddress = async (req, res) => {
    try {
        const buyerId = req.session.buyerId;
        const addressId = Number(req.params.addressId);

        if (!Number.isInteger(addressId) || addressId <= 0) {
            return res.status(400).json({ error: 'Invalid address ID' });
        }

        const result = await pool.query(`
            DELETE FROM address
            WHERE address_id = $1 AND buyer_id = $2
            RETURNING address_id
        `, [addressId, buyerId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Address not found or unauthorized' });
        }

        res.status(200).json({ message: 'Address deleted successfully' });
    } catch (err) {
        console.error(err);
        if (err.code === '23503') {
            return res.status(400).json({ error: 'Cannot delete this address because it is linked to past orders.' });
        }
        res.status(500).json({ error: 'Database error' });
    }
};

module.exports = {
    addAddress,
    getAddresses,
    getCurrentAddress,
    setCurrentAddress,
    deleteAddress
};
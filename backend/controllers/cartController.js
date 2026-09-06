const pool = require('../db');
// assume buyer has already been authenticated


//To do:
// 1. delete cart


const cleanupExpiredReservations = async (client) => {
    // Find expired reservations
    const expiredItems = await client.query(`
        SELECT UNIT_ID
        FROM CART_ITEM
        WHERE RESERVED_UNTIL <= CURRENT_TIMESTAMP
    `);

    if (expiredItems.rows.length === 0) {
        return;
    }

    const unitIds = expiredItems.rows.map(item => item.unit_id);

    // Release the physical units
    await client.query(`
        UPDATE PRODUCT_UNIT
        SET UNIT_STATUS = 'available'
        WHERE UNIT_ID = ANY($1)
    `, [unitIds]);

    // Remove the expired cart reservations
    await client.query(`
        DELETE FROM CART_ITEM
        WHERE UNIT_ID = ANY($1)
    `, [unitIds]);
};

// POST /api/cart/items
const postCartItems = async (req, res) => {
    const buyerId = req.session.buyerId;
    const { productId, quantity } = req.body;

    const productId_ = Number(productId);
    const quantity_ = Number(quantity);
    if (!Number.isInteger(quantity_) || quantity_ <= 0) {
        return res.status(400).json({
        error: 'Quantity must be a positive integer'
        });
    }

    if(!Number.isInteger(productId_) || productId_ <= 0) {
        return res.status(400).json({
            error: 'Product ID must be a positive integer'
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Release expired reservations first
        await cleanupExpiredReservations(client);

        // Check whether the product exists
        const productResult = await client.query(`
            SELECT PRODUCT_ID
            FROM PRODUCT
            WHERE PRODUCT_ID = $1
        `, [productId_]);

        if (productResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
            error: 'Product does not exist'
        });
        }

        const cartResult = await client.query(`
            SELECT *
            FROM CART
            WHERE BUYER_ID = $1
            AND STATUS = 'active'
        `, [buyerId]);
        let cartId;
            
        // create cart if not exists
        if(cartResult.rows.length === 0){
            const newCartResult = await client.query(`
                INSERT INTO CART (BUYER_ID)
                VALUES ($1)
                RETURNING *
            `, [buyerId]);

            cartId = newCartResult.rows[0].cart_id
        } else{
            cartId = cartResult.rows[0].cart_id;
        }


        // insert into cart_item

        const unitsResult = await client.query(`
            SELECT *
            FROM PRODUCT_UNIT
            WHERE PRODUCT_ID = $1 AND UNIT_STATUS = 'available'
            ORDER BY UNIT_ID
            LIMIT $2
            FOR UPDATE SKIP LOCKED
        `, [productId_, quantity_]);

        let units = unitsResult.rows;

        if(units.length < quantity_) {
            await client.query('ROLLBACK');
            return res.status(400).json({error: 'Not enough stock'});
        }
        
        let values = [];
        let params = [cartId];
        for(let i = 0; i < quantity_; i++){
            values.push(`($1, $${i+2}, CURRENT_TIMESTAMP + INTERVAL '15 minutes')`);
            params.push(units[i].unit_id);
        }

        const cartItemResult = await client.query(`
            INSERT INTO CART_ITEM (CART_ID, UNIT_ID, RESERVED_UNTIL)
            VALUES ${values.join(', ')}
            RETURNING *
        `, params);

        // update unit status
        const unitIds = units.map(u => u.unit_id);
        await client.query(`
            UPDATE PRODUCT_UNIT
            SET UNIT_STATUS = 'reserved'
            WHERE UNIT_ID = ANY($1)
        `, [unitIds]);

        await client.query('COMMIT');

        res.status(200).json({
            message: 'Items added to cart',
            cartId: cartId,
            productId: productId_,
            quantity: quantity_
        })
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({error: 'Database error'});
    } finally {
        client.release();
    }
};


// GET /api/cart
const getCart = async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const buyerID = req.session.buyerId;

        // Release expired reservations first
        await cleanupExpiredReservations(client);

        // Get the buyer's active cart
        const result = await client.query(`
        SELECT
            C.CART_ID,
            C.BUYER_ID,
            I.UNIT_ID,
            I.RESERVED_UNTIL,
            P.PRODUCT_ID,
            P.PRODUCT_NAME,
            P.PRODUCT_DESCRIPTION,
            P.PRICE
        FROM CART C
        JOIN CART_ITEM I
            ON C.CART_ID = I.CART_ID
        JOIN PRODUCT_UNIT PU
            ON I.UNIT_ID = PU.UNIT_ID
        JOIN PRODUCT P
            ON PU.PRODUCT_ID = P.PRODUCT_ID
        WHERE C.BUYER_ID = $1
        AND C.STATUS = 'active'
        `, [buyerID]);

        await client.query('COMMIT');

        res.status(200).json({
            message: 'viewing cart successful',
            cart: result.rows
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({
            error: 'Database error'
        });
    } finally {
        client.release();
    }
};


// DELETE /api/cart/items/:unitId
const deleteCartItem = async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const buyerId = req.session.buyerId;
        const unitId = req.params.unitId;

        // Check whether this unit belongs to the buyer's active cart
        const cartResult = await client.query(`
            SELECT
                C.CART_ID,
                C.BUYER_ID,
                C.STATUS,
                C.CREATED_AT,
                I.UNIT_ID,
                I.RESERVED_UNTIL
            FROM CART C
            JOIN CART_ITEM I
                ON C.CART_ID = I.CART_ID
            WHERE C.BUYER_ID = $1
              AND C.STATUS = 'active'
              AND I.UNIT_ID = $2
        `, [buyerId, unitId]);

        if (cartResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: 'Item not in buyer cart'
            });
        }

        const cartId = cartResult.rows[0].cart_id;

        // Delete the item from this specific cart
        await client.query(`
            DELETE FROM CART_ITEM
            WHERE CART_ID = $1
              AND UNIT_ID = $2
        `, [cartId, unitId]);

        // Release the physical unit
        await client.query(`
            UPDATE PRODUCT_UNIT
            SET UNIT_STATUS = 'available'
            WHERE UNIT_ID = $1
        `, [unitId]);

        await client.query('COMMIT');

        res.status(200).json({
            message: 'Item deleted from cart',
            item: cartResult.rows
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({
            error: 'Database error'
        });
    } finally {
        client.release();
    }
};

module.exports = {
    postCartItems,
    getCart,
    deleteCartItem
}
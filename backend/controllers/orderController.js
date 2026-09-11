const pool = require('../db');


// to do: add get order and payment handling and delivery handling


// /api/orders
// delivery boy and payment not handled yet
const postOrders = async (req, res) => {
    const client = await pool.connect();
    try {
        const buyerId = req.session.buyerId;
        const {
            addressId_,
            receiverName,
            receiverPhoneNumber,
        } = req.body;
    
        const addressId = Number(addressId_);

        if (!Number.isInteger(addressId) || addressId <= 0) {
            return res.status(400).json({
            error: 'Address ID must be a positive integer'
            });
        }

        if (typeof receiverName !== 'string' || !receiverName.trim()) {
            return res.status(400).json({
            error: 'Receiver name is required'
            });
        }

        if (typeof receiverPhoneNumber !== 'string' || !receiverPhoneNumber.trim()) {
            return res.status(400).json({
            error: 'Receiver phone number is required'
            });
        }

        await client.query('BEGIN');

        // check if address belongs to buyer
        const addressResult = await client.query(`
            SELECT *
            FROM ADDRESS
            WHERE ADDRESS_ID = $1 AND BUYER_ID = $2
        `, [addressId, buyerId]);

        if(addressResult.rows.length === 0){
            await client.query('ROLLBACK');
            return res.status(400).json({error: 'Invalid address'});
        }

        // check cart
        const cartResult = await client.query(`
        SELECT
        C.CART_ID,
        CI.UNIT_ID,
        PU.UNIT_STATUS,
        CI.RESERVED_UNTIL
        FROM CART C
        JOIN CART_ITEM CI
        ON CI.CART_ID = C.CART_ID
        JOIN PRODUCT_UNIT PU
        ON PU.UNIT_ID = CI.UNIT_ID
        WHERE C.BUYER_ID = $1
        AND C.STATUS = 'active'
        `, [buyerId]);

        if(cartResult.rows.length === 0){
            await client.query('ROLLBACK');
            return res.status(400).json({error: 'Cart is empty'});
        }

        const invalidItem = cartResult.rows.some(item =>
        item.unit_status !== 'reserved' ||
        new Date(item.reserved_until) <= new Date()
        );

        if (invalidItem) {
            await client.query('ROLLBACK');
            return res.status(400).json({
            error: 'One or more cart items have expired. Please update your cart.'
            });
        }

        const cartId = cartResult.rows[0].cart_id;

        const orderResult = await client.query(`
            INSERT INTO ORDERS(BUYER_ID, ADDRESS_ID, RECEIVER_NAME, RECEIVER_PHONE_NUMBER)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [buyerId, addressId, receiverName, receiverPhoneNumber]);

        const orderId = orderResult.rows[0].order_id;


        // insert into order items
        const orderItemResult = await client.query(`
            INSERT INTO ORDER_ITEM(ORDER_ID, UNIT_ID, UNIT_PRICE)
            SELECT $1, CI.UNIT_ID, P.PRICE
            FROM CART_ITEM CI
            JOIN PRODUCT_UNIT PU ON PU.UNIT_ID = CI.UNIT_ID
            JOIN PRODUCT P ON P.PRODUCT_ID = PU.PRODUCT_ID
            WHERE CI.CART_ID = $2
                AND PU.UNIT_STATUS = 'reserved'
                AND CI.RESERVED_UNTIL > CURRENT_TIMESTAMP
        `, [orderId, cartId]);

        if (orderItemResult.rowCount !== cartResult.rows.length) {
            throw new Error('Not all cart items were transferred to the order');
        }

        //total price
        const totalResult = await client.query(`
            SELECT COALESCE(SUM(UNIT_PRICE), 0) AS total
            FROM ORDER_ITEM
            WHERE ORDER_ID = $1
        `, [orderId]);

        const orderTotal = Number(totalResult.rows[0].total);

        //Insert into payment
        await client.query(`
        INSERT INTO PAYMENT (
            ORDER_ID,
            PAYMENT_METHOD,
            PAYMENT_STATUS,
            AMOUNT
        )
        VALUES ($1, 'cash_on_delivery', 'pending', $2)
        `, [orderId, orderTotal]);

        // update product unit
        await client.query(`
            UPDATE PRODUCT_UNIT PU
            SET UNIT_STATUS = 'sold'
            FROM CART_ITEM CI
            WHERE CI.CART_ID = $1
            AND CI.UNIT_ID = PU.UNIT_ID
            AND PU.UNIT_STATUS = 'reserved'
            AND CI.RESERVED_UNTIL > CURRENT_TIMESTAMP
        `, [cartId]);

        // delete cart
        await client.query(`
        DELETE FROM CART
        WHERE CART_ID = $1
        `, [cartId]);

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Order has been placed',
            order: orderResult.rows[0]
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({error: 'Database error'});
    } finally {
        client.release();
    }
};



module.exports = {
    postOrders
}
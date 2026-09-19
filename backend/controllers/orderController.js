const pool = require('../db');


// to do: add get order and payment handling and delivery handling

// helper function of completeOrder, assigns the oldest pending order to an available delivery.
const assignWaitingOrderToDeliveryBoy = async (client, deliveryBoyId) => {
    // Find the oldest pending order waiting for a delivery boy
    const pendingOrderResult = await client.query(`
        SELECT ORDER_ID
        FROM ORDERS
        WHERE STATUS = 'pending'
          AND DELIVERY_BOY_ID IS NULL
        ORDER BY CREATED_AT
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    `);

    // No pending order is waiting
    if (pendingOrderResult.rows.length === 0) {
        return null;
    }

    const orderId = pendingOrderResult.rows[0].order_id;

    // Assign the delivery boy to the order
    await client.query(`
        UPDATE ORDERS
        SET DELIVERY_BOY_ID = $1,
            STATUS = 'shipped'
        WHERE ORDER_ID = $2
    `, [deliveryBoyId, orderId]);

    // Mark the delivery boy as assigned
    await client.query(`
        UPDATE DELIVERY_BOY
        SET STATUS = 'assigned'
        WHERE DELIVERY_BOY_ID = $1
    `, [deliveryBoyId]);

    return orderId;
};

// admin marks an order to be completed, then the delivery boy is available again. If there is an order that is waiting for delivery boy, it will be assigned to the available delivery boy.
// POST /admin/orders/:orderId/complete
const completeOrder = async (req, res) => {
    const client = await pool.connect();

    try {
        const orderId = Number(req.params.orderId);

        if (!Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({
                error: 'Order ID must be a positive integer'
            });
        }

        await client.query('BEGIN');

        // Find the order
        const orderResult = await client.query(`
            SELECT ORDER_ID, DELIVERY_BOY_ID, STATUS
            FROM ORDERS
            WHERE ORDER_ID = $1
            FOR UPDATE
        `, [orderId]);

        if (orderResult.rows.length === 0) {
            await client.query('ROLLBACK');

            return res.status(404).json({
                error: 'Order not found'
            });
        }

        const order = orderResult.rows[0];

        // Only shipped orders can be completed
        if (order.status !== 'shipped') {
            await client.query('ROLLBACK');

            return res.status(400).json({
                error: 'Only shipped orders can be completed'
            });
        }

        // The order must have a delivery boy
        if (order.delivery_boy_id === null) {
            await client.query('ROLLBACK');

            return res.status(400).json({
                error: 'Order has no assigned delivery boy'
            });
        }
        // Check the payment associated with the order
        const paymentResult = await client.query(`
        SELECT PAYMENT_ID, PAYMENT_STATUS, PAYMENT_METHOD, AMOUNT
        FROM PAYMENT
        WHERE ORDER_ID = $1
        FOR UPDATE
        `, [orderId]);

        if (paymentResult.rows.length === 0) {
        await client.query('ROLLBACK');

        return res.status(400).json({
        error: 'Payment record not found'
    });
    }

    const payment = paymentResult.rows[0];

    if (payment.payment_method !== 'cash_on_delivery') {
    await client.query('ROLLBACK');

    return res.status(400).json({
        error: 'Order does not have a COD payment'
    });
    }

    if (payment.payment_status !== 'pending') {
        await client.query('ROLLBACK');

        return res.status(400).json({
            error: 'Payment has already been processed'
        });
    }

        // Mark the order as delivered
        await client.query(`
            UPDATE ORDERS
            SET STATUS = 'delivered',
                COMPLETED_AT = CURRENT_TIMESTAMP
            WHERE ORDER_ID = $1
        `, [orderId]);

        // Mark the COD payment as paid
        await client.query(`
            UPDATE PAYMENT
            SET PAYMENT_STATUS = 'paid',
            PAID_AT = CURRENT_TIMESTAMP
            WHERE PAYMENT_ID = $1
        `, [payment.payment_id]);

        // Make the delivery boy available
        await client.query(`
            UPDATE DELIVERY_BOY
            SET STATUS = 'available'
            WHERE DELIVERY_BOY_ID = $1
        `, [order.delivery_boy_id]);

        // Immediately assign the freed delivery boy
        // to the oldest waiting order
        const assignedOrderId =
            await assignWaitingOrderToDeliveryBoy(
                client,
                order.delivery_boy_id
            );

        await client.query('COMMIT');

        res.status(200).json({
            message: 'Order marked as delivered',
            reassignedOrderId: assignedOrderId
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


// Assign delivery boy to order
const assignAvailableDeliveryBoy = async (client, orderId) => {
    // Find one available delivery boy
    const deliveryBoyResult = await client.query(`
        SELECT DELIVERY_BOY_ID
        FROM DELIVERY_BOY
        WHERE STATUS = 'available'
        ORDER BY DELIVERY_BOY_ID
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    `);

    // No delivery boy is currently available
    if (deliveryBoyResult.rows.length === 0) {
        return null;
    }

    const deliveryBoyId = deliveryBoyResult.rows[0].delivery_boy_id;

    // Assign the delivery boy to the order
    await client.query(`
        UPDATE ORDERS
        SET DELIVERY_BOY_ID = $1,
            STATUS = 'shipped'
        WHERE ORDER_ID = $2
    `, [deliveryBoyId, orderId]);

    // Mark delivery boy as assigned
    await client.query(`
        UPDATE DELIVERY_BOY
        SET STATUS = 'assigned'
        WHERE DELIVERY_BOY_ID = $1
    `, [deliveryBoyId]);

    return deliveryBoyId;
};

// /api/orders
// Place an order with COD payment and automatic delivery assignment
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

        //automatic assign delivery boy
        const deliveryBoyId = await assignAvailableDeliveryBoy(client, orderId);

        if (!deliveryBoyId) {
            console.log('No available delivery boy at the moment. Order will be assigned later.');
        }
        
        // delete cart
        await client.query(`
        DELETE FROM CART
        WHERE CART_ID = $1
        `, [cartId]);

        await client.query('COMMIT');

        // Fetch the final order details to return in the response
        const finalOrderResult = await client.query(`
        SELECT *
        FROM ORDERS
        WHERE ORDER_ID = $1
        `, [orderId]);

        res.status(201).json({
        message: 'Order has been placed',
        order: finalOrderResult.rows[0]
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({error: 'Database error'});
    } finally {
        client.release();
    }
};

// GET /api/orders
const getOrders = async (req, res) => {
    try {
        const buyerId = req.session.buyerId;

        const ordersResult = await pool.query(`
            SELECT
                O.ORDER_ID,
                O.STATUS,
                O.RECEIVER_NAME,
                O.RECEIVER_PHONE_NUMBER,
                O.CREATED_AT,
                O.COMPLETED_AT,
                P.PAYMENT_METHOD,
                P.PAYMENT_STATUS,
                P.AMOUNT AS TOTAL_AMOUNT
            FROM ORDERS O
            LEFT JOIN PAYMENT P
                ON P.ORDER_ID = O.ORDER_ID
            WHERE O.BUYER_ID = $1
            ORDER BY O.CREATED_AT DESC
        `, [buyerId]);

        res.status(200).json({
            orders: ordersResult.rows
        });

    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
};

module.exports = {
    postOrders,
    completeOrder,
    getOrders
}
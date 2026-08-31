const pool = require('../db');
// assume buyer has already been authenticated







// POST /api/cart/items
const postCartItems = async (req, res) => {
    const buyerId = req.session.buyerId;
    const { productId, quantity } = req.body;
    const quantity_ = parseInt(quantity);

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const cartResult = await client.query(`
            SELECT *
            FROM CART
            WHERE BUYER_ID = $1
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
            LIMIT $2
        `, [productId, quantity_]);

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
            productId: productId,
            quantity: quantity
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
    try {
        const buyerID = req.session.buyerId;

        const result = await pool.query(`
            SELECT *
            FROM CART C JOIN CART_ITEM I ON C.CART_ID = I.CART_ID
            WHERE C.BUYER_ID = $1
        `, [buyerID]);

        res.status(200).json({
            message: 'viewing cart successful',
            cart: result.rows
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({error: 'Database error'})
    }
}


// DELETE /api/cart/items/:unitId
const deleteCartItem = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const buyerId = req.session.buyerId;
        const unitId = req.params.unitId;

        // check if buyer was cart with unitId
        const cartResult = await client.query(`
            SELECT *
            FROM CART C JOIN CART_ITEM I ON C.CART_ID = I.CART_ID
            WHERE C.BUYER_ID = $1 AND I.UNIT_ID = $2
        `, [buyerId, unitId]);

        if(cartResult.rows.length === 0){
            await client.query('ROLLBACK');
            res.status(400).json({error: 'item not in buyer cart'});
        }

        // delete from cart_item
        await client.query(`
            DELETE
            FROM CART_ITEM
            WHERE UNIT_ID = $1
        `, [unitId]);

        // update status
        await client.query(`
            UPDATE PRODUCT_UNIT
            SET UNIT_STATUS = 'available'
            WHERE UNIT_ID = $1
        `, [unitId]);

        await client.query('COMMIT');

        res.status(200).json({
            message: 'item deleted from cart',
            item: cartResult.rows
        })

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({error: 'Database error'});
    } finally {
        client.release();
    }
}

module.exports = {
    postCartItems,
    getCart,
    deleteCartItem
}
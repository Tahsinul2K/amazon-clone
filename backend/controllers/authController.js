const pool = require('../db');
const bcrypt = require('bcrypt');


/* 
  req.session will contain
    buyerId
    sellerId 
*/

// POST /api/register/seller
const postRegisterSeller = async (req, res) => {
    try {
        const { fullName, email, password, businessAddress } = req.body;

        // 10 salt rounds
        const passwordHash = await bcrypt.hash(password, 10);

        const result = await pool.query(`
            INSERT INTO SELLER (FULL_NAME, EMAIL, PASSWORD_HASH, BUSINESS_ADDRESS)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [fullName, email, passwordHash, businessAddress]);

        res.status(201).json({
            message: 'Seller account created successfully',
            seller: result.rows[0]
        });
        
    } catch (err) {
        console.error(err);
        res.status(500).json({error: 'Database error'});
    }
};


// POST /api/register/buyer
const postRegisterBuyer = async (req, res) => {
    try {
        const { fullName, email, password } = req.body;

        // 10 salt rounds
        const passwordHash = await bcrypt.hash(password, 10);

        const result = await pool.query(`
            INSERT INTO BUYER (FULL_NAME, EMAIL, PASSWORD_HASH)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [fullName, email, passwordHash]);

        res.status(201).json({
            message: 'Buyer account created successfully',
            buyer: result.rows[0]
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({error: 'Database error'});
    }
};

// login via email and password
// POST /api/login/seller
const postLoginSeller = async (req, res) => {
    try {
        const { email, password } = req.body;

        const result = await pool.query(`
            SELECT *
            FROM SELLER
            WHERE EMAIL = $1
        `, [email]);

        if (result.rows.length === 0) {
            return res.status(401).json({error: 'Invalid email'});
        }

        if (!(await bcrypt.compare(password, result.rows[0].password_hash))) {
            return res.status(401).json({error: 'Invalid password'});
        }

        req.session.sellerId = result.rows[0].seller_id;

        res.status(200).json({
            message: 'Seller login successful',
            seller: result.rows[0]
        })
    } catch (err) {
        console.error(err);
        res.status(500).json({message: 'Database error'});
    }
};



// login via email and password
// POST /api/login/buyer
const postLoginBuyer = async (req, res) => {
    try {
        const { email, password } = req.body;

        const result = await pool.query(`
            SELECT *
            FROM BUYER
            WHERE EMAIL = $1
        `, [email]);

        if (result.rows.length === 0) {
            return res.status(401).json({error: 'Invalid email'});
        }

        if (!(await bcrypt.compare(password, result.rows[0].password_hash))) {
            return res.status(401).json({error: 'Invalid password'});
        }

        req.session.buyerId = result.rows[0].buyer_id;

        res.status(200).json({
            message: 'Buyer login successful',
            buyer: result.rows[0]
        })
    } catch (err) {
        console.error(err);
        res.status(500).json({message: 'Database error'});
    }
};



module.exports = {
    postRegisterSeller,
    postRegisterBuyer,
    postLoginSeller,
    postLoginBuyer
}
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

        if (!fullName || !email || !password || !businessAddress) {
            return res.status(400).json({
            error: 'Full name, email, password and business address are required'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
            error: 'Password must be at least 8 characters'
            });
        }

        if (!email.includes('@')) {
            return res.status(400).json({
            error: 'Please provide a valid email address'
            });
        }
        // 10 salt rounds
        const passwordHash = await bcrypt.hash(password, 10);

        const result = await pool.query(`
            INSERT INTO SELLER (FULL_NAME, EMAIL, PASSWORD_HASH, BUSINESS_ADDRESS)
            VALUES ($1, $2, $3, $4)
            RETURNING SELLER_ID, FULL_NAME, EMAIL, BUSINESS_ADDRESS, CREATED_AT
        `, [fullName, email, passwordHash, businessAddress]);

        res.status(201).json({
            message: 'Seller account created successfully',
            seller: result.rows[0]
        });
        
    } catch (err) {
        console.error(err);

        if (err.code === '23505') {
        return res.status(409).json({
            error: 'An account with this email already exists'
        });
        }

        res.status(500).json({error: 'Database error'});
    }
};


// POST /api/register/buyer
const postRegisterBuyer = async (req, res) => {
    try {
        const { fullName, email, password } = req.body;

        if (!fullName || !email || !password) {
            return res.status(400).json({
            error: 'Full name, email and password are required'
            });
        }
        if (password.length < 8) {
            return res.status(400).json({
            error: 'Password must be at least 8 characters'
            });
        }
        if (!email.includes('@')) {
            return res.status(400).json({
            error: 'Please provide a valid email address'
            });
        }
        // 10 salt rounds
        const passwordHash = await bcrypt.hash(password, 10);

        const result = await pool.query(`
            INSERT INTO BUYER (FULL_NAME, EMAIL, PASSWORD_HASH)
            VALUES ($1, $2, $3)
            RETURNING BUYER_ID, FULL_NAME, EMAIL, CREATED_AT
        `, [fullName, email, passwordHash]);

        res.status(201).json({
            message: 'Buyer account created successfully',
            buyer: result.rows[0]
        });

    } catch (err) {
        console.error(err);

        if (err.code === '23505') {
        return res.status(409).json({
            error: 'An account with this email already exists'
        });
        }

        res.status(500).json({error: 'Database error'});
    }
};

// login via email and password
// POST /api/login/seller
const postLoginSeller = async (req, res) => {
    try {
        const { email, password } = req.body;

        const result = await pool.query(`
            SELECT SELLER_ID, FULL_NAME, EMAIL, PASSWORD_HASH, BUSINESS_ADDRESS
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
            seller: {
                seller_id: result.rows[0].seller_id,
                full_name: result.rows[0].full_name,
                email: result.rows[0].email,
                business_address: result.rows[0].business_address
            }
        })
    } catch (err) {
        console.error(err);

        res.status(500).json({error: 'Database error'});
    }
};



// login via email and password
// POST /api/login/buyer
const postLoginBuyer = async (req, res) => {
    try {
        const { email, password } = req.body;

        const result = await pool.query(`
            SELECT BUYER_ID, FULL_NAME, EMAIL, PASSWORD_HASH
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
            buyer: {
                buyer_id: result.rows[0].buyer_id,
                full_name: result.rows[0].full_name,
                email: result.rows[0].email
            }
        })
    } catch (err) {
        console.error(err);
        res.status(500).json({error: 'Database error'});
    }
};

const postLogout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({
                error: 'Could not log out'
            });
        }

        res.clearCookie('connect.sid');

        return res.status(200).json({
            message: 'Logout successful'
        });
    });
};

const postLoginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: 'Email and password are required'
            });
        }

        const result = await pool.query(`
            SELECT ADMIN_ID, FULL_NAME, EMAIL, PASSWORD_HASH
            FROM ADMIN
            WHERE EMAIL = $1
        `, [email]);

        if (result.rows.length === 0) {
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        const admin = result.rows[0];

        const passwordMatch = await bcrypt.compare(
            password,
            admin.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        req.session.adminId = admin.admin_id;

        res.status(200).json({
            message: 'Admin login successful',
            admin: {
                admin_id: admin.admin_id,
                full_name: admin.full_name,
                email: admin.email
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Database error'
        });
    }
};

module.exports = {
    postRegisterSeller,
    postRegisterBuyer,
    postLoginSeller,
    postLoginBuyer,
    postLogout,
    postLoginAdmin
}
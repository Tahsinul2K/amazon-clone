const express = require('express');
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');
const router = express.Router();

router.post('/register/seller', authController.postRegisterSeller);
router.post('/register/buyer', authController.postRegisterBuyer);
router.post('/login/seller', authController.postLoginSeller);
router.post('/login/buyer', authController.postLoginBuyer);
router.post('/logout', authController.postLogout);
router.post('/login/admin', authController.postLoginAdmin);

router.get('/admin/test', auth.requiresAdminAuth, (req, res) => {
    res.status(200).json({
        message: 'Admin authorization successful',
        adminId: req.session.adminId
    });
});
module.exports = router;
const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/register/seller', authController.postRegisterSeller);
router.post('/register/buyer', authController.postRegisterBuyer);
router.post('/login/seller', authController.postLoginSeller);
router.post('/login/buyer', authController.postLoginBuyer);



module.exports = router;
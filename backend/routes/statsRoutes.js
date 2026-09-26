const express = require('express');
const auth = require('../middleware/auth');
const statsController = require('../controllers/statsController');

const router = express.Router();

router.get(
    '/seller/stats',
    auth.requiresSellerAuth,
    statsController.getSellerStats
);

module.exports = router;

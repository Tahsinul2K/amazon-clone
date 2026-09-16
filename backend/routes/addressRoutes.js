const express = require('express');
const addressController = require('../controllers/addressController');
const auth = require('../middleware/auth');
const router = express.Router();

router.post('/address', auth.requiresBuyerAuth, addressController.addAddress);
router.get('/addresses', auth.requiresBuyerAuth, addressController.getAddresses);
router.get('/address/current', auth.requiresBuyerAuth, addressController.getCurrentAddress);
router.put('/address/:addressId/current', auth.requiresBuyerAuth, addressController.setCurrentAddress);
router.delete('/address/:addressId', auth.requiresBuyerAuth, addressController.deleteAddress);

module.exports = router;
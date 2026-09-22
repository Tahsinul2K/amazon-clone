const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const categoryController = require('../controllers/categoryController');

router.post(
    '/categories',
    auth.requiresAdminAuth,
    categoryController.createCategory
);

router.get(
    '/categories',
    auth.requiresAnyAuth,
    categoryController.getCategories
);

router.get(
    '/categories/:categoryId',
    auth.requiresAnyAuth,
    categoryController.getCategoryById
);

module.exports = router;
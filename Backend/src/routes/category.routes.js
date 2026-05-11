const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.use(verifyToken);

router.post('/create', categoryController.createCategory);
router.get('/list', categoryController.getCategories);
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;

const express = require('express');
const router = express.Router();
const tagController = require('../controllers/tag.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.use(verifyToken);

router.post('/create', tagController.createTag);
router.get('/list', tagController.getTags);
router.delete('/:id', tagController.deleteTag);

module.exports = router;

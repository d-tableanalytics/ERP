const express = require('express');
const router = express.Router();
const chatbotController = require('./chatbot.controller');
const { verifyToken } = require('../../middlewares/auth.middleware');

/**
 * Chatbot Routes
 * All routes require authentication
 */

// POST /api/chatbot/message - Send message to chatbot
router.post('/message', verifyToken, chatbotController.handleMessage);

// GET /api/chatbot/history - Get conversation history (future use)
router.get('/history', verifyToken, chatbotController.getHistory);

module.exports = router;
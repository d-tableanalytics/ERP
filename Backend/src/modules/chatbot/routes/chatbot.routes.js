const express = require('express');
const router = express.Router();

const { verifyToken } = require('../../../middlewares/auth.middleware');
const requestContext = require('../middleware/requestContext');
const rateLimit = require('../middleware/rateLimit');

const chatController = require('../controllers/chat.controller');
const streamController = require('../controllers/stream.controller');
const historyController = require('../controllers/history.controller');
const shareController = require('../controllers/share.controller');

/**
 * Chatbot routes (v2). Auth required for every endpoint.
 */

router.use(verifyToken);
router.use(requestContext);
router.use(rateLimit);

// JSON one-shot message (backward-compatible)
router.post('/message', chatController.handleMessage);

// SSE streaming variant
router.post('/stream', streamController.streamMessage);

// Sessions / history
router.get('/sessions', historyController.listSessions);
router.get('/history', historyController.getHistory);
router.get('/history/:sessionId', historyController.getHistory);
router.delete('/sessions/:sessionId', historyController.clearSession);

// Secure member-only share links
router.post('/chats/:chatId/share', shareController.createShareLink);
router.get('/share/:shareToken', shareController.loadSharedChat);
router.delete('/chats/:chatId/share', shareController.revokeShareLink);

module.exports = router;

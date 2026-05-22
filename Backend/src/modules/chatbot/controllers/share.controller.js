const shareService = require('../services/share.service');
const { resolveUserId } = require('../validators/permissions');
const logger = require('../utils/logger');

const log = logger.child({ controller: 'share' });

exports.createShareLink = async function (req, res) {
  try {
    const userId = resolveUserId(req.user);
    const { chatId } = req.params;
    log.info('createShareLink', { requestId: req.requestId, userId, chatId });

    const share = await shareService.createShareLink(chatId, userId);
    return res.status(201).json({
      success: true,
      shareToken: share.shareToken,
      shareUrl: `/erpgpt/share/${share.shareToken}`,
      expiresAt: share.expires_at,
    });
  } catch (err) {
    log.error('createShareLink failed', { requestId: req.requestId, error: err.message });
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to create share link',
    });
  }
};

exports.loadSharedChat = async function (req, res) {
  try {
    const userId = resolveUserId(req.user);
    const { shareToken } = req.params;
    log.info('loadSharedChat', { requestId: req.requestId, userId });

    const data = await shareService.loadSharedChat(shareToken, userId);
    return res.json({ success: true, ...data });
  } catch (err) {
    const status = err.status || 500;
    log.warn('loadSharedChat failed', { requestId: req.requestId, status, error: err.message });
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to load shared chat',
    });
  }
};

exports.revokeShareLink = async function (req, res) {
  try {
    const userId = resolveUserId(req.user);
    const { chatId } = req.params;
    log.info('revokeShareLink', { requestId: req.requestId, userId, chatId });

    await shareService.revokeShareLink(chatId, userId);
    return res.json({ success: true });
  } catch (err) {
    log.error('revokeShareLink failed', { requestId: req.requestId, error: err.message });
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to revoke share link',
    });
  }
};

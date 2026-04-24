const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// ══════════════════════════════════════════════════
// GET /api/notifications — List notifications (paginated)
// ══════════════════════════════════════════════════
router.get('/', auth, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  try {
    const r = await db.query(
      `SELECT n.id, n.type, n.message, n.is_read, n.created_at,
              n.reference_id, n.reference_type,
              n.from_user_id,
              u.email AS from_email,
              COALESCE(up.display_name, '') AS from_display_name
       FROM notifications n
       LEFT JOIN users u ON n.from_user_id = u.id
       LEFT JOIN user_profiles up ON n.from_user_id = up.user_id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    res.json({ notifications: r.rows, page, limit });
  } catch (e) {
    console.error('list notifications error', e);
    res.status(500).json({ error: 'Server error fetching notifications' });
  }
});

// ══════════════════════════════════════════════════
// GET /api/notifications/unread-count
// ══════════════════════════════════════════════════
router.get('/unread-count', auth, async (req, res) => {
  try {
    const r = await db.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    );
    res.json({ count: parseInt(r.rows[0].count) });
  } catch (e) {
    console.error('unread count error', e);
    res.status(500).json({ error: 'Server error fetching unread count' });
  }
});

// ══════════════════════════════════════════════════
// PUT /api/notifications/read-all — Mark all as read
// ══════════════════════════════════════════════════
router.put('/read-all', auth, async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (e) {
    console.error('read all error', e);
    res.status(500).json({ error: 'Server error marking notifications' });
  }
});

// ══════════════════════════════════════════════════
// PUT /api/notifications/:id/read — Mark single as read
// ══════════════════════════════════════════════════
router.put('/:id/read', auth, async (req, res) => {
  const notifId = parseInt(req.params.id);
  if (!Number.isFinite(notifId)) return res.status(400).json({ error: 'Invalid notification ID' });

  try {
    const r = await db.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING id',
      [notifId, req.user.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Notification not found' });

    res.json({ message: 'Notification marked as read' });
  } catch (e) {
    console.error('read notification error', e);
    res.status(500).json({ error: 'Server error marking notification' });
  }
});

module.exports = router;

const express = require('express');
const { z } = require('zod');
const db = require('../db');
const auth = require('../middleware/auth');
const { logSecurityEvent } = require('../middleware/securityLogs');

const router = express.Router();

// ── Helper: create notification ──
async function createNotification({ userId, type, fromUserId, referenceId, referenceType, message }) {
  if (userId === fromUserId) return;
  try {
    await db.query(
      `INSERT INTO notifications (user_id, type, from_user_id, reference_id, reference_type, message)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, type, fromUserId, referenceId || null, referenceType || null, message]
    );
  } catch (e) {
    console.error('notification insert failed', e.message);
  }
}

// ══════════════════════════════════════════════════
// GET /api/friends — List all accepted friends
// ══════════════════════════════════════════════════
router.get('/', auth, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT f.friend_id AS id, u.email, f.created_at AS friends_since,
              COALESCE(up.display_name, '') AS display_name,
              up.avatar_file_id
       FROM friends f
       JOIN users u ON f.friend_id = u.id
       LEFT JOIN user_profiles up ON f.friend_id = up.user_id
       WHERE f.user_id = $1 AND f.status = 'ACCEPTED'
       ORDER BY COALESCE(up.display_name, u.email) ASC`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (e) {
    console.error('list friends error', e);
    res.status(500).json({ error: 'Server error fetching friends' });
  }
});

// ══════════════════════════════════════════════════
// GET /api/friends/requests — Incoming pending requests
// ══════════════════════════════════════════════════
router.get('/requests', auth, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT f.user_id AS id, u.email, f.created_at,
              COALESCE(up.display_name, '') AS display_name,
              up.avatar_file_id
       FROM friends f
       JOIN users u ON f.user_id = u.id
       LEFT JOIN user_profiles up ON f.user_id = up.user_id
       WHERE f.friend_id = $1 AND f.status = 'PENDING'
       ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (e) {
    console.error('list friend requests error', e);
    res.status(500).json({ error: 'Server error fetching friend requests' });
  }
});

// ══════════════════════════════════════════════════
// POST /api/friends/request — Send friend request
// ══════════════════════════════════════════════════
router.post('/request', auth, async (req, res) => {
  const parsed = z.object({ user_id: z.coerce.number().int().positive() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request' });

  const targetId = parsed.data.user_id;
  if (targetId === req.user.id) return res.status(400).json({ error: 'Cannot send friend request to yourself' });

  try {
    // Check if target exists
    const userCheck = await db.query('SELECT id FROM users WHERE id = $1 AND is_verified = TRUE', [targetId]);
    if (userCheck.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    // Check if blocked by target
    const blocked = await db.query(
      `SELECT 1 FROM friends WHERE user_id = $1 AND friend_id = $2 AND status = 'BLOCKED'`,
      [targetId, req.user.id]
    );
    if (blocked.rows.length > 0) return res.status(403).json({ error: 'Unable to send friend request' });

    // Check existing relationship
    const existing = await db.query(
      `SELECT status FROM friends WHERE user_id = $1 AND friend_id = $2`,
      [req.user.id, targetId]
    );
    if (existing.rows.length > 0) {
      const status = existing.rows[0].status;
      if (status === 'ACCEPTED') return res.status(400).json({ error: 'Already friends' });
      if (status === 'PENDING') return res.status(400).json({ error: 'Friend request already sent' });
      if (status === 'BLOCKED') return res.status(400).json({ error: 'You have blocked this user' });
    }

    // Check if incoming request exists (auto-accept)
    const incoming = await db.query(
      `SELECT status FROM friends WHERE user_id = $1 AND friend_id = $2 AND status = 'PENDING'`,
      [targetId, req.user.id]
    );

    if (incoming.rows.length > 0) {
      // Auto-accept: both directions
      await db.query(
        `UPDATE friends SET status = 'ACCEPTED' WHERE user_id = $1 AND friend_id = $2`,
        [targetId, req.user.id]
      );
      await db.query(
        `INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, 'ACCEPTED')
         ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'ACCEPTED'`,
        [req.user.id, targetId]
      );

      await createNotification({
        userId: targetId,
        type: 'FRIEND_ACCEPTED',
        fromUserId: req.user.id,
        message: 'accepted your friend request',
      });
      await logSecurityEvent({ userId: req.user.id, eventType: 'FRIEND_REQUEST_ACCEPTED', req, metadata: { targetId } });
      return res.json({ message: 'Friend request accepted (mutual)', status: 'ACCEPTED' });
    }

    // Create pending request
    await db.query(
      `INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, 'PENDING')
       ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'PENDING'`,
      [req.user.id, targetId]
    );

    await createNotification({
      userId: targetId,
      type: 'FRIEND_REQUEST',
      fromUserId: req.user.id,
      message: 'sent you a friend request',
    });

    await logSecurityEvent({ userId: req.user.id, eventType: 'FRIEND_REQUEST_SENT', req, metadata: { targetId } });
    res.json({ message: 'Friend request sent', status: 'PENDING' });
  } catch (e) {
    console.error('send friend request error', e);
    res.status(500).json({ error: 'Server error sending friend request' });
  }
});

// ══════════════════════════════════════════════════
// POST /api/friends/accept — Accept a friend request
// ══════════════════════════════════════════════════
router.post('/accept', auth, async (req, res) => {
  const parsed = z.object({ user_id: z.coerce.number().int().positive() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request' });

  const senderId = parsed.data.user_id;

  try {
    // Check incoming pending
    const pending = await db.query(
      `SELECT 1 FROM friends WHERE user_id = $1 AND friend_id = $2 AND status = 'PENDING'`,
      [senderId, req.user.id]
    );
    if (pending.rows.length === 0) return res.status(404).json({ error: 'No pending friend request from this user' });

    // Accept: update sender row and insert reverse
    await db.query(
      `UPDATE friends SET status = 'ACCEPTED' WHERE user_id = $1 AND friend_id = $2`,
      [senderId, req.user.id]
    );
    await db.query(
      `INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, 'ACCEPTED')
       ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'ACCEPTED'`,
      [req.user.id, senderId]
    );

    await createNotification({
      userId: senderId,
      type: 'FRIEND_ACCEPTED',
      fromUserId: req.user.id,
      message: 'accepted your friend request',
    });

    await logSecurityEvent({ userId: req.user.id, eventType: 'FRIEND_REQUEST_ACCEPTED', req, metadata: { senderId } });
    res.json({ message: 'Friend request accepted' });
  } catch (e) {
    console.error('accept friend request error', e);
    res.status(500).json({ error: 'Server error accepting friend request' });
  }
});

// ══════════════════════════════════════════════════
// POST /api/friends/reject — Reject a friend request
// ══════════════════════════════════════════════════
router.post('/reject', auth, async (req, res) => {
  const parsed = z.object({ user_id: z.coerce.number().int().positive() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request' });

  const senderId = parsed.data.user_id;

  try {
    await db.query(
      `DELETE FROM friends WHERE user_id = $1 AND friend_id = $2 AND status = 'PENDING'`,
      [senderId, req.user.id]
    );

    await logSecurityEvent({ userId: req.user.id, eventType: 'FRIEND_REQUEST_REJECTED', req, metadata: { senderId } });
    res.json({ message: 'Friend request rejected' });
  } catch (e) {
    console.error('reject friend request error', e);
    res.status(500).json({ error: 'Server error rejecting friend request' });
  }
});

// ══════════════════════════════════════════════════
// POST /api/friends/block — Block a user
// ══════════════════════════════════════════════════
router.post('/block', auth, async (req, res) => {
  const parsed = z.object({ user_id: z.coerce.number().int().positive() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request' });

  const targetId = parsed.data.user_id;
  if (targetId === req.user.id) return res.status(400).json({ error: 'Cannot block yourself' });

  try {
    // Remove any existing friendship in both directions  
    await db.query('DELETE FROM friends WHERE user_id = $1 AND friend_id = $2', [targetId, req.user.id]);
    
    // Set block from user -> target
    await db.query(
      `INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, 'BLOCKED')
       ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'BLOCKED'`,
      [req.user.id, targetId]
    );

    await logSecurityEvent({ userId: req.user.id, eventType: 'USER_BLOCKED', req, metadata: { targetId } });
    res.json({ message: 'User blocked' });
  } catch (e) {
    console.error('block user error', e);
    res.status(500).json({ error: 'Server error blocking user' });
  }
});

// ══════════════════════════════════════════════════
// DELETE /api/friends/:friendId — Remove friend
// ══════════════════════════════════════════════════
router.delete('/:friendId', auth, async (req, res) => {
  const friendId = parseInt(req.params.friendId);
  if (!Number.isFinite(friendId)) return res.status(400).json({ error: 'Invalid friend ID' });

  try {
    await db.query('DELETE FROM friends WHERE user_id = $1 AND friend_id = $2', [req.user.id, friendId]);
    await db.query('DELETE FROM friends WHERE user_id = $1 AND friend_id = $2', [friendId, req.user.id]);

    await logSecurityEvent({ userId: req.user.id, eventType: 'FRIEND_REMOVED', req, metadata: { friendId } });
    res.json({ message: 'Friend removed' });
  } catch (e) {
    console.error('remove friend error', e);
    res.status(500).json({ error: 'Server error removing friend' });
  }
});

module.exports = router;

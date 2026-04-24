const express = require('express');
const { z } = require('zod');
const db = require('../db');
const auth = require('../middleware/auth');
const { logSecurityEvent } = require('../middleware/securityLogs');

const router = express.Router();

const PrivacyLevel = z.enum(['PUBLIC', 'FRIENDS_ONLY', 'PRIVATE']);
const settingsSchema = z.object({
  profile_visibility: PrivacyLevel.optional(),
  post_visibility: PrivacyLevel.optional(),
  contact_visibility: PrivacyLevel.optional(),
});

router.get('/settings', auth, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT profile_visibility, post_visibility, contact_visibility
       FROM privacy_settings WHERE user_id = $1`,
      [req.user.id]
    );
    if (r.rows.length === 0) {
      // lazy-create defaults
      await db.query('INSERT INTO privacy_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [req.user.id]);
      return res.json({ profile_visibility: 'PUBLIC', post_visibility: 'FRIENDS_ONLY', contact_visibility: 'PRIVATE' });
    }
    res.json(r.rows[0]);
  } catch (e) {
    console.error('privacy get settings error', e);
    res.status(500).json({ error: 'Server error fetching privacy settings' });
  }
});

router.put('/settings', auth, async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid privacy settings' });

  const { profile_visibility, post_visibility, contact_visibility } = parsed.data;

  try {
    await db.query('INSERT INTO privacy_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [req.user.id]);

    const r = await db.query(
      `UPDATE privacy_settings
       SET profile_visibility = COALESCE($2, profile_visibility),
           post_visibility = COALESCE($3, post_visibility),
           contact_visibility = COALESCE($4, contact_visibility)
       WHERE user_id = $1
       RETURNING profile_visibility, post_visibility, contact_visibility`,
      [req.user.id, profile_visibility || null, post_visibility || null, contact_visibility || null]
    );

    await logSecurityEvent({ userId: req.user.id, eventType: 'PRIVACY_SETTINGS_UPDATED', req });
    res.json(r.rows[0]);
  } catch (e) {
    console.error('privacy update settings error', e);
    res.status(500).json({ error: 'Server error updating privacy settings' });
  }
});

// Profile view with privacy enforcement (friend graph not implemented -> FRIENDS_ONLY treated as PRIVATE)
router.get('/profile/view/:userId', auth, async (req, res) => {
  const targetUserId = Number(req.params.userId);
  if (!Number.isFinite(targetUserId)) return res.status(400).json({ error: 'Invalid userId' });

  try {
    const userRes = await db.query('SELECT id, email, created_at FROM users WHERE id = $1', [targetUserId]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const settingsRes = await db.query(
      `SELECT profile_visibility, contact_visibility
       FROM privacy_settings WHERE user_id = $1`,
      [targetUserId]
    );
    const settings = settingsRes.rows[0] || { profile_visibility: 'PUBLIC', contact_visibility: 'PRIVATE' };

    const isSelf = req.user.id === targetUserId;
    let isFriend = false;
    if (!isSelf) {
      const fr = await db.query(
        `SELECT 1 FROM friends
         WHERE user_id = $1 AND friend_id = $2 AND status = 'ACCEPTED'`,
        [targetUserId, req.user.id]
      );
      isFriend = fr.rows.length > 0;
    }

    const profileVisible =
      isSelf ||
      settings.profile_visibility === 'PUBLIC' ||
      (settings.profile_visibility === 'FRIENDS_ONLY' && isFriend);

    if (!profileVisible) return res.status(403).json({ error: 'Profile is not visible' });

    const contactVisible =
      isSelf ||
      settings.contact_visibility === 'PUBLIC' ||
      (settings.contact_visibility === 'FRIENDS_ONLY' && isFriend);

    res.json({
      id: userRes.rows[0].id,
      created_at: userRes.rows[0].created_at,
      email: contactVisible ? userRes.rows[0].email : null,
      privacy: settings,
    });
  } catch (e) {
    console.error('profile view error', e);
    res.status(500).json({ error: 'Server error fetching profile' });
  }
});

module.exports = router;

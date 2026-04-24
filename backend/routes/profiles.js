const express = require('express');
const { z } = require('zod');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const auth = require('../middleware/auth');
const { logSecurityEvent } = require('../middleware/securityLogs');
const { searchLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const UPLOADS_DIR = path.join(__dirname, '../encrypted_uploads');
const ALLOWED_AVATAR_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB for avatars

const profileSchema = z.object({
  display_name: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
});

// ── Helper: ensure profile row exists ──
async function ensureProfile(userId) {
  await db.query(
    'INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING',
    [userId]
  );
}

// ══════════════════════════════════════════════════
// GET /api/profiles/me — Own profile
// ══════════════════════════════════════════════════
router.get('/me', auth, async (req, res) => {
  try {
    await ensureProfile(req.user.id);
    const r = await db.query(
      `SELECT up.display_name, up.bio, up.avatar_file_id, up.updated_at,
              u.email, u.created_at
       FROM user_profiles up
       JOIN users u ON up.user_id = u.id
       WHERE up.user_id = $1`,
      [req.user.id]
    );
    res.json(r.rows[0]);
  } catch (e) {
    console.error('get profile error', e);
    res.status(500).json({ error: 'Server error fetching profile' });
  }
});

// ══════════════════════════════════════════════════
// PUT /api/profiles/me — Update profile
// ══════════════════════════════════════════════════
router.put('/me', auth, async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid profile data' });

  const { display_name, bio } = parsed.data;

  try {
    await ensureProfile(req.user.id);
    const r = await db.query(
      `UPDATE user_profiles
       SET display_name = COALESCE($2, display_name),
           bio = COALESCE($3, bio),
           updated_at = NOW()
       WHERE user_id = $1
       RETURNING display_name, bio, avatar_file_id, updated_at`,
      [req.user.id, display_name !== undefined ? display_name : null, bio !== undefined ? bio : null]
    );

    await logSecurityEvent({ userId: req.user.id, eventType: 'PROFILE_UPDATED', req });
    res.json(r.rows[0]);
  } catch (e) {
    console.error('update profile error', e);
    res.status(500).json({ error: 'Server error updating profile' });
  }
});

// ══════════════════════════════════════════════════
// POST /api/profiles/me/avatar — Upload avatar
// ══════════════════════════════════════════════════
router.post('/me/avatar', auth, upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!ALLOWED_AVATAR_MIME.has(req.file.mimetype)) {
    return res.status(400).json({ error: 'Only PNG, JPEG, or WebP images are allowed' });
  }

  try {
    // Encrypt the avatar using AES-256-GCM (same pipeline as files)
    const fileKey = crypto.randomBytes(32);
    const wrappedKey = Buffer.from(fileKey).toString('base64');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, fileKey, iv);
    const encryptedBuffer = Buffer.concat([cipher.update(req.file.buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

    const filename = `avatar-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.enc`;
    const encryptedPath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(encryptedPath, encryptedBuffer);

    // Store in files table
    const fileRes = await db.query(
      `INSERT INTO files (user_id, filename, original_name, mime_type, size, encrypted_path, encryption_key, iv, auth_tag, file_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [req.user.id, filename, req.file.originalname || 'avatar', req.file.mimetype, req.file.size,
       encryptedPath, wrappedKey, iv.toString('hex'), authTag.toString('hex'), fileHash]
    );

    // Link to profile
    await ensureProfile(req.user.id);
    await db.query(
      'UPDATE user_profiles SET avatar_file_id = $2, updated_at = NOW() WHERE user_id = $1',
      [req.user.id, fileRes.rows[0].id]
    );

    await logSecurityEvent({ userId: req.user.id, eventType: 'AVATAR_UPLOADED', req });
    res.json({ message: 'Avatar uploaded', fileId: fileRes.rows[0].id });
  } catch (e) {
    console.error('avatar upload error', e);
    res.status(500).json({ error: 'Server error uploading avatar' });
  }
});

// ══════════════════════════════════════════════════
// GET /api/profiles/search?q= — Search users
// ══════════════════════════════════════════════════
router.get('/search', auth, searchLimiter, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.status(400).json({ error: 'Search query must be at least 2 characters' });

  // Escape SQL LIKE wildcards to prevent search manipulation
  const escapedQ = q.replace(/[%_\\]/g, '\\$&');

  try {
    const r = await db.query(
      `SELECT u.id, u.email, u.created_at,
              COALESCE(up.display_name, '') AS display_name,
              up.avatar_file_id
       FROM users u
       LEFT JOIN user_profiles up ON u.id = up.user_id
       WHERE u.is_verified = TRUE
         AND u.id != $1
         AND (u.email ILIKE $2 OR COALESCE(up.display_name, '') ILIKE $2)
       ORDER BY u.email ASC
       LIMIT 20`,
      [req.user.id, `%${escapedQ}%`]
    );

    res.json(r.rows);
  } catch (e) {
    console.error('search users error', e);
    res.status(500).json({ error: 'Server error searching users' });
  }
});

// ══════════════════════════════════════════════════
// GET /api/profiles/:userId — View profile (privacy enforced)
// ══════════════════════════════════════════════════
router.get('/:userId', auth, async (req, res) => {
  const targetUserId = parseInt(req.params.userId);
  if (!Number.isFinite(targetUserId)) return res.status(400).json({ error: 'Invalid userId' });

  try {
    const userRes = await db.query(
      `SELECT u.id, u.email, u.created_at,
              COALESCE(up.display_name, '') AS display_name,
              COALESCE(up.bio, '') AS bio,
              up.avatar_file_id
       FROM users u
       LEFT JOIN user_profiles up ON u.id = up.user_id
       WHERE u.id = $1`,
      [targetUserId]
    );
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const target = userRes.rows[0];
    const isSelf = req.user.id === targetUserId;

    // Privacy settings
    const settingsRes = await db.query(
      'SELECT profile_visibility, post_visibility, contact_visibility FROM privacy_settings WHERE user_id = $1',
      [targetUserId]
    );
    const settings = settingsRes.rows[0] || { profile_visibility: 'PUBLIC', post_visibility: 'FRIENDS_ONLY', contact_visibility: 'PRIVATE' };

    let isFriend = false;
    let friendStatus = null;
    if (!isSelf) {
      const fr = await db.query(
        `SELECT status FROM friends WHERE user_id = $1 AND friend_id = $2`,
        [req.user.id, targetUserId]
      );
      if (fr.rows.length > 0) {
        friendStatus = fr.rows[0].status;
        isFriend = friendStatus === 'ACCEPTED';
      }
      // Also check reverse direction for pending incoming requests
      if (!friendStatus) {
        const fr2 = await db.query(
          `SELECT status FROM friends WHERE user_id = $1 AND friend_id = $2`,
          [targetUserId, req.user.id]
        );
        if (fr2.rows.length > 0) {
          friendStatus = fr2.rows[0].status === 'ACCEPTED' ? 'ACCEPTED' : 'PENDING_INCOMING';
          isFriend = fr2.rows[0].status === 'ACCEPTED';
        }
      }
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

    // Get recent posts if visible
    let posts = [];
    const postsVisible =
      isSelf ||
      settings.post_visibility === 'PUBLIC' ||
      (settings.post_visibility === 'FRIENDS_ONLY' && isFriend);

    if (postsVisible) {
      // Show PUBLIC posts always, FRIENDS_ONLY if friend, PRIVATE only if self
      let postQuery;
      if (isSelf) {
        postQuery = await db.query(
          `SELECT p.id, p.content, p.image_file_id, p.visibility, p.created_at,
                  (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
                  (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comment_count,
                  EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $2) AS liked_by_me
           FROM posts p WHERE p.author_id = $1 ORDER BY p.created_at DESC LIMIT 20`,
          [targetUserId, req.user.id]
        );
      } else if (isFriend) {
        postQuery = await db.query(
          `SELECT p.id, p.content, p.image_file_id, p.visibility, p.created_at,
                  (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
                  (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comment_count,
                  EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $2) AS liked_by_me
           FROM posts p WHERE p.author_id = $1 AND p.visibility IN ('PUBLIC','FRIENDS_ONLY') ORDER BY p.created_at DESC LIMIT 20`,
          [targetUserId, req.user.id]
        );
      } else {
        postQuery = await db.query(
          `SELECT p.id, p.content, p.image_file_id, p.visibility, p.created_at,
                  (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
                  (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comment_count,
                  EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $2) AS liked_by_me
           FROM posts p WHERE p.author_id = $1 AND p.visibility = 'PUBLIC' ORDER BY p.created_at DESC LIMIT 20`,
          [targetUserId, req.user.id]
        );
      }
      posts = postQuery.rows;
    }

    // Count friends
    const friendCountRes = await db.query(
      `SELECT COUNT(*) FROM friends WHERE user_id = $1 AND status = 'ACCEPTED'`,
      [targetUserId]
    );

    res.json({
      id: target.id,
      display_name: target.display_name,
      bio: target.bio,
      avatar_file_id: target.avatar_file_id,
      email: contactVisible ? target.email : null,
      created_at: target.created_at,
      friend_count: parseInt(friendCountRes.rows[0].count),
      friend_status: isSelf ? 'SELF' : (friendStatus || 'NONE'),
      is_friend: isFriend,
      privacy: settings,
      posts,
    });
  } catch (e) {
    console.error('profile view error', e);
    res.status(500).json({ error: 'Server error fetching profile' });
  }
});

module.exports = router;

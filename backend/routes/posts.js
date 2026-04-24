const express = require('express');
const { z } = require('zod');
const db = require('../db');
const auth = require('../middleware/auth');
const { logSecurityEvent } = require('../middleware/securityLogs');
const { postLimiter, commentLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

// ── Validation Schemas ──
const createPostSchema = z.object({
  content: z.string().min(1).max(5000),
  visibility: z.enum(['PUBLIC', 'FRIENDS_ONLY', 'PRIVATE']).optional().default('FRIENDS_ONLY'),
  image_file_id: z.coerce.number().int().positive().optional(),
});

const updatePostSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  visibility: z.enum(['PUBLIC', 'FRIENDS_ONLY', 'PRIVATE']).optional(),
});

const commentSchema = z.object({
  content: z.string().min(1).max(2000),
});

// ── Helper: check if two users are friends ──
async function areFriends(userId1, userId2) {
  const r = await db.query(
    `SELECT 1 FROM friends
     WHERE user_id = $1 AND friend_id = $2 AND status = 'ACCEPTED'`,
    [userId1, userId2]
  );
  return r.rows.length > 0;
}

// ── Helper: check post visibility for a viewer ──
async function canViewPost(post, viewerId) {
  if (post.author_id === viewerId) return true;
  if (post.visibility === 'PUBLIC') return true;
  if (post.visibility === 'PRIVATE') return false;
  if (post.visibility === 'FRIENDS_ONLY') {
    return areFriends(post.author_id, viewerId);
  }
  return false;
}

// ── Helper: create notification ──
async function createNotification({ userId, type, fromUserId, referenceId, referenceType, message }) {
  if (userId === fromUserId) return; // Don't notify yourself
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
// POST /api/posts — Create a new post
// ══════════════════════════════════════════════════
router.post('/', auth, postLimiter, async (req, res) => {
  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid post data', details: parsed.error.flatten() });

  const { content, visibility, image_file_id } = parsed.data;

  try {
    // If image attached, verify ownership
    if (image_file_id) {
      const imgCheck = await db.query('SELECT id FROM files WHERE id = $1 AND user_id = $2', [image_file_id, req.user.id]);
      if (imgCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Image file not found or not owned by you' });
      }
    }

    const r = await db.query(
      `INSERT INTO posts (author_id, content, image_file_id, visibility)
       VALUES ($1, $2, $3, $4)
       RETURNING id, content, image_file_id, visibility, created_at`,
      [req.user.id, content, image_file_id || null, visibility]
    );

    await logSecurityEvent({ userId: req.user.id, eventType: 'POST_CREATED', req, metadata: { postId: r.rows[0].id } });
    res.status(201).json(r.rows[0]);
  } catch (e) {
    console.error('create post error', e);
    res.status(500).json({ error: 'Server error creating post' });
  }
});

// ══════════════════════════════════════════════════
// GET /api/posts/feed — Privacy-aware news feed
// ══════════════════════════════════════════════════
router.get('/feed', auth, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  try {
    // Get friend IDs
    const friendsRes = await db.query(
      `SELECT friend_id FROM friends WHERE user_id = $1 AND status = 'ACCEPTED'`,
      [req.user.id]
    );
    const friendIds = friendsRes.rows.map(r => r.friend_id);

    let query, params;

    if (friendIds.length > 0) {
      // Show: own posts + friends' FRIENDS_ONLY & PUBLIC + anyone's PUBLIC
      query = `
        SELECT p.id, p.author_id, p.content, p.image_file_id, p.visibility, p.created_at, p.updated_at,
               u.email AS author_email,
               COALESCE(up.display_name, '') AS author_display_name,
               up.avatar_file_id AS author_avatar_file_id,
               (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
               (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comment_count,
               EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $1) AS liked_by_me
        FROM posts p
        JOIN users u ON p.author_id = u.id
        LEFT JOIN user_profiles up ON p.author_id = up.user_id
        WHERE (
          p.author_id = $1
          OR (p.visibility = 'PUBLIC')
          OR (p.visibility = 'FRIENDS_ONLY' AND p.author_id = ANY($2::bigint[]))
        )
        ORDER BY p.created_at DESC
        LIMIT $3 OFFSET $4
      `;
      params = [req.user.id, friendIds, limit, offset];
    } else {
      // No friends: show own posts + anyone's PUBLIC
      query = `
        SELECT p.id, p.author_id, p.content, p.image_file_id, p.visibility, p.created_at, p.updated_at,
               u.email AS author_email,
               COALESCE(up.display_name, '') AS author_display_name,
               up.avatar_file_id AS author_avatar_file_id,
               (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
               (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comment_count,
               EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $1) AS liked_by_me
        FROM posts p
        JOIN users u ON p.author_id = u.id
        LEFT JOIN user_profiles up ON p.author_id = up.user_id
        WHERE (p.author_id = $1 OR p.visibility = 'PUBLIC')
        ORDER BY p.created_at DESC
        LIMIT $2 OFFSET $3
      `;
      params = [req.user.id, limit, offset];
    }

    const r = await db.query(query, params);
    res.json({ posts: r.rows, page, limit });
  } catch (e) {
    console.error('feed error', e);
    res.status(500).json({ error: 'Server error fetching feed' });
  }
});

// ══════════════════════════════════════════════════
// GET /api/posts/:id — Single post (privacy checked)
// ══════════════════════════════════════════════════
router.get('/:id', auth, async (req, res) => {
  const postId = parseInt(req.params.id);
  if (!Number.isFinite(postId)) return res.status(400).json({ error: 'Invalid post ID' });

  try {
    const r = await db.query(
      `SELECT p.*, u.email AS author_email,
              COALESCE(up.display_name, '') AS author_display_name,
              up.avatar_file_id AS author_avatar_file_id,
              (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comment_count,
              EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $2) AS liked_by_me
       FROM posts p
       JOIN users u ON p.author_id = u.id
       LEFT JOIN user_profiles up ON p.author_id = up.user_id
       WHERE p.id = $1`,
      [postId, req.user.id]
    );

    if (r.rows.length === 0) return res.status(404).json({ error: 'Post not found' });

    const post = r.rows[0];
    const allowed = await canViewPost(post, req.user.id);
    if (!allowed) return res.status(403).json({ error: 'You do not have permission to view this post' });

    res.json(post);
  } catch (e) {
    console.error('get post error', e);
    res.status(500).json({ error: 'Server error fetching post' });
  }
});

// ══════════════════════════════════════════════════
// PUT /api/posts/:id — Edit own post
// ══════════════════════════════════════════════════
router.put('/:id', auth, async (req, res) => {
  const postId = parseInt(req.params.id);
  if (!Number.isFinite(postId)) return res.status(400).json({ error: 'Invalid post ID' });

  const parsed = updatePostSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid post data' });

  const { content, visibility } = parsed.data;

  try {
    const r = await db.query(
      `UPDATE posts
       SET content = COALESCE($3, content),
           visibility = COALESCE($4, visibility),
           updated_at = NOW()
       WHERE id = $1 AND author_id = $2
       RETURNING id, content, visibility, updated_at`,
      [postId, req.user.id, content || null, visibility || null]
    );

    if (r.rows.length === 0) return res.status(404).json({ error: 'Post not found or not owned by you' });

    await logSecurityEvent({ userId: req.user.id, eventType: 'POST_UPDATED', req, metadata: { postId } });
    res.json(r.rows[0]);
  } catch (e) {
    console.error('update post error', e);
    res.status(500).json({ error: 'Server error updating post' });
  }
});

// ══════════════════════════════════════════════════
// DELETE /api/posts/:id — Delete own post
// ══════════════════════════════════════════════════
router.delete('/:id', auth, async (req, res) => {
  const postId = parseInt(req.params.id);
  if (!Number.isFinite(postId)) return res.status(400).json({ error: 'Invalid post ID' });

  try {
    const r = await db.query('DELETE FROM posts WHERE id = $1 AND author_id = $2 RETURNING id', [postId, req.user.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Post not found or not owned by you' });

    await logSecurityEvent({ userId: req.user.id, eventType: 'POST_DELETED', req, metadata: { postId } });
    res.json({ message: 'Post deleted' });
  } catch (e) {
    console.error('delete post error', e);
    res.status(500).json({ error: 'Server error deleting post' });
  }
});

// ══════════════════════════════════════════════════
// POST /api/posts/:id/like — Like a post
// ══════════════════════════════════════════════════
router.post('/:id/like', auth, async (req, res) => {
  const postId = parseInt(req.params.id);
  if (!Number.isFinite(postId)) return res.status(400).json({ error: 'Invalid post ID' });

  try {
    // Check post exists and viewer can see it
    const postRes = await db.query('SELECT * FROM posts WHERE id = $1', [postId]);
    if (postRes.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    const post = postRes.rows[0];
    const allowed = await canViewPost(post, req.user.id);
    if (!allowed) return res.status(403).json({ error: 'Cannot like a post you cannot view' });

    await db.query(
      'INSERT INTO likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.id, postId]
    );

    // Notify author
    await createNotification({
      userId: post.author_id,
      type: 'LIKE',
      fromUserId: req.user.id,
      referenceId: postId,
      referenceType: 'post',
      message: 'liked your post',
    });

    const countRes = await db.query('SELECT COUNT(*) FROM likes WHERE post_id = $1', [postId]);
    await logSecurityEvent({ userId: req.user.id, eventType: 'POST_LIKED', req, metadata: { postId } });
    res.json({ liked: true, like_count: parseInt(countRes.rows[0].count) });
  } catch (e) {
    console.error('like post error', e);
    res.status(500).json({ error: 'Server error liking post' });
  }
});

// ══════════════════════════════════════════════════
// DELETE /api/posts/:id/like — Unlike a post
// ══════════════════════════════════════════════════
router.delete('/:id/like', auth, async (req, res) => {
  const postId = parseInt(req.params.id);
  if (!Number.isFinite(postId)) return res.status(400).json({ error: 'Invalid post ID' });

  try {
    await db.query('DELETE FROM likes WHERE user_id = $1 AND post_id = $2', [req.user.id, postId]);

    const countRes = await db.query('SELECT COUNT(*) FROM likes WHERE post_id = $1', [postId]);
    await logSecurityEvent({ userId: req.user.id, eventType: 'POST_UNLIKED', req, metadata: { postId } });
    res.json({ liked: false, like_count: parseInt(countRes.rows[0].count) });
  } catch (e) {
    console.error('unlike post error', e);
    res.status(500).json({ error: 'Server error unliking post' });
  }
});

// ══════════════════════════════════════════════════
// GET /api/posts/:id/comments — Get comments
// ══════════════════════════════════════════════════
router.get('/:id/comments', auth, async (req, res) => {
  const postId = parseInt(req.params.id);
  if (!Number.isFinite(postId)) return res.status(400).json({ error: 'Invalid post ID' });

  try {
    // Ensure viewer can see the post
    const postRes = await db.query('SELECT * FROM posts WHERE id = $1', [postId]);
    if (postRes.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    const post = postRes.rows[0];
    const allowed = await canViewPost(post, req.user.id);
    if (!allowed) return res.status(403).json({ error: 'Cannot view comments on this post' });

    const r = await db.query(
      `SELECT c.id, c.content, c.created_at, c.author_id,
              u.email AS author_email,
              COALESCE(up.display_name, '') AS author_display_name
       FROM comments c
       JOIN users u ON c.author_id = u.id
       LEFT JOIN user_profiles up ON c.author_id = up.user_id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC
       LIMIT 200`,
      [postId]
    );

    res.json(r.rows);
  } catch (e) {
    console.error('get comments error', e);
    res.status(500).json({ error: 'Server error fetching comments' });
  }
});

// ══════════════════════════════════════════════════
// POST /api/posts/:id/comments — Add a comment
// ══════════════════════════════════════════════════
router.post('/:id/comments', auth, commentLimiter, async (req, res) => {
  const postId = parseInt(req.params.id);
  if (!Number.isFinite(postId)) return res.status(400).json({ error: 'Invalid post ID' });

  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid comment' });

  try {
    const postRes = await db.query('SELECT * FROM posts WHERE id = $1', [postId]);
    if (postRes.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    const post = postRes.rows[0];
    const allowed = await canViewPost(post, req.user.id);
    if (!allowed) return res.status(403).json({ error: 'Cannot comment on this post' });

    const r = await db.query(
      `INSERT INTO comments (post_id, author_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, content, created_at`,
      [postId, req.user.id, parsed.data.content]
    );

    // Notify post author
    await createNotification({
      userId: post.author_id,
      type: 'COMMENT',
      fromUserId: req.user.id,
      referenceId: postId,
      referenceType: 'post',
      message: 'commented on your post',
    });

    await logSecurityEvent({ userId: req.user.id, eventType: 'COMMENT_ADDED', req, metadata: { postId, commentId: r.rows[0].id } });
    res.status(201).json(r.rows[0]);
  } catch (e) {
    console.error('add comment error', e);
    res.status(500).json({ error: 'Server error adding comment' });
  }
});

// ══════════════════════════════════════════════════
// DELETE /api/posts/comments/:commentId — Delete comment
// ══════════════════════════════════════════════════
router.delete('/comments/:commentId', auth, async (req, res) => {
  const commentId = parseInt(req.params.commentId);
  if (!Number.isFinite(commentId)) return res.status(400).json({ error: 'Invalid comment ID' });

  try {
    const r = await db.query('DELETE FROM comments WHERE id = $1 AND author_id = $2 RETURNING id', [commentId, req.user.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Comment not found or not owned by you' });

    await logSecurityEvent({ userId: req.user.id, eventType: 'COMMENT_DELETED', req, metadata: { commentId } });
    res.json({ message: 'Comment deleted' });
  } catch (e) {
    console.error('delete comment error', e);
    res.status(500).json({ error: 'Server error deleting comment' });
  }
});

module.exports = router;

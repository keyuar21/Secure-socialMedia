const express = require('express');
const { z } = require('zod');
const db = require('../db');
const auth = require('../middleware/auth');
const { logSecurityEvent } = require('../middleware/securityLogs');

const router = express.Router();

// Server never sees plaintext: client sends ciphertext + iv + auth_tag (AES-256-GCM)
const sendSchema = z.object({
  receiver_id: z.coerce.number().int().positive(),
  encrypted_message: z.string().min(1),
  iv: z.string().min(16),
  auth_tag: z.string().min(8),
  encrypted_key_for_sender: z.string().min(1).optional(),
  encrypted_key_for_receiver: z.string().min(1).optional(),
});

// Public key registry for E2EE (client holds private key)
router.get('/key/:userId', auth, async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isFinite(userId)) return res.status(400).json({ error: 'Invalid userId' });
  try {
    const r = await db.query('SELECT public_key_spki FROM user_keys WHERE user_id = $1', [userId]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'No public key registered' });
    res.json({ user_id: userId, public_key_spki: r.rows[0].public_key_spki });
  } catch (e) {
    console.error('get key error', e);
    res.status(500).json({ error: 'Server error fetching key' });
  }
});

router.put('/key', auth, async (req, res) => {
  const parsed = z.object({ public_key_spki: z.string().min(50) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid key' });
  try {
    await db.query(
      `INSERT INTO user_keys (user_id, public_key_spki)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET public_key_spki = EXCLUDED.public_key_spki, created_at = NOW()`,
      [req.user.id, parsed.data.public_key_spki]
    );
    await logSecurityEvent({ userId: req.user.id, eventType: 'E2EE_PUBLIC_KEY_UPDATED', req });
    res.json({ message: 'Public key saved' });
  } catch (e) {
    console.error('put key error', e);
    res.status(500).json({ error: 'Server error saving key' });
  }
});

router.post('/send', auth, async (req, res) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid message payload' });

  const { receiver_id, encrypted_message, iv, auth_tag, encrypted_key_for_sender, encrypted_key_for_receiver } = parsed.data;
  if (receiver_id === req.user.id) return res.status(400).json({ error: 'Cannot message yourself' });

  try {
    // basic existence check
    const u = await db.query('SELECT id FROM users WHERE id = $1 AND is_verified = TRUE', [receiver_id]);
    if (u.rows.length === 0) return res.status(404).json({ error: 'Receiver not found' });

    const r = await db.query(
      `INSERT INTO messages (sender_id, receiver_id, encrypted_message, iv, auth_tag, encrypted_key_for_sender, encrypted_key_for_receiver)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, timestamp`,
      [req.user.id, receiver_id, encrypted_message, iv, auth_tag, encrypted_key_for_sender || null, encrypted_key_for_receiver || null]
    );

    await logSecurityEvent({ userId: req.user.id, eventType: 'MESSAGE_SENT', req, metadata: { receiver_id } });
    res.status(201).json({ id: r.rows[0].id, timestamp: r.rows[0].timestamp });
  } catch (e) {
    console.error('send message error', e);
    res.status(500).json({ error: 'Server error sending message' });
  }
});

router.get('/get', auth, async (req, res) => {
  const otherId = Number(req.query.with);
  if (!Number.isFinite(otherId)) return res.status(400).json({ error: 'Query param "with" is required' });

  try {
    const r = await db.query(
      `SELECT id, sender_id, receiver_id, encrypted_message, iv, auth_tag, encrypted_key_for_sender, encrypted_key_for_receiver, timestamp
       FROM messages
       WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY timestamp ASC
       LIMIT 200`,
      [req.user.id, otherId]
    );
    res.json(r.rows);
  } catch (e) {
    console.error('get messages error', e);
    res.status(500).json({ error: 'Server error fetching messages' });
  }
});

module.exports = router;


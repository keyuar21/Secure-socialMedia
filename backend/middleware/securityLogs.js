const db = require('../db');

function getClientIp(req) {
  // trust proxy should be enabled on app if behind a reverse proxy
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length > 0) return xf.split(',')[0].trim();
  return req.socket?.remoteAddress || null;
}

async function logSecurityEvent({ userId, eventType, req, metadata = {} }) {
  try {
    await db.query(
      `INSERT INTO security_logs (user_id, event_type, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId || null,
        eventType,
        getClientIp(req),
        req.headers['user-agent'] || null,
        metadata,
      ]
    );
  } catch (e) {
    // Never block auth flows on logging failure
    console.error('security log insert failed', e.message);
  }
}

module.exports = { logSecurityEvent, getClientIp };


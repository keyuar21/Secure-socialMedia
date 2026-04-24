const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// NOTE: for demo scope, any authenticated user can view their own logs.
router.get('/logs', auth, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT id, event_type, ip_address, user_agent, metadata, timestamp
       FROM security_logs
       WHERE user_id = $1
       ORDER BY timestamp DESC
       LIMIT 200`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (e) {
    console.error('get logs error', e);
    res.status(500).json({ error: 'Server error fetching logs' });
  }
});

// Enhanced anomaly detection
router.get('/security-alerts', auth, async (req, res) => {
  try {
    const last7 = await db.query(
      `SELECT ip_address, event_type, timestamp
       FROM security_logs
       WHERE user_id = $1 AND timestamp > NOW() - INTERVAL '7 days'
       ORDER BY timestamp DESC`,
      [req.user.id]
    );

    // 30-day IP history for new-location detection
    const last30 = await db.query(
      `SELECT DISTINCT ip_address
       FROM security_logs
       WHERE user_id = $1
         AND timestamp > NOW() - INTERVAL '30 days'
         AND event_type = 'LOGIN_SUCCESS'`,
      [req.user.id]
    );

    const knownLoginIps = new Set(last30.rows.map(r => r.ip_address).filter(Boolean));

    const ips7 = new Map();
    let failed5m = 0;
    const now = Date.now();
    let eventsLastHour = 0;

    const alerts = [];

    for (const row of last7.rows) {
      if (row.ip_address) ips7.set(row.ip_address, true);
      const age = now - new Date(row.timestamp).getTime();

      // Count failed logins in last 5 minutes
      if (row.event_type === 'LOGIN_FAILED' && age < 5 * 60 * 1000) {
        failed5m += 1;
      }

      // Count ALL events in last hour (unusual frequency detection)
      if (age < 60 * 60 * 1000) {
        eventsLastHour += 1;
      }

      // Detect login from NEW IP (not seen in prior 30 days of successful logins)
      if (row.event_type === 'LOGIN_SUCCESS' && row.ip_address && !knownLoginIps.has(row.ip_address)) {
        // Only alert if it's in the last 24 hours
        if (age < 24 * 60 * 60 * 1000) {
          if (!alerts.find(a => a.type === 'NEW_LOCATION_LOGIN' && a.detail.includes(row.ip_address))) {
            alerts.push({
              type: 'NEW_LOCATION_LOGIN',
              severity: 'medium',
              detail: `Login from new IP: ${row.ip_address} at ${new Date(row.timestamp).toISOString()}`,
            });
          }
        }
        knownLoginIps.add(row.ip_address); // add so we don't alert again for the same IP
      }
    }

    // Burst of failed logins
    if (failed5m >= 5) {
      alerts.push({
        type: 'FAILED_LOGIN_BURST',
        severity: 'high',
        detail: `${failed5m} failed logins in last 5 minutes`,
      });
    } else if (failed5m >= 3) {
      alerts.push({
        type: 'FAILED_LOGIN_BURST',
        severity: 'medium',
        detail: `${failed5m} failed logins in last 5 minutes`,
      });
    }

    // Unusual activity frequency (>20 events in 1 hour)
    if (eventsLastHour > 20) {
      alerts.push({
        type: 'UNUSUAL_ACTIVITY_FREQUENCY',
        severity: 'medium',
        detail: `${eventsLastHour} security events in the last hour (threshold: 20)`,
      });
    }

    const knownIps = Array.from(ips7.keys());

    res.json({
      known_ips_last_7_days: knownIps,
      alerts,
    });
  } catch (e) {
    console.error('security alerts error', e);
    res.status(500).json({ error: 'Server error generating alerts' });
  }
});

// Download CSV format
router.get('/logs/csv', auth, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT event_type, ip_address, timestamp, metadata
       FROM security_logs
       WHERE user_id = $1
       ORDER BY timestamp DESC
       LIMIT 1000`,
      [req.user.id]
    );
    
    // Sanitize CSV cell to prevent formula injection (=, +, -, @, \t, \r)
    const sanitizeCell = (val) => {
      const s = String(val);
      if (/^[=+\-@\t\r]/.test(s)) return `'${s}`;
      return s;
    };

    // Create CSV header
    let csvData = 'Timestamp,Event Type,IP Address,Details\n';
    
    // Process rows
    for (const row of r.rows) {
      const ts = new Date(row.timestamp).toISOString();
      const metaStr = row.metadata ? JSON.stringify(row.metadata).replace(/"/g, '""') : '';
      csvData += `"${sanitizeCell(ts)}","${sanitizeCell(row.event_type)}","${sanitizeCell(row.ip_address || '')}","${sanitizeCell(metaStr)}"\n`;
    }
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="security_logs.csv"');
    res.status(200).send(csvData);
  } catch (e) {
    console.error('csv logs error', e);
    res.status(500).json({ error: 'Server error generating CSV' });
  }
});

module.exports = router;

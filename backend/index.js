// Force .env values to override inherited shell env vars.
// This prevents stale exported EMAIL_USER values from taking precedence.
require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: false,
    methods: ['GET','POST','PUT','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization'],
}));

// JSON body size limit (prevent payload DoS)
app.use(express.json({ limit: '100kb' }));

// Request ID middleware for traceability
app.use((req, res, next) => {
    req.requestId = crypto.randomUUID();
    res.setHeader('X-Request-ID', req.requestId);
    next();
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Load Routes ──
const authRouter          = require('./routes/auth');
const filesRouter         = require('./routes/files');
const privacyRouter       = require('./routes/privacy');
const messagesRouter      = require('./routes/messages');
const monitoringRouter    = require('./routes/monitoring');
const postsRouter         = require('./routes/posts');
const profilesRouter      = require('./routes/profiles');
const friendsRouter       = require('./routes/friends');
const notificationsRouter = require('./routes/notifications');

app.use('/api/auth',          authRouter);
app.use('/api/files',         filesRouter);
app.use('/api/privacy',       privacyRouter);
app.use('/api/messages',      messagesRouter);
app.use('/api/monitoring',    monitoringRouter);
app.use('/api/posts',         postsRouter);
app.use('/api/profiles',      profilesRouter);
app.use('/api/friends',       friendsRouter);
app.use('/api/notifications', notificationsRouter);

// ── Top-level spec aliases ──
app.post('/api/upload',                  (req, res, next) => { req.url = '/upload';                             filesRouter(req, res, next); });
app.get('/api/download/:id',             (req, res, next) => { req.url = `/download/${req.params.id}`;          filesRouter(req, res, next); });
app.post('/api/password-reset-request',  (req, res, next) => { req.url = '/password-reset-request';            authRouter(req, res, next); });
app.post('/api/password-reset',          (req, res, next) => { req.url = '/password-reset';                    authRouter(req, res, next); });
app.get('/api/logs',                     (req, res, next) => { req.url = '/logs';                               monitoringRouter(req, res, next); });
app.get('/api/security-alerts',          (req, res, next) => { req.url = '/security-alerts';                   monitoringRouter(req, res, next); });
app.get('/api/profile/view/:id',         (req, res, next) => { req.url = `/${req.params.id}`;                  profilesRouter(req, res, next); });

// Global error handler (MUST be before 404 catch-all)
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Catch-all: useful 404 instead of HTML error page
app.use((req, res) => {
    res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ── Startup Checks ──
if (!process.env.JWT_SECRET) {
    console.error('❌  FATAL: JWT_SECRET environment variable is not set. Server cannot start securely.');
    process.exit(1);
}
if (process.env.JWT_SECRET === 'change_me_to_a_long_random_secret') {
    console.warn('⚠️  WARNING: JWT_SECRET is set to the example value. Change it for production!');
}
if (!process.env.ENCRYPTION_KEY) {
    console.warn('⚠️  WARNING: ENCRYPTION_KEY not set. Using insecure default.');
}

app.listen(PORT, () => {
    console.log(`✅  Backend running → http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
});

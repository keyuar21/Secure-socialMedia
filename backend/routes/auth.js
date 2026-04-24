const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const { z } = require('zod');
const db = require('../db');
const { sendOTP, sendSecurityAlert } = require('../email');
const { loginLimiter, otpLimiter, passwordResetLimiter } = require('../middleware/rateLimiters');
const { logSecurityEvent } = require('../middleware/securityLogs');
const router = express.Router();

const generateOTP = () => crypto.randomInt(100000, 999999).toString();

const emailSchema = z.string().trim().toLowerCase().email().max(320);
const passwordSchema = z.string().min(8).max(128);

function lockoutUntil() {
    return new Date(Date.now() + 15 * 60 * 1000); // 15 min
}

async function setOtp({ userId, purpose, otp, expiry }) {
    await db.query(
        `INSERT INTO otps (user_id, otp_code, purpose, expiry_time)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, purpose)
         DO UPDATE SET otp_code = EXCLUDED.otp_code, expiry_time = EXCLUDED.expiry_time, created_at = NOW()`,
        [userId, otp, purpose, expiry]
    );
}

async function consumeOtp({ userId, purpose, otp }) {
    const r = await db.query(
        `SELECT otp_code, expiry_time FROM otps WHERE user_id = $1 AND purpose = $2`,
        [userId, purpose]
    );
    if (r.rows.length === 0) return { ok: false };
    const row = r.rows[0];
    if (row.otp_code !== otp) return { ok: false };
    if (new Date() > new Date(row.expiry_time)) return { ok: false, expired: true };
    await db.query(`DELETE FROM otps WHERE user_id = $1 AND purpose = $2`, [userId, purpose]);
    return { ok: true };
}

// Register User
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!emailSchema.safeParse(email).success || !passwordSchema.safeParse(password).success) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }
        
        const otp = generateOTP();
        const otp_expiry = new Date(Date.now() + 10 * 60000); // 10 minutes

        // Check if user exists
        const userExists = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            const user = userExists.rows[0];
            if (user.is_verified) {
                return res.status(400).json({ error: 'User already exists and is verified. Please log in.' });
            } else {
                // User exists but unverified. Resend OTP.
                const salt = await bcrypt.genSalt(10);
                const password_hash = await bcrypt.hash(password, salt);
                
                await db.query(
                    'UPDATE users SET password_hash = $1 WHERE id = $2',
                    [password_hash, user.id]
                );
                await setOtp({ userId: user.id, purpose: 'registration', otp, expiry: otp_expiry });
                await sendOTP(email, otp);
                return res.status(200).json({ message: 'Verification code resent. Please check your email.' });
            }
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        
        const insertRes = await db.query(
            'INSERT INTO users (email, password_hash, is_verified) VALUES ($1, $2, FALSE) RETURNING id',
            [email, password_hash]
        );
        await setOtp({ userId: insertRes.rows[0].id, purpose: 'registration', otp, expiry: otp_expiry });

        await sendOTP(email, otp);

        res.status(201).json({ message: 'Registration successful. Please check your email for the OTP.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// Verify Registration
router.post('/verify-registration', otpLimiter, async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!emailSchema.safeParse(email).success || !z.string().length(6).safeParse(String(otp)).success) {
            return res.status(400).json({ error: 'Invalid request' });
        }
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = result.rows[0];
        
        if (user.is_verified) {
             return res.status(400).json({ error: 'User is already verified' });
        }

        const check = await consumeOtp({ userId: user.id, purpose: 'registration', otp: String(otp) });
        if (!check.ok) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        await db.query(
            'UPDATE users SET is_verified = TRUE WHERE id = $1',
            [user.id]
        );
        await db.query('INSERT INTO privacy_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);
        await logSecurityEvent({ userId: user.id, eventType: 'EMAIL_VERIFIED', req, metadata: { email } });

        res.json({ message: 'Email verified successfully. You can now login.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error during verification' });
    }
});

// Login - Step 1
router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { email: rawEmail, password } = req.body;
        const emailValidation = emailSchema.safeParse(rawEmail);
        if (!emailValidation.success || !passwordSchema.safeParse(password).success) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        const email = emailValidation.data;
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        if (!user.is_verified) {
            return res.status(401).json({ error: 'Please verify your email first' });
        }

        if (user.account_locked_until && new Date(user.account_locked_until) > new Date()) {
            await logSecurityEvent({ userId: user.id, eventType: 'LOGIN_BLOCKED_LOCKOUT', req });
            return res.status(423).json({ error: 'Account is locked. Try again later.' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            const nextFails = (user.failed_login_attempts || 0) + 1;
            const shouldLock = nextFails >= 5;
            await db.query(
                `UPDATE users
                 SET failed_login_attempts = $2,
                     account_locked_until = CASE WHEN $3::boolean THEN $4::timestamptz ELSE NULL END
                 WHERE id = $1`,
                [user.id, nextFails, shouldLock, shouldLock ? lockoutUntil() : null]
            );
            await logSecurityEvent({ userId: user.id, eventType: 'LOGIN_FAILED', req, metadata: { failed_login_attempts: nextFails } });
            if (shouldLock) {
                await sendSecurityAlert(
                    user.email,
                    'Account locked after failed logins',
                    `We detected repeated failed login attempts and temporarily locked your account for 15 minutes.\n\nIf this wasn't you, reset your password immediately.`
                );
            }
            return res.status(400).json({ error: shouldLock ? 'Account locked due to repeated failures' : 'Invalid credentials' });
        }

        // Successful password check -> reset counters
        await db.query('UPDATE users SET failed_login_attempts = 0, account_locked_until = NULL WHERE id = $1', [user.id]);

        // If TOTP enabled, require TOTP code in verify step (still allow email OTP as fallback if enabled)
        if (user.totp_enabled) {
            await logSecurityEvent({ userId: user.id, eventType: 'LOGIN_PASSWORD_OK_TOTP_REQUIRED', req });
            return res.json({ message: 'TOTP required', totp_required: true });
        }

        const otp = generateOTP();
        const otp_expiry = new Date(Date.now() + 10 * 60000);

        await setOtp({ userId: user.id, purpose: 'login', otp, expiry: otp_expiry });

        await sendOTP(email, otp);
        await logSecurityEvent({ userId: user.id, eventType: 'LOGIN_OTP_SENT', req });

        res.json({ message: 'OTP sent to your email for 2FA' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Verify Login (2FA)
router.post('/verify-login', otpLimiter, async (req, res) => {
    try {
        const { email, otp, totp } = req.body;
        if (!emailSchema.safeParse(email).success) {
            return res.status(400).json({ error: 'Invalid request' });
        }
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = result.rows[0];

        if (user.totp_enabled) {
            const code = String(totp || '');
            if (code.length !== 6) return res.status(400).json({ error: 'TOTP code required' });
            const ok = speakeasy.totp.verify({
                secret: user.totp_secret || '',
                encoding: 'base32',
                token: code,
                window: 1
            });
            if (!ok) {
                await logSecurityEvent({ userId: user.id, eventType: 'TOTP_FAILED', req });
                return res.status(400).json({ error: 'Invalid TOTP code' });
            }
        } else {
            const check = await consumeOtp({ userId: user.id, purpose: 'login', otp: String(otp || '') });
            if (!check.ok) return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not configured');
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        await logSecurityEvent({ userId: user.id, eventType: 'LOGIN_SUCCESS', req });
        res.json({ token, message: 'Login successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error during 2FA verification' });
    }
});

// Spec alias: /verify-otp forwards to verify-login logic inline
router.post('/verify-otp', otpLimiter, async (req, res) => {
    const { email, otp } = req.body || {};
    if (!emailSchema.safeParse(email).success) return res.status(400).json({ error: 'Invalid request' });
    // Inline verify-login logic
    try {
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        const user = result.rows[0];
        const check = await consumeOtp({ userId: user.id, purpose: 'login', otp: String(otp || '') });
        if (!check.ok) return res.status(400).json({ error: 'Invalid or expired OTP' });
        if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not configured');
        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
        await logSecurityEvent({ userId: user.id, eventType: 'LOGIN_SUCCESS', req });
        res.json({ token, message: 'Login successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error during OTP verification' });
    }
});

// Resend Registration OTP
router.post('/resend-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!emailSchema.safeParse(email).success) return res.status(400).json({ error: 'Invalid email' });
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'User not found' });
        }
        
        const user = result.rows[0];
        if (user.is_verified) {
             return res.status(400).json({ error: 'User is already verified' });
        }

        const otp = generateOTP();
        const otp_expiry = new Date(Date.now() + 10 * 60000);

        await setOtp({ userId: user.id, purpose: 'registration', otp, expiry: otp_expiry });

        await sendOTP(email, otp);
        await logSecurityEvent({ userId: user.id, eventType: 'REGISTRATION_OTP_RESENT', req });
        res.json({ message: 'New verification code sent' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error during OTP resend' });
    }
});

const handlePasswordResetRequest = async (req, res) => {
    try {
        const { email } = req.body;
        if (!emailSchema.safeParse(email).success) {
            return res.json({ message: 'If that account exists, a password reset code has been sent.' });
        }
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);

        if (result.rows.length === 0) {
            // Generic message for security
            return res.json({ message: 'If that account exists, a password reset code has been sent.' });
        }

        const user = result.rows[0];
        const reset_token = generateOTP();
        const expiry_time = new Date(Date.now() + 10 * 60000);
        await db.query(
            `INSERT INTO password_resets (user_id, reset_token, expiry_time)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id)
             DO UPDATE SET reset_token = EXCLUDED.reset_token, expiry_time = EXCLUDED.expiry_time, created_at = NOW()`,
            [user.id, reset_token, expiry_time]
        );

        // Send full hex token as reset code
        await sendOTP(email, reset_token);
        await logSecurityEvent({ userId: user.id, eventType: 'PASSWORD_RESET_REQUESTED', req });
        res.json({ message: 'If that account exists, a password reset code has been sent.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error during forgot password request' });
    }
};

// Forgot Password - Request OTP
router.post('/password-reset-request', passwordResetLimiter, handlePasswordResetRequest);

// Back-compat alias
router.post('/forgot-password', passwordResetLimiter, handlePasswordResetRequest);

// Reset Password (token-based)
router.post('/password-reset', passwordResetLimiter, async (req, res) => {
    try {
        const { email, reset_token, newPassword } = req.body;
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (result.rows.length === 0) {
             return res.status(400).json({ error: 'Invalid request' });
        }

        const user = result.rows[0];

        if (!passwordSchema.safeParse(newPassword).success) return res.status(400).json({ error: 'Invalid password' });

        const pr = await db.query('SELECT reset_token, expiry_time FROM password_resets WHERE user_id = $1', [user.id]);
        if (pr.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired token' });
        if (new Date() > new Date(pr.rows[0].expiry_time)) return res.status(400).json({ error: 'Invalid or expired token' });
        if (String(pr.rows[0].reset_token) !== String(reset_token)) return res.status(400).json({ error: 'Invalid or expired token' });

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(newPassword, salt);

        await db.query(
            'UPDATE users SET password_hash = $1 WHERE id = $2',
            [password_hash, user.id]
        );
        await db.query('DELETE FROM password_resets WHERE user_id = $1', [user.id]);
        await logSecurityEvent({ userId: user.id, eventType: 'PASSWORD_CHANGED', req });

        res.json({ message: 'Password reset successfully. You can now login.' });
    } catch (error) {
        console.error('Reset Password Error:', error);
        res.status(500).json({ error: 'Server error during password reset' });
    }
});

// Back-compat alias for existing frontend
router.post('/reset-password', passwordResetLimiter, async (req, res) => {
    const { email, otp, newPassword } = req.body || {};
    try {
        const u = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (u.rows.length === 0) return res.status(400).json({ error: 'Invalid request' });
        const pr = await db.query('SELECT reset_token, expiry_time FROM password_resets WHERE user_id = $1', [u.rows[0].id]);
        if (pr.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired token' });
        if (new Date() > new Date(pr.rows[0].expiry_time)) return res.status(400).json({ error: 'Invalid or expired token' });
        // Constant-time comparison to prevent timing attacks
        const tokenMatch = crypto.timingSafeEqual(
            Buffer.from(String(pr.rows[0].reset_token)),
            Buffer.from(String(otp || '').padEnd(String(pr.rows[0].reset_token).length, '\0'))
        );
        if (!tokenMatch) return res.status(400).json({ error: 'Invalid or expired token' });
        if (!passwordSchema.safeParse(newPassword).success) return res.status(400).json({ error: 'Invalid password' });
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(newPassword, salt);
        await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, u.rows[0].id]);
        await db.query('DELETE FROM password_resets WHERE user_id = $1', [u.rows[0].id]);
        await logSecurityEvent({ userId: u.rows[0].id, eventType: 'PASSWORD_CHANGED', req });
        res.json({ message: 'Password reset successfully. You can now login.' });
    } catch (e) {
        console.error('reset-password alias error', e);
        return res.status(500).json({ error: 'Server error during password reset' });
    }
});

// Enable TOTP 2FA (authenticator app)
router.post('/enable-2fa', async (req, res) => {
    // Requires user to be authenticated in a real app; keeping simple for project scope by requiring a valid JWT.
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Access denied. No token provided.' });
    const token = authHeader.split(' ')[1];
    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return res.status(400).json({ error: 'Invalid token.' });
    }

    try {
        const secret = speakeasy.generateSecret({ name: `SecureSocial (${decoded.email})` });
        await db.query(
            'UPDATE users SET totp_enabled = TRUE, totp_secret = $2 WHERE id = $1',
            [decoded.id, secret.base32]
        );
        await logSecurityEvent({ userId: decoded.id, eventType: 'TOTP_ENABLED', req });
        res.json({ message: 'TOTP enabled', otpauth_url: secret.otpauth_url, secret_base32: secret.base32 });
    } catch (e) {
        console.error('enable 2fa error', e);
        res.status(500).json({ error: 'Server error enabling 2FA' });
    }
});

router.post('/logout', async (req, res) => {
    // Stateless JWT logout: client deletes token. We still log the event.
    try {
        const authHeader = req.header('Authorization') || '';
        let userId = null;
        if (authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                userId = decoded.id;
            } catch {}
        }
        await logSecurityEvent({ userId, eventType: 'LOGOUT', req });
    } catch {}
    res.json({ message: 'Logged out' });
});

module.exports = router;

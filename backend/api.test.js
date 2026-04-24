const request = require('supertest');
const fs = require('fs');
const path = require('path');
const db = require('./db');

// In memory setup for testing
const app = require('express')();
app.use(require('express').json());
app.use('/api/auth', require('./routes/auth'));
app.use('/api/files', require('./routes/files'));
app.use('/api/privacy', require('./routes/privacy'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/monitoring', require('./routes/monitoring'));

describe('Authentication and File Security APIs', () => {

    let token = '';
    let fileId = '';

    beforeAll(async () => {
         process.env.NODE_ENV = 'test';
         // Create a test user directly (bypassing email OTP for simplicity of programmatic test)
         const bcrypt = require('bcrypt');
         const salt = await bcrypt.genSalt(10);
         const password_hash = await bcrypt.hash('testpass123', salt);
         
         // Ensure schema exists (idempotent)
         // For tests, drop and recreate to ensure columns match the latest schema
         await db.query('DROP TABLE IF EXISTS security_logs CASCADE');
         await db.query('DROP TABLE IF EXISTS password_resets CASCADE');
         await db.query('DROP TABLE IF EXISTS messages CASCADE');
         await db.query('DROP TABLE IF EXISTS user_keys CASCADE');
         await db.query('DROP TABLE IF EXISTS otps CASCADE');
         await db.query('DROP TABLE IF EXISTS file_shares CASCADE');
         await db.query('DROP TABLE IF EXISTS files CASCADE');
         await db.query('DROP TABLE IF EXISTS privacy_settings CASCADE');
         await db.query('DROP TABLE IF EXISTS friends CASCADE');
         await db.query('DROP TABLE IF EXISTS users CASCADE');
         // enum type may already exist
         await db.query("DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'privacy_level') THEN DROP TYPE privacy_level; END IF; END $$;");

         const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql')).toString();
         await db.query(schemaSql);

         await db.query('DELETE FROM messages');
         await db.query('DELETE FROM user_keys');
         await db.query('DELETE FROM security_logs');
         await db.query('DELETE FROM password_resets');
         await db.query('DELETE FROM otps');
         await db.query('DELETE FROM file_shares');
         await db.query('DELETE FROM files');
         await db.query('DELETE FROM privacy_settings');
         await db.query('DELETE FROM friends');
         await db.query('DELETE FROM users WHERE email = $1', ['test@example.com']);

         await db.query(
            'INSERT INTO users (email, password_hash, is_verified) VALUES ($1, $2, TRUE)',
            ['test@example.com', password_hash]
        );
    });

    afterAll(async () => {
         await db.query('DELETE FROM messages');
         await db.query('DELETE FROM user_keys');
         await db.query('DELETE FROM security_logs');
         await db.query('DELETE FROM password_resets');
         await db.query('DELETE FROM otps');
         await db.query('DELETE FROM file_shares');
         await db.query('DELETE FROM files');
         await db.query('DELETE FROM privacy_settings');
         await db.query('DELETE FROM friends');
         await db.query('DELETE FROM users');
         await db.end();
    });

    it('should login and retrieve a JWT', async () => {
        // Trigger step 1
        const loginRes = await request(app).post('/api/auth/login').send({ email: 'test@example.com', password: 'testpass123' });
        expect(loginRes.status).toBe(200);

        // Fetch OTP from DB directly
        const userRes = await db.query('SELECT id FROM users WHERE email = $1', ['test@example.com']);
        const otpRes = await db.query("SELECT otp_code FROM otps WHERE user_id = $1 AND purpose = 'login'", [userRes.rows[0].id]);
        const otp = otpRes.rows[0].otp_code;

        // Perform step 2
        const verifyRes = await request(app).post('/api/auth/verify-login').send({ email: 'test@example.com', otp });
        expect(verifyRes.status).toBe(200);
        expect(verifyRes.body.token).toBeDefined();
        token = verifyRes.body.token;
    });

    it('should securely upload and encrypt a file', async () => {
        const testFilePath = path.join(__dirname, 'test-file.txt');
        fs.writeFileSync(testFilePath, 'Hello, Secure World!');

        const res = await request(app)
            .post('/api/files/upload')
            .set('Authorization', `Bearer ${token}`)
            .attach('file', testFilePath);

        expect(res.status).toBe(201);
        expect(res.body.fileId).toBeDefined();
        fileId = res.body.fileId;
        
        fs.unlinkSync(testFilePath);

        // Verify it was encrypted in DB
        const fileRecord = await db.query('SELECT * FROM files WHERE id = $1', [fileId]);
        expect(fileRecord.rows[0].encrypted_path).toBeDefined();
        expect(fileRecord.rows[0].iv).toBeDefined();
        expect(fileRecord.rows[0].encryption_key).toBeDefined();
        
        // Verify file exists on disk
        expect(fs.existsSync(fileRecord.rows[0].encrypted_path)).toBe(true);

        // Verify it looks encrypted (doesn't contain original text)
        const content = fs.readFileSync(fileRecord.rows[0].encrypted_path).toString();
        expect(content).not.toContain('Hello, Secure World!');
    });

    it('should list the uploaded file', async () => {
        const res = await request(app)
            .get('/api/files')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBeGreaterThan(0);
        expect(res.body[0].original_name).toBe('test-file.txt');
    });

    it('should decrypt and download the file securely', async () => {
         const res = await request(app)
            .get(`/api/files/download/${fileId}`)
            .set('Authorization', `Bearer ${token}`);
            
         expect(res.status).toBe(200);
         expect(res.text).toBe('Hello, Secure World!');
    });

    it('should retrieve list of users to share with', async () => {
        // Create a secondary user to share with
        const bcrypt = require('bcrypt');
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash('testpass456', salt);
        
        await db.query(
           'INSERT INTO users (email, password_hash, is_verified) VALUES ($1, $2, TRUE)',
           ['receiver@example.com', password_hash]
        );

        const res = await request(app)
            .get('/api/files/users')
            .set('Authorization', `Bearer ${token}`);
            
        expect(res.status).toBe(200);
        expect(res.body.users).toBeDefined();
        expect(res.body.users.length).toBeGreaterThan(0);
        expect(res.body.users.some(u => u.email === 'receiver@example.com')).toBe(true);
        // keys no longer returned by server
    });

    it('should share a file with another user', async () => {
        const res = await request(app)
            .post('/api/files/share')
            .set('Authorization', `Bearer ${token}`)
            .send({ fileId, receiverEmail: 'receiver@example.com' });
            
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('File shared successfully');
    });

    it('should list shared files for the receiver', async () => {
        // Login as receiver
        await request(app).post('/api/auth/login').send({ email: 'receiver@example.com', password: 'testpass456' });
        const userRes = await db.query('SELECT id FROM users WHERE email = $1', ['receiver@example.com']);
        const otpRes = await db.query("SELECT otp_code FROM otps WHERE user_id = $1 AND purpose = 'login'", [userRes.rows[0].id]);
        const verifyRes = await request(app).post('/api/auth/verify-login').send({ email: 'receiver@example.com', otp: otpRes.rows[0].otp_code });
        const receiverToken = verifyRes.body.token;

        const res = await request(app)
            .get('/api/files/shared-with-me')
            .set('Authorization', `Bearer ${receiverToken}`);
            
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].original_name).toBe('test-file.txt');
        expect(res.body[0].sender_email).toBe('test@example.com');
    });

    it('should allow receiver to download shared file', async () => {
        // Login as receiver again
        const userRes = await db.query('SELECT id FROM users WHERE email = $1', ['receiver@example.com']);
        
        // Re-generate token since OTP might be cleared
        const jwt = require('jsonwebtoken');
        const receiverToken = jwt.sign(
            { id: userRes.rows[0].id, email: 'receiver@example.com' },
            process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod'
        );

        const res = await request(app)
            .get(`/api/files/download/${fileId}`)
            .set('Authorization', `Bearer ${receiverToken}`);
            
         expect(res.status).toBe(200);
         expect(res.text).toBe('Hello, Secure World!');
    });

    it('should allow user to request password reset', async () => {
        const res = await request(app)
            .post('/api/auth/password-reset-request')
            .send({ email: 'test@example.com' });
        
        expect(res.status).toBe(200);
        expect(res.body.message).toContain('password reset code has been sent');

        // Check if DB was updated with a reset token
        const userRes = await db.query('SELECT id FROM users WHERE email = $1', ['test@example.com']);
        const pr = await db.query('SELECT reset_token FROM password_resets WHERE user_id = $1', [userRes.rows[0].id]);
        expect(pr.rows[0].reset_token).toBeDefined();
    });

    it('should reset password with valid token', async () => {
        const userRes = await db.query('SELECT id FROM users WHERE email = $1', ['test@example.com']);
        const pr = await db.query('SELECT reset_token FROM password_resets WHERE user_id = $1', [userRes.rows[0].id]);
        const reset_token = pr.rows[0].reset_token;

        const res = await request(app)
            .post('/api/auth/password-reset')
            .send({ email: 'test@example.com', reset_token, newPassword: 'newsecurepass' });

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('Password reset successfully');

        // Validate login works with new password
        const loginRes = await request(app).post('/api/auth/login').send({ email: 'test@example.com', password: 'newsecurepass' });
        expect(loginRes.status).toBe(200);
    });

    it('should allow unverified user to register', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ email: 'newuser@example.com', password: 'password123' });
        
        expect(res.status).toBe(201);
    });

    it('should resend OTP for unverified user automatically on re-register', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ email: 'newuser@example.com', password: 'password123' });
        
        expect(res.status).toBe(200);
        expect(res.body.message).toContain('Verification code resent');
    });

    it('should update privacy settings and enforce FRIENDS_ONLY visibility', async () => {
        const bcrypt = require('bcrypt');
        const salt = await bcrypt.genSalt(10);
        const ph = await bcrypt.hash('friendpass123', salt);
        const u2 = await db.query('INSERT INTO users (email, password_hash, is_verified) VALUES ($1,$2,TRUE) RETURNING id', ['friend@example.com', ph]);

        // Set friend profile to FRIENDS_ONLY
        await db.query('INSERT INTO privacy_settings (user_id, profile_visibility) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET profile_visibility = EXCLUDED.profile_visibility', [u2.rows[0].id, 'FRIENDS_ONLY']);

        // Not friends yet -> forbidden
        const deny = await request(app)
          .get(`/api/privacy/profile/view/${u2.rows[0].id}`)
          .set('Authorization', `Bearer ${token}`);
        expect(deny.status).toBe(403);

        // Accept friendship (both directions)
        await db.query("INSERT INTO friends (user_id, friend_id, status) VALUES ($1,$2,'ACCEPTED')", [u2.rows[0].id, JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).id]);
        await db.query("INSERT INTO friends (user_id, friend_id, status) VALUES ($1,$2,'ACCEPTED')", [JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).id, u2.rows[0].id]);

        const allow = await request(app)
          .get(`/api/privacy/profile/view/${u2.rows[0].id}`)
          .set('Authorization', `Bearer ${token}`);
        expect(allow.status).toBe(200);
        expect(allow.body.id).toBe(u2.rows[0].id);
    });

    it('should store encrypted messages without plaintext', async () => {
        // Create receiver if missing
        const recv = await db.query('SELECT id FROM users WHERE email = $1', ['receiver@example.com']);
        const receiverId = Number(recv.rows[0].id);

        const ciphertext = Buffer.from('not-plaintext-ciphertext').toString('base64');
        const iv = Buffer.from('0123456789ab').toString('base64');

        const send = await request(app)
          .post('/api/messages/send')
          .set('Authorization', `Bearer ${token}`)
          .send({
            receiver_id: receiverId,
            encrypted_message: ciphertext,
            iv,
            auth_tag: 'webcrypto',
            encrypted_key_for_sender: Buffer.from('k1').toString('base64'),
            encrypted_key_for_receiver: Buffer.from('k2').toString('base64'),
          });
        expect(send.status).toBe(201);

        const get = await request(app)
          .get(`/api/messages/get?with=${receiverId}`)
          .set('Authorization', `Bearer ${token}`);
        expect(get.status).toBe(200);
        expect(get.body.length).toBeGreaterThan(0);
        expect(get.body[0].encrypted_message).toBeDefined();
        expect(get.body[0].encrypted_message).not.toContain('Hello');
    });

});

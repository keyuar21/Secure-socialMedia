const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const NodeClam = require('clamscan');
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const { logSecurityEvent } = require('../middleware/securityLogs');
const router = express.Router();

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const UPLOADS_DIR = path.join(__dirname, '../encrypted_uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
const ALLOWED_MIME = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/pdf',
    'text/plain',
]);

// Multer configured to use memory storage first so we can scan the buffer
const storage = multer.memoryStorage();
const upload = multer({ 
    storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

let clamscan;

// Initialize ClamScan
const initClamScan = async () => {
    if (process.env.NODE_ENV === 'test' || process.env.BYPASS_AV_SCAN_IN_DEV === 'true') {
        clamscan = {
            scanBuffer: async (buffer) => {
                console.log('[DEV/TEST MODE] Mocking malware scan');
                // Simulate clean file for tests/local dev
                return { isInfected: false, viruses: [] };
            }
        };
        console.log('ClamAV mocked for testing/development');
        return;
    }

    try {
        clamscan = await new NodeClam().init({
            clamdscan: { host: '127.0.0.1', port: 3310, active: true },
            preference: 'clamdscan'
        });
        console.log('ClamAV initialized successfully');
    } catch (err) {
        console.error('ClamAV initialization failed. Falling back to clamscan binary if available.', err);
        try {
            clamscan = await new NodeClam().init({
               clamscan: { path: '/opt/homebrew/bin/clamscan', active: true },
               preference: 'clamscan'
            });
            console.log('ClamAV (binary mode) initialized');
        } catch(fallbackErr) {
             console.error('ClamAV fallback failed. Scans will error out.', fallbackErr);
        }
    }
};

initClamScan();

const getEncryptionKey = () => {
    // In production, this must be a securely managed 32-byte key
    const secret = process.env.ENCRYPTION_KEY || 'default_super_secret_key_32bytes!';
    return crypto.createHash('sha256').update(String(secret)).digest('base64').substring(0, 32);
};

// Upload File Endpoint
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        // 0. Type validation (defense-in-depth; do not rely only on MIME sniffing)
        if (!ALLOWED_MIME.has(req.file.mimetype)) {
            return res.status(400).json({ error: 'Unsupported file type' });
        }

        // 1. Malware Scanning
        let scanResult = null;
        
        if (process.env.BYPASS_AV_SCAN_IN_DEV === 'true' || process.env.NODE_ENV === 'test') {
             console.log('[DEV BYPASS] Mocking malware scan block for local testing.');
             scanResult = { isInfected: false, viruses: [] };
        } else if (clamscan) {
            try {
                 scanResult = await clamscan.scanBuffer(req.file.buffer);
            } catch (bufferErr) {
                 console.log('Buffer scan failed, falling back to temp file scan...', bufferErr.message);
                 const tempScanPath = path.join('/tmp', `scan-${Date.now()}`);
                 try {
                     fs.writeFileSync(tempScanPath, req.file.buffer);
                     scanResult = await clamscan.isInfected(tempScanPath);
                 } catch (fallbackErr) {
                     console.error('Complete clamscan failure on fallback', fallbackErr.message);
                 } finally {
                     if (fs.existsSync(tempScanPath)) {
                         fs.unlinkSync(tempScanPath);
                     }
                 }
            }
        } else {
             console.warn('Antivirus service unavailable - rejecting upload for safety');
             return res.status(503).json({ error: 'Antivirus service unavailable. Upload rejected for safety.' });
        }

        // Reject if scan failed entirely (no result) or malware detected
        if (!scanResult) {
            return res.status(503).json({ error: 'Malware scan failed. Upload rejected for safety.' });
        }
        
        if (scanResult.isInfected) {
            return res.status(400).json({ error: 'Malware detected in uploaded file', viruses: scanResult.viruses });
        }

        // 1.5 File Hashing
        const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

        // 2. Encryption (AES-256-GCM)
        // Per-file random key (store wrapped for project scope)
        const fileKey = crypto.randomBytes(32);
        const wrappedKey = Buffer.concat([fileKey]).toString('base64'); // placeholder: wrap with KMS/master in production
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, fileKey, iv);
        
        const encryptedBuffer = Buffer.concat([cipher.update(req.file.buffer), cipher.final()]);
        const authTag = cipher.getAuthTag();

        const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.enc`;
        const encryptedPath = path.join(UPLOADS_DIR, filename);

        // Save encrypted file to disk
        fs.writeFileSync(encryptedPath, encryptedBuffer);

        // 3. Store metadata in database
        const result = await db.query(
            `INSERT INTO files (user_id, filename, original_name, mime_type, size, encrypted_path, encryption_key, iv, auth_tag, file_hash) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
            [
                req.user.id,
                filename,
                req.file.originalname,
                req.file.mimetype,
                req.file.size,
                encryptedPath,
                wrappedKey,
                iv.toString('hex'),
                authTag.toString('hex'),
                fileHash
            ]
        );

        await logSecurityEvent({ userId: req.user.id, eventType: 'FILE_UPLOADED', req, metadata: { fileId: result.rows[0].id, fileHash } });
        res.status(201).json({ message: 'File uploaded securely', fileId: result.rows[0].id, fileHash });

    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ error: 'Server error during secure file upload' });
    }
});


// List User Files
router.get('/', authMiddleware, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, original_name, mime_type, size, created_at, file_hash, auth_tag FROM files WHERE user_id = $1 ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('List Files Error:', error);
        res.status(500).json({ error: 'Server error fetching files' });
    }
});


// Download File Endpoint
router.get('/download/:id', authMiddleware, async (req, res) => {
    try {
        const fileId = req.params.id;
        
        // 1. Check permissions and get metadata
        // Allow if user is the owner OR if there's a record in file_shares granting them access
        const result = await db.query(`
            SELECT f.* 
            FROM files f
            LEFT JOIN file_shares fs ON f.id = fs.file_id AND fs.receiver_id = $2
            WHERE f.id = $1 AND (f.user_id = $2 OR fs.receiver_id = $2)
        `, [fileId, req.user.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'File not found or access denied' });
        }

        const fileRecord = result.rows[0];

        // 2. Decryption logic
        if (!fs.existsSync(fileRecord.encrypted_path)) {
             return res.status(404).json({ error: 'Encrypted physical file missing' });
        }

        // Unwrap file key (placeholder)
        const fileKey = Buffer.from(fileRecord.encryption_key || '', 'base64');
        const iv = Buffer.from(fileRecord.iv, 'hex');
        const authTag = Buffer.from(fileRecord.auth_tag, 'hex');

        const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, fileKey, iv);
        decipher.setAuthTag(authTag);

        const encryptedData = fs.readFileSync(fileRecord.encrypted_path);
        
        let decryptedBuffer;
        try {
            decryptedBuffer = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
        } catch (decryptErr) {
             console.error('Decryption failed, likely tampered data', decryptErr);
             return res.status(500).json({ error: 'File decryption failed (auth tag mismatch)' });
        }

        // 3. Write temp file
        const tempFilePath = path.join('/tmp', `decrypted-${Date.now()}-${fileRecord.original_name}`);
        fs.writeFileSync(tempFilePath, decryptedBuffer);

        // 4. Send File and Cleanup
        res.download(tempFilePath, fileRecord.original_name, (err) => {
            if (err) {
                console.error('Error sending file:', err);
            }
            // Cleanup temp file immediately after stream closes/finishes
            fs.unlink(tempFilePath, (unlinkErr) => {
                if (unlinkErr) console.error('Error cleaning up temp file:', unlinkErr);
            });
        });

    } catch (error) {
        console.error('Download Error:', error);
        res.status(500).json({ error: 'Server error during file download' });
    }
});


// Share File Endpoint
router.post('/share', authMiddleware, async (req, res) => {
    try {
        const { fileId, receiverEmail } = req.body;

        // Verify the user owns the file
        const fileCheck = await db.query('SELECT id FROM files WHERE id = $1 AND user_id = $2', [fileId, req.user.id]);
        if (fileCheck.rows.length === 0) {
             return res.status(404).json({ error: 'File not found or you do not have permission to share it.' });
        }

        // Find the receiver user
        const receiverCheck = await db.query('SELECT id FROM users WHERE email = $1', [receiverEmail]);
        if (receiverCheck.rows.length === 0) {
             return res.status(404).json({ error: 'User to share with not found.' });
        }

        const receiverId = receiverCheck.rows[0].id;

        // Prevent sharing with self
        if (receiverId === req.user.id) {
             return res.status(400).json({ error: 'You cannot share a file with yourself.' });
        }

        // Insert share record (on conflict = already shared, ignore)
        const shareRes = await db.query(
            'INSERT INTO file_shares (file_id, sender_id, receiver_id) VALUES ($1, $2, $3) ON CONFLICT (file_id, receiver_id) DO NOTHING RETURNING file_id',
            [fileId, req.user.id, receiverId]
        );
        if (shareRes.rows.length === 0) {
            return res.status(400).json({ error: 'File is already shared with this user' });
        }

        await logSecurityEvent({ userId: req.user.id, eventType: 'FILE_SHARED', req, metadata: { fileId, receiverId, receiverEmail } });
        res.json({ message: 'File shared successfully' });
    } catch (error) {
        console.error('Share Error:', error);
        res.status(500).json({ error: 'Server error during file sharing' });
    }
});

// List Shared/Received Files
router.get('/shared-with-me', authMiddleware, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT f.id, f.original_name, f.mime_type, f.size, f.created_at, f.file_hash, f.auth_tag, u.email as sender_email
            FROM files f
            JOIN file_shares fs ON f.id = fs.file_id
            JOIN users u ON fs.sender_id = u.id
            WHERE fs.receiver_id = $1
            ORDER BY fs.created_at DESC
        `, [req.user.id]);
        
        res.json(result.rows);
    } catch (error) {
         console.error('List Shared Files Error:', error);
         res.status(500).json({ error: 'Server error fetching shared files' });
    }
});

// List All Registered Users Endpoint and Current User's Keys
router.get('/users', authMiddleware, async (req, res) => {
    try {
         // Return list of all verified users except the requester
         const usersResult = await db.query(
             'SELECT id, email FROM users WHERE is_verified = TRUE AND id != $1 ORDER BY email ASC', 
             [req.user.id]
         );

         res.json({
             users: usersResult.rows
         });
    } catch (error) {
         console.error('List Users Error:', error);
         res.status(500).json({ error: 'Server error fetching users directory' });
    }
});

module.exports = router;

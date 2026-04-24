# Security Architecture Documentation

## 1. Secure User Authentication

### Password Storage
- All passwords are hashed using **bcrypt** with a work factor of 10 (salt generated per-hash).
- Plaintext passwords are never stored or logged.
- Passwords must be 8–128 characters (validated with Zod schema).

### JWT Authentication
- Stateless Access tokens issued using `jsonwebtoken` with configurable secret (`JWT_SECRET`).
- Token lifetime: **1 hour**.
- Tokens contain `{ id, email }` claims.
- All protected endpoints require `Authorization: Bearer <token>` header.
- JWT verification middleware returns `401` for missing or invalid tokens.

### Two-Factor Authentication (2FA)

#### Email OTP (Default)
- After successful password check, a 6-digit OTP is generated using `Math.random()`.
- OTP is emailed via Nodemailer and stored in the `otps` table with a 10-minute expiry.
- OTP is consumed on verification (single-use).

#### TOTP Authenticator App (Optional)
- Enabled via `/api/auth/enable-2fa` (requires valid JWT).
- Uses `speakeasy` to generate a TOTP secret (base32 encoded).
- Returns an `otpauth://` URL for QR code scanning.
- On login, TOTP code is verified with a window of ±1 (30-second tolerance).

### Account Lockout
- After **5 consecutive failed login attempts**, the account is locked for **15 minutes**.
- `failed_login_attempts` counter is reset on successful password verification.
- Lockout state is stored in `account_locked_until` column.
- A **security email alert** is sent when lockout triggers.

### Rate Limiting
| Endpoint | Window | Max Requests |
|----------|--------|-------------|
| `/login` | 15 min | 10 |
| `/verify-*` (OTP) | 10 min | 10 |
| `/password-reset-*` | 10 min | 5 |

Implemented using `express-rate-limit` with `standardHeaders: true`.

---

## 2. Privacy Settings Module

### Privacy Levels
- **PUBLIC** — Visible to all authenticated users.
- **FRIENDS_ONLY** — Visible only to accepted friends (uses `friends` table with `ACCEPTED` status).
- **PRIVATE** — Visible only to the profile owner.

### Enforcement
- Privacy settings are stored in `privacy_settings` table (one row per user).
- Profile view endpoint (`/api/privacy/profile/view/:userId`) checks:
  1. Is the viewer the profile owner? → Full access.
  2. Is the viewer an accepted friend? → `FRIENDS_ONLY` access.
  3. Otherwise → `PUBLIC` access only.
- Contact information (email) is conditionally redacted based on `contact_visibility`.
- **All privacy logic executes server-side** — the client receives only the data it's authorized to see.

### Database
```sql
CREATE TYPE privacy_level AS ENUM ('PUBLIC','FRIENDS_ONLY','PRIVATE');

CREATE TABLE privacy_settings (
  user_id BIGINT PRIMARY KEY REFERENCES users(id),
  profile_visibility privacy_level DEFAULT 'PUBLIC',
  post_visibility privacy_level DEFAULT 'FRIENDS_ONLY',
  contact_visibility privacy_level DEFAULT 'PRIVATE'
);

CREATE TABLE friends (
  user_id BIGINT REFERENCES users(id),
  friend_id BIGINT REFERENCES users(id),
  status TEXT CHECK (status IN ('PENDING','ACCEPTED','BLOCKED')),
  PRIMARY KEY (user_id, friend_id)
);
```

---

## 3. End-to-End Encrypted Messaging

### Architecture
The server **never sees plaintext messages**. Encryption/decryption happens entirely in the browser using the Web Crypto API.

### Key Exchange
1. Each user generates an **RSA-OAEP 2048-bit keypair** in the browser.
2. The **public key** (SPKI format, base64) is uploaded to the server (`user_keys` table).
3. The **private key** (PKCS8 format, base64) is stored in `localStorage` only.

### Message Encryption Flow
1. Sender generates a random **AES-256-GCM key** (32 bytes).
2. Message plaintext is encrypted with this AES key + random 12-byte IV.
3. The AES key is encrypted with:
   - Receiver's RSA public key → `encrypted_key_for_receiver`
   - Sender's RSA public key → `encrypted_key_for_sender`
4. Only ciphertext + IV + encrypted keys are sent to the server.

### Decryption
1. User decrypts the AES key using their RSA private key (from `localStorage`).
2. AES key is used to decrypt the message ciphertext.

### Server Storage
```sql
CREATE TABLE messages (
  id BIGSERIAL PRIMARY KEY,
  sender_id BIGINT REFERENCES users(id),
  receiver_id BIGINT REFERENCES users(id),
  encrypted_message TEXT NOT NULL,  -- AES-256-GCM ciphertext (base64)
  iv TEXT NOT NULL,                  -- 12-byte IV (base64)
  auth_tag TEXT NOT NULL,            -- GCM auth tag
  encrypted_key_for_sender TEXT,     -- RSA-OAEP wrapped AES key
  encrypted_key_for_receiver TEXT,   -- RSA-OAEP wrapped AES key
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. Secure File Upload

### Upload Security Pipeline
1. **File type validation** — Allowlisted MIME types only: `image/png`, `image/jpeg`, `image/webp`, `application/pdf`, `text/plain`.
2. **File size limit** — 50 MB max (Multer `limits.fileSize`).
3. **Malware scanning** — ClamAV (`clamscan`/`clamd`). Falls back gracefully if unavailable.
4. **SHA-256 hashing** — Integrity fingerprint stored in `file_hash` column.
5. **AES-256-GCM encryption** — Per-file random 32-byte key + 16-byte IV.
6. **Secure file naming** — Timestamp + `crypto.randomBytes(8)` + `.enc` extension.
7. **Directory traversal prevention** — Files written only to `encrypted_uploads/` using `path.join()`.

### Storage
- Encrypted blobs stored on disk at `backend/encrypted_uploads/`.
- Encryption metadata stored in database (`iv`, `auth_tag`, `encryption_key`).
- Original filename preserved in `original_name` column but never used for file paths.

### Download Flow
1. Verify ownership or file share permission.
2. Read encrypted blob from disk.
3. Decrypt with stored key, IV, and auth tag.
4. Stream to client with original filename.
5. Temp decrypted file deleted immediately after streaming.

---

## 5. Account Recovery

### Flow
1. User requests password reset → server generates a **64-character hex token** using `crypto.randomBytes(32)`.
2. Token stored in `password_resets` table with **10-minute TTL**.
3. First 6 characters emailed as a recovery code.
4. User submits recovery code + new password.
5. Server validates token, updates password hash, deletes token.

### Security Measures
- **Generic response messages** prevent email enumeration (`"If that account exists…"`).
- **Rate limited** to 5 requests per 10 minutes.
- **Single-use** — token deleted after successful reset.
- Password change logged as a security event.

---

## 6. Post Visibility & Social Privacy

### Post Visibility Levels
Posts use the same `privacy_level` enum as profile settings:
- **PUBLIC** — Visible to all authenticated users in their feed.
- **FRIENDS_ONLY** — Visible only to accepted friends (default).
- **PRIVATE** — Visible only to the post author.

### Feed Enforcement
The feed endpoint (`/api/posts/feed`) implements a privacy-aware query:
1. Always shows the current user's own posts (all visibility levels).
2. Shows `PUBLIC` posts from all users.
3. Shows `FRIENDS_ONLY` posts only from users in the viewer's friend graph.
4. Never shows `PRIVATE` posts from other users.

### Post Actions
- Like and comment actions require passing the same visibility check — users cannot interact with posts they cannot see.
- Deleting a post cascades to all comments and likes.

---

## 7. Friend Graph Security

### Bidirectional Friendship
Friendships are stored as directed edges in the `friends` table. A mutual friendship requires two rows:
- `(userA, userB, ACCEPTED)`
- `(userB, userA, ACCEPTED)`

### Request Flow
1. User A sends request → `(A, B, PENDING)` row created.
2. User B accepts → Updates to `ACCEPTED`, creates reverse row.
3. Auto-accept: If A sends request to B who already has a pending request to A, both are accepted.

### Blocking
- Blocking removes the friendship in both directions.
- A blocked user cannot send friend requests.
- Block status is not revealed to the blocked user (returns a generic error).

---

## 8. Incident Response

### Detection
- **Failed login tracking** — Counter incremented per failed attempt.
- **Account lockout** — 5 failures → 15-minute lockout + email alert.
- **New location detection** — Login from IP not seen in prior 30 days of successful logins.
- **Activity frequency** — Alert if >20 security events logged within 1 hour.

### Response Actions
- Account lockout (automatic, time-based).
- Email security alert to the account holder.
- Event logging for audit trail.

---

## 9. Security Logging & Monitoring

### Logged Events
| Event Type | Trigger |
|-----------|---------|
| `EMAIL_VERIFIED` | Registration OTP verified |
| `LOGIN_OTP_SENT` | Login step 1 success, OTP sent |
| `LOGIN_SUCCESS` | Full login completed |
| `LOGIN_FAILED` | Invalid password |
| `LOGIN_BLOCKED_LOCKOUT` | Locked account login attempt |
| `LOGIN_PASSWORD_OK_TOTP_REQUIRED` | Password OK, TOTP pending |
| `TOTP_ENABLED` | User enabled TOTP 2FA |
| `TOTP_FAILED` | Invalid TOTP code |
| `LOGOUT` | User logged out |
| `PASSWORD_CHANGED` | Password reset completed |
| `PASSWORD_RESET_REQUESTED` | Reset token generated |
| `PRIVACY_SETTINGS_UPDATED` | Privacy level changed |
| `PROFILE_UPDATED` | Display name or bio changed |
| `AVATAR_UPLOADED` | Avatar image uploaded |
| `MESSAGE_SENT` | Encrypted message stored |
| `E2EE_PUBLIC_KEY_UPDATED` | Public key uploaded |
| `POST_CREATED` | New post published |
| `POST_DELETED` | Post removed |
| `COMMENT_ADDED` | Comment on a post |
| `FRIEND_REQUEST_SENT` | Friend request issued |
| `FRIEND_REQUEST_ACCEPTED` | Friend request accepted |
| `USER_BLOCKED` | User blocked |
| `REGISTRATION_OTP_RESENT` | Registration OTP re-sent |

### Anomaly Detection
- **FAILED_LOGIN_BURST** — ≥3 failures in 5 minutes (medium) / ≥5 (high).
- **NEW_LOCATION_LOGIN** — Login from IP not seen in 30 days.
- **UNUSUAL_ACTIVITY_FREQUENCY** — >20 events in 1 hour.

### Log Storage
```sql
CREATE TABLE security_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  event_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 10. Notifications Security

### Privacy
- Notifications are scoped to the recipient — a user can only see their own notifications.
- Notification messages use generic text ("liked your post") without leaking post content.
- Self-notifications are suppressed (e.g., liking your own post generates no notification).

### Rate Protection
- Notification creation has no user-facing endpoint — they are generated server-side by social actions.
- Bulk read operations (mark-all-read) are idempotent.

---

## 11. Security Best Practices Applied

| Practice | Implementation |
|----------|---------------|
| Input validation | Zod schemas on all request bodies |
| Rate limiting | `express-rate-limit` on login, OTP, reset, posts, comments, search |
| Security headers | `helmet` (CSP, HSTS, X-Frame-Options, etc.) |
| CORS | Origin-restricted, credentials-aware |
| SQL injection prevention | Parameterized queries (`$1, $2…`) throughout |
| XSS protection | Helmet `X-XSS-Protection`, CSP headers |
| Password hashing | bcrypt with per-hash salt |
| Secrets management | `.env` file, not committed to VCS |
| File upload safety | MIME allowlist, size limit, ClamAV, unique names |
| Encryption at rest | AES-256-GCM for files, avatars, and messages |
| Transport security | JWT Bearer tokens, HTTPS recommended in production |
| JSON body limit | 100KB limit prevents payload-based DoS |
| Request tracing | X-Request-ID header on all responses |

---

## 12. Secrets & Environment Variables

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Signs JWT access tokens |
| `ENCRYPTION_KEY` | Derives master key for file encryption |
| `DB_PASSWORD` | PostgreSQL authentication |
| `EMAIL_APP_PASSWORD` | Gmail SMTP app password |
| `CORS_ORIGIN` | Allowed frontend origin |

> **Never commit `.env` files. Rotate any exposed secrets immediately.**

# API Examples

Base URL (backend): `http://localhost:3000`

All protected endpoints require `Authorization: Bearer <token>` header.

---

## Auth

### Register
```bash
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Password123!"}'
```
Response: `201 Created`
```json
{ "message": "Registration successful. Please check your email for the OTP." }
```

### Verify Registration OTP
```bash
curl -s -X POST http://localhost:3000/api/auth/verify-registration \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","otp":"123456"}'
```

### Login (Step 1 — Password)
```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Password123!"}'
```
Response (email OTP): `{ "message": "OTP sent to your email for 2FA" }`
Response (TOTP enabled): `{ "message": "TOTP required", "totp_required": true }`

### Verify Login OTP (Step 2 — 2FA)
```bash
# Email OTP
curl -s -X POST http://localhost:3000/api/auth/verify-login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","otp":"123456"}'

# TOTP
curl -s -X POST http://localhost:3000/api/auth/verify-login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","totp":"123456"}'
```
Response: `{ "token": "eyJhbGciOi...", "message": "Login successful" }`

### Enable TOTP 2FA
```bash
curl -s -X POST http://localhost:3000/api/auth/enable-2fa \
  -H "Authorization: Bearer $TOKEN"
```
Response:
```json
{
  "message": "TOTP enabled",
  "otpauth_url": "otpauth://totp/SecureSocial%20(alice@example.com)?secret=...",
  "secret_base32": "JBSWY3DPEHPK3PXP"
}
```

### Logout
```bash
curl -s -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```
Response: `{ "message": "Logged out" }`

---

## Account Recovery

### Request Password Reset
```bash
curl -s -X POST http://localhost:3000/api/auth/password-reset-request \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com"}'
```
Response: `{ "message": "If that account exists, a password reset code has been sent." }`

### Reset Password
```bash
curl -s -X POST http://localhost:3000/api/auth/password-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","reset_token":"<64-char-hex>","newPassword":"NewPass456!"}'
```

---

## Posts & Feed

### Create Post
```bash
curl -s -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Hello SecureVault!","visibility":"FRIENDS_ONLY"}'
```
Response: `201 Created`
```json
{ "id": 1, "content": "Hello SecureVault!", "visibility": "FRIENDS_ONLY", "created_at": "..." }
```

### Get Feed (Privacy-Aware)
```bash
curl -s "http://localhost:3000/api/posts/feed?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```
Response:
```json
{
  "posts": [
    {
      "id": 1,
      "author_id": 1,
      "content": "Hello SecureVault!",
      "visibility": "FRIENDS_ONLY",
      "author_email": "alice@example.com",
      "author_display_name": "Alice",
      "like_count": "3",
      "comment_count": "1",
      "liked_by_me": false
    }
  ],
  "page": 1,
  "limit": 20
}
```

### Get Single Post
```bash
curl -s http://localhost:3000/api/posts/1 \
  -H "Authorization: Bearer $TOKEN"
```

### Edit Post
```bash
curl -s -X PUT http://localhost:3000/api/posts/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Updated content","visibility":"PUBLIC"}'
```

### Delete Post
```bash
curl -s -X DELETE http://localhost:3000/api/posts/1 \
  -H "Authorization: Bearer $TOKEN"
```

### Like Post
```bash
curl -s -X POST http://localhost:3000/api/posts/1/like \
  -H "Authorization: Bearer $TOKEN"
```
Response: `{ "liked": true, "like_count": 4 }`

### Unlike Post
```bash
curl -s -X DELETE http://localhost:3000/api/posts/1/like \
  -H "Authorization: Bearer $TOKEN"
```

### Get Comments
```bash
curl -s http://localhost:3000/api/posts/1/comments \
  -H "Authorization: Bearer $TOKEN"
```

### Add Comment
```bash
curl -s -X POST http://localhost:3000/api/posts/1/comments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Great post!"}'
```

### Delete Comment
```bash
curl -s -X DELETE http://localhost:3000/api/posts/comments/1 \
  -H "Authorization: Bearer $TOKEN"
```

---

## Profiles

### Get Own Profile
```bash
curl -s http://localhost:3000/api/profiles/me \
  -H "Authorization: Bearer $TOKEN"
```
Response:
```json
{
  "display_name": "Alice",
  "bio": "Security enthusiast",
  "avatar_file_id": 5,
  "email": "alice@example.com",
  "created_at": "..."
}
```

### Update Profile
```bash
curl -s -X PUT http://localhost:3000/api/profiles/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"display_name":"Alice Secure","bio":"Privacy advocate"}'
```

### Upload Avatar
```bash
curl -s -X POST http://localhost:3000/api/profiles/me/avatar \
  -H "Authorization: Bearer $TOKEN" \
  -F "avatar=@./avatar.png"
```
Response: `{ "message": "Avatar uploaded", "fileId": 5 }`

### Search Users
```bash
curl -s "http://localhost:3000/api/profiles/search?q=bob" \
  -H "Authorization: Bearer $TOKEN"
```
Response:
```json
[
  { "id": 2, "email": "bob@example.com", "display_name": "Bob", "avatar_file_id": null }
]
```

### View Profile (Privacy Enforced)
```bash
curl -s http://localhost:3000/api/profiles/2 \
  -H "Authorization: Bearer $TOKEN"

# Also available at:
curl -s http://localhost:3000/api/profile/view/2 \
  -H "Authorization: Bearer $TOKEN"
```
Response:
```json
{
  "id": 2,
  "display_name": "Bob",
  "bio": "Hello world",
  "email": null,
  "friend_status": "NONE",
  "is_friend": false,
  "friend_count": 5,
  "posts": [ ... ],
  "privacy": { "profile_visibility": "PUBLIC", "contact_visibility": "FRIENDS_ONLY" }
}
```
Note: `email` will be `null` if the viewer doesn't meet `contact_visibility` requirements.

---

## Friends

### List Friends
```bash
curl -s http://localhost:3000/api/friends \
  -H "Authorization: Bearer $TOKEN"
```

### Incoming Friend Requests
```bash
curl -s http://localhost:3000/api/friends/requests \
  -H "Authorization: Bearer $TOKEN"
```

### Send Friend Request
```bash
curl -s -X POST http://localhost:3000/api/friends/request \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id": 2}'
```
Response: `{ "message": "Friend request sent", "status": "PENDING" }`

### Accept Friend Request
```bash
curl -s -X POST http://localhost:3000/api/friends/accept \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id": 2}'
```

### Reject Friend Request
```bash
curl -s -X POST http://localhost:3000/api/friends/reject \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id": 2}'
```

### Block User
```bash
curl -s -X POST http://localhost:3000/api/friends/block \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id": 2}'
```

### Remove Friend
```bash
curl -s -X DELETE http://localhost:3000/api/friends/2 \
  -H "Authorization: Bearer $TOKEN"
```

---

## Notifications

### List Notifications
```bash
curl -s "http://localhost:3000/api/notifications?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```
Response:
```json
{
  "notifications": [
    {
      "id": 1,
      "type": "LIKE",
      "message": "liked your post",
      "is_read": false,
      "from_email": "bob@example.com",
      "from_display_name": "Bob",
      "created_at": "..."
    }
  ],
  "page": 1,
  "limit": 20
}
```

### Unread Count
```bash
curl -s http://localhost:3000/api/notifications/unread-count \
  -H "Authorization: Bearer $TOKEN"
```
Response: `{ "count": 3 }`

### Mark as Read
```bash
curl -s -X PUT http://localhost:3000/api/notifications/1/read \
  -H "Authorization: Bearer $TOKEN"
```

### Mark All as Read
```bash
curl -s -X PUT http://localhost:3000/api/notifications/read-all \
  -H "Authorization: Bearer $TOKEN"
```

---

## Privacy

### Get Privacy Settings
```bash
curl -s http://localhost:3000/api/privacy/settings \
  -H "Authorization: Bearer $TOKEN"
```
Response:
```json
{
  "profile_visibility": "PUBLIC",
  "post_visibility": "FRIENDS_ONLY",
  "contact_visibility": "PRIVATE"
}
```

### Update Privacy Settings
```bash
curl -s -X PUT http://localhost:3000/api/privacy/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"profile_visibility":"FRIENDS_ONLY","contact_visibility":"PRIVATE"}'
```

---

## Messaging (E2E Encrypted)

### Upload Public Key
```bash
curl -s -X PUT http://localhost:3000/api/messages/key \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"public_key_spki":"<base64-spki-key>"}'
```

### Get User's Public Key
```bash
curl -s http://localhost:3000/api/messages/key/2 \
  -H "Authorization: Bearer $TOKEN"
```

### Send Encrypted Message
```bash
curl -s -X POST http://localhost:3000/api/messages/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "receiver_id": 2,
    "encrypted_message": "<base64-ciphertext>",
    "iv": "<base64-iv>",
    "auth_tag": "webcrypto",
    "encrypted_key_for_sender": "<base64-rsa-wrapped>",
    "encrypted_key_for_receiver": "<base64-rsa-wrapped>"
  }'
```

### Get Messages with User
```bash
curl -s "http://localhost:3000/api/messages/get?with=2" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Files

### Upload File
```bash
curl -s -X POST http://localhost:3000/api/files/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./example.pdf"
```
Response: `{ "message": "File uploaded securely", "fileId": 1, "fileHash": "abc123..." }`

### List My Files
```bash
curl -s http://localhost:3000/api/files \
  -H "Authorization: Bearer $TOKEN"
```

### Download File
```bash
curl -L http://localhost:3000/api/files/download/1 \
  -H "Authorization: Bearer $TOKEN" \
  -o downloaded.pdf
```

### Share File
```bash
curl -s -X POST http://localhost:3000/api/files/share \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fileId": 1, "receiverEmail": "bob@example.com"}'
```

### Files Shared With Me
```bash
curl -s http://localhost:3000/api/files/shared-with-me \
  -H "Authorization: Bearer $TOKEN"
```

---

## Monitoring

### Get Security Logs
```bash
curl -s http://localhost:3000/api/monitoring/logs \
  -H "Authorization: Bearer $TOKEN"
```

### Get Security Alerts
```bash
curl -s http://localhost:3000/api/monitoring/security-alerts \
  -H "Authorization: Bearer $TOKEN"
```
Response:
```json
{
  "known_ips_last_7_days": ["127.0.0.1", "192.168.1.100"],
  "alerts": [
    { "type": "FAILED_LOGIN_BURST", "severity": "high", "detail": "5 failed logins in last 5 minutes" },
    { "type": "NEW_LOCATION_LOGIN", "severity": "medium", "detail": "Login from new IP: 203.0.113.50 at 2024-..." }
  ]
}
```

---

## Health Check

```bash
curl -s http://localhost:3000/api/health
```
Response: `{ "status": "ok", "timestamp": "2024-..." }`

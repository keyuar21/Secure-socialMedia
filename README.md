# SecureVault — Secure Social Platform

<div align="center">

![SecureVault](https://img.shields.io/badge/SecureVault-Social%20Platform-blue?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)
![Node](https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-336791?style=for-the-badge&logo=postgresql)

**A privacy-first, industry-grade social media platform with end-to-end encrypted messaging, AES-256 file encryption, 2FA authentication, and comprehensive security logging.**

</div>

---

## Features

- **End-to-End Encrypted Messaging** — RSA-OAEP + AES-GCM hybrid encryption. Messages are encrypted in your browser; the server only stores ciphertext.
- **AES-256-GCM File Encryption** — All uploaded files are encrypted at rest with per-file unique keys.
- **Two-Factor Authentication (2FA)** — Email OTP and TOTP (Google Authenticator) support.
- **Social Platform** — Posts, comments, likes, friend requests, real-time notifications.
- **Security Audit Logs** — Every user action is logged server-side for accountability.
- **Rate Limiting & Lockout** — Brute-force protection on all auth endpoints.
- **Malware Scanning** — ClamAV integration for file upload scanning.
- **Privacy Controls** — Granular per-user privacy settings.
- **Real-Time Updates** — Background polling for messages and dashboard data.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TailwindCSS |
| Backend | Node.js, Express 5 |
| Database | PostgreSQL |
| Auth | JWT, bcrypt, speakeasy (TOTP) |
| Encryption | Web Crypto API (frontend), Node.js crypto (backend) |
| File Security | AES-256-GCM + ClamAV |

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- (Optional) ClamAV for malware scanning

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/securevault.git
cd securevault
```

### 2. Set Up the Database

```bash
# Create the database
createdb secure_file_storage

# Run the schema
psql -d secure_file_storage -f backend/schema.sql
```

### 3. Configure the Backend

```bash
cd backend
cp .env.example .env
# Edit .env and fill in your real values
npm install
```

### 4. Configure the Frontend

```bash
cd frontend
cp .env.example .env
# Edit .env — set VITE_API_URL to your backend URL
npm install
```

### 5. Run Locally

```bash
# Terminal 1 — Backend
cd backend && npx nodemon index.js

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key for JWT signing (min 64 chars) |
| `ENCRYPTION_KEY` | AES-256 master encryption key (32 chars) |
| `EMAIL_USER` | Gmail address for sending OTPs |
| `EMAIL_APP_PASSWORD` | Gmail App Password |
| `PORT` | Server port (default: 3000) |
| `CORS_ORIGIN` | Allowed frontend origin |
| `BYPASS_AV_SCAN_IN_DEV` | Skip ClamAV in local dev (`true`/`false`) |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL (e.g. `http://localhost:3000/api`) |

---

## Security Architecture

- **Passwords** hashed with bcrypt (salt rounds: 10)
- **JWT tokens** expire after 1 hour
- **Account lockout** after 5 failed login attempts (15 min)
- **SQL injection** prevented via parameterised queries
- **XSS** mitigated via helmet.js + React's built-in escaping
- **CSRF** not applicable (stateless JWT + no cookie auth)
- **Rate limiting** on all sensitive endpoints
- **Timing-safe** password reset token comparison
- **CSV injection** sanitised in security log exports
- **File uploads** validated by MIME type and scanned by ClamAV

See [SECURITY.md](SECURITY.md) for the full security policy.

---

## Project Structure

```
secure-file-storage/
├── backend/
│   ├── index.js              # Entry point
│   ├── schema.sql            # Database schema
│   ├── db.js                 # PostgreSQL pool
│   ├── email.js              # Nodemailer config
│   ├── middleware/
│   │   ├── auth.js           # JWT auth middleware
│   │   ├── rateLimiters.js   # Rate limit configs
│   │   └── securityLogs.js   # Audit log helper
│   └── routes/
│       ├── auth.js           # Register, login, 2FA, reset
│       ├── files.js          # Upload, download, share
│       ├── messages.js       # E2EE messaging
│       ├── posts.js          # Feed & social
│       ├── friends.js        # Friend requests
│       ├── profiles.js       # User profiles
│       ├── privacy.js        # Privacy settings
│       ├── notifications.js  # Real-time notifications
│       └── monitoring.js     # Security logs & alerts
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── pages/            # Login, Register, Feed, Dashboard, Profile
│       └── components/       # Reusable UI components
├── .gitignore
└── README.md
```

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate and never commit `.env` files with real secrets.
# Secure-socialMedia

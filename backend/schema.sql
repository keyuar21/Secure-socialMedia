-- Secure Social Platform — Full Schema
-- Run against your PostgreSQL database (e.g. secure_file_storage).

BEGIN;

-- ═══════════════════════════════════════════════════
-- 1. USERS
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  twofa_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  totp_secret TEXT,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  account_locked_until TIMESTAMPTZ,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════
-- 2. OTP TABLE
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS otps (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  otp_code TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('registration','login','password_reset')),
  expiry_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, purpose)
);

CREATE INDEX IF NOT EXISTS idx_otps_expiry ON otps(expiry_time);

-- ═══════════════════════════════════════════════════
-- 3. PRIVACY ENUM + SETTINGS
-- ═══════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'privacy_level') THEN
    CREATE TYPE privacy_level AS ENUM ('PUBLIC','FRIENDS_ONLY','PRIVATE');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS privacy_settings (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  profile_visibility privacy_level NOT NULL DEFAULT 'PUBLIC',
  post_visibility privacy_level NOT NULL DEFAULT 'FRIENDS_ONLY',
  contact_visibility privacy_level NOT NULL DEFAULT 'PRIVATE'
);

-- ═══════════════════════════════════════════════════
-- 4. FRIENDS
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS friends (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('PENDING','ACCEPTED','BLOCKED')) DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friends_user_status ON friends(user_id, status);
CREATE INDEX IF NOT EXISTS idx_friends_friend_status ON friends(friend_id, status);

-- ═══════════════════════════════════════════════════
-- 5. E2EE MESSAGING
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_keys (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  public_key_spki TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  encrypted_message TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  encrypted_key_for_sender TEXT,
  encrypted_key_for_receiver TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_pair_time ON messages(sender_id, receiver_id, timestamp DESC);

-- ═══════════════════════════════════════════════════
-- 6. FILES (encrypted blob metadata)
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS files (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size BIGINT NOT NULL,
  encrypted_path TEXT NOT NULL,
  encryption_key TEXT,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  file_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS file_shares (
  file_id BIGINT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (file_id, receiver_id)
);

-- ═══════════════════════════════════════════════════
-- 7. USER PROFILES (depends on files for avatar_file_id)
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  avatar_file_id BIGINT REFERENCES files(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_name ON user_profiles(display_name);

-- ═══════════════════════════════════════════════════
-- 8. POSTS
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS posts (
  id BIGSERIAL PRIMARY KEY,
  author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_file_id BIGINT REFERENCES files(id) ON DELETE SET NULL,
  visibility privacy_level NOT NULL DEFAULT 'FRIENDS_ONLY',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_visibility ON posts(visibility, created_at DESC);

-- ═══════════════════════════════════════════════════
-- 9. COMMENTS
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS comments (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);

-- ═══════════════════════════════════════════════════
-- 10. LIKES
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS likes (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id);

-- ═══════════════════════════════════════════════════
-- 11. NOTIFICATIONS
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  from_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  reference_id BIGINT,
  reference_type TEXT,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- ═══════════════════════════════════════════════════
-- 12. PASSWORD RESETS
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS password_resets (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  reset_token TEXT NOT NULL,
  expiry_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_expiry ON password_resets(expiry_time);

-- ═══════════════════════════════════════════════════
-- 13. SECURITY LOGS
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS security_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_logs_user_time ON security_logs(user_id, timestamp DESC);

-- ═══════════════════════════════════════════════════
-- 14. TRIGGERS
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_posts_updated_at ON posts;
CREATE TRIGGER update_posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMIT;

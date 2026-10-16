CREATE TABLE IF NOT EXISTS referrals (
  referee_user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  referrer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  rewarded_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer
  ON referrals(referrer_user_id);

ALTER TABLE users ADD COLUMN referral_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code
  ON users(referral_code);

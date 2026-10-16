CREATE TABLE IF NOT EXISTS attest_keys (
  key_id TEXT PRIMARY KEY,
  public_key TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS attest_challenges (
  challenge TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attest_challenges_created_at
  ON attest_challenges (created_at);

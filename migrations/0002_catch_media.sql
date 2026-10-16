CREATE TABLE IF NOT EXISTS catch_media (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  catch_id TEXT NOT NULL DEFAULT '',
  basename TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'photo',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT '',
  updated_at_ms INTEGER NOT NULL,
  deleted_at TEXT,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_catch_media_user_updated
  ON catch_media(user_id, updated_at_ms);

CREATE INDEX IF NOT EXISTS idx_catch_media_user_basename
  ON catch_media(user_id, basename);

CREATE TABLE IF NOT EXISTS media_objects (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  basename TEXT NOT NULL,
  bytes INTEGER NOT NULL DEFAULT 0,
  content_type TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, basename)
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL UNIQUE,
  clerk_user_id TEXT UNIQUE,
  email TEXT,
  account_name TEXT,
  angler_name TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_synced_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_angler_name ON users(angler_name);

CREATE TABLE IF NOT EXISTS devices (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  platform TEXT,
  model TEXT,
  os_name TEXT,
  os_version TEXT,
  app_version TEXT,
  first_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at TEXT,
  PRIMARY KEY (user_id, device_id)
);

CREATE TABLE IF NOT EXISTS catches (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  species TEXT NOT NULL DEFAULT '',
  weight_kg REAL,
  length_cm REAL,
  caught_at TEXT NOT NULL DEFAULT '',
  spot_id TEXT,
  session_id TEXT,
  method TEXT NOT NULL DEFAULT '',
  weather TEXT NOT NULL DEFAULT '',
  air_temp_c REAL,
  wind_kph REAL,
  pressure_hpa REAL,
  released INTEGER NOT NULL DEFAULT 0,
  landed INTEGER NOT NULL DEFAULT 1,
  pinned INTEGER NOT NULL DEFAULT 0,
  bait TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT '',
  updated_at_ms INTEGER NOT NULL,
  deleted_at TEXT,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_catches_user_updated
  ON catches(user_id, updated_at_ms);

CREATE TABLE IF NOT EXISTS spots (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  water_type TEXT NOT NULL DEFAULT 'freshwater',
  latitude REAL,
  longitude REAL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT '',
  updated_at_ms INTEGER NOT NULL,
  deleted_at TEXT,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_spots_user_updated
  ON spots(user_id, updated_at_ms);

CREATE TABLE IF NOT EXISTS sessions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT '',
  ended_at TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT '',
  updated_at_ms INTEGER NOT NULL,
  deleted_at TEXT,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_updated
  ON sessions(user_id, updated_at_ms);

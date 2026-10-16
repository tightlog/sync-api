ALTER TABLE users ADD COLUMN revenuecat_app_user_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_revenuecat_app_user_id
  ON users(revenuecat_app_user_id);

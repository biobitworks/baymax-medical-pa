CREATE TABLE IF NOT EXISTS baymax_apple_health_connections (
  session_hash text PRIMARY KEY REFERENCES baymax_care_workspaces(session_hash) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL CHECK (length(token_hash) = 64),
  created_at timestamptz NOT NULL DEFAULT now(),
  time_zone text NOT NULL DEFAULT 'UTC',
  last_sync_at timestamptz
);
CREATE TABLE IF NOT EXISTS baymax_apple_health_days (
  session_hash text NOT NULL REFERENCES baymax_apple_health_connections(session_hash) ON DELETE CASCADE,
  date date NOT NULL,
  metrics jsonb NOT NULL,
  exported_at timestamptz NOT NULL,
  PRIMARY KEY (session_hash, date)
);

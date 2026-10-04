CREATE TABLE IF NOT EXISTS baymax_care_workspaces (
  session_hash text PRIMARY KEY CHECK (length(session_hash) = 64),
  state jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

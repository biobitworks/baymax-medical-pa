CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  external_id text UNIQUE,
  name text NOT NULL,
  email text UNIQUE,
  date_of_birth date,
  sex text,
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS user_conditions (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  notes text,
  PRIMARY KEY (user_id, name)
);
CREATE TABLE IF NOT EXISTS user_medications (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  PRIMARY KEY (user_id, name)
);
CREATE TABLE IF NOT EXISTS user_allergies (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  PRIMARY KEY (user_id, name)
);
CREATE TABLE IF NOT EXISTS checkins (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checked_on date NOT NULL,
  energy text NOT NULL CHECK (energy IN ('low', 'okay', 'good', 'great')),
  note text,
  PRIMARY KEY (user_id, checked_on)
);
CREATE TABLE IF NOT EXISTS daily_metrics (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day date NOT NULL,
  steps integer NOT NULL DEFAULT 0,
  active_minutes integer NOT NULL DEFAULT 0,
  hydration_ml integer NOT NULL DEFAULT 0,
  sleep_hours double precision NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
CREATE TABLE IF NOT EXISTS runs (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ran_on date NOT NULL,
  distance_mi double precision NOT NULL,
  duration_min double precision NOT NULL,
  note text
);
CREATE INDEX IF NOT EXISTS runs_user_date_idx ON runs (user_id, ran_on DESC);
CREATE TABLE IF NOT EXISTS body_measurements (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  measured_on date NOT NULL,
  type text NOT NULL,
  value double precision NOT NULL,
  unit text NOT NULL,
  PRIMARY KEY (user_id, measured_on, type)
);
CREATE TABLE IF NOT EXISTS records (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id text NOT NULL,
  name text NOT NULL,
  source text NOT NULL CHECK (source IN ('library', 'upload')),
  format text NOT NULL,
  content text NOT NULL,
  size_bytes integer NOT NULL,
  conversation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
CREATE TABLE IF NOT EXISTS lab_results (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  record_id text NOT NULL,
  panel text,
  biomarker text NOT NULL,
  unit text NOT NULL DEFAULT '',
  value double precision NOT NULL,
  reference_low double precision,
  reference_high double precision,
  flag text,
  notes text,
  measured_on date NOT NULL,
  FOREIGN KEY (user_id, record_id) REFERENCES records (user_id, id) ON DELETE CASCADE,
  UNIQUE (user_id, record_id, biomarker, measured_on)
);
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New chat',
  head_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conversations_user_updated_idx ON conversations (user_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS conversation_messages (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  id text NOT NULL,
  parent_id text,
  role text NOT NULL,
  position integer NOT NULL,
  content jsonb NOT NULL,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  run_config jsonb,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (conversation_id, id)
)

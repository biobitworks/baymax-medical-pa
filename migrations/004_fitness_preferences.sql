CREATE TABLE IF NOT EXISTS user_fitness_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  steps_goal integer NOT NULL DEFAULT 5000 CHECK (steps_goal BETWEEN 1000 AND 30000),
  active_minutes_goal integer NOT NULL DEFAULT 20 CHECK (active_minutes_goal BETWEEN 5 AND 180),
  notifications text NOT NULL DEFAULT 'off' CHECK (notifications IN ('off', 'enabled', 'unavailable')),
  onboarded boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
)

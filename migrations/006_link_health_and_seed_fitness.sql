ALTER TABLE baymax_apple_health_connections ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE SET NULL;
UPDATE baymax_apple_health_connections SET user_id = '8f1c2d3e-4a5b-4c6d-9e7f-0a1b2c3d4e5f' WHERE user_id IS NULL AND EXISTS (SELECT 1 FROM users WHERE id = '8f1c2d3e-4a5b-4c6d-9e7f-0a1b2c3d4e5f');
INSERT INTO user_fitness_preferences (user_id, onboarded) SELECT id, true FROM users WHERE id = '8f1c2d3e-4a5b-4c6d-9e7f-0a1b2c3d4e5f' ON CONFLICT (user_id) DO NOTHING

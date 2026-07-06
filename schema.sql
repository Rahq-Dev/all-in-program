CREATE TABLE IF NOT EXISTS signups (
  id TEXT PRIMARY KEY,
  parent_name TEXT NOT NULL,
  player_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  signup_type TEXT NOT NULL,
  selected_day_ids TEXT NOT NULL,
  week_ids TEXT NOT NULL,
  selected_dates TEXT NOT NULL,
  submitted_at TEXT NOT NULL
);


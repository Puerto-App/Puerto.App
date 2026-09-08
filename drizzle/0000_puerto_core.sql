CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','member')),
  birthday_day INTEGER NOT NULL CHECK(birthday_day BETWEEN 1 AND 31),
  birthday_month INTEGER NOT NULL CHECK(birthday_month BETWEEN 1 AND 12),
  personal_bio TEXT NOT NULL DEFAULT '',
  ai_bio TEXT NOT NULL DEFAULT '',
  avatar_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE external_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK(provider IN ('google','apple')),
  provider_subject TEXT NOT NULL,
  provider_email TEXT,
  linked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, provider_subject)
);
CREATE TABLE expenses (
  id TEXT PRIMARY KEY,
  payer_id TEXT NOT NULL REFERENCES users(id),
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  concept TEXT NOT NULL CHECK(length(concept) BETWEEN 1 AND 140),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE expense_shares (
  expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  debtor_id TEXT NOT NULL REFERENCES users(id),
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  paid_at TEXT,
  paid_by_id TEXT REFERENCES users(id),
  PRIMARY KEY(expense_id, debtor_id)
);
CREATE INDEX expense_shares_debtor_open ON expense_shares(debtor_id, paid_at);
CREATE TABLE roulette_sessions (
  id TEXT PRIMARY KEY,
  created_by_id TEXT NOT NULL REFERENCES users(id),
  mode TEXT NOT NULL CHECK(mode IN ('teams2','teams3','single')),
  eligible_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE location_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  accuracy_m REAL NOT NULL,
  captured_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX location_logs_user_time ON location_logs(user_id, captured_at DESC);
CREATE TABLE birthday_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  local_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, local_date)
);

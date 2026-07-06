CREATE TABLE IF NOT EXISTS shared_tables (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  summary_cards TEXT NOT NULL DEFAULT '[]',
  columns TEXT NOT NULL DEFAULT '[]',
  rows TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_shared_tables_published_updated
ON shared_tables (published, updated_at DESC);

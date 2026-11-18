CREATE TABLE IF NOT EXISTS hub_state (
  singleton_id TEXT PRIMARY KEY DEFAULT 'default' CHECK (singleton_id = 'default'),
  version BIGINT NOT NULL DEFAULT 1,
  state JSONB NOT NULL,
  state_sha256 CHAR(64) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_state_backups (
  id TEXT PRIMARY KEY,
  state JSONB NOT NULL,
  state_sha256 CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  checksum TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hub_state_backups_created_at_idx
  ON hub_state_backups (created_at DESC);

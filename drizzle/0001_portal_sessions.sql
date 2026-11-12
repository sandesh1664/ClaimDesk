CREATE TABLE portal_sessions (
  token_hash TEXT PRIMARY KEY,
  sandbox_id TEXT NOT NULL REFERENCES demo_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('customer','officer','support','admin')),
  expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX portal_sessions_expiry ON portal_sessions(expires_at);

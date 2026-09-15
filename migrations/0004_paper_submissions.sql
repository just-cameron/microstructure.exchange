CREATE TABLE IF NOT EXISTS paper_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  call_id TEXT NOT NULL,
  submission_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  abstract TEXT,
  submitter_name TEXT NOT NULL,
  submitter_email TEXT NOT NULL,
  coauthors_json TEXT NOT NULL DEFAULT '[]',
  author_names TEXT,
  author_emails TEXT,
  original_filename TEXT NOT NULL,
  stored_filename TEXT,
  r2_key TEXT,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  confirmation_token TEXT NOT NULL UNIQUE,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_agent TEXT,
  ip_hash TEXT,
  UNIQUE (call_id, submission_number)
);

CREATE INDEX IF NOT EXISTS idx_paper_submissions_call ON paper_submissions(call_id, submission_number);
CREATE INDEX IF NOT EXISTS idx_paper_submissions_email ON paper_submissions(submitter_email);

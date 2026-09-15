CREATE TABLE IF NOT EXISTS assessment_papers (
  id TEXT PRIMARY KEY,
  paper_number INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'application/pdf',
  sort_order INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assessment_reviewers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reviewer_code TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT NOT NULL,
  submitted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assessment_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reviewer_id INTEGER NOT NULL,
  paper_id TEXT NOT NULL,
  assignment_order INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (reviewer_id, paper_id),
  FOREIGN KEY (reviewer_id) REFERENCES assessment_reviewers(id),
  FOREIGN KEY (paper_id) REFERENCES assessment_papers(id)
);

CREATE TABLE IF NOT EXISTS assessment_ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reviewer_id INTEGER NOT NULL,
  paper_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comments TEXT,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_agent TEXT,
  ip_hash TEXT,
  UNIQUE (reviewer_id, paper_id),
  FOREIGN KEY (reviewer_id) REFERENCES assessment_reviewers(id),
  FOREIGN KEY (paper_id) REFERENCES assessment_papers(id)
);

CREATE INDEX IF NOT EXISTS idx_assessment_assignments_reviewer ON assessment_assignments(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_assessment_assignments_paper ON assessment_assignments(paper_id);
CREATE INDEX IF NOT EXISTS idx_assessment_ratings_reviewer ON assessment_ratings(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_assessment_ratings_paper ON assessment_ratings(paper_id);

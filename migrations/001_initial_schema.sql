-- Create timesheet_entries table
CREATE TABLE IF NOT EXISTS timesheet_entries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  project TEXT NOT NULL,
  description TEXT NOT NULL,
  hours REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for efficient date queries
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_date ON timesheet_entries(date);

-- Create index for project queries
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_project ON timesheet_entries(project);

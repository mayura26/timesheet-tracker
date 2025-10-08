-- Create tasks table for managing task budgets and notes
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_name TEXT NOT NULL,
  description TEXT NOT NULL,
  budgeted_hours REAL DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_name, description)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_name);

-- Populate tasks table with existing unique task combinations from time entries
INSERT OR IGNORE INTO tasks (id, project_name, description, budgeted_hours, notes, created_at, updated_at)
SELECT 
  project || '|' || description as id,
  project as project_name,
  description,
  0 as budgeted_hours,
  '' as notes,
  MIN(created_at) as created_at,
  CURRENT_TIMESTAMP as updated_at
FROM timesheet_entries
GROUP BY project, description;

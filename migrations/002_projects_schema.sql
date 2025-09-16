-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT 1,
  color TEXT DEFAULT '#3b82f6',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default projects
INSERT OR IGNORE INTO projects (id, name, description, is_active, color) VALUES
('1', 'Client A', 'Primary client work', 1, '#3b82f6'),
('2', 'Client B', 'Secondary client work', 1, '#10b981'),
('3', 'Internal', 'Internal company work', 1, '#f59e0b'),
('4', 'Admin', 'Administrative tasks', 1, '#ef4444'),
('5', 'Other', 'Miscellaneous work', 1, '#8b5cf6');

-- Create index for active projects
CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(is_active);

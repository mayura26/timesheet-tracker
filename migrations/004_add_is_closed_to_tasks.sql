-- Add is_closed field to tasks table
ALTER TABLE tasks ADD COLUMN is_closed INTEGER DEFAULT 0;

-- Create index for faster lookups of open tasks
CREATE INDEX IF NOT EXISTS idx_tasks_is_closed ON tasks(is_closed);


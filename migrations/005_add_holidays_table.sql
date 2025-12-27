-- Create holidays table
CREATE TABLE IF NOT EXISTS holidays (
  date TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for efficient date queries
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);


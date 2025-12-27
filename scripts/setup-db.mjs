import dotenv from 'dotenv';
import { createClient } from '@libsql/client';

dotenv.config({ path: '.env.local' });

async function setupDatabase() {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!databaseUrl || !authToken) {
    console.error('Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables');
    process.exit(1);
  }

  const client = createClient({
    url: databaseUrl,
    authToken: authToken,
  });

  try {
    console.log('Creating timesheet_entries table...');
    await client.execute(`
      CREATE TABLE IF NOT EXISTS timesheet_entries (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        project TEXT NOT NULL,
        description TEXT NOT NULL,
        hours REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Table created successfully');

    console.log('Creating date index...');
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_timesheet_entries_date ON timesheet_entries(date)
    `);
    console.log('✅ Date index created successfully');

    console.log('Creating project index...');
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_timesheet_entries_project ON timesheet_entries(project)
    `);
    console.log('✅ Project index created successfully');

    console.log('Creating projects table...');
    await client.execute(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        is_active BOOLEAN DEFAULT 1,
        color TEXT DEFAULT '#3b82f6',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Projects table created successfully');

    console.log('Creating projects index...');
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(is_active)
    `);
    console.log('✅ Projects index created successfully');

    console.log('Inserting default projects...');
    await client.execute(`
      INSERT OR IGNORE INTO projects (id, name, description, is_active, color) VALUES
      ('1', 'Client A', 'Primary client work', 1, '#3b82f6'),
      ('2', 'Client B', 'Secondary client work', 1, '#10b981'),
      ('3', 'Internal', 'Internal company work', 1, '#f59e0b'),
      ('4', 'Admin', 'Administrative tasks', 1, '#ef4444'),
      ('5', 'Other', 'Miscellaneous work', 1, '#8b5cf6')
    `);
    console.log('✅ Default projects inserted successfully');

    console.log('Creating holidays table...');
    await client.execute(`
      CREATE TABLE IF NOT EXISTS holidays (
        date TEXT PRIMARY KEY,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Holidays table created successfully');

    console.log('Creating holidays index...');
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date)
    `);
    console.log('✅ Holidays index created successfully');

    console.log('🎉 Database setup completed successfully!');
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

setupDatabase();

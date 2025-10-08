import dotenv from 'dotenv';
import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: '.env.local' });

async function runMigration() {
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
    // Read the migration file
    const migrationPath = join(__dirname, '..', 'migrations', '003_add_tasks_table.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log('Running migration: 003_add_tasks_table.sql');
    console.log('----------------------------------------');

    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      console.log('Executing statement...');
      await client.execute(statement);
      console.log('✅ Statement executed successfully');
    }

    console.log('----------------------------------------');
    console.log('🎉 Migration completed successfully!');
    
    // Verify the tasks table was created
    const result = await client.execute(`
      SELECT COUNT(*) as count FROM tasks
    `);
    console.log(`📊 Tasks table now has ${result.rows[0].count} entries`);

  } catch (error) {
    console.error('❌ Error running migration:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

runMigration();

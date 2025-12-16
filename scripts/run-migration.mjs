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
    const migrationPath = join(__dirname, '..', 'migrations', '004_add_is_closed_to_tasks.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log('Running migration: 004_add_is_closed_to_tasks.sql');
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
    
    // Verify the is_closed column was added
    const result = await client.execute(`
      SELECT COUNT(*) as count FROM tasks WHERE is_closed = 0
    `);
    console.log(`📊 Found ${result.rows[0].count} open tasks`);

  } catch (error) {
    console.error('❌ Error running migration:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

runMigration();

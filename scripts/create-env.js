const fs = require('fs');
const path = require('path');

const envContent = `# Turso Database Configuration
# Get these values from your Turso dashboard at https://turso.tech/
TURSO_DATABASE_URL=libsql://your-database-name-your-username.turso.io
TURSO_AUTH_TOKEN=your-auth-token-here

# Instructions:
# 1. Sign up at https://turso.tech/
# 2. Create a new database
# 3. Copy the database URL and auth token from your dashboard
# 4. Replace the placeholder values above with your actual credentials
# 5. Run 'npm run setup-db' to initialize the database schema
`;

const envPath = path.join(__dirname, '..', '.env.local');

try {
  if (fs.existsSync(envPath)) {
    console.log('.env.local already exists. Skipping creation.');
  } else {
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Created .env.local file with Turso placeholders');
    console.log('📝 Please edit .env.local and add your actual Turso credentials');
    console.log('🚀 Then run: npm run setup-db');
  }
} catch (error) {
  console.error('Error creating .env.local:', error.message);
  process.exit(1);
}

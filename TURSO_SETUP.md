# Turso Database Setup Instructions

## 1. Create Environment File

Create a `.env.local` file in the root directory with the following content:

```env
# Turso Database Configuration
TURSO_DATABASE_URL=libsql://your-database-name-your-username.turso.io
TURSO_AUTH_TOKEN=your-auth-token-here
```

## 2. Get Turso Credentials

1. Sign up at [https://turso.tech/](https://turso.tech/)
2. Create a new database
3. Copy the database URL and auth token from your dashboard
4. Replace the placeholder values in `.env.local` with your actual credentials

## 3. Initialize Database

Run the following command to set up the database schema:

```bash
npm run setup-db
```

## 4. Start Development Server

```bash
npm run dev
```

## Environment Variables Reference

- `TURSO_DATABASE_URL`: Your Turso database URL (starts with `libsql://`)
- `TURSO_AUTH_TOKEN`: Your Turso authentication token

## Troubleshooting

- Make sure your `.env.local` file is in the root directory
- Verify your Turso credentials are correct
- Check that the database setup script ran successfully
- Ensure your Turso database is accessible and not paused

#!/bin/bash
# Database Cleanup Script
# Drops the SQLite database and recreates the schema using `prisma db push`.
# NOTE: Migrations are disabled during development. Re-enable when moving to PostgreSQL.

set -e

# Navigate to the prisma directory (where this script lives)
cd "$(dirname "$0")"/..

echo "🗑️  Cleaning database..."

for file in dev.db dev.db-journal dev.db-shm dev.db-wal; do
    if [ -f "$file" ]; then
        rm "$file"
        echo "✅ Deleted: prisma/$file"
    fi
done

echo ""
echo "🔨 Recreating schema with prisma db push..."

# Run from the project root
cd ..
npx prisma db push

echo ""
echo "✅ Database cleaned and schema pushed!"
echo "You can now start the application with: npm run dev"


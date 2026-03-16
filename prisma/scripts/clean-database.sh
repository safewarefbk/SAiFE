#!/bin/bash
# Database Cleanup Script (PostgreSQL)
# Drops all tables in the connected PostgreSQL database and recreates the schema
# using `prisma db push --force-reset`.
# Credentials are read from the .env file in the project root.
# If the postgres Docker container is not running, it is started automatically.

set -e

# Resolve project root (two levels up from prisma/scripts/)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load .env so DATABASE_URL and POSTGRES_* are available
if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$PROJECT_ROOT/.env"
    set +a
else
    echo "❌  .env file not found at $PROJECT_ROOT/.env"
    exit 1
fi

if [ -z "$DATABASE_URL" ]; then
    echo "❌  DATABASE_URL is not set in .env"
    exit 1
fi

echo "⚠️  This will DELETE ALL DATA in the database."
echo "   DATABASE_URL: $DATABASE_URL"
echo ""
read -r -p "Are you sure you want to continue? [y/N] " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Aborted."
    exit 0
fi

# ── Ensure postgres container is running ─────────────────────────────────────
CONTAINER_NAME="saife-postgres"
STARTED_CONTAINER=false

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo ""
    echo "🐳 PostgreSQL container is not running. Starting it..."
    cd "$PROJECT_ROOT"
    docker compose up -d postgres
    STARTED_CONTAINER=true
fi

echo ""
echo "⏳ Waiting for PostgreSQL to be ready..."
for i in $(seq 1 30); do
    if docker exec "$CONTAINER_NAME" pg_isready -U "${POSTGRES_USER:-saife_user}" -d saife -q 2>/dev/null; then
        echo "✅ PostgreSQL is ready."
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "❌ PostgreSQL did not become ready in time."
        exit 1
    fi
    sleep 1
done

# ── Drop and recreate schema ─────────────────────────────────────────────────
echo ""
echo "🗑️  Dropping all tables and recreating schema..."


cd "$PROJECT_ROOT"

npx prisma db push --force-reset

echo ""
echo "✅ Database cleaned and schema pushed!"

# Stop the container if we started it just for this script
if [ "$STARTED_CONTAINER" = true ]; then
    echo ""
    read -r -p "The postgres container was started by this script. Stop it now? [y/N] " stop_confirm
    if [[ "$stop_confirm" == "y" || "$stop_confirm" == "Y" ]]; then
        docker compose stop postgres
        echo "🛑 postgres container stopped."
    fi
fi

echo ""
echo "You can now start the application with: npm run dev  (or docker compose up)"

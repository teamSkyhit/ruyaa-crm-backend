#!/bin/bash

# Script to create a migration for production deployment
# Usage: ./scripts/create-production-migration.sh "migration_name"

set -e

MIGRATION_NAME=${1:-"add_production_changes"}

echo "🚀 Creating migration: $MIGRATION_NAME"
echo ""

# Check if we're in the right directory
if [ ! -f "prisma/schema.prisma" ]; then
    echo "❌ Error: prisma/schema.prisma not found. Please run this from the project root."
    exit 1
fi

# Check if DATABASE_URL is set (for local dev)
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  Warning: DATABASE_URL not set. Using .env file if available."
fi

echo "📋 Steps:"
echo "1. Creating migration..."
npx prisma migrate dev --name "$MIGRATION_NAME" --create-only

echo ""
echo "✅ Migration created successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Review the migration file in: prisma/migrations/"
echo "2. Test the migration on a staging database"
echo "3. Commit the migration to version control"
echo "4. Deploy to production using: npx prisma migrate deploy"
echo ""


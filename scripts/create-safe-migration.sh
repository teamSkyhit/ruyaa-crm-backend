#!/bin/bash

# Script to create a safe migration that handles existing data
# Run this on your EC2 server

set -e

echo "🔧 Creating migration with data handling..."

# Step 1: Create migration file only (without applying)
npx prisma migrate dev --create-only --name add_multi_store_pos_features

echo ""
echo "✅ Migration file created!"
echo ""
echo "📝 Next: You need to manually edit the migration file to handle existing data"
echo "   Location: prisma/migrations/[timestamp]_add_multi_store_pos_features/migration.sql"
echo ""
echo "The migration needs to:"
echo "1. Add columns as nullable first"
echo "2. Update existing rows with default values"
echo "3. Then make columns required (if needed)"


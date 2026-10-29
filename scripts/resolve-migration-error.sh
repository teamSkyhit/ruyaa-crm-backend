#!/bin/bash

# Script to resolve failed migration error
# Run this on your EC2 server

set -e

echo "🔧 Resolving failed migration error..."
echo ""

# Step 1: Fix the data first
echo "Step 1: Fixing existing data..."
node scripts/fix-failed-migration.js

echo ""
echo "Step 2: Resolving the failed migration..."
npx prisma migrate resolve --rolled-back 20251220090923_add_multi_store_pos_features

echo ""
echo "Step 3: Editing migration file to remove UPDATE statements (already done)..."
MIGRATION_FILE=$(find prisma/migrations -name "*add_multi_store_pos_features*" -type d | head -1)/migration.sql

if [ -f "$MIGRATION_FILE" ]; then
    # Create backup
    cp "$MIGRATION_FILE" "${MIGRATION_FILE}.backup2"
    
    # Remove UPDATE statements since we already fixed the data
    # Keep only the ALTER TABLE statements
    sed -i '/^UPDATE /d' "$MIGRATION_FILE"
    sed -i '/^WITH /d' "$MIGRATION_FILE"
    sed -i '/^FROM /d' "$MIGRATION_FILE"
    sed -i '/^WHERE /d' "$MIGRATION_FILE"
    
    echo "✅ Migration file cleaned"
    echo "📝 Review the file: $MIGRATION_FILE"
else
    echo "⚠️  Migration file not found: $MIGRATION_FILE"
fi

echo ""
echo "Step 4: Re-applying migration..."
npx prisma migrate dev

echo ""
echo "✅ Done! Check status:"
npx prisma migrate status


#!/bin/bash

# Script to run the safe migration template directly against the database
# This bypasses Prisma and runs SQL directly

set -e

echo "🚀 Running safe migration directly against database..."
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL not set"
    echo "   Please set it in .env file or export it"
    exit 1
fi

# Path to template
TEMPLATE_FILE="prisma/migrations/TEMPLATE_safe_migration.sql"

if [ ! -f "$TEMPLATE_FILE" ]; then
    echo "❌ Template file not found: $TEMPLATE_FILE"
    exit 1
fi

echo "📄 Using template: $TEMPLATE_FILE"
echo ""

# Create a temporary file with enhanced SQL (add IF NOT EXISTS)
TEMP_FILE=$(mktemp)
cat > "$TEMP_FILE" << 'EOF'
-- Safe migration with IF NOT EXISTS checks
-- Add columns as nullable first
DO $$ 
BEGIN
    -- Categories
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='hsnCode') THEN
        ALTER TABLE "categories" ADD COLUMN "hsnCode" VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='gstRate') THEN
        ALTER TABLE "categories" ADD COLUMN "gstRate" DECIMAL(5,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='gstInclusive') THEN
        ALTER TABLE "categories" ADD COLUMN "gstInclusive" BOOLEAN DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='minStockLevel') THEN
        ALTER TABLE "categories" ADD COLUMN "minStockLevel" INTEGER DEFAULT 5;
    END IF;

    -- Products
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='sku') THEN
        ALTER TABLE "products" ADD COLUMN "sku" VARCHAR(20);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='mrp') THEN
        ALTER TABLE "products" ADD COLUMN "mrp" DECIMAL(10,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='salePrice') THEN
        ALTER TABLE "products" ADD COLUMN "salePrice" DECIMAL(10,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='modelType') THEN
        ALTER TABLE "products" ADD COLUMN "modelType" VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='packType') THEN
        ALTER TABLE "products" ADD COLUMN "packType" VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='minStockLevel') THEN
        ALTER TABLE "products" ADD COLUMN "minStockLevel" INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='allowNegativeStock') THEN
        ALTER TABLE "products" ADD COLUMN "allowNegativeStock" BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Update existing categories
UPDATE "categories" 
SET 
  "hsnCode" = COALESCE("hsnCode", '00000000'),
  "gstRate" = COALESCE("gstRate", 0),
  "gstInclusive" = COALESCE("gstInclusive", true),
  "minStockLevel" = COALESCE("minStockLevel", 5)
WHERE "hsnCode" IS NULL;

-- Generate SKUs for existing products
WITH numbered_products AS (
  SELECT 
    id,
    'GPS-' || LPAD(ROW_NUMBER() OVER (ORDER BY "createdAt")::text, 6, '0') as new_sku
  FROM products
  WHERE sku IS NULL
)
UPDATE products p
SET sku = np.new_sku
FROM numbered_products np
WHERE p.id = np.id;

-- Set MRP from price
UPDATE "products" 
SET "mrp" = COALESCE("price", 0)
WHERE "mrp" IS NULL;

-- Set defaults
UPDATE "products" 
SET "allowNegativeStock" = COALESCE("allowNegativeStock", true)
WHERE "allowNegativeStock" IS NULL;

-- Make columns required
ALTER TABLE "categories" ALTER COLUMN "hsnCode" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "sku" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "mrp" SET NOT NULL;

-- Add indexes
CREATE UNIQUE INDEX IF NOT EXISTS "products_sku_key" ON "products"("sku");
CREATE INDEX IF NOT EXISTS "categories_hsnCode_idx" ON "categories"("hsnCode");
EOF

echo "📝 Running migration..."
psql "$DATABASE_URL" -f "$TEMP_FILE"

echo ""
echo "✅ Migration completed!"
echo "🧹 Cleaning up..."
rm "$TEMP_FILE"

echo ""
echo "📋 Next: Mark the Prisma migration as applied"
echo "   npx prisma migrate resolve --applied 20251220090923_add_multi_store_pos_features"


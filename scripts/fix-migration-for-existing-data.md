# How to Fix Migration for Existing Data

## Problem
You have existing data in:
- `categories` table (7 rows) - needs `hsnCode`
- `products` table (9 rows) - needs `sku` and `mrp`

## Solution: Edit the Migration File

### Step 1: Create Migration File Only
```bash
npx prisma migrate dev --create-only --name add_multi_store_pos_features
```

### Step 2: Edit the Migration File

Find the migration file:
```bash
ls -la prisma/migrations/
# Look for: [timestamp]_add_multi_store_pos_features/migration.sql
```

Edit it with:
```bash
nano prisma/migrations/[timestamp]_add_multi_store_pos_features/migration.sql
```

### Step 3: Modify the Migration

**Replace the problematic ALTER TABLE statements with this pattern:**

#### For Categories:
```sql
-- Add column as nullable first
ALTER TABLE "categories" ADD COLUMN "hsnCode" VARCHAR(255);
ALTER TABLE "categories" ADD COLUMN "gstRate" DECIMAL(5,2) DEFAULT 0;
ALTER TABLE "categories" ADD COLUMN "gstInclusive" BOOLEAN DEFAULT true;
ALTER TABLE "categories" ADD COLUMN "minStockLevel" INTEGER DEFAULT 5;

-- Update existing rows
UPDATE "categories" SET 
  "hsnCode" = COALESCE("hsnCode", '00000000'),
  "gstRate" = COALESCE("gstRate", 0),
  "gstInclusive" = COALESCE("gstInclusive", true),
  "minStockLevel" = COALESCE("minStockLevel", 5)
WHERE "hsnCode" IS NULL;

-- Make required (if needed)
ALTER TABLE "categories" ALTER COLUMN "hsnCode" SET NOT NULL;
```

#### For Products:
```sql
-- Add columns as nullable first
ALTER TABLE "products" ADD COLUMN "sku" VARCHAR(20);
ALTER TABLE "products" ADD COLUMN "mrp" DECIMAL(10,2);
ALTER TABLE "products" ADD COLUMN "salePrice" DECIMAL(10,2);
ALTER TABLE "products" ADD COLUMN "modelType" VARCHAR(50);
ALTER TABLE "products" ADD COLUMN "packType" VARCHAR(50);
ALTER TABLE "products" ADD COLUMN "minStockLevel" INTEGER;
ALTER TABLE "products" ADD COLUMN "allowNegativeStock" BOOLEAN DEFAULT true;

-- Update existing products
-- Generate SKU: GPS-000001, GPS-000002, etc.
WITH numbered_products AS (
  SELECT 
    id,
    'GPS-' || LPAD(ROW_NUMBER() OVER (ORDER BY "createdAt")::text, 6, '0') as new_sku,
    COALESCE("price", 0) as new_mrp
  FROM "products"
  WHERE "sku" IS NULL
)
UPDATE "products" p
SET 
  "sku" = np.new_sku,
  "mrp" = np.new_mrp,
  "allowNegativeStock" = true
FROM numbered_products np
WHERE p.id = np.id;

-- Make required
ALTER TABLE "products" ALTER COLUMN "sku" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "mrp" SET NOT NULL;

-- Add unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "products_sku_key" ON "products"("sku");
```

### Step 4: Apply the Migration

```bash
npx prisma migrate dev
```

This will apply your edited migration.

### Step 5: Verify

```bash
npx prisma migrate status
```

## Alternative: Quick Fix Script

If you want, I can create a script that automatically fixes the migration file. Let me know!


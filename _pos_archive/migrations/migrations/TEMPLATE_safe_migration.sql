-- Template for safe migration that handles existing data
-- Use this as a reference when editing your migration file

-- Step 1: Add columns as nullable first (or with defaults)
ALTER TABLE "categories" ADD COLUMN "hsnCode" VARCHAR(255);
ALTER TABLE "categories" ADD COLUMN "gstRate" DECIMAL(5,2) DEFAULT 0;
ALTER TABLE "categories" ADD COLUMN "gstInclusive" BOOLEAN DEFAULT true;
ALTER TABLE "categories" ADD COLUMN "minStockLevel" INTEGER DEFAULT 5;

ALTER TABLE "products" ADD COLUMN "sku" VARCHAR(20);
ALTER TABLE "products" ADD COLUMN "mrp" DECIMAL(10,2);
ALTER TABLE "products" ADD COLUMN "salePrice" DECIMAL(10,2);
ALTER TABLE "products" ADD COLUMN "modelType" VARCHAR(50);
ALTER TABLE "products" ADD COLUMN "packType" VARCHAR(50);
ALTER TABLE "products" ADD COLUMN "minStockLevel" INTEGER;
ALTER TABLE "products" ADD COLUMN "allowNegativeStock" BOOLEAN DEFAULT true;

-- Step 2: Update existing rows with default/calculated values
-- For categories: Set default HSN code
UPDATE "categories" SET "hsnCode" = '00000000' WHERE "hsnCode" IS NULL;
UPDATE "categories" SET "gstRate" = 0 WHERE "gstRate" IS NULL;
UPDATE "categories" SET "gstInclusive" = true WHERE "gstInclusive" IS NULL;
UPDATE "categories" SET "minStockLevel" = 5 WHERE "minStockLevel" IS NULL;

-- For products: Generate SKU and set MRP from existing price
-- SKU format: GPS-000001, GPS-000002, etc.
UPDATE "products" SET 
  "sku" = 'GPS-' || LPAD(ROW_NUMBER() OVER (ORDER BY "createdAt")::text, 6, '0'),
  "mrp" = COALESCE("price", 0),
  "salePrice" = NULL,
  "allowNegativeStock" = true
WHERE "sku" IS NULL OR "mrp" IS NULL;

-- Step 3: Make columns required (if schema requires them)
ALTER TABLE "categories" ALTER COLUMN "hsnCode" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "sku" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "mrp" SET NOT NULL;

-- Step 4: Add unique constraints and indexes
CREATE UNIQUE INDEX IF NOT EXISTS "products_sku_key" ON "products"("sku");
CREATE INDEX IF NOT EXISTS "categories_hsnCode_idx" ON "categories"("hsnCode");


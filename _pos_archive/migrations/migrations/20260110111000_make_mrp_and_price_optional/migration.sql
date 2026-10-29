-- AlterTable: Make MRP and price optional (nullable)
-- This allows products to be created without MRP

-- Add mrp column if it doesn't exist, then make it nullable
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'mrp'
    ) THEN
        ALTER TABLE "products" ADD COLUMN "mrp" DECIMAL(10,2);
    END IF;
END $$;

-- Make mrp nullable (if it exists and is not nullable)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' 
        AND column_name = 'mrp' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "products" ALTER COLUMN "mrp" DROP NOT NULL;
    END IF;
END $$;

-- Make price nullable (since it depends on mrp or salePrice)
-- Only if price column exists and is not nullable
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' 
        AND column_name = 'price' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "products" ALTER COLUMN "price" DROP NOT NULL;
    END IF;
END $$;


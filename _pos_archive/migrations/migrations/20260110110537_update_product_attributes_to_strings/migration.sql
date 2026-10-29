-- AlterTable: Update modelType and packType to VARCHAR(500) to support free-hand text
-- This handles both enum-to-VARCHAR conversion and VARCHAR size increase
-- Step 1: Convert modelType (handles enum or VARCHAR)
DO $$ 
BEGIN
    -- Check if column exists and is enum type, convert to VARCHAR(500)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'modelType'
        AND data_type = 'USER-DEFINED'
    ) THEN
        -- Convert enum to VARCHAR(500)
        ALTER TABLE "products" ALTER COLUMN "modelType" TYPE VARCHAR(500) USING "modelType"::text;
    ELSE
        -- Just change VARCHAR size if it exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'modelType'
        ) THEN
            ALTER TABLE "products" ALTER COLUMN "modelType" TYPE VARCHAR(500);
        END IF;
    END IF;
END $$;

-- Step 2: Convert packType (handles enum or VARCHAR)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'packType'
        AND data_type = 'USER-DEFINED'
    ) THEN
        ALTER TABLE "products" ALTER COLUMN "packType" TYPE VARCHAR(500) USING "packType"::text;
    ELSE
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'packType'
        ) THEN
            ALTER TABLE "products" ALTER COLUMN "packType" TYPE VARCHAR(500);
        END IF;
    END IF;
END $$;

-- Step 3: Add new size and weight columns
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "size" VARCHAR(500);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "weight" VARCHAR(500);


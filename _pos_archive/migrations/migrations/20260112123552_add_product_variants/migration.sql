-- AlterTable: Add product variant support
-- This allows products to have parent-child relationships for variants

-- Add parentProductId column to products table
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "parentProductId" UUID;

-- Add foreign key constraint for parent product relationship
ALTER TABLE "products" ADD CONSTRAINT "products_parentProductId_fkey" 
    FOREIGN KEY ("parentProductId") 
    REFERENCES "products"("id") 
    ON DELETE CASCADE 
    ON UPDATE CASCADE;

-- Add index for parentProductId for better query performance
CREATE INDEX IF NOT EXISTS "products_parentProductId_idx" ON "products"("parentProductId");


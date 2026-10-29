/**
 * Script to generate a safe migration that handles existing data
 * Run this after creating migration with --create-only flag
 */

const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '..', 'prisma', 'migrations');

// Find the latest migration directory
const migrationDirs = fs.readdirSync(migrationsDir)
  .filter(dir => {
    const dirPath = path.join(migrationsDir, dir);
    return fs.statSync(dirPath).isDirectory() && dir.match(/^\d+_/);
  })
  .sort()
  .reverse();

if (migrationDirs.length === 0) {
  console.error('❌ No migration directories found');
  process.exit(1);
}

const latestMigration = migrationDirs[0];
const migrationFile = path.join(migrationsDir, latestMigration, 'migration.sql');

if (!fs.existsSync(migrationFile)) {
  console.error(`❌ Migration file not found: ${migrationFile}`);
  process.exit(1);
}

console.log(`📝 Found migration: ${latestMigration}`);
console.log(`📄 Editing: ${migrationFile}\n`);

// Read current migration
let migrationContent = fs.readFileSync(migrationFile, 'utf8');

// Replace problematic ALTER TABLE statements
const replacements = [
  // Categories: Add as nullable first, then update, then make required
  {
    pattern: /ALTER TABLE "categories" ADD COLUMN "hsnCode" VARCHAR\(255\) NOT NULL;/g,
    replacement: `-- Add hsnCode as nullable first
ALTER TABLE "categories" ADD COLUMN "hsnCode" VARCHAR(255);
-- Update existing rows with default value
UPDATE "categories" SET "hsnCode" = '00000000' WHERE "hsnCode" IS NULL;
-- Make it required
ALTER TABLE "categories" ALTER COLUMN "hsnCode" SET NOT NULL;`
  },
  // Products: SKU
  {
    pattern: /ALTER TABLE "products" ADD COLUMN "sku" VARCHAR\(20\) NOT NULL;/g,
    replacement: `-- Add sku as nullable first
ALTER TABLE "products" ADD COLUMN "sku" VARCHAR(20);
-- Generate SKU for existing products: GPS-000001, GPS-000002, etc.
WITH numbered_products AS (
  SELECT 
    id,
    'GPS-' || LPAD(ROW_NUMBER() OVER (ORDER BY "createdAt")::text, 6, '0') as new_sku
  FROM "products"
  WHERE "sku" IS NULL
)
UPDATE "products" p
SET "sku" = np.new_sku
FROM numbered_products np
WHERE p.id = np.id;
-- Make it required
ALTER TABLE "products" ALTER COLUMN "sku" SET NOT NULL;`
  },
  // Products: MRP
  {
    pattern: /ALTER TABLE "products" ADD COLUMN "mrp" DECIMAL\(10,2\) NOT NULL;/g,
    replacement: `-- Add mrp as nullable first
ALTER TABLE "products" ADD COLUMN "mrp" DECIMAL(10,2);
-- Set MRP from existing price for existing products
UPDATE "products" SET "mrp" = COALESCE("price", 0) WHERE "mrp" IS NULL;
-- Make it required
ALTER TABLE "products" ALTER COLUMN "mrp" SET NOT NULL;`
  }
];

let modified = false;
replacements.forEach(({ pattern, replacement }) => {
  if (pattern.test(migrationContent)) {
    migrationContent = migrationContent.replace(pattern, replacement);
    modified = true;
    console.log('✅ Fixed migration statement');
  }
});

if (modified) {
  // Backup original
  const backupFile = migrationFile + '.backup';
  fs.writeFileSync(backupFile, fs.readFileSync(migrationFile));
  console.log(`💾 Backup created: ${backupFile}`);
  
  // Write modified migration
  fs.writeFileSync(migrationFile, migrationContent);
  console.log(`✅ Migration file updated successfully!\n`);
  console.log('📋 Next steps:');
  console.log('1. Review the migration file:');
  console.log(`   nano ${migrationFile}`);
  console.log('2. Apply the migration:');
  console.log('   npx prisma migrate dev');
} else {
  console.log('ℹ️  No changes needed - migration looks safe');
}


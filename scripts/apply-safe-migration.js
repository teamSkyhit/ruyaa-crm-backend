/**
 * Script to apply the safe migration template to the actual migration file
 * or run it directly against the database
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const templatePath = path.join(__dirname, '..', 'prisma', 'migrations', 'TEMPLATE_safe_migration.sql');
const migrationsDir = path.join(__dirname, '..', 'prisma', 'migrations');

// Find the migration directory
const migrationDirs = fs.readdirSync(migrationsDir)
  .filter(dir => {
    const dirPath = path.join(migrationsDir, dir);
    return fs.statSync(dirPath).isDirectory() && dir.match(/^\d+_add_multi_store_pos_features/);
  })
  .sort()
  .reverse();

if (migrationDirs.length === 0) {
  console.error('❌ Migration directory not found. Please create the migration first:');
  console.error('   npx prisma migrate dev --create-only --name add_multi_store_pos_features');
  process.exit(1);
}

const migrationDir = migrationDirs[0];
const migrationFile = path.join(migrationsDir, migrationDir, 'migration.sql');

console.log(`📝 Found migration: ${migrationDir}`);
console.log(`📄 Migration file: ${migrationFile}\n`);

// Read template
if (!fs.existsSync(templatePath)) {
  console.error('❌ Template file not found:', templatePath);
  process.exit(1);
}

const templateContent = fs.readFileSync(templatePath, 'utf8');

// Create backup
const backupFile = migrationFile + '.backup';
if (fs.existsSync(migrationFile)) {
  fs.writeFileSync(backupFile, fs.readFileSync(migrationFile));
  console.log(`💾 Backup created: ${backupFile}`);
}

// Write template content to migration file
// But first, we need to enhance it with IF NOT EXISTS and proper structure
const enhancedTemplate = templateContent
  .replace(/ALTER TABLE "categories" ADD COLUMN "hsnCode"/g, 'ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "hsnCode"')
  .replace(/ALTER TABLE "categories" ADD COLUMN "gstRate"/g, 'ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "gstRate"')
  .replace(/ALTER TABLE "categories" ADD COLUMN "gstInclusive"/g, 'ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "gstInclusive"')
  .replace(/ALTER TABLE "categories" ADD COLUMN "minStockLevel"/g, 'ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "minStockLevel"')
  .replace(/ALTER TABLE "products" ADD COLUMN "sku"/g, 'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sku"')
  .replace(/ALTER TABLE "products" ADD COLUMN "mrp"/g, 'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "mrp"')
  .replace(/ALTER TABLE "products" ADD COLUMN "salePrice"/g, 'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "salePrice"')
  .replace(/ALTER TABLE "products" ADD COLUMN "modelType"/g, 'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "modelType"')
  .replace(/ALTER TABLE "products" ADD COLUMN "packType"/g, 'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "packType"')
  .replace(/ALTER TABLE "products" ADD COLUMN "minStockLevel"/g, 'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "minStockLevel"')
  .replace(/ALTER TABLE "products" ADD COLUMN "allowNegativeStock"/g, 'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "allowNegativeStock"');

// Fix the SKU generation query (the template has a syntax issue)
const fixedTemplate = enhancedTemplate.replace(
  /UPDATE "products" SET\s+"sku" = 'GPS-' \|\| LPAD\(ROW_NUMBER\(\) OVER \(ORDER BY "createdAt"\)::text, 6, '0'\),/g,
  `-- Generate SKUs for existing products
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
UPDATE "products" SET`
);

fs.writeFileSync(migrationFile, fixedTemplate);
console.log(`✅ Migration file updated with safe template!\n`);

console.log('📋 Next steps:');
console.log('1. Review the migration file:');
console.log(`   nano ${migrationFile}`);
console.log('2. Apply the migration:');
console.log('   npx prisma migrate dev');
console.log('\nOr run directly against database:');
console.log(`   psql $DATABASE_URL -f ${migrationFile}`);


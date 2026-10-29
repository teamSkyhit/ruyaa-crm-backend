/**
 * Script to check the current state of the database and migration
 * Helps understand what columns exist and what needs to be fixed
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkState() {
  try {
    console.log('🔍 Checking database and migration state...\n');

    // Check what columns exist
    const columns = await prisma.$queryRawUnsafe(`
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name IN ('categories', 'products')
        AND (
          column_name IN ('hsnCode', 'gstRate', 'gstInclusive', 'minStockLevel') OR
          column_name IN ('sku', 'mrp', 'salePrice', 'modelType', 'packType', 'allowNegativeStock')
        )
      ORDER BY table_name, column_name;
    `);

    console.log('📊 Existing columns:');
    if (columns.length === 0) {
      console.log('  ⚠️  No new columns found - migration was fully rolled back');
    } else {
      columns.forEach(col => {
        console.log(`  ${col.table_name}.${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    }

    // Check data counts
    console.log('\n📦 Data counts:');
    const categoryCount = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM categories;`);
    const productCount = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM products;`);
    console.log(`  Categories: ${categoryCount[0].count}`);
    console.log(`  Products: ${productCount[0].count}`);

    // Check for NULL values in existing columns
    console.log('\n🔍 Checking for NULL values:');
    const hsnCol = columns.find(c => c.column_name === 'hsnCode' && c.table_name === 'categories');
    if (hsnCol) {
      const nullHsn = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM categories WHERE "hsnCode" IS NULL;`);
      console.log(`  Categories with NULL hsnCode: ${nullHsn[0].count}`);
    }

    const skuCol = columns.find(c => c.column_name === 'sku' && c.table_name === 'products');
    if (skuCol) {
      const nullSku = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM products WHERE sku IS NULL;`);
      console.log(`  Products with NULL sku: ${nullSku[0].count}`);
    }

    const mrpCol = columns.find(c => c.column_name === 'mrp' && c.table_name === 'products');
    if (mrpCol) {
      const nullMrp = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM products WHERE mrp IS NULL;`);
      console.log(`  Products with NULL mrp: ${nullMrp[0].count}`);
    }

    console.log('\n✅ State check complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkState();


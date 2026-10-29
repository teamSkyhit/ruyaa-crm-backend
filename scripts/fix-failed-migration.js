/**
 * Script to fix failed migration and update existing data
 * Run this to resolve the migration error
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixFailedMigration() {
  try {
    console.log('🔧 Fixing failed migration...\n');

    // Step 1: Check if columns exist
    console.log('📊 Checking database schema...');
    
    const columnCheck = await prisma.$queryRawUnsafe(`
      SELECT 
        column_name, 
        table_name,
        is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name IN ('categories', 'products')
        AND column_name IN ('hsnCode', 'sku', 'mrp', 'gstRate', 'gstInclusive', 'minStockLevel')
      ORDER BY table_name, column_name;
    `);
    
    console.log('  Existing columns:');
    columnCheck.forEach(col => {
      console.log(`    ${col.table_name}.${col.column_name} (nullable: ${col.is_nullable})`);
    });
    console.log('');

    // Step 2: Check current data (only if columns exist)
    let categoriesCount = 0;
    let productsCount = 0;
    
    try {
      const categories = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as count
        FROM categories 
        WHERE "hsnCode" IS NULL;
      `);
      categoriesCount = parseInt(categories[0].count);
    } catch (e) {
      console.log('  ⚠️  hsnCode column does not exist yet');
    }
    
    try {
      const products = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as count
        FROM products 
        WHERE sku IS NULL OR mrp IS NULL;
      `);
      productsCount = parseInt(products[0].count);
    } catch (e) {
      console.log('  ⚠️  sku or mrp columns do not exist yet');
    }

    console.log(`  Categories needing hsnCode: ${categoriesCount}`);
    console.log(`  Products needing sku/mrp: ${productsCount}\n`);

    // Step 3: Fix Categories (only if column exists)
    const hsnCodeExists = columnCheck.some(c => c.column_name === 'hsnCode' && c.table_name === 'categories');
    
    if (hsnCodeExists && categoriesCount > 0) {
      console.log('🔨 Fixing categories...');
      try {
        await prisma.$executeRawUnsafe(`
          UPDATE categories 
          SET 
            "hsnCode" = COALESCE("hsnCode", '00000000'),
            "gstRate" = COALESCE("gstRate", 0),
            "gstInclusive" = COALESCE("gstInclusive", true),
            "minStockLevel" = COALESCE("minStockLevel", 5)
          WHERE "hsnCode" IS NULL;
        `);
        console.log(`  ✅ Updated ${categoriesCount} categories`);
      } catch (e) {
        console.log(`  ⚠️  Could not update categories: ${e.message}`);
      }
    } else if (!hsnCodeExists) {
      console.log('  ℹ️  hsnCode column does not exist - will be created by migration');
    }

    // Step 4: Fix Products (only if columns exist)
    const skuExists = columnCheck.some(c => c.column_name === 'sku' && c.table_name === 'products');
    const mrpExists = columnCheck.some(c => c.column_name === 'mrp' && c.table_name === 'products');
    
    if (productsCount > 0 && (skuExists || mrpExists)) {
      console.log('🔨 Fixing products...');
      
      try {
        // Generate SKUs for products without them
        if (skuExists) {
          await prisma.$executeRawUnsafe(`
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
          `);
          console.log('  ✅ Generated SKUs');
        }

        // Set MRP from price
        if (mrpExists) {
          await prisma.$executeRawUnsafe(`
            UPDATE products 
            SET mrp = COALESCE(price, 0)
            WHERE mrp IS NULL;
          `);
          console.log('  ✅ Set MRP values');
        }

        // Set defaults for other fields
        const allowNegativeExists = columnCheck.some(c => c.column_name === 'allowNegativeStock' && c.table_name === 'products');
        if (allowNegativeExists) {
          await prisma.$executeRawUnsafe(`
            UPDATE products 
            SET "allowNegativeStock" = COALESCE("allowNegativeStock", true)
            WHERE "allowNegativeStock" IS NULL;
          `);
        }

        console.log(`  ✅ Updated products`);
      } catch (e) {
        console.log(`  ⚠️  Could not update products: ${e.message}`);
      }
    } else if (!skuExists && !mrpExists) {
      console.log('  ℹ️  sku/mrp columns do not exist - will be created by migration');
    }

    // Step 5: Verify (only if columns exist)
    console.log('\n✅ Verification:');
    
    let allFixed = true;
    
    if (hsnCodeExists) {
      try {
        const nullHsn = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM categories WHERE "hsnCode" IS NULL;`);
        const count = parseInt(nullHsn[0].count);
        console.log(`  Categories with NULL hsnCode: ${count}`);
        if (count > 0) allFixed = false;
      } catch (e) {
        console.log('  ⚠️  Could not verify hsnCode');
      }
    }
    
    if (skuExists) {
      try {
        const nullSku = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM products WHERE sku IS NULL;`);
        const count = parseInt(nullSku[0].count);
        console.log(`  Products with NULL sku: ${count}`);
        if (count > 0) allFixed = false;
      } catch (e) {
        console.log('  ⚠️  Could not verify sku');
      }
    }
    
    if (mrpExists) {
      try {
        const nullMrp = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM products WHERE mrp IS NULL;`);
        const count = parseInt(nullMrp[0].count);
        console.log(`  Products with NULL mrp: ${count}`);
        if (count > 0) allFixed = false;
      } catch (e) {
        console.log('  ⚠️  Could not verify mrp');
      }
    }

    console.log('\n📋 Next steps:');
    console.log('1. Edit the migration file to handle existing data properly');
    console.log('2. Re-apply the migration:');
    console.log('   npx prisma migrate dev');
    
    if (allFixed && (hsnCodeExists || skuExists || mrpExists)) {
      console.log('\n✅ Data is ready for migration!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixFailedMigration();


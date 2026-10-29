/**
 * Script to verify production database schema
 * Run this after migrations to ensure everything is correct
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifySchema() {
  try {
    console.log('🔍 Verifying production database schema...\n');

    // Check if all main tables exist
    const tables = [
      'users',
      'products',
      'categories',
      'subcategories',
      'sales',
      'stores',
      'counters',
      'shifts',
      'payments',
      'returns',
      'activity_logs',
    ];

    console.log('📊 Checking tables:');
    for (const table of tables) {
      try {
        const result = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*) as count FROM "${table}"`
        );
        console.log(`  ✅ ${table} - exists`);
      } catch (error) {
        console.log(`  ❌ ${table} - missing or error: ${error.message}`);
      }
    }

    // Check for required indexes
    console.log('\n📑 Checking indexes:');
    const indexes = await prisma.$queryRawUnsafe(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      ORDER BY tablename, indexname;
    `);
    console.log(`  Found ${indexes.length} indexes`);

    // Check migration history
    console.log('\n📜 Migration history:');
    const migrations = await prisma.$queryRawUnsafe(`
      SELECT migration_name, finished_at 
      FROM "_prisma_migrations" 
      ORDER BY finished_at;
    `);
    migrations.forEach((m) => {
      console.log(`  ✅ ${m.migration_name} - ${m.finished_at ? 'Applied' : 'Pending'}`);
    });

    // Check for sample data
    console.log('\n📦 Data counts:');
    const userCount = await prisma.user.count();
    const productCount = await prisma.product.count();
    const categoryCount = await prisma.category.count();
    const storeCount = await prisma.store.count();

    console.log(`  Users: ${userCount}`);
    console.log(`  Products: ${productCount}`);
    console.log(`  Categories: ${categoryCount}`);
    console.log(`  Stores: ${storeCount}`);

    console.log('\n✅ Schema verification complete!');
  } catch (error) {
    console.error('❌ Error verifying schema:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifySchema();


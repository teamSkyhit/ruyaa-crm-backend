/**
 * Script to check for duplicate saleNumbers before migration
 * Run this before applying the unique constraint
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDuplicates() {
  try {
    console.log('Checking for duplicate saleNumbers...\n');

    // Get all sales with non-null saleNumbers
    const sales = await prisma.sale.findMany({
      where: {
        saleNumber: {
          not: null,
        },
      },
      select: {
        id: true,
        saleNumber: true,
        saleDate: true,
      },
      orderBy: {
        saleDate: 'desc',
      },
    });

    console.log(`Total sales with saleNumber: ${sales.length}`);

    // Group by saleNumber to find duplicates
    const saleNumberMap = new Map();
    sales.forEach((sale) => {
      if (!saleNumberMap.has(sale.saleNumber)) {
        saleNumberMap.set(sale.saleNumber, []);
      }
      saleNumberMap.get(sale.saleNumber).push(sale);
    });

    // Find duplicates
    const duplicates = Array.from(saleNumberMap.entries()).filter(
      ([_, sales]) => sales.length > 1
    );

    if (duplicates.length === 0) {
      console.log('✅ No duplicate saleNumbers found. Safe to proceed with migration.\n');
      console.log('You can run: npx prisma db push');
      return;
    }

    console.log(`⚠️  Found ${duplicates.length} duplicate saleNumber(s):\n`);

    duplicates.forEach(([saleNumber, sales]) => {
      console.log(`  SaleNumber: ${saleNumber} (${sales.length} occurrences)`);
      sales.forEach((sale, idx) => {
        console.log(`    ${idx + 1}. Sale ID: ${sale.id}, Date: ${sale.saleDate}`);
      });
      console.log('');
    });

    console.log('❌ Cannot proceed with migration. Please fix duplicates first.');
    console.log('\nOptions:');
    console.log('1. Delete duplicate sales (keep the most recent one)');
    console.log('2. Update duplicate saleNumbers to make them unique');
    console.log('3. Set duplicate saleNumbers to NULL (if not needed)');
  } catch (error) {
    console.error('Error checking duplicates:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicates();


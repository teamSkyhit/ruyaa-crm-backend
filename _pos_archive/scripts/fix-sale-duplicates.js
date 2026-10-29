/**
 * Script to fix duplicate saleNumbers
 * This will keep the most recent sale and update others to NULL
 * Run this if you have duplicates
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixDuplicates() {
  try {
    console.log('Fixing duplicate saleNumbers...\n');

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

    // Group by saleNumber
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
      console.log('✅ No duplicates found. Nothing to fix.');
      return;
    }

    console.log(`Found ${duplicates.length} duplicate saleNumber(s). Fixing...\n`);

    let fixedCount = 0;

    for (const [saleNumber, salesList] of duplicates) {
      // Keep the most recent sale (first in list since sorted by date desc)
      const keepSale = salesList[0];
      const updateSales = salesList.slice(1); // All others

      console.log(`  SaleNumber: ${saleNumber}`);
      console.log(`    Keeping: Sale ID ${keepSale.id} (Date: ${keepSale.saleDate})`);

      // Update others to NULL
      for (const sale of updateSales) {
        await prisma.sale.update({
          where: { id: sale.id },
          data: { saleNumber: null },
        });
        console.log(`    Updated: Sale ID ${sale.id} -> saleNumber set to NULL`);
        fixedCount++;
      }
      console.log('');
    }

    console.log(`✅ Fixed ${fixedCount} duplicate saleNumber(s).`);
    console.log('\nYou can now run: npx prisma db push');
  } catch (error) {
    console.error('Error fixing duplicates:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixDuplicates();


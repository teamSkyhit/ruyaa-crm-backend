// scripts/migrate-product-categories.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting product category migration...');

  // Get all products that need migration
  const products = await prisma.product.findMany({
    where: {
      AND: [{ category: { not: null } }, { categoryId: null }],
    },
    select: {
      id: true,
      category: true,
      subcategory: true,
    },
  });

  console.log(`Found ${products.length} products to migrate`);

  let migratedCount = 0;

  for (const product of products) {
    if (!product.category) continue;

    try {
      // Find the category
      const category = await prisma.category.findUnique({
        where: { name: product.category },
      });

      if (!category) {
        console.log(
          `❌ Category not found: ${product.category} for product ${product.id}`
        );
        continue;
      }

      let subcategoryId = null;

      // Find the subcategory if it exists
      if (product.subcategory) {
        const subcategory = await prisma.subCategory.findUnique({
          where: {
            name_categoryId: {
              name: product.subcategory,
              categoryId: category.id,
            },
          },
        });

        if (subcategory) {
          subcategoryId = subcategory.id;
        } else {
          console.log(
            `⚠️  Subcategory not found: ${product.subcategory} in ${product.category} for product ${product.id}`
          );
        }
      }

      // Update the product
      await prisma.product.update({
        where: { id: product.id },
        data: {
          categoryId: category.id,
          subcategoryId: subcategoryId,
        },
      });

      migratedCount++;
      console.log(
        `✅ Migrated product ${product.id}: ${product.category}${
          product.subcategory ? ` -> ${product.subcategory}` : ''
        }`
      );
    } catch (error) {
      console.error(`❌ Error migrating product ${product.id}:`, error);
    }
  }

  console.log(
    `🎉 Product migration completed! Migrated ${migratedCount} out of ${products.length} products`
  );
  console.log('\nNext steps:');
  console.log('1. Verify the migration by checking products with categories');
  console.log('2. Remove old category/subcategory string columns from schema');
  console.log('3. Apply final migration to clean up the schema');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error during product migration:', e);
    await prisma.$disconnect();
    process.exit(1);
  });

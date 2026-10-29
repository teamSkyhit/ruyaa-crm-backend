// scripts/migrate-categories.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting category migration...');

  // Step 1: Create categories and subcategories based on existing product data
  const existingProducts = await prisma.product.findMany({
    select: { category: true, subcategory: true },
  });

  // Get unique categories and subcategories
  const categoriesSet = new Set<string>();
  const subcategoriesMap = new Map<string, Set<string>>();

  existingProducts.forEach(
    (product: { category: string | null; subcategory: string | null }) => {
      if (product.category) {
        categoriesSet.add(product.category);

        if (product.subcategory) {
          if (!subcategoriesMap.has(product.category)) {
            subcategoriesMap.set(product.category, new Set());
          }
          subcategoriesMap.get(product.category)?.add(product.subcategory);
        }
      }
    }
  );

  console.log(`Found ${categoriesSet.size} unique categories`);

  // Create categories first
  const categoryMap = new Map<string, string>(); // category name -> category id

  for (const categoryName of categoriesSet) {
    let category = await prisma.category.findUnique({
      where: { name: categoryName },
    });

    if (!category) {
      category = await prisma.category.create({
        data: {
          name: categoryName,
          description: `Category for ${categoryName} products`,
        },
      });
      console.log(`✅ Created category: ${categoryName}`);
    } else {
      console.log(`✅ Category already exists: ${categoryName}`);
    }

    categoryMap.set(categoryName, category.id);
  }

  // Create subcategories
  const subcategoryMap = new Map<string, string>(); // "categoryName|subcategoryName" -> subcategory id

  for (const [categoryName, subcategoryNames] of subcategoriesMap) {
    const categoryId = categoryMap.get(categoryName);
    if (!categoryId) continue;

    for (const subcategoryName of subcategoryNames) {
      const key = `${categoryName}|${subcategoryName}`;

      let subcategory = await prisma.subCategory.findUnique({
        where: {
          name_categoryId: {
            name: subcategoryName,
            categoryId,
          },
        },
      });

      if (!subcategory) {
        subcategory = await prisma.subCategory.create({
          data: {
            name: subcategoryName,
            categoryId,
            description: `Subcategory for ${subcategoryName} in ${categoryName}`,
          },
        });
        console.log(
          `✅ Created subcategory: ${subcategoryName} in ${categoryName}`
        );
      } else {
        console.log(
          `✅ Subcategory already exists: ${subcategoryName} in ${categoryName}`
        );
      }

      subcategoryMap.set(key, subcategory.id);
    }
  }

  console.log('🎉 Category migration completed successfully!');
  console.log('\nNext steps:');
  console.log(
    '1. Apply the Prisma migration with: npx prisma migrate dev --name add-categories'
  );
  console.log(
    '2. Run the product migration script to update product references'
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error during category migration:', e);
    await prisma.$disconnect();
    process.exit(1);
  });

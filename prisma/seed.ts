import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Ruyaa Essentials database...');

  // Admin user
  const passwordHash = await bcrypt.hash('Admin@123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ruyaaessentials.com' },
    update: {},
    create: {
      name: 'Ruyaa Admin',
      email: 'admin@ruyaaessentials.com',
      role: 'ADMIN',
      status: 'ACTIVE',
      passwordHash,
    },
  });
  console.log(`Admin user: ${admin.email}`);

  // SiteSettings singleton
  const settings = await prisma.siteSettings.upsert({
    where: { singleton: 'global' },
    update: {},
    create: {
      singleton: 'global',
      brandName: 'Ruyaa Essentials',
      tagline: 'Natural Handcrafted Soaps',
      contactEmail: 'hello@ruyaaessentials.com',
      shippingCharge: 60,
      freeShippingThreshold: 499,
      estimatedDeliveryDays: '5-7 business days',
      codEnabled: true,
      announcementBarEnabled: true,
      announcementBarText: 'Free shipping on orders above ₹499',
      defaultMetaTitle: 'Ruyaa Essentials – Natural Handcrafted Soaps',
      defaultMetaDescription:
        'Shop premium natural handcrafted soaps made with the finest ingredients. Ruyaa Essentials – pure skincare, beautifully crafted.',
    },
  });
  console.log(`SiteSettings: ${settings.brandName}`);

  // Category
  const category = await prisma.category.upsert({
    where: { slug: 'handcrafted-soaps' },
    update: {},
    create: {
      name: 'Handcrafted Soaps',
      slug: 'handcrafted-soaps',
      description:
        'Premium natural soaps crafted with the finest ingredients for your daily skincare ritual.',
      sortOrder: 1,
      isActive: true,
    },
  });
  console.log(`Category: ${category.name}`);

  // Products
  const products = [
    {
      name: 'Red Vine Soap',
      slug: 'red-vine-soap',
      sku: 'RYA-001',
      mrp: 299,
      salePrice: null as null | number,
      description:
        'Enriched with red vine extract, this luxurious soap delivers powerful antioxidant benefits. Perfect for brightening and toning your skin while providing deep nourishment.',
      featuredIngredients: ['Red Vine Extract', 'Vitamin E', 'Shea Butter', 'Lavender Oil'],
      fullIngredients:
        'Sodium Palmate, Sodium Palm Kernelate, Aqua, Red Vine Extract, Tocopherol (Vitamin E), Butyrospermum Parkii (Shea Butter), Lavandula Angustifolia Oil, Glycerin, Parfum',
      shelfLife: '24 months from manufacture',
      howToUse:
        'Lather with water and gently massage onto skin. Rinse thoroughly. For best results, use daily.',
      storageInstructions:
        'Store in a cool, dry place away from direct sunlight. Keep on a soap dish to allow drainage.',
      manufacturer: 'Ruyaa Essentials',
      metaTitle: 'Red Vine Soap – Antioxidant Natural Bar Soap | Ruyaa Essentials',
      metaDescription:
        'Discover the power of red vine extract in our handcrafted natural soap. Brightens, tones and deeply nourishes your skin.',
      sortOrder: 1,
    },
    {
      name: 'Golden Glow Soap',
      slug: 'golden-glow-soap',
      sku: 'RYA-002',
      mrp: 299,
      salePrice: null as null | number,
      description:
        'Our Golden Glow Soap is infused with turmeric and saffron to give your skin a natural radiance. A time-honoured formula for luminous, healthy-looking skin.',
      featuredIngredients: ['Turmeric', 'Saffron', 'Almond Oil', 'Honey'],
      fullIngredients:
        'Sodium Palmate, Sodium Palm Kernelate, Aqua, Curcuma Longa (Turmeric) Root Extract, Crocus Sativus (Saffron) Extract, Prunus Amygdalus Dulcis (Sweet Almond) Oil, Mel (Honey), Glycerin, Parfum',
      shelfLife: '24 months from manufacture',
      howToUse:
        'Work into a rich lather and massage gently onto damp skin. Rinse well. Use regularly for best results.',
      storageInstructions:
        'Keep in a dry place. Avoid prolonged exposure to water to extend soap life.',
      manufacturer: 'Ruyaa Essentials',
      metaTitle: 'Golden Glow Soap – Turmeric & Saffron Natural Bar | Ruyaa Essentials',
      metaDescription:
        'Achieve a natural golden glow with our turmeric and saffron-infused handcrafted soap. Brightens and evens skin tone beautifully.',
      sortOrder: 2,
    },
    {
      name: 'Charcoal Soap',
      slug: 'charcoal-soap',
      sku: 'RYA-003',
      mrp: 299,
      salePrice: null as null | number,
      description:
        'Activated charcoal draws out impurities, unclogs pores, and detoxifies your skin. This deep-cleansing bar is ideal for oily and acne-prone skin.',
      featuredIngredients: ['Activated Charcoal', 'Tea Tree Oil', 'Neem Extract', 'Aloe Vera'],
      fullIngredients:
        'Sodium Palmate, Sodium Palm Kernelate, Aqua, Activated Charcoal, Melaleuca Alternifolia (Tea Tree) Leaf Oil, Azadirachta Indica (Neem) Extract, Aloe Barbadensis Leaf Juice, Glycerin, Parfum',
      shelfLife: '24 months from manufacture',
      howToUse:
        'Apply to wet skin, work into a lather. Leave on for 1-2 minutes for deeper cleansing. Rinse thoroughly.',
      storageInstructions: 'Store away from moisture and heat. Allow to dry between uses.',
      manufacturer: 'Ruyaa Essentials',
      metaTitle: 'Charcoal Soap – Deep Cleansing Detox Bar | Ruyaa Essentials',
      metaDescription:
        'Purify your skin with activated charcoal and tea tree oil. Our deep-cleansing charcoal soap is perfect for oily and acne-prone skin.',
      sortOrder: 3,
    },
    {
      name: 'Goat Milk Soap',
      slug: 'goat-milk-soap',
      sku: 'RYA-004',
      mrp: 349,
      salePrice: null as null | number,
      description:
        'Rich in vitamins and minerals, our Goat Milk Soap gently cleanses while deeply moisturising. Perfect for sensitive and dry skin types — leaves skin soft and supple.',
      featuredIngredients: ['Goat Milk', 'Oatmeal', 'Calendula', 'Vitamin E'],
      fullIngredients:
        'Sodium Palmate, Sodium Palm Kernelate, Caprae Lac (Goat Milk), Avena Sativa (Oatmeal), Calendula Officinalis Flower Extract, Tocopherol (Vitamin E), Glycerin, Aqua, Parfum',
      shelfLife: '18 months from manufacture',
      howToUse:
        'Lather gently and apply to skin. Rinse with warm water. Suitable for face and body. Use daily.',
      storageInstructions: 'Keep in a cool, dry location. Avoid storing in humid environments.',
      manufacturer: 'Ruyaa Essentials',
      metaTitle: 'Goat Milk Soap – Moisturising Natural Bar for Sensitive Skin | Ruyaa Essentials',
      metaDescription:
        'Gentle and nourishing goat milk soap enriched with oatmeal and calendula. Ideal for sensitive and dry skin types.',
      sortOrder: 4,
    },
    {
      name: 'Shea Butter Soap',
      slug: 'shea-butter-soap',
      sku: 'RYA-005',
      mrp: 349,
      salePrice: null as null | number,
      description:
        'Luxuriously creamy and deeply moisturising, our Shea Butter Soap transforms your daily cleanse into a spa-like experience. Leaves skin feeling velvety soft.',
      featuredIngredients: ['Shea Butter', 'Cocoa Butter', 'Argan Oil', 'Rose Hip Extract'],
      fullIngredients:
        'Sodium Palmate, Sodium Palm Kernelate, Butyrospermum Parkii (Shea) Butter, Theobroma Cacao (Cocoa) Seed Butter, Argania Spinosa Kernel Oil, Rosa Canina (Rosehip) Fruit Extract, Glycerin, Aqua, Parfum',
      shelfLife: '24 months from manufacture',
      howToUse:
        'Massage onto wet skin to build a rich lather. Rinse well. Enjoy its moisturising benefits every day.',
      storageInstructions:
        'Store in a dry spot away from direct sunlight. Use a draining soap dish to maximise longevity.',
      manufacturer: 'Ruyaa Essentials',
      metaTitle: 'Shea Butter Soap – Ultra-Moisturising Natural Bar | Ruyaa Essentials',
      metaDescription:
        'Indulge in the deep moisturising power of shea butter and cocoa butter. Our handcrafted soap leaves skin irresistibly soft and smooth.',
      sortOrder: 5,
    },
  ];

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        categoryId: category.id,
        mrp: p.mrp,
        salePrice: p.salePrice,
        weight: '125g',
        description: p.description,
        featuredIngredients: p.featuredIngredients,
        fullIngredients: p.fullIngredients,
        shelfLife: p.shelfLife,
        howToUse: p.howToUse,
        storageInstructions: p.storageInstructions,
        manufacturer: p.manufacturer,
        quantity: 100,
        lowStockThreshold: 10,
        isActive: true,
        showOnWebsite: true,
        sortOrder: p.sortOrder,
        metaTitle: p.metaTitle,
        metaDescription: p.metaDescription,
      },
    });
    console.log(`Product: ${product.name} (${product.sku})`);
  }

  // SystemConfig: public API key for storefront endpoints
  const publicApiKey = process.env.PUBLIC_API_KEY;
  if (publicApiKey) {
    await prisma.systemConfig.upsert({
      where: { key: 'public_api_key' },
      update: { value: publicApiKey },
      create: { key: 'public_api_key', value: publicApiKey },
    });
    console.log('SystemConfig: public_api_key seeded');
  }

  console.log('\nSeed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

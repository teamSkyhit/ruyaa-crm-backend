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

  // Email Templates
  const EMAIL_FOOTER = `<div style="background:#f7f5f0;padding:20px 32px;text-align:center;border-top:2px solid #4A5C38">{{{socialLinksHtml}}}<p style="margin:4px 0;font-size:13px;color:#555;font-family:sans-serif">{{brandName}} · Natural Handcrafted Soaps</p><p style="margin:4px 0;font-size:12px;color:#888;font-family:sans-serif">{{contactEmail}}</p></div>`;
  const EMAIL_HEADER = `<div style="background:#4A5C38;padding:24px 32px;text-align:center">{{{logoHtml}}}</div>`;
  const wrapEmail = (body: string) =>
    `<div style="font-family:Georgia,'Times New Roman',serif;max-width:600px;margin:0 auto;color:#2c2c2c;background:#fff">${EMAIL_HEADER}<div style="padding:32px 32px 24px">${body.trim()}</div>${EMAIL_FOOTER}</div>`;

  const emailTemplates = [
    { key: 'order_confirmation', name: 'Order Confirmation', subject: 'Order Confirmed – {{orderNumber}} | {{brandName}}', bodyHtml: wrapEmail(`<h2 style="color:#4A5C38;margin-top:0">Order Confirmed!</h2><p>Hi {{customerName}}, your order <strong>{{orderNumber}}</strong> has been confirmed.</p><table style="width:100%;border-collapse:collapse;margin:16px 0"><thead><tr style="background:#f5f5f5"><th style="padding:8px;text-align:left;font-family:sans-serif;font-size:13px">Product</th><th style="padding:8px;text-align:center;font-family:sans-serif;font-size:13px">Qty</th><th style="padding:8px;text-align:right;font-family:sans-serif;font-size:13px">Price</th><th style="padding:8px;text-align:right;font-family:sans-serif;font-size:13px">Total</th></tr></thead><tbody>{{{itemsHtml}}}</tbody></table><div style="text-align:right;margin-top:8px;font-family:sans-serif;font-size:14px"><p style="margin:4px 0">Subtotal: {{subtotal}}</p><p style="margin:4px 0">Shipping: {{shippingCharge}}</p><p style="margin:4px 0;font-weight:700;font-size:16px">Total: {{total}}</p></div><p style="color:#666;font-size:13px;font-family:sans-serif;margin-top:20px">Estimated delivery: 5–7 business days.</p><p style="color:#999;font-size:12px;font-family:sans-serif">Questions? Reply to this email or contact us at {{contactEmail}}.</p>`), variables: ['orderNumber','customerName','total','subtotal','shippingCharge','itemsHtml','brandName','logoHtml','socialLinksHtml','contactEmail'] },
    { key: 'shipping_update', name: 'Shipping Update', subject: 'Your order {{orderNumber}} has shipped! | {{brandName}}', bodyHtml: wrapEmail(`<h2 style="color:#4A5C38;margin-top:0">Your order has shipped!</h2><p>Hi {{customerName}}, your order <strong>{{orderNumber}}</strong> is on its way.</p>{{{trackingHtml}}}<p style="color:#666;font-size:13px;font-family:sans-serif">If you have any questions, please reach out at {{contactEmail}}.</p>`), variables: ['orderNumber','customerName','trackingHtml','brandName','logoHtml','socialLinksHtml','contactEmail'] },
    { key: 'delivery_confirmation', name: 'Delivery Confirmation', subject: 'Your {{brandName}} order has been delivered!', bodyHtml: wrapEmail(`<h2 style="color:#4A5C38;margin-top:0">Your order has been delivered!</h2><p>Hi {{customerName}}, your order <strong>{{orderNumber}}</strong> has been delivered.</p><p>We hope you love your {{brandName}} products.</p><p style="color:#666;font-size:13px;font-family:sans-serif">Thank you for shopping with us! If anything isn't right, contact us at {{contactEmail}}.</p>`), variables: ['orderNumber','customerName','brandName','logoHtml','socialLinksHtml','contactEmail'] },
    { key: 'review_request', name: 'Review Request', subject: 'How was your {{brandName}} experience? 🌿', bodyHtml: wrapEmail(`<h2 style="color:#4A5C38;margin-top:0">How did we do?</h2><p>Hi {{customerName}}, we hope you're enjoying your recent order <strong>{{orderNumber}}</strong>.</p><p>Your feedback means the world to us. Would you mind leaving a quick review?</p><ul style="list-style:none;padding:0;margin:16px 0">{{{productLinks}}}</ul><p style="color:#666;font-size:13px;font-family:sans-serif">It only takes a minute and helps other customers.</p>`), variables: ['orderNumber','customerName','productLinks','brandName','logoHtml','socialLinksHtml','contactEmail'] },
    { key: 'newsletter_welcome', name: 'Newsletter Welcome', subject: 'Welcome to {{brandName}}! 🌿', bodyHtml: wrapEmail(`<h2 style="color:#4A5C38;margin-top:0">You're on the list!</h2><p>Thank you for subscribing to the {{brandName}} newsletter. You'll be the first to hear about new products and exclusive offers.</p><p style="color:#666;font-size:14px;font-family:sans-serif">We respect your inbox — expect only meaningful updates, no spam.</p><p style="color:#999;font-size:12px;font-family:sans-serif;margin-top:32px">If you didn't sign up for this, you can safely ignore this email.</p>`), variables: ['brandName','logoHtml','socialLinksHtml','contactEmail'] },
    { key: 'password_reset', name: 'Password Reset', subject: 'Reset your {{brandName}} password', bodyHtml: wrapEmail(`<h2 style="color:#4A5C38;margin-top:0">Reset your password</h2><p>We received a request to reset the password for your account. Click the button below.</p><p style="text-align:center;margin:32px 0"><a href="{{resetUrl}}" style="background:#4A5C38;color:#fff;padding:14px 28px;border-radius:4px;text-decoration:none;font-weight:700;font-family:sans-serif;font-size:15px">Reset Password</a></p><p style="font-family:sans-serif;font-size:14px">This link expires in 1 hour.</p><p style="color:#999;font-size:12px;font-family:sans-serif">If the button doesn't work:<br/>{{resetUrl}}</p>`), variables: ['resetUrl','brandName','logoHtml','socialLinksHtml','contactEmail'] },
    { key: 'customer_otp', name: 'Customer OTP / Login Code', subject: 'Your {{brandName}} login code', bodyHtml: wrapEmail(`<h2 style="color:#4A5C38;margin-top:0">Your login code</h2><p style="font-family:sans-serif;font-size:15px">Use this one-time code to sign in. It expires in <strong>10 minutes</strong>.</p><p style="font-size:42px;letter-spacing:14px;font-weight:700;text-align:center;color:#4A5C38;margin:28px 0;font-family:monospace">{{otp}}</p><p style="color:#666;font-size:13px;font-family:sans-serif">If you did not request this code, you can safely ignore this email.</p>`), variables: ['otp','brandName','logoHtml','socialLinksHtml','contactEmail'] },
    { key: 'ticket_reply', name: 'Support Ticket Reply', subject: 'Reply on ticket {{ticketNumber}} | {{brandName}}', bodyHtml: wrapEmail(`<h2 style="color:#4A5C38;margin-top:0">Reply on ticket {{ticketNumber}}</h2><div style="background:#f9f9f9;border-left:4px solid #4A5C38;padding:16px 20px;border-radius:0 4px 4px 0;line-height:1.8;font-family:sans-serif;font-size:14px">{{{body}}}</div><p style="color:#888;font-size:12px;font-family:sans-serif;margin-top:20px">Ticket reference: {{ticketNumber}}</p><p style="color:#666;font-size:13px;font-family:sans-serif">Reply to this email to continue the conversation.</p>`), variables: ['ticketNumber','body','brandName','logoHtml','socialLinksHtml','contactEmail'] },
    { key: 'low_stock_alert', name: 'Low Stock Alert', subject: 'Low Stock Alert: {{productName}} | {{brandName}}', bodyHtml: wrapEmail(`<h2 style="color:#c0392b;margin-top:0">Low Stock Alert</h2><p style="font-family:sans-serif"><strong>{{productName}}</strong> (SKU: {{sku}}) is running low.</p><table style="border-collapse:collapse;margin:16px 0;font-family:sans-serif;font-size:14px"><tr><td style="padding:8px 20px 8px 0;color:#666">Current stock:</td><td style="padding:8px 0;font-weight:700;color:#c0392b">{{currentQty}} units</td></tr><tr><td style="padding:8px 20px 8px 0;color:#666">Alert threshold:</td><td style="padding:8px 0">{{threshold}} units</td></tr></table><p style="color:#666;font-size:13px;font-family:sans-serif">Please restock soon to avoid stockouts.</p>`), variables: ['productName','sku','currentQty','threshold','brandName','logoHtml','socialLinksHtml','contactEmail'] },
  ];

  for (const tpl of emailTemplates) {
    await prisma.emailTemplate.upsert({
      where: { key: tpl.key },
      update: { name: tpl.name, subject: tpl.subject, bodyHtml: tpl.bodyHtml, variables: tpl.variables, isActive: true },
      create: { key: tpl.key, name: tpl.name, subject: tpl.subject, bodyHtml: tpl.bodyHtml, variables: tpl.variables, isActive: true },
    });
    console.log(`Email template: ${tpl.key}`);
  }

  console.log('\nSeed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

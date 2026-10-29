// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@unitrack.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
  const hash = await bcrypt.hash(adminPassword, 10);

  // Create admin user if not exists
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        name: 'Admin',
        email: adminEmail,
        role: 'admin',
        status: 'active',
        passwordHash: hash,
      },
    });
    console.log('Created admin:', admin.email);
  } else {
    console.log('Admin already exists:', admin.email);
  }

  // Create sample shelves
  const shelves = [
    { id: 'A1', name: 'A1', description: 'Shelf A1' },
    { id: 'B1', name: 'B1', description: 'Shelf B1' },
  ];
  for (const s of shelves) {
    await prisma.shelf.upsert({
      where: { id: s.id },
      update: {},
      create: s,
    });
  }
  console.log('Shelves ensured.');

  // Sample product
  const product = await prisma.product.upsert({
    where: { barcode: '123456789012' },
    update: {},
    create: {
      name: 'Sample Laptop',
      category: 'Electronics',
      subcategory: 'Laptops',
      barcode: '123456789012',
      quantity: 10,
      price: '799.99',
      shelfId: 'A1',
      description: 'Sample laptop for demo',
    },
  });
  console.log('Sample product ensured:', product.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

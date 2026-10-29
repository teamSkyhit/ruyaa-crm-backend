import 'dotenv/config';
import prisma from '../src/prismaClient';

const PINCODES = [
  { pincode: '500001', city: 'Hyderabad', state: 'Telangana', deliverable: true, estimatedDays: 3 },
  { pincode: '500081', city: 'Hyderabad', state: 'Telangana', deliverable: true, estimatedDays: 3 },
  { pincode: '110001', city: 'New Delhi', state: 'Delhi', deliverable: true, estimatedDays: 5 },
  { pincode: '400001', city: 'Mumbai', state: 'Maharashtra', deliverable: true, estimatedDays: 5 },
  { pincode: '560001', city: 'Bengaluru', state: 'Karnataka', deliverable: true, estimatedDays: 4 },
  { pincode: '999999', city: 'Unserviceable', state: 'NA', deliverable: false, estimatedDays: 0 },
];

async function main() {
  for (const row of PINCODES) {
    await prisma.pincodeZone.upsert({
      where: { pincode: row.pincode },
      create: row,
      update: row,
    });
  }
  console.log(`Seeded ${PINCODES.length} pincode zones`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

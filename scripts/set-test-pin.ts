import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

if (process.env.NODE_ENV === 'production') {
    console.error('ERROR: This script must NOT be run in production.');
    process.exit(1);
}

const prisma = new PrismaClient();
const TEST_PIN = '123456';

async function main() {
    const user = await prisma.user.findFirst();
    if (!user) {
        console.log('No users found.');
        return;
    }

    console.log(`Found user: ${user.email}`);

    // BUG-001 FIX: Hash PIN before storing — never store plain-text PINs
    const pinHash = await bcrypt.hash(TEST_PIN, 12);

    const updated = await prisma.user.update({
        where: { id: user.id },
        data: { pin: pinHash },
    });

    console.log(`[DEV ONLY] Updated user ${updated.email} with hashed test PIN (plain: ${TEST_PIN})`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const SEED_EMAILS = [
    'sarah@techstartup.com',
    'alex@venturefund.com',
    'priya@bigcorp.com',
    'marcus@advisors.io',
    'jessica@jobhunt.me',
];
async function main() {
    console.log('🧹 Cleaning seed/test data from database...\n');
    const seedUsers = await prisma.user.findMany({
        where: { email: { in: SEED_EMAILS } },
        select: { id: true, email: true },
    });
    if (seedUsers.length === 0) {
        console.log('  No seed users found. Database is clean.');
        return;
    }
    const seedIds = seedUsers.map(u => u.id);
    console.log(`  Found ${seedUsers.length} seed users:`);
    seedUsers.forEach(u => console.log(`    - ${u.email} (${u.id})`));
    const matchesDeleted = await prisma.match.deleteMany({
        where: {
            OR: [
                { userAId: { in: seedIds } },
                { userBId: { in: seedIds } },
            ],
        },
    });
    console.log(`\n  Deleted ${matchesDeleted.count} matches`);
    const introsDeleted = await prisma.introductionRecord.deleteMany({
        where: {
            OR: [
                { userAId: { in: seedIds } },
                { userBId: { in: seedIds } },
            ],
        },
    });
    console.log(`  Deleted ${introsDeleted.count} introduction records`);
    const dealsDeleted = await prisma.dealTracking.deleteMany({
        where: {
            OR: [
                { dealPartnerId: { in: seedIds } },
                { founderId: { in: seedIds } },
            ],
        },
    });
    console.log(`  Deleted ${dealsDeleted.count} deal tracking records`);
    const usersDeleted = await prisma.user.deleteMany({
        where: { id: { in: seedIds } },
    });
    console.log(`  Deleted ${usersDeleted.count} users (profiles, notifications, conversations cascade automatically)`);
    console.log('\n🧹 Seed data cleanup complete!');
}
main()
    .catch((e) => {
    console.error('Cleanup failed:', e);
    process.exit(1);
})
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=clean-seed.js.map
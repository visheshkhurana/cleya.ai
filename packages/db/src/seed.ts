import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPass = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPass) {
    console.log('⚠️  ADMIN_EMAIL and ADMIN_PASSWORD not set — skipping admin seed');
    console.log('🌱 Seeding complete (no admin created)!');
    return;
  }

  const adminPassword = await bcrypt.hash(adminPass, 12);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: adminPassword,
      role: 'ADMIN',
      emailVerified: true,
      profile: {
        create: {
          persona: 'OPERATOR',
          headline: 'Cleo.ai Platform Admin',
          currentRole: 'Admin',
          companyName: 'Cleo.ai',
          location: 'San Francisco, CA',
          isComplete: true,
          completenessScore: 1.0,
        },
      },
    },
  });
  console.log(`  ✅ Admin user: ${admin.email}`);

  console.log('🌱 Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

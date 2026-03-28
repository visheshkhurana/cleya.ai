import { prisma } from '@cleya/db';
import bcrypt from 'bcryptjs';
import { env } from './config/env';

export async function seedDatabase() {
  try {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      console.log(`Database already has ${userCount} users, skipping seed`);
      return;
    }

    if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
      console.log('No ADMIN_EMAIL/ADMIN_PASSWORD set — skipping admin seed');
      return;
    }

    console.log('Seeding database with admin user...');

    const adminPassword = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
    const admin = await prisma.user.create({
      data: {
        email: env.ADMIN_EMAIL,
        passwordHash: adminPassword,
        role: 'ADMIN',
        emailVerified: true,
        profile: {
          create: {
            persona: 'OPERATOR',
            headline: 'Cleya.ai Platform Admin',
            currentRole: 'Admin',
            companyName: 'Cleya.ai',
            location: 'San Francisco, CA',
            isComplete: true,
            completenessScore: 1.0,
          },
        },
      },
    });
    console.log(`  Seeded admin: ${admin.email}`);
    console.log('Database seeding complete!');
  } catch (error) {
    console.error('Seed error (non-fatal):', error);
  }
}

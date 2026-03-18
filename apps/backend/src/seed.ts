import { prisma } from '@boardy/db';
import bcrypt from 'bcryptjs';

export async function seedDatabase() {
  try {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      console.log(`Database already has ${userCount} users, skipping seed`);
      return;
    }

    console.log('Seeding database with admin user...');

    const adminPassword = await bcrypt.hash('admin123456', 12);
    const admin = await prisma.user.create({
      data: {
        email: 'admin@cleo.ai',
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
    console.log(`  Seeded admin: ${admin.email}`);
    console.log('Database seeding complete!');
  } catch (error) {
    console.error('Seed error (non-fatal):', error);
  }
}

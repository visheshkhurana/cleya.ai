/**
 * Idempotent test-user seeder.
 * Creates (or resets) test@cleya.ai with password: test1234
 * - emailVerified: true
 * - onboardingComplete: true
 * - Profile attached (FOUNDER persona, fully populated) so /matches, /chat,
 *   /profile, /dashboard etc. all render meaningful content.
 *
 * Run:  npx ts-node apps/backend/scripts/seed-test-user.ts
 */
import bcrypt from 'bcryptjs';
import { prisma } from '@cleya/db';

const TEST_EMAIL = 'test@cleya.ai';
const TEST_PASSWORD = 'test1234';

(async () => {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);

  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: {
      passwordHash,
      emailVerified: true,
      onboardingComplete: true,
      isActive: true,
      name: 'Test Founder',
    },
    create: {
      email: TEST_EMAIL,
      passwordHash,
      emailVerified: true,
      onboardingComplete: true,
      isActive: true,
      name: 'Test Founder',
    },
  });

  await prisma.profile.upsert({
    where: { userId: user.id },
    update: {
      persona: 'FOUNDER',
      headline: 'Founder & CEO at TestCo — building agentic networking',
      bio: 'Test profile for previewing authenticated pages. Building TestCo — an AI-native B2B SaaS for India\'s startup ecosystem.',
      companyName: 'TestCo',
      companyStage: 'SEED',
      currentRole: 'Founder & CEO',
      location: 'Bengaluru, India',
      linkedinUrl: 'https://linkedin.com/in/testfounder',
      yearsExperience: 6,
      industries: ['SAAS', 'AI'],
      skills: ['Product', 'Sales', 'Hiring'],
      interests: ['Founder community', 'Distribution', 'GTM'],
      lookingFor: ['Investors', 'Senior engineers', 'Design partners'],
      isComplete: true,
      completenessScore: 0.95,
      profileScore: 85,
    },
    create: {
      userId: user.id,
      persona: 'FOUNDER',
      headline: 'Founder & CEO at TestCo — building agentic networking',
      bio: 'Test profile for previewing authenticated pages. Building TestCo — an AI-native B2B SaaS for India\'s startup ecosystem.',
      companyName: 'TestCo',
      companyStage: 'SEED',
      currentRole: 'Founder & CEO',
      location: 'Bengaluru, India',
      linkedinUrl: 'https://linkedin.com/in/testfounder',
      yearsExperience: 6,
      industries: ['SAAS', 'AI'],
      skills: ['Product', 'Sales', 'Hiring'],
      interests: ['Founder community', 'Distribution', 'GTM'],
      lookingFor: ['Investors', 'Senior engineers', 'Design partners'],
      isComplete: true,
      completenessScore: 0.95,
      profileScore: 85,
    },
  });

  console.log('\n=========================================');
  console.log(' Test user ready');
  console.log('=========================================');
  console.log(' Email:    ' + TEST_EMAIL);
  console.log(' Password: ' + TEST_PASSWORD);
  console.log(' UserId:   ' + user.id);
  console.log('=========================================\n');
  process.exit(0);
})().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});

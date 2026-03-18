import { prisma } from '@boardy/db';
import bcrypt from 'bcryptjs';

export async function seedDatabase() {
  try {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      console.log(`Database already has ${userCount} users, skipping seed`);
      return;
    }

    console.log('Seeding database with initial data...');

    const adminPassword = await bcrypt.hash('admin123456', 12);
    const userPassword = await bcrypt.hash('password123', 12);

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

    const sampleUsers = [
      {
        email: 'sarah@techstartup.com',
        persona: 'FOUNDER' as const,
        priority: 'FUNDRAISING' as const,
        headline: 'Building AI-powered supply chain optimization',
        companyName: 'ChainMind',
        companyStage: 'SEED' as const,
        currentRole: 'CEO & Co-Founder',
        industries: ['ai_ml', 'enterprise'],
        skills: ['product', 'fundraising', 'strategy'],
        lookingFor: ['fundraising', 'advisors'],
        location: 'San Francisco, CA',
      },
      {
        email: 'alex@venturefund.com',
        persona: 'INVESTOR' as const,
        headline: 'Investing in early-stage enterprise AI',
        companyName: 'Horizon Ventures',
        companyStage: 'SERIES_A' as const,
        currentRole: 'Partner',
        industries: ['ai_ml', 'saas', 'enterprise'],
        skills: ['investing', 'mentoring', 'strategy'],
        lookingFor: ['deal_flow'],
        investmentAmount: '$500K',
        location: 'New York, NY',
      },
      {
        email: 'priya@bigcorp.com',
        persona: 'OPERATOR' as const,
        headline: 'Scaling engineering teams at hypergrowth companies',
        companyName: 'ScaleUp Inc',
        companyStage: 'SERIES_B' as const,
        currentRole: 'VP Engineering',
        industries: ['saas', 'fintech'],
        skills: ['engineering', 'leadership', 'hiring'],
        lookingFor: ['advisors', 'partnerships'],
        location: 'Austin, TX',
      },
      {
        email: 'marcus@advisors.io',
        persona: 'ADVISOR' as const,
        headline: 'Helping SaaS founders go from $1M to $10M ARR',
        companyName: 'Independent',
        currentRole: 'Fractional CRO',
        industries: ['saas', 'fintech'],
        skills: ['sales', 'go-to-market', 'strategy'],
        lookingFor: ['advisory_roles'],
        location: 'London, UK',
      },
      {
        email: 'jessica@jobhunt.me',
        persona: 'JOB_SEEKER' as const,
        targetRole: 'FOUNDING_ENGINEER' as const,
        headline: 'Senior PM looking for my next challenge at a Series A startup',
        companyName: 'Google (prev)',
        currentRole: 'Senior Product Manager',
        industries: ['ai_ml', 'consumer'],
        skills: ['product-management', 'data-analysis', 'user-research'],
        lookingFor: ['job_opportunities'],
        location: 'Seattle, WA',
      },
    ];

    for (const user of sampleUsers) {
      const created = await prisma.user.create({
        data: {
          email: user.email,
          passwordHash: userPassword,
          emailVerified: true,
          profile: {
            create: {
              persona: user.persona,
              priority: (user as any).priority || null,
              targetRole: (user as any).targetRole || null,
              investmentAmount: (user as any).investmentAmount || null,
              headline: user.headline,
              companyName: user.companyName,
              companyStage: (user as any).companyStage || null,
              currentRole: user.currentRole,
              industries: user.industries,
              skills: user.skills,
              lookingFor: user.lookingFor,
              location: user.location,
              isComplete: true,
              completenessScore: 0.88,
            },
          },
        },
      });
      console.log(`  Seeded user: ${created.email} (${user.persona})`);
    }

    console.log('Database seeding complete!');
  } catch (error) {
    console.error('Seed error (non-fatal):', error);
  }
}

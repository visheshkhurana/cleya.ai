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

  await seedMatches();
}

async function seedMatches() {
  try {
    const matchCount = await prisma.match.count();
    if (matchCount > 0) return;

    const users = await prisma.user.findMany({
      where: { role: 'USER' },
      include: { profile: true },
    });

    if (users.length < 2) return;

    const matchPairs: { a: string; b: string; score: number; reason: string }[] = [];

    const sarah = users.find(u => u.email === 'sarah@techstartup.com');
    const alex = users.find(u => u.email === 'alex@venturefund.com');
    const priya = users.find(u => u.email === 'priya@bigcorp.com');
    const marcus = users.find(u => u.email === 'marcus@advisors.io');
    const jessica = users.find(u => u.email === 'jessica@jobhunt.me');

    if (sarah && alex) matchPairs.push({
      a: sarah.id, b: alex.id, score: 0.92,
      reason: 'Sarah is building an AI-powered supply chain startup at seed stage, and Alex invests in early-stage enterprise AI. Strong alignment on industry focus and stage.',
    });
    if (sarah && marcus) matchPairs.push({
      a: sarah.id, b: marcus.id, score: 0.85,
      reason: 'Marcus specializes in helping SaaS founders scale from $1M to $10M ARR. His go-to-market expertise could accelerate ChainMind\'s growth.',
    });
    if (sarah && jessica) matchPairs.push({
      a: sarah.id, b: jessica.id, score: 0.78,
      reason: 'Jessica is a senior PM from Google looking for her next role at a Series A startup. Her product expertise in AI/ML is a strong fit for ChainMind.',
    });
    if (alex && priya) matchPairs.push({
      a: alex.id, b: priya.id, score: 0.75,
      reason: 'Priya is scaling engineering at a Series B company in SaaS/fintech. Alex could provide strategic investment perspective and portfolio introductions.',
    });
    if (priya && marcus) matchPairs.push({
      a: priya.id, b: marcus.id, score: 0.82,
      reason: 'Marcus has deep sales and go-to-market expertise that could complement Priya\'s engineering leadership at ScaleUp Inc.',
    });
    if (alex && jessica) matchPairs.push({
      a: alex.id, b: jessica.id, score: 0.7,
      reason: 'Jessica\'s product background at Google and interest in AI startups aligns with Alex\'s portfolio focus. Potential talent introduction for portfolio companies.',
    });

    for (const pair of matchPairs) {
      await prisma.match.create({
        data: {
          userAId: pair.a,
          userBId: pair.b,
          score: pair.score,
          reason: pair.reason,
          status: 'PROPOSED',
          userAResponse: 'PENDING',
          userBResponse: 'PENDING',
        },
      });
    }

    console.log(`  Seeded ${matchPairs.length} matches between users`);
  } catch (error) {
    console.error('Match seeding error (non-fatal):', error);
  }
}

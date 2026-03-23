import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function backfillMatchReasoning() {
  const matches = await prisma.match.findMany({
    include: {
      userA: {
        include: {
          profile: true,
        },
      },
      userB: {
        include: {
          profile: true,
        },
      },
    },
  });

  console.log(`Found ${matches.length} matches to process`);

  if (matches.length === 0) {
    console.log('No matches found. Nothing to backfill.');
    await prisma.$disconnect();
    return;
  }

  let updated = 0;
  let failed = 0;
  let investorInvestorDeleted = 0;

  for (const match of matches) {
    const profileA = match.userA?.profile;
    const profileB = match.userB?.profile;

    if (profileA?.persona === 'INVESTOR' && profileB?.persona === 'INVESTOR') {
      console.log(`  Deleting investor-investor match ${match.id}`);
      await prisma.match.delete({ where: { id: match.id } });
      investorInvestorDeleted++;
      continue;
    }

    if (!profileA || !profileB) {
      console.log(`  Skipping match ${match.id} — missing profile data`);
      failed++;
      continue;
    }

    const describeProfile = (p: any) => {
      const parts: string[] = [];
      if (p.persona) parts.push(`Persona: ${p.persona}`);
      if (p.headline) parts.push(`Role: ${p.headline}`);
      if (p.companyName) parts.push(`Company: ${p.companyName}`);
      if (p.fundName) parts.push(`Fund: ${p.fundName}`);
      if (p.industries?.length) parts.push(`Industries: ${p.industries.join(', ')}`);
      if (p.skills?.length) parts.push(`Skills: ${p.skills.join(', ')}`);
      if (p.lookingFor?.length) parts.push(`Looking for: ${p.lookingFor.join(', ')}`);
      if (p.companyStage) parts.push(`Stage: ${p.companyStage}`);
      if (p.bio) parts.push(`Bio: ${p.bio.slice(0, 150)}`);
      if (p.businessDescription) parts.push(`Business: ${p.businessDescription.slice(0, 150)}`);
      if (p.investmentThesis) parts.push(`Thesis: ${p.investmentThesis.slice(0, 150)}`);
      if (p.location) parts.push(`Location: ${p.location}`);
      return parts.join('. ');
    };

    const nameA = match.userA?.name || 'User A';
    const nameB = match.userB?.name || 'User B';

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are Cleo, an AI networking assistant for India\'s startup ecosystem. Write exactly 2 sentences explaining why these two people should connect. Be specific — mention their actual names, roles, companies, industries, stages, and goals. Never be generic. Never say "complementary backgrounds."',
          },
          {
            role: 'user',
            content: `Person A (${nameA}): ${describeProfile(profileA)}\n\nPerson B (${nameB}): ${describeProfile(profileB)}\n\nWrite 2 specific sentences about why ${nameA} and ${nameB} should connect.`,
          },
        ],
        max_tokens: 150,
        temperature: 0.7,
      });

      const reasoning = response.choices[0]?.message?.content?.trim();
      if (reasoning) {
        await prisma.match.update({
          where: { id: match.id },
          data: { reason: reasoning },
        });
        console.log(`  Updated match ${match.id}: "${reasoning.substring(0, 80)}..."`);
        updated++;
      } else {
        console.log(`  No reasoning generated for match ${match.id}`);
        failed++;
      }
    } catch (error: any) {
      console.error(`  Failed to generate reasoning for match ${match.id}:`, error.message);
      failed++;
    }

    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nBackfill complete:`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Investor-Investor deleted: ${investorInvestorDeleted}`);

  await prisma.$disconnect();
}

backfillMatchReasoning().catch(console.error);

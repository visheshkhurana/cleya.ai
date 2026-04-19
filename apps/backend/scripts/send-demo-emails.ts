/**
 * One-shot demo: actually send the three matching-flow emails so the user
 * can see them in their real inbox. Uses the live Resend client.
 */
(async () => {
  const { emailService } = await import('../src/services/email');

  const A_EMAIL = 'jivraj@indiansiliconvalley.in';
  const B_EMAIL = 'jssachar98@gmail.com';

  console.log('--- Step 1: Welcome email ---');
  await emailService.sendWelcome(A_EMAIL);
  await emailService.sendWelcome(B_EMAIL);

  console.log('--- Step 2: Match-proposed email ---');
  await emailService.sendMatchProposed(
    A_EMAIL,
    'Jivraj Singh Sachar',
    'Tanmay Sharma',
    'FOUNDER',
    0.87,
    {
      companyName: 'ShopLane',
      headline: 'Founder & CEO at ShopLane — D2C commerce infra for India',
      raiseAmount: '30000000',
      sector: 'ECOMMERCE',
      stage: 'SEED',
      traction: 'INR 1.2 Cr ARR, growing 35% MoM, 14 active D2C brands',
      linkedinUrl: 'https://linkedin.com/in/tanmaysharma',
      location: 'Bengaluru, India',
      matchReason:
        "Tanmay is the kind of founder who keeps shipping even when the market is quiet — he's gone from zero to ~INR 1.2 Cr ARR in fourteen months by being obsessive about D2C ops. You spend most of your time on early-stage commerce theses at Indian Silicon Valley Capital and have backed two other ops-heavy founders this quarter, so the angle on his INR 3 Cr seed feels real, not spray-and-pray.",
    }
  );
  await emailService.sendMatchProposed(
    B_EMAIL,
    'Jivraj Singh Sachar',
    'Tanmay Sharma',
    'FOUNDER',
    0.87,
    {
      companyName: 'ShopLane',
      headline: 'Founder & CEO at ShopLane — D2C commerce infra for India',
      raiseAmount: '30000000',
      sector: 'ECOMMERCE',
      stage: 'SEED',
      traction: 'INR 1.2 Cr ARR, growing 35% MoM, 14 active D2C brands',
      linkedinUrl: 'https://linkedin.com/in/tanmaysharma',
      location: 'Bengaluru, India',
      matchReason:
        "Tanmay is the kind of founder who keeps shipping even when the market is quiet — he's gone from zero to ~INR 1.2 Cr ARR in fourteen months by being obsessive about D2C ops. You spend most of your time on early-stage commerce theses at Indian Silicon Valley Capital and have backed two other ops-heavy founders this quarter, so the angle on his INR 3 Cr seed feels real, not spray-and-pray.",
    }
  );

  console.log('--- Step 3: Joint intro email (Boardy-style, after BOTH accept) ---');
  // For the joint demo, both addresses ARE the two parties so you can see
  // the same shared thread in both inboxes — exactly what would happen
  // with two real users who both said yes.
  await emailService.sendMatchIntroJoint({
    emailA: A_EMAIL,
    nameA: 'Jivraj Singh Sachar',
    emailB: B_EMAIL,
    nameB: 'Tanmay Sharma',
    personaA: 'INVESTOR',
    personaB: 'FOUNDER',
    headlineA: 'Principal at Indian Silicon Valley Capital — early-stage commerce + AI',
    headlineB: 'Founder & CEO at ShopLane — D2C commerce infra for India',
    companyA: 'Indian Silicon Valley Capital',
    companyB: 'ShopLane',
    sectorA: 'ECOMMERCE',
    sectorB: 'ECOMMERCE',
    locationA: 'Mumbai, India',
    locationB: 'Bengaluru, India',
    tractionA: '12 portfolio cos, 4 in commerce; 2 active checks this quarter',
    tractionB: 'INR 1.2 Cr ARR, 35% MoM growth, 14 active D2C brands on the platform',
    linkedinA: 'https://linkedin.com/in/jivrajsachar',
    linkedinB: 'https://linkedin.com/in/tanmaysharma',
    matchReason:
      "Tanmay's been quietly compounding ShopLane through a flat market — INR 1.2 Cr ARR with real D2C ops underneath, raising INR 3 Cr to set up a 5-10 TPD plant near Okhla. Jivraj is actively deploying pre-seed checks at Indian Silicon Valley Capital across commerce-infra and ops-heavy founders this quarter. Both of you keep coming back to the same question: can a thin D2C wedge become real distribution infrastructure?",
    talkingPoints: [
      "How Tanmay is thinking about CAC payback as ShopLane moves from 14 brands to the next 50.",
      "Jivraj's view on which D2C-infra theses still have room in 2026 vs. which are crowded.",
      "Whether the Okhla plant changes the gross-margin profile enough to unlock Series A optionality.",
      "Shared founders in the network — Jivraj has backed two ops-heavy founders this quarter who would be useful peer references.",
    ],
  });

  console.log('--- Done. Check both inboxes. ---');
  process.exit(0);
})().catch((e) => {
  console.error('Demo send failed:', e);
  process.exit(1);
});

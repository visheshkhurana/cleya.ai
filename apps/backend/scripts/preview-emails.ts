/**
 * Render every match-flow email to a real HTML file on disk so you can
 * open them in a browser and confirm the copy / layout. Does NOT send
 * anything — the Resend client is stubbed.
 */
import * as fs from 'fs';
import * as path from 'path';

const captured: Array<{ slug: string; subject: string; to: string[]; reply_to?: string | string[]; html: string }> = [];

const fakeClient = {
  emails: {
    send: async (payload: any) => {
      captured.push({
        slug: '',
        subject: payload.subject,
        to: Array.isArray(payload.to) ? payload.to : [payload.to],
        reply_to: payload.reply_to,
        html: payload.html,
      });
      return { data: { id: 'preview_' + captured.length }, error: null };
    },
  },
};

require.cache[require.resolve('../src/services/resendClient')] = {
  id: require.resolve('../src/services/resendClient'),
  filename: require.resolve('../src/services/resendClient'),
  loaded: true,
  exports: {
    getUncachableResendClient: async () => ({
      client: fakeClient,
      fromEmail: 'hello@cleya.ai',
    }),
  },
} as any;

(async () => {
  const { emailService } = await import('../src/services/email');

  const outDir = path.resolve(__dirname, '../../../docs/email-previews');
  fs.mkdirSync(outDir, { recursive: true });

  const flows: Array<{ slug: string; run: () => Promise<any> }> = [
    {
      slug: '1-welcome',
      run: () => emailService.sendWelcome('jivraj@indiansiliconvalley.in'),
    },
    {
      slug: '2-match-proposed',
      run: () =>
        emailService.sendMatchProposed(
          'jivraj@indiansiliconvalley.in',
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
        ),
    },
    {
      slug: '3-joint-intro-after-accept',
      run: () =>
        emailService.sendMatchIntroJoint({
          emailA: 'jivraj@indiansiliconvalley.in',
          nameA: 'Jivraj Singh Sachar',
          emailB: 'tanmay@shoplane.in',
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
        }),
    },
  ];

  for (const f of flows) {
    captured.length = 0;
    await f.run();
    if (captured.length === 0) {
      console.log(`[preview] no email captured for ${f.slug}`);
      continue;
    }
    const cap = captured[0];
    const meta = `<!-- subject: ${cap.subject} | to: ${cap.to.join(', ')} | reply-to: ${
      Array.isArray(cap.reply_to) ? cap.reply_to.join(', ') : cap.reply_to || '(default)'
    } -->\n`;
    const banner = `
<div style="position:sticky;top:0;background:#0B0820;color:#fff;padding:12px 20px;font-family:-apple-system,sans-serif;font-size:13px;border-bottom:2px solid #8B7BFF;z-index:9999;">
  <div><strong style="color:#8B7BFF;">Subject:</strong> ${cap.subject}</div>
  <div><strong style="color:#8B7BFF;">To:</strong> ${cap.to.join(', ')}</div>
  <div><strong style="color:#8B7BFF;">Reply-To:</strong> ${
      Array.isArray(cap.reply_to) ? cap.reply_to.join(', ') : cap.reply_to || '(default — env.REPLY_TO_EMAIL)'
    }</div>
</div>
`;
    const out = meta + banner + cap.html;
    const outPath = path.join(outDir, `${f.slug}.html`);
    fs.writeFileSync(outPath, out);
    console.log(`[preview] wrote ${outPath}`);
  }

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

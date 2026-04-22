/**
 * Send the referral-onboarding email to one new person.
 *
 * Usage:
 *   npx tsx apps/backend/scripts/onboard-referral.ts <email> [--name "Full Name"] [--referrer "Their Name"]
 *
 * Examples:
 *   npx tsx apps/backend/scripts/onboard-referral.ts jane@startup.io
 *   npx tsx apps/backend/scripts/onboard-referral.ts jane@startup.io --name "Jane Doe"
 *   npx tsx apps/backend/scripts/onboard-referral.ts jane@startup.io --name "Jane Doe" --referrer "Avik Bansal"
 */

function parseArgs(argv: string[]): { email?: string; name?: string; referrer?: string } {
  const out: { email?: string; name?: string; referrer?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--name') out.name = argv[++i];
    else if (a === '--referrer') out.referrer = argv[++i];
    else if (!out.email && a && !a.startsWith('--')) out.email = a;
  }
  return out;
}

async function main() {
  const { email, name, referrer } = parseArgs(process.argv.slice(2));
  if (!email) {
    console.error('Usage: npx tsx apps/backend/scripts/onboard-referral.ts <email> [--name "Full Name"] [--referrer "Their Name"]');
    process.exit(1);
  }
  const { emailService } = await import('../src/services/email');
  console.log(`📧 Sending onboarding email → ${email}${name ? ` (${name})` : ''}${referrer ? ` referred by ${referrer}` : ''}`);
  const ok = await emailService.sendReferralOnboarding(email, { name, referrerName: referrer });
  if (ok) {
    console.log('✅ Sent.');
  } else {
    console.log('❌ Send failed — check logs.');
    process.exit(2);
  }
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });

/**
 * One-shot broadcast: "Refer 1 person, get 1 proprietary connection".
 *
 * Recipient list is hard-coded from a snapshot of production users
 * (active + email-verified) taken on 2026-04-22, with seed/test
 * accounts filtered out. Sends sequentially with a 250ms gap to stay
 * well under Resend's per-second rate limit.
 *
 * Run: npx tsx apps/backend/scripts/send-referral-broadcast.ts
 *      DRY=1 npx tsx apps/backend/scripts/send-referral-broadcast.ts   # preview only
 */

type Recipient = { email: string; name: string };

const RECIPIENTS: Recipient[] = [
  { email: 'jssachar98@gmail.com', name: 'Jivraj Singh Sachar' },
  { email: 'jivraj@indiansiliconvalley.in', name: '' },
  { email: 'vysheshk@gmail.com', name: '' },
  { email: 'neharika3007@gmail.com', name: 'Neharika Garg' },
  { email: 'vishesh.khurana@kartrocket.com', name: 'Vishesh Khurana' },
  { email: 'abhay@theproductfolks.com', name: 'Abhay Jani' },
  { email: 'harshsangani15@gmail.com', name: 'Harsh Sangani' },
  { email: 'isshhhikka@gmail.com', name: 'Ishika' },
  { email: 'dhruv@indiansiliconvalley.in', name: 'Dhruv Lakra' },
  { email: 'gamyaathi@gmail.com', name: 'Gyan' },
  { email: 'i@kunalsheth.in', name: 'Kunal Sheth' },
  { email: 'devajmera1006@gmail.com', name: 'Devyansh Ajmera' },
  { email: 'debraj.bandyopadhyay@mastersunion.org', name: 'Debraj Bandyopadhyay' },
  { email: 'shambhavi30.sharma@gmail.com', name: 'Shambhavi' },
  { email: 'avik.bansal@gmail.com', name: 'Avik Bansal' },
  { email: 'lakshyajain012005@gmail.com', name: 'lakshya jain' },
  { email: 'Saba.guru@gmail.com', name: 'Sabarish Gurusubramanian' },
  { email: 'ashim@ibecindia.in', name: 'Ashim Jolly' },
  { email: 'palak.dua3005@gmail.com', name: 'Palak Dua' },
  { email: 'akshattrivedi@hotmail.com', name: 'Akshat Trivedi' },
  { email: 'gabrizenna@gmail.com', name: 'Gabriele Zennaro' },
  { email: 'sd23@berkeley.edu', name: 'Shubh Dua' },
  { email: 'devansh.asawa@mastersunion.org', name: 'Devansh Asawa' },
  { email: 'mehakshokar17@gmail.com', name: 'Mehakdeep Singh Shokar' },
  { email: 'paulanuraag@gmail.com', name: 'Anuraag Paul' },
  { email: 'hrshsangani99@gmail.com', name: '' },
  { email: 'Manpreet165@gmail.com', name: 'Manpreet Singh Chhabra' },
  { email: 'ceo@cornerbricks.com', name: 'Sandeep Gupta' },
  { email: 'dheerajprajapati0792@gmail.com', name: '' },
  { email: 'aabhas@myasiavc.com', name: 'Aabhas Khanna' },
  { email: 'rharki@gmail.com', name: 'Rahul Harkisanka' },
  { email: 'saahil.goel@gmail.com', name: 'Saahil Goel' },
  { email: 'vk@cleya.ai', name: '' },
  { email: 'raj@tribecap.in', name: '' },
  { email: 'megha.sachdeva03@gmail.com', name: 'Megha Sachdeva' },
  { email: 'avik.ashar@gmail.com', name: 'Avik Ashar' },
  { email: 'aaushi@omnivore.vc', name: 'AAUSHI SHARMA' },
  { email: 'tripti@think9.vc', name: 'Tripti Banka' },
  { email: 'jinushah@gmail.com', name: 'Jinesh' },
  { email: 'anindya.8336010281@gmail.com', name: 'Anindya Chakraborty' },
  { email: 'ankitkedia84@gmail.com', name: 'Ankit Kedia' },
  { email: 'gaurav@siliconroad.vc', name: 'Gaurav Thakkar' },
  { email: 'sachin1231298@gmail.com', name: 'Sachin Mittal' },
  { email: 'manish.kayal@motilaloswal.com', name: 'Manish Kayal' },
  { email: 'subin.oswal@gmail.com', name: 'Subin Oswal' },
  { email: 'Agarwal.akshay0736@gmail.com', name: 'Akshay Kumar' },
  { email: 'whoissourabh@gmail.com', name: '' },
  { email: 'aayush@4uvp.com', name: '' },
  { email: 'sanket7panda@gmail.com', name: 'Sanket Panda' },
  { email: 'jaikapoorwork@gmail.com', name: 'Jai' },
  { email: 'vinay@spotlightsp.com', name: 'Vinay Jain' },
  { email: 'd1c1.dc@gmail.com', name: 'Divyanshu Chaudhari' },
  { email: 'siddharthshahtech@gmail.com', name: 'Siddharth Shah' },
  { email: 'rohit@done.deals', name: 'Rohit Raj' },
  { email: 'shashank@smartalgorhythm.com', name: '' },
  { email: 'narendra.bhat@gmail.com', name: 'Narendra Bhat' },
  { email: 'aneesh.satnaliwala@gmail.com', name: 'Aneesh Satnaliwala' },
  { email: 'shubhandua@gmail.com', name: 'Sam D' },
  { email: 'navneet@strideventures.in', name: 'Navneet' },
  { email: 'jay@theex.co', name: 'Jay Ahya' },
  { email: 'work.ayush8@gmail.com', name: 'Ayush Kumar' },
  { email: 'sulay@bummer.in', name: 'Sulay Lavsi' },
  { email: 'rachit.iitkgp@gmail.com', name: 'Rachit Murarka' },
  { email: 'shreya@imshreyapatel.com', name: 'Shreya Patel' },
  { email: 'subhendu@foxo.club', name: 'Subhendu Panigrahi' },
  { email: 'amardixit14@gmail.com', name: 'Amar Dixit' },
  { email: 'arjun.ghose@gmail.com', name: 'Arjun Ghose' },
  { email: 'shantanu@therecruiters.net', name: 'Shantanu Saha' },
  { email: 'natarajan@nat-cons.com', name: 'Natarajan Venkateswaran' },
  { email: 'rajendra.bengani@gmail.com', name: 'Rajendra Bengani' },
  { email: 'sharangshah@gmail.com', name: 'Sharang Shah' },
  { email: 'pawasjain@wldd.in', name: 'Pawas Jain' },
  { email: 'mohitraj1999@gmail.com', name: 'Mohit Raj' },
  { email: 'founder@impacto.eco', name: 'Shivang Singh' },
  { email: 'alex.chen.product@gmail.com', name: 'Alex Chen' },
  { email: 'aditya@getpassionfruit.com', name: 'Aditya Raj Jain' },
  { email: 'bachanitanishq@gmail.com', name: 'Tanishq Bachani' },
  { email: 'kartik@vizops.ai', name: '' },
  { email: 'prithvic.chauhan@gmail.com', name: 'Prithvi Chauhan' },
  { email: 'rohitrajjain@gmail.com', name: 'ROHIT' },
  { email: 'naveen@mastersunion.org', name: 'Naveen Balaji' },
  { email: 'aakritisuri96@gmail.com', name: 'Aakriti Suri' },
  { email: 'k@kumars.co.in', name: 'Karan Kumar' },
  { email: 'shannath@strideventures.in', name: 'Shannath' },
  { email: 'akash.iitb@gmail.com', name: 'Akash Gupta' },
  { email: 'tanmay@icrave.it', name: 'Tanmay Yadav' },
  { email: 'email@shivkapoor.me', name: 'Shiv Kapoor' },
  { email: 'hskhanuja168@gmail.com', name: 'Harmeet Singh Khanuja' },
  { email: 'learnproduct3@gmail.com', name: '' },
  { email: 'naresushen01@gmail.com', name: 'Sushen Nare' },
  { email: 'aryan@vetoai.ai', name: 'Aryan Grover' },
  { email: 'kaulridhi1@gmail.com', name: 'Ridhi Kaul' },
  { email: 'anujpatel224@gmail.com', name: '' },
  { email: 'adityaojha911@gmail.com', name: 'Aditya ojha' },
  { email: 'kishan.kishore02@gmail.com', name: 'Kishan Kishore' },
  { email: 'msr@abyrocapital.com', name: 'Srinivas Rao Mahankali ( MSR)' },
  { email: 'nelsonvinod@gmail.com', name: 'Nelson Vinod Moses' },
  { email: 'pall.agarwal08@gmail.com', name: 'Pall Agarwal' },
  { email: 'abhi.aggarwal0998@gmail.com', name: 'Abhishek Aggarwal' },
  { email: 'vasukhanna6292@gmail.com', name: 'Vasu Khanna' },
  { email: 'gyan@babylonhire.com', name: 'Gyan Banjan' },
  { email: 'kushal.bhavsar@equanimity.vc', name: 'Kushal Bhavsar' },
  { email: 'andyraheja1@yahoo.co.uk', name: 'Anand Raheja' },
  { email: 'vijaypravin.maharajan@gmail.com', name: 'Vijay Pravin Maharajan' },
  { email: 'gulhatigarvita@gmail.com', name: 'Garvita Gulhati' },
  { email: 'raopreetam007@gmail.com', name: '' },
  { email: 'deepakjain.dj2@gmail.com', name: 'Deepak' },
  { email: 'vidur@edyouthlearning.co.in', name: 'Vidur Dhabaria' },
  { email: 'manpreet165@gmail.com', name: 'Manpreet Singh' },
  { email: 'ravneshdk@gmail.com', name: 'Ravinesh singh' },
  { email: 'ankurpoddar@chrysaliis.com', name: 'Ankur Poddar' },
  { email: 'atharv.vyas@mastersunion.org', name: '' },
  { email: 'prabhatiitbhu@gmail.com', name: '' },
  { email: 'agam.gupta@seafund.in', name: '' },
  { email: 'smitbhavsar290901@gmail.com', name: '' },
  { email: 'chandan@recapi.ai', name: '' },
  { email: 'singhamit47@gmail.com', name: '' },
];

// Capitalise the first letter of a lowercase first name; preserve already-cased names.
function firstNameOf(raw: string): string | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  const first = trimmed.split(/\s+/)[0];
  if (!first) return null;
  // If the whole name is lowercase, title-case it. Otherwise keep as the user typed.
  if (first === first.toLowerCase()) {
    return first.charAt(0).toUpperCase() + first.slice(1);
  }
  // If ALL CAPS (>3 chars), title-case it too — looks shouty otherwise.
  if (first.length > 3 && first === first.toUpperCase()) {
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  }
  return first;
}

function buildSubject(firstName: string | null): string {
  return firstName
    ? `${firstName}, I lined up something for you 👀`
    : `I lined up something for you 👀`;
}

function buildHtml(firstName: string | null): string {
  const greeting = firstName ? `Hey <strong>${firstName}</strong> 👋` : `Hey there 👋`;
  // Inline-styled HTML — keeps formatting consistent across mail clients
  // and avoids Gmail's habit of stripping <style> blocks.
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f6f7fb;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;padding:40px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;line-height:1.6;font-size:16px;">
          <tr><td>
            <p style="margin:0 0 16px 0;">${greeting}</p>

            <p style="margin:0 0 16px 0;">It's Cleya — your AI networker, currently over-caffeinated and thinking about who in the world you should meet next.</p>

            <p style="margin:0 0 16px 0;">Quick observation: the people who get the most out of me are the ones whose networks are <em>dense</em>. The more good humans show up here, the better every match gets — for you, for them, for everyone. It compounds.</p>

            <p style="margin:0 0 24px 0;">So I've been wondering if you'd help me grow this thing properly.</p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0eeff;border-left:4px solid #6C63FF;border-radius:12px;padding:20px 24px;margin:0 0 28px 0;">
              <tr><td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#1a1a1a;">
                <p style="margin:0 0 8px 0;font-size:18px;"><strong>🎁 Here's the deal — and I'm keeping it dead simple:</strong></p>
                <p style="margin:0;"><strong>Refer one new person to Cleya, and I'll hand-pick a proprietary connection for you within 48 hours.</strong> Not from the regular match pool — someone curated specifically for you, from outside it. One referral = one new connection. No cap. Bring three, get three.</p>
              </td></tr>
            </table>

            <p style="margin:0 0 12px 0;"><strong>Three ways to send someone my way</strong> <span style="color:#666;">(pick whichever takes the least effort):</span></p>

            <ol style="margin:0 0 24px 0;padding-left:22px;">
              <li style="margin-bottom:10px;">📩 <strong>Forward this email</strong> to anyone you think would benefit. They'll figure out the rest.</li>
              <li style="margin-bottom:10px;">✉️ <strong>Ask them to email me</strong> at <a href="mailto:hello@cleya.ai" style="color:#6C63FF;text-decoration:none;"><strong>hello@cleya.ai</strong></a> — I'll take it from there.</li>
              <li style="margin-bottom:10px;">🔗 <strong>Reply to this email with their LinkedIn URL</strong> and I'll reach out personally, on your behalf.</li>
            </ol>

            <p style="margin:0 0 24px 0;color:#555;">No referral codes. No copy-paste links. No sign-up forms for <em>you</em> to fill out. Just a forward or a reply.</p>

            <p style="margin:0 0 8px 0;">Oh — and while I have you:</p>
            <p style="margin:0 0 24px 0;"><strong>Anything else I can help you with?</strong> A specific kind of intro you've been chasing — an investor, an operator, a co-founder, a hire? Just hit reply and tell me. That's literally my whole job.</p>

            <p style="margin:0 0 4px 0;">Talk soon,</p>
            <p style="margin:0 0 4px 0;"><strong>Cleya</strong></p>
            <p style="margin:0;color:#888;font-size:14px;font-style:italic;">Your AI networker, on call.</p>
          </td></tr>
        </table>

        <p style="font-size:12px;color:#999;margin:20px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          Cleya · India · <a href="{{UNSUB}}" style="color:#999;">Unsubscribe</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function main() {
  const dryRun = process.env.DRY === '1';
  const { getUncachableResendClient } = await import('../src/services/resendClient');
  const { client, fromEmail: connectorFromEmail } = await getUncachableResendClient();
  const fromEmail = connectorFromEmail || process.env.FROM_EMAIL || 'hello@cleya.ai';
  const FRONTEND_URL = process.env.FRONTEND_URL || 'https://cleya.ai';

  // Case-insensitive dedupe — prefer entries that have a name attached.
  const dedup = new Map<string, Recipient>();
  for (const r of RECIPIENTS) {
    const key = r.email.toLowerCase();
    const prev = dedup.get(key);
    if (!prev || (!prev.name && r.name)) dedup.set(key, r);
  }
  const recipients = [...dedup.values()];

  console.log(`📧 Broadcasting referral email to ${recipients.length} recipients (dry=${dryRun})`);
  console.log(`📧 From: ${fromEmail}  Reply-To: hello@cleya.ai`);

  let sent = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const r of recipients) {
    const firstName = firstNameOf(r.name);
    const subject = buildSubject(firstName);
    const unsubUrl = `${FRONTEND_URL}/unsubscribe?email=${encodeURIComponent(r.email)}`;
    const html = buildHtml(firstName).replace('{{UNSUB}}', unsubUrl);

    if (dryRun) {
      console.log(`  [DRY] → ${r.email.padEnd(40)} | ${subject}`);
      sent++;
      continue;
    }

    try {
      const result = await client.emails.send({
        from: `Cleya from Cleya.ai <${fromEmail}>`,
        to: [r.email],
        subject,
        html,
        reply_to: 'hello@cleya.ai',
        headers: {
          'List-Unsubscribe': `<${unsubUrl}>, <mailto:unsubscribe@cleya.ai?subject=unsubscribe>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      } as any);

      if (result.error) {
        failed++;
        failures.push(`${r.email}: ${JSON.stringify(result.error)}`);
        console.log(`  ❌ ${r.email}: ${JSON.stringify(result.error)}`);
      } else {
        sent++;
        console.log(`  ✅ ${r.email.padEnd(40)} | ${subject} | id=${result.data?.id}`);
      }
    } catch (err: any) {
      failed++;
      failures.push(`${r.email}: ${err?.message || err}`);
      console.log(`  ❌ ${r.email}: ${err?.message || err}`);
    }

    // Polite pacing — Resend free/dev tier is 2 req/s.
    await new Promise(res => setTimeout(res, 300));
  }

  console.log(`\n📊 Done. Sent: ${sent}  Failed: ${failed}`);
  if (failures.length) {
    console.log('Failures:');
    failures.forEach(f => console.log('  -', f));
  }
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });

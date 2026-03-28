import { createAIService } from '@cleya/ai';
import { prisma } from '@cleya/db';
import { createZoomMeeting, isUserZoomConnected } from './zoomService';
import { emailService } from './email';
import { sendToUser } from '../websocket/server';

const SECRETARY_SYSTEM_PROMPT = `You are Cleya Secretary, an AI assistant built into Cleya.ai — a professional networking platform for India's startup ecosystem.

You are each user's personal AI secretary. Your responsibilities:
1. Help schedule meetings with their matches/connections
2. Send calendar invites (you'll output structured actions for the system to execute)
3. Provide daily networking digests and updates
4. Help prepare for upcoming meetings with talking points
5. Manage follow-ups after introductions
6. Create Zoom meeting links when scheduling

Your personality:
- Warm, professional, proactive
- You speak concisely (2-4 sentences unless more detail is needed)
- You know India's startup ecosystem well
- You use the user's name when appropriate
- You proactively suggest actions (schedule a meeting, follow up, etc.)

IMPORTANT: When the user wants to schedule a meeting, output a JSON action block like this:
\`\`\`action
{"type":"schedule_meeting","matchId":"...","participantId":"...","title":"...","proposedTime":"ISO8601","duration":30,"createZoom":true}
\`\`\`

When the user wants to send a follow-up or meeting reminder:
\`\`\`action
{"type":"send_followup","to":"email","subject":"...","body":"..."}
\`\`\`

Always confirm with the user before executing actions. Present options clearly.
Never make up data — only reference what's in the context provided.`;

let ai: ReturnType<typeof createAIService> | null = null;

function getAI() {
  if (!ai) {
    if (!process.env.OPENAI_API_KEY) return null;
    ai = createAIService({ provider: 'openai', model: 'gpt-4o-mini' });
  }
  return ai;
}

const personaLabel: Record<string, string> = {
  FOUNDER: 'Founder', INVESTOR: 'Investor', TALENT: 'Talent',
  DEAL_PARTNER: 'Deal Partner', VENTURE_PARTNER: 'Venture Partner',
  ADVISOR: 'Advisor', OPERATOR: 'Operator', JOB_SEEKER: 'Job Seeker',
  RECRUITER: 'Recruiter', FREELANCER: 'Freelancer', OTHER: 'Other',
};

async function buildUserContext(userId: string): Promise<string> {
  const [user, matches, meetings, introductions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    }),
    prisma.match.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
        status: { in: ['ACCEPTED', 'PROPOSED', 'PENDING_A', 'PENDING_B'] },
      },
      include: {
        userA: { include: { profile: true } },
        userB: { include: { profile: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 15,
    }),
    prisma.meeting.findMany({
      where: {
        OR: [{ organizerId: userId }, { participantId: userId }],
        status: { in: ['PROPOSED', 'CONFIRMED'] },
      },
      include: {
        organizer: { include: { profile: true } },
        participant: { include: { profile: true } },
      },
      orderBy: { confirmedTime: 'asc' },
      take: 10,
    }),
    prisma.introductionRecord.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
        status: { in: ['SENT', 'VIEWED', 'RESPONDED', 'PENDING_APPROVAL'] },
      },
      include: {
        userA: { include: { profile: true } },
        userB: { include: { profile: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
  ]);

  const profile = user?.profile;
  const zoomConnected = !!user?.zoomAccessToken;

  let ctx = `\n--- USER CONTEXT ---\n`;
  ctx += `Name: ${user?.name || 'Unknown'}\n`;
  ctx += `Email: ${user?.email}\n`;
  if (profile) {
    ctx += `Persona: ${personaLabel[profile.persona || ''] || profile.persona || 'Not set'}\n`;
    ctx += `Role: ${profile.currentRole || 'Not set'}\n`;
    ctx += `Company: ${profile.companyName || 'Not set'}\n`;
    ctx += `Industries: ${profile.industries?.join(', ') || 'Not set'}\n`;
    ctx += `Location: ${profile.location || 'Not set'}\n`;
    if (profile.headline) ctx += `Headline: ${profile.headline}\n`;
  }
  ctx += `Zoom Connected: ${zoomConnected ? 'Yes' : 'No'}\n`;
  ctx += `Today: ${new Date().toISOString().split('T')[0]} (IST timezone)\n`;

  if (matches.length > 0) {
    ctx += `\n--- ACTIVE MATCHES (${matches.length}) ---\n`;
    for (const m of matches) {
      const other = m.userAId === userId ? m.userB : m.userA;
      const otherProfile = other.profile;
      const myResponse = m.userAId === userId ? m.userAResponse : m.userBResponse;
      ctx += `• ${other.name || other.email.split('@')[0]}`;
      if (otherProfile?.currentRole) ctx += ` — ${otherProfile.currentRole}`;
      if (otherProfile?.companyName) ctx += ` at ${otherProfile.companyName}`;
      ctx += ` (${personaLabel[otherProfile?.persona || ''] || 'Unknown'})`;
      ctx += ` | Match: ${Math.round(m.score * 100)}% | Status: ${m.status}`;
      ctx += ` | Your response: ${myResponse || 'PENDING'}`;
      ctx += ` | Match ID: ${m.id} | Other User ID: ${other.id}`;
      if (m.reason) ctx += ` | Why: ${m.reason}`;
      ctx += `\n`;
    }
  }

  if (meetings.length > 0) {
    ctx += `\n--- UPCOMING MEETINGS (${meetings.length}) ---\n`;
    for (const mt of meetings) {
      const other = mt.organizerId === userId ? mt.participant : mt.organizer;
      ctx += `• "${mt.title}" with ${other.name || other.email.split('@')[0]}`;
      if (mt.confirmedTime) ctx += ` — ${mt.confirmedTime.toISOString()}`;
      else if (mt.proposedTimes.length) ctx += ` — Proposed: ${mt.proposedTimes.map(t => t.toISOString()).join(', ')}`;
      ctx += ` | ${mt.duration}min | Status: ${mt.status}`;
      if (mt.meetingUrl) ctx += ` | URL: ${mt.meetingUrl}`;
      ctx += `\n`;
    }
  }

  if (introductions.length > 0) {
    ctx += `\n--- ACTIVE INTRODUCTIONS (${introductions.length}) ---\n`;
    for (const intro of introductions) {
      const other = intro.userAId === userId ? intro.userB : intro.userA;
      ctx += `• Intro with ${other.name || other.email.split('@')[0]}`;
      ctx += ` — Status: ${intro.status}`;
      if (intro.sentAt) ctx += ` | Sent: ${intro.sentAt.toISOString().split('T')[0]}`;
      ctx += `\n`;
    }
  }

  return ctx;
}

export async function chatWithSecretary(
  userId: string,
  message: string
): Promise<{ content: string; actions?: any[] }> {
  const aiInstance = getAI();

  const recentMessages = await prisma.secretaryMessage.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  await prisma.secretaryMessage.create({
    data: { userId, role: 'USER', content: message },
  });

  if (!aiInstance) {
    const fallback = getSecretaryFallback(message);
    await prisma.secretaryMessage.create({
      data: { userId, role: 'AI', content: fallback },
    });
    return { content: fallback };
  }

  const context = await buildUserContext(userId);

  const history = recentMessages
    .reverse()
    .map(m => ({
      role: (m.role === 'USER' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content,
    }));

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: SECRETARY_SYSTEM_PROMPT + context },
    ...history.slice(-10),
    { role: 'user', content: message },
  ];

  try {
    const response = await aiInstance.chat(messages);
    const responseText = response.content;

    await prisma.secretaryMessage.create({
      data: { userId, role: 'AI', content: responseText },
    });

    const actions = extractActions(responseText);

    return { content: responseText, actions };
  } catch (err) {
    console.error('Secretary AI error:', err);
    const fallback = getSecretaryFallback(message);
    await prisma.secretaryMessage.create({
      data: { userId, role: 'AI', content: fallback },
    });
    return { content: fallback };
  }
}

function extractActions(text: string): any[] {
  const actions: any[] = [];
  const regex = /```action\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      actions.push(JSON.parse(match[1].trim()));
    } catch {}
  }
  return actions;
}

export async function executeSecretaryAction(
  userId: string,
  action: any
): Promise<{ success: boolean; message: string; data?: any }> {
  switch (action.type) {
    case 'schedule_meeting':
      return handleScheduleMeeting(userId, action);
    case 'send_followup':
      return handleSendFollowup(userId, action);
    default:
      return { success: false, message: `Unknown action type: ${action.type}` };
  }
}

async function handleScheduleMeeting(
  userId: string,
  action: {
    participantId: string;
    title: string;
    proposedTime: string;
    duration?: number;
    createZoom?: boolean;
    matchId?: string;
  }
): Promise<{ success: boolean; message: string; data?: any }> {
  const proposedTime = new Date(action.proposedTime);
  if (isNaN(proposedTime.getTime())) {
    return { success: false, message: 'Invalid proposed time' };
  }

  const duration = action.duration || 30;
  let meetingUrl: string | null = null;
  let zoomMeetingId: string | null = null;

  if (action.createZoom) {
    const zoomConnected = await isUserZoomConnected(userId);
    if (zoomConnected) {
      const zoom = await createZoomMeeting(
        userId,
        action.title,
        proposedTime,
        duration
      );
      if (zoom) {
        meetingUrl = zoom.joinUrl;
        zoomMeetingId = zoom.meetingId;
      }
    }
  }

  const meeting = await prisma.meeting.create({
    data: {
      organizerId: userId,
      participantId: action.participantId,
      matchId: action.matchId || null,
      title: action.title,
      proposedTimes: [proposedTime],
      duration,
      meetingUrl,
      zoomMeetingId,
      status: 'PROPOSED',
    },
    include: {
      organizer: true,
      participant: true,
    },
  });

  const participant = meeting.participant;
  const organizer = meeting.organizer;

  try {
    await emailService.sendMeetingInvite(
      participant.email,
      organizer.name || 'A Cleya connection',
      action.title,
      proposedTime,
      duration,
      meetingUrl
    );

    await emailService.sendMeetingInvite(
      organizer.email,
      participant.name || 'A Cleya connection',
      action.title,
      proposedTime,
      duration,
      meetingUrl
    );
  } catch (err) {
    console.error('Failed to send meeting invite emails:', err);
  }

  return {
    success: true,
    message: `Meeting "${action.title}" proposed for ${proposedTime.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}${meetingUrl ? ' with Zoom link' : ''}`,
    data: { meetingId: meeting.id, meetingUrl, zoomMeetingId },
  };
}

async function handleSendFollowup(
  userId: string,
  action: { to: string; subject: string; body: string }
): Promise<{ success: boolean; message: string }> {
  try {
    await emailService.sendFollowup(action.to, action.subject, action.body);
    return { success: true, message: `Follow-up email sent to ${action.to}` };
  } catch (err) {
    console.error('Follow-up send error:', err);
    return { success: false, message: 'Failed to send follow-up email' };
  }
}

export async function generateDailyDigest(userId: string): Promise<string> {
  const [user, pendingMatches, upcomingMeetings, activeIntros] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    }),
    prisma.match.findMany({
      where: {
        OR: [
          { userAId: userId, userAResponse: null },
          { userBId: userId, userBResponse: null },
        ],
        status: { in: ['PROPOSED', 'PENDING_A', 'PENDING_B'] },
      },
      include: {
        userA: { include: { profile: true } },
        userB: { include: { profile: true } },
      },
    }),
    prisma.meeting.findMany({
      where: {
        OR: [{ organizerId: userId }, { participantId: userId }],
        status: { in: ['PROPOSED', 'CONFIRMED'] },
        confirmedTime: { gte: new Date() },
      },
      include: {
        organizer: true,
        participant: true,
      },
      orderBy: { confirmedTime: 'asc' },
      take: 5,
    }),
    prisma.introductionRecord.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
        status: { in: ['SENT', 'VIEWED', 'PENDING_APPROVAL'] },
      },
      include: {
        userA: { include: { profile: true } },
        userB: { include: { profile: true } },
      },
    }),
  ]);

  let digest = `Good morning${user?.name ? ', ' + user.name.split(' ')[0] : ''}! Here's your Cleya.ai daily update:\n\n`;

  if (pendingMatches.length > 0) {
    digest += `**${pendingMatches.length} match${pendingMatches.length > 1 ? 'es' : ''} waiting for your review:**\n`;
    for (const m of pendingMatches.slice(0, 3)) {
      const other = m.userAId === userId ? m.userB : m.userA;
      const otherProfile = other.profile;
      digest += `• ${other.name || 'Someone new'} — ${otherProfile?.currentRole || personaLabel[otherProfile?.persona || ''] || 'Professional'}`;
      if (otherProfile?.companyName) digest += ` at ${otherProfile.companyName}`;
      digest += ` (${Math.round(m.score * 100)}% match)\n`;
    }
    if (pendingMatches.length > 3) digest += `  ...and ${pendingMatches.length - 3} more\n`;
    digest += `\n`;
  }

  if (upcomingMeetings.length > 0) {
    digest += `**Upcoming meetings:**\n`;
    for (const mt of upcomingMeetings) {
      const other = mt.organizerId === userId ? mt.participant : mt.organizer;
      digest += `• "${mt.title}" with ${other.name || other.email}`;
      if (mt.confirmedTime) {
        digest += ` — ${mt.confirmedTime.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}`;
      }
      digest += `\n`;
    }
    digest += `\n`;
  }

  if (activeIntros.length > 0) {
    digest += `**${activeIntros.length} active introduction${activeIntros.length > 1 ? 's' : ''}** — don't forget to follow up!\n\n`;
  }

  if (pendingMatches.length === 0 && upcomingMeetings.length === 0 && activeIntros.length === 0) {
    digest += `Everything is up to date — no pending actions right now. Check back later or ask me to find new matches!\n`;
  }

  digest += `\nReply to me anytime to schedule meetings, get networking tips, or manage your connections.`;

  return digest;
}

export async function getConversationHistory(userId: string, limit: number = 50): Promise<any[]> {
  const messages = await prisma.secretaryMessage.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
  return messages.map(m => ({
    id: m.id,
    role: m.role === 'USER' ? 'user' : 'assistant',
    content: m.content,
    createdAt: m.createdAt,
  }));
}

export async function clearConversationHistory(userId: string): Promise<void> {
  await prisma.secretaryMessage.deleteMany({ where: { userId } });
}

export async function onMatchAccepted(matchId: string, userAId: string, userBId: string): Promise<void> {
  try {
    const [userA, userB] = await Promise.all([
      prisma.user.findUnique({ where: { id: userAId }, include: { profile: true } }),
      prisma.user.findUnique({ where: { id: userBId }, include: { profile: true } }),
    ]);
    if (!userA || !userB) return;

    const nameA = userA.name || 'your connection';
    const nameB = userB.name || 'your connection';
    const roleA = userA.profile?.currentRole || '';
    const companyA = userA.profile?.companyName || '';
    const roleB = userB.profile?.currentRole || '';
    const companyB = userB.profile?.companyName || '';

    const msgForA = `Great news! Your match with ${nameB}${roleB ? ` (${roleB}${companyB ? ` at ${companyB}` : ''})` : ''} has been accepted. Would you like me to schedule an introductory call? I can set up a 30-minute meeting and include a Zoom link if you have Zoom connected.`;
    const msgForB = `Great news! Your match with ${nameA}${roleA ? ` (${roleA}${companyA ? ` at ${companyA}` : ''})` : ''} has been accepted. Would you like me to schedule an introductory call? I can set up a 30-minute meeting and include a Zoom link if you have Zoom connected.`;

    await Promise.all([
      prisma.secretaryMessage.create({
        data: { userId: userAId, role: 'SYSTEM', content: msgForA },
      }),
      prisma.secretaryMessage.create({
        data: { userId: userBId, role: 'SYSTEM', content: msgForB },
      }),
    ]);

    sendToUser(userAId, 'secretary:message', { content: msgForA, type: 'match_accepted' });
    sendToUser(userBId, 'secretary:message', { content: msgForB, type: 'match_accepted' });
  } catch (err) {
    console.error('[Secretary] onMatchAccepted error:', err);
  }
}

function getSecretaryFallback(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('schedule') || lower.includes('meeting') || lower.includes('call')) {
    return "I can help schedule meetings with your connections! Tell me who you'd like to meet with and when, and I'll set it up — including a Zoom link if you've connected your account.";
  }
  if (lower.includes('digest') || lower.includes('update') || lower.includes('today')) {
    return "I'll prepare your daily digest with pending matches, upcoming meetings, and active introductions. Check your dashboard for the latest updates!";
  }
  if (lower.includes('zoom')) {
    return "To set up Zoom meetings automatically, connect your Zoom account from the Settings page. Once connected, I'll create Zoom links whenever you schedule a meeting.";
  }
  if (lower.includes('follow') || lower.includes('remind')) {
    return "I can help you follow up with your connections. Tell me who you'd like to reach out to, and I'll draft a follow-up message for you.";
  }
  return "Hi! I'm your Cleya AI Secretary. I can help you schedule meetings, send follow-ups, prepare for calls, and keep track of your networking activities. What would you like to do?";
}

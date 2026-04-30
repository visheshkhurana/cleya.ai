"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatWithSecretary = chatWithSecretary;
exports.executeSecretaryAction = executeSecretaryAction;
exports.generateDailyDigest = generateDailyDigest;
exports.getConversationHistory = getConversationHistory;
exports.clearConversationHistory = clearConversationHistory;
exports.onMatchAccepted = onMatchAccepted;
const ai_1 = require("@cleya/ai");
const db_1 = require("@cleya/db");
const matching_1 = require("@cleya/matching");
const zoomService_1 = require("./zoomService");
const email_1 = require("./email");
const server_1 = require("../websocket/server");
const calendarService = __importStar(require("./calendarService"));
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

When the user asks about their schedule, calendar, upcoming meetings, or availability:
\`\`\`action
{"type":"get_calendar_events","timeMin":"ISO8601","timeMax":"ISO8601"}
\`\`\`

When the user wants to create a calendar event:
\`\`\`action
{"type":"create_calendar_event","summary":"...","description":"...","start":"ISO8601","end":"ISO8601","attendees":["email1","email2"]}
\`\`\`

When the user asks about availability for a specific date:
\`\`\`action
{"type":"check_availability","date":"YYYY-MM-DD"}
\`\`\`

Always confirm with the user before executing actions. Present options clearly.
Never make up data — only reference what's in the context provided.`;
let ai = null;
function getAI() {
    if (!ai) {
        if (!process.env.OPENAI_API_KEY)
            return null;
        ai = (0, ai_1.createAIService)({ provider: 'openai', model: 'gpt-4o-mini' });
    }
    return ai;
}
const personaLabel = {
    FOUNDER: 'Founder', INVESTOR: 'Investor', TALENT: 'Talent',
    DEAL_PARTNER: 'Deal Partner', VENTURE_PARTNER: 'Venture Partner',
    ADVISOR: 'Advisor', OPERATOR: 'Operator', JOB_SEEKER: 'Job Seeker',
    RECRUITER: 'Recruiter', FREELANCER: 'Freelancer', OTHER: 'Other',
};
async function buildUserContext(userId) {
    const [user, matches, meetings, introductions] = await Promise.all([
        db_1.prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true },
        }),
        db_1.prisma.match.findMany({
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
        db_1.prisma.meeting.findMany({
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
        db_1.prisma.introductionRecord.findMany({
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
        if (profile.headline)
            ctx += `Headline: ${profile.headline}\n`;
    }
    const calendarConnected = await calendarService.isUserCalendarConnected(userId);
    ctx += `Zoom Connected: ${zoomConnected ? 'Yes' : 'No'}\n`;
    ctx += `Google Calendar Connected: ${calendarConnected ? 'Yes' : 'No'}\n`;
    ctx += `Today: ${new Date().toISOString().split('T')[0]} (IST timezone)\n`;
    if (matches.length > 0) {
        ctx += `\n--- ACTIVE MATCHES (${matches.length}) ---\n`;
        for (const m of matches) {
            const other = m.userAId === userId ? m.userB : m.userA;
            const otherProfile = other.profile;
            const myResponse = m.userAId === userId ? m.userAResponse : m.userBResponse;
            ctx += `• ${other.name || other.email.split('@')[0]}`;
            if (otherProfile?.currentRole)
                ctx += ` — ${otherProfile.currentRole}`;
            if (otherProfile?.companyName)
                ctx += ` at ${otherProfile.companyName}`;
            ctx += ` (${personaLabel[otherProfile?.persona || ''] || 'Unknown'})`;
            ctx += ` | Match: ${Math.round(m.score * 100)}% | Status: ${m.status}`;
            ctx += ` | Your response: ${myResponse || 'PENDING'}`;
            ctx += ` | Match ID: ${m.id} | Other User ID: ${other.id}`;
            if (m.reason)
                ctx += ` | Why: ${m.reason}`;
            ctx += `\n`;
        }
    }
    if (meetings.length > 0) {
        ctx += `\n--- UPCOMING MEETINGS (${meetings.length}) ---\n`;
        for (const mt of meetings) {
            const other = mt.organizerId === userId ? mt.participant : mt.organizer;
            ctx += `• "${mt.title}" with ${other.name || other.email.split('@')[0]}`;
            if (mt.confirmedTime)
                ctx += ` — ${mt.confirmedTime.toISOString()}`;
            else if (mt.proposedTimes.length)
                ctx += ` — Proposed: ${mt.proposedTimes.map(t => t.toISOString()).join(', ')}`;
            ctx += ` | ${mt.duration}min | Status: ${mt.status}`;
            if (mt.meetingUrl)
                ctx += ` | URL: ${mt.meetingUrl}`;
            ctx += `\n`;
        }
    }
    if (introductions.length > 0) {
        ctx += `\n--- ACTIVE INTRODUCTIONS (${introductions.length}) ---\n`;
        for (const intro of introductions) {
            const other = intro.userAId === userId ? intro.userB : intro.userA;
            ctx += `• Intro with ${other.name || other.email.split('@')[0]}`;
            ctx += ` — Status: ${intro.status}`;
            if (intro.sentAt)
                ctx += ` | Sent: ${intro.sentAt.toISOString().split('T')[0]}`;
            ctx += `\n`;
        }
    }
    return ctx;
}
async function chatWithSecretary(userId, message) {
    const aiInstance = getAI();
    const recentMessages = await db_1.prisma.secretaryMessage.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
    });
    await db_1.prisma.secretaryMessage.create({
        data: { userId, role: 'USER', content: message },
    });
    if (!aiInstance) {
        const fallback = getSecretaryFallback(message);
        await db_1.prisma.secretaryMessage.create({
            data: { userId, role: 'AI', content: fallback },
        });
        return { content: fallback };
    }
    const context = await buildUserContext(userId);
    const history = recentMessages
        .reverse()
        .map(m => ({
        role: (m.role === 'USER' ? 'user' : 'assistant'),
        content: m.content,
    }));
    const messages = [
        { role: 'system', content: SECRETARY_SYSTEM_PROMPT + context },
        ...history.slice(-10),
        { role: 'user', content: message },
    ];
    try {
        const response = await aiInstance.chat(messages);
        const responseText = response.content;
        await db_1.prisma.secretaryMessage.create({
            data: { userId, role: 'AI', content: responseText },
        });
        const actions = extractActions(responseText);
        return { content: responseText, actions };
    }
    catch (err) {
        console.error('Secretary AI error:', err);
        const fallback = getSecretaryFallback(message);
        await db_1.prisma.secretaryMessage.create({
            data: { userId, role: 'AI', content: fallback },
        });
        return { content: fallback };
    }
}
function extractActions(text) {
    const actions = [];
    const regex = /```action\s*\n([\s\S]*?)```/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        try {
            actions.push(JSON.parse(match[1].trim()));
        }
        catch { }
    }
    return actions;
}
async function executeSecretaryAction(userId, action) {
    switch (action.type) {
        case 'schedule_meeting':
            return handleScheduleMeeting(userId, action);
        case 'send_followup':
            return handleSendFollowup(userId, action);
        case 'get_calendar_events':
            return handleGetCalendarEvents(userId, action);
        case 'create_calendar_event':
            return handleCreateCalendarEvent(userId, action);
        case 'check_availability':
            return handleCheckAvailability(userId, action);
        default:
            return { success: false, message: `Unknown action type: ${action.type}` };
    }
}
async function handleScheduleMeeting(userId, action) {
    const proposedTime = new Date(action.proposedTime);
    if (isNaN(proposedTime.getTime())) {
        return { success: false, message: 'Invalid proposed time' };
    }
    const duration = action.duration || 30;
    let meetingUrl = null;
    let zoomMeetingId = null;
    if (action.createZoom) {
        const zoomConnected = await (0, zoomService_1.isUserZoomConnected)(userId);
        if (zoomConnected) {
            const zoom = await (0, zoomService_1.createZoomMeeting)(userId, action.title, proposedTime, duration);
            if (zoom) {
                meetingUrl = zoom.joinUrl;
                zoomMeetingId = zoom.meetingId;
            }
        }
    }
    const meeting = await db_1.prisma.meeting.create({
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
        await email_1.emailService.sendMeetingInvite(participant.email, organizer.name || 'A Cleya connection', action.title, proposedTime, duration, meetingUrl);
        await email_1.emailService.sendMeetingInvite(organizer.email, participant.name || 'A Cleya connection', action.title, proposedTime, duration, meetingUrl);
    }
    catch (err) {
        console.error('Failed to send meeting invite emails:', err);
    }
    return {
        success: true,
        message: `Meeting "${action.title}" proposed for ${proposedTime.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}${meetingUrl ? ' with Zoom link' : ''}`,
        data: { meetingId: meeting.id, meetingUrl, zoomMeetingId },
    };
}
async function handleSendFollowup(userId, action) {
    try {
        await email_1.emailService.sendFollowup(action.to, action.subject, action.body);
        return { success: true, message: `Follow-up email sent to ${action.to}` };
    }
    catch (err) {
        console.error('Follow-up send error:', err);
        return { success: false, message: 'Failed to send follow-up email' };
    }
}
async function generateDailyDigest(userId) {
    const [user, pendingMatches, upcomingMeetings, activeIntros] = await Promise.all([
        db_1.prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true },
        }),
        db_1.prisma.match.findMany({
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
        db_1.prisma.meeting.findMany({
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
        db_1.prisma.introductionRecord.findMany({
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
            if (otherProfile?.companyName)
                digest += ` at ${otherProfile.companyName}`;
            digest += ` (${(0, matching_1.toDisplayPercent)(m.score)}% match)\n`;
        }
        if (pendingMatches.length > 3)
            digest += `  ...and ${pendingMatches.length - 3} more\n`;
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
async function getConversationHistory(userId, limit = 50) {
    const messages = await db_1.prisma.secretaryMessage.findMany({
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
async function clearConversationHistory(userId) {
    await db_1.prisma.secretaryMessage.deleteMany({ where: { userId } });
}
async function onMatchAccepted(matchId, userAId, userBId) {
    try {
        const [userA, userB] = await Promise.all([
            db_1.prisma.user.findUnique({ where: { id: userAId }, include: { profile: true } }),
            db_1.prisma.user.findUnique({ where: { id: userBId }, include: { profile: true } }),
        ]);
        if (!userA || !userB)
            return;
        const nameA = userA.name || 'your connection';
        const nameB = userB.name || 'your connection';
        const roleA = userA.profile?.currentRole || '';
        const companyA = userA.profile?.companyName || '';
        const roleB = userB.profile?.currentRole || '';
        const companyB = userB.profile?.companyName || '';
        const msgForA = `Great news! Your match with ${nameB}${roleB ? ` (${roleB}${companyB ? ` at ${companyB}` : ''})` : ''} has been accepted. Would you like me to schedule an introductory call? I can set up a 30-minute meeting and include a Zoom link if you have Zoom connected.`;
        const msgForB = `Great news! Your match with ${nameA}${roleA ? ` (${roleA}${companyA ? ` at ${companyA}` : ''})` : ''} has been accepted. Would you like me to schedule an introductory call? I can set up a 30-minute meeting and include a Zoom link if you have Zoom connected.`;
        await Promise.all([
            db_1.prisma.secretaryMessage.create({
                data: { userId: userAId, role: 'SYSTEM', content: msgForA },
            }),
            db_1.prisma.secretaryMessage.create({
                data: { userId: userBId, role: 'SYSTEM', content: msgForB },
            }),
        ]);
        (0, server_1.sendToUser)(userAId, 'secretary:message', { content: msgForA, type: 'match_accepted' });
        (0, server_1.sendToUser)(userBId, 'secretary:message', { content: msgForB, type: 'match_accepted' });
    }
    catch (err) {
        console.error('[Secretary] onMatchAccepted error:', err);
    }
}
async function handleGetCalendarEvents(userId, action) {
    try {
        const events = await calendarService.getEvents(userId, action.timeMin ? new Date(action.timeMin) : undefined, action.timeMax ? new Date(action.timeMax) : undefined);
        if (events.length === 0) {
            return { success: true, message: 'No upcoming events found in your calendar.' };
        }
        const formatted = events.map(e => {
            const start = e.start?.dateTime || e.start?.date || '';
            const summary = e.summary || 'Untitled';
            const startDate = start ? new Date(start).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'TBD';
            return `• ${summary} — ${startDate}`;
        }).join('\n');
        return {
            success: true,
            message: `Here are your upcoming events:\n${formatted}`,
            data: events.map(e => ({ id: e.id, summary: e.summary, start: e.start?.dateTime || e.start?.date, end: e.end?.dateTime || e.end?.date })),
        };
    }
    catch (err) {
        console.error('Calendar get events error:', err);
        if (err.message?.includes('not connected')) {
            return { success: false, message: 'Your Google Calendar is not connected. Please connect it from Settings first.' };
        }
        return { success: false, message: 'Failed to fetch calendar events.' };
    }
}
async function handleCreateCalendarEvent(userId, action) {
    try {
        const event = await calendarService.createEvent(userId, {
            summary: action.summary,
            description: action.description,
            start: new Date(action.start),
            end: new Date(action.end),
            attendees: action.attendees,
        });
        const startStr = event.start?.dateTime
            ? new Date(event.start.dateTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '';
        return {
            success: true,
            message: `Calendar event "${action.summary}" created for ${startStr}${event.htmlLink ? `. [View in Calendar](${event.htmlLink})` : ''}`,
            data: { eventId: event.id, htmlLink: event.htmlLink },
        };
    }
    catch (err) {
        console.error('Calendar create event error:', err);
        if (err.message?.includes('not connected')) {
            return { success: false, message: 'Your Google Calendar is not connected. Please connect it from Settings first.' };
        }
        return { success: false, message: 'Failed to create calendar event.' };
    }
}
async function handleCheckAvailability(userId, action) {
    try {
        const result = await calendarService.checkAvailability(userId, new Date(action.date));
        if (result.free) {
            return { success: true, message: `You're free all day on ${action.date}!`, data: result };
        }
        const busySlots = result.busy.map(b => {
            const start = new Date(b.start).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
            const end = new Date(b.end).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
            return `${start} – ${end}`;
        }).join(', ');
        return {
            success: true,
            message: `On ${action.date}, you have ${result.busy.length} busy slot(s): ${busySlots}`,
            data: result,
        };
    }
    catch (err) {
        console.error('Calendar availability error:', err);
        if (err.message?.includes('not connected')) {
            return { success: false, message: 'Your Google Calendar is not connected. Please connect it from Settings first.' };
        }
        return { success: false, message: 'Failed to check availability.' };
    }
}
function getSecretaryFallback(message) {
    const lower = message.toLowerCase();
    if (lower.includes('schedule') || lower.includes('meeting') || lower.includes('call')) {
        return "I can help schedule meetings with your connections! Tell me who you'd like to meet with and when, and I'll set it up — including a Zoom link if you've connected your account.";
    }
    if (lower.includes('digest') || lower.includes('update') || lower.includes('today')) {
        return "I'll prepare your daily digest with pending matches, upcoming meetings, and active introductions. Check your dashboard for the latest updates!";
    }
    if (lower.includes('calendar') || lower.includes('schedule') || lower.includes('availability') || lower.includes('free') || lower.includes('busy')) {
        return "I can help with your calendar! If you've connected your Google Calendar in Settings, I can check your schedule, find free time slots, and create events. Just ask me about your availability or tell me what meeting to set up.";
    }
    if (lower.includes('zoom')) {
        return "To set up Zoom meetings automatically, connect your Zoom account from the Settings page. Once connected, I'll create Zoom links whenever you schedule a meeting.";
    }
    if (lower.includes('follow') || lower.includes('remind')) {
        return "I can help you follow up with your connections. Tell me who you'd like to reach out to, and I'll draft a follow-up message for you.";
    }
    return "Hi! I'm your Cleya AI Secretary. I can help you schedule meetings, send follow-ups, prepare for calls, and keep track of your networking activities. What would you like to do?";
}
//# sourceMappingURL=secretaryService.js.map
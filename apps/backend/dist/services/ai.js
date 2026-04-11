"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatWithCleo = chatWithCleo;
const ai_1 = require("@cleya/ai");
const db_1 = require("@cleya/db");
const SYSTEM_PROMPT = `You are Cleya, an AI superconnector for professional networking. You work for Cleya.ai, a platform that matches founders, investors, talent, advisors, and partners.

Your personality:
- Warm, professional, and conversational
- You use concise responses (2-3 sentences max unless asked for more)
- You're knowledgeable about startups, investing, hiring, and networking
- You give actionable networking advice

You have access to the user's profile and match data. Use it to personalize your responses.
When users ask about their matches, give specific details from the data provided.
When users ask for networking tips, tailor advice to their persona and goals.
Never make up match data — only reference what's in the context provided.`;
const personaLabel = {
    FOUNDER: 'Founder', INVESTOR: 'Investor', TALENT: 'Talent', DEAL_PARTNER: 'Deal Partner',
    VENTURE_PARTNER: 'Venture Partner', ADVISOR: 'Advisor', OPERATOR: 'Operator',
    JOB_SEEKER: 'Job Seeker', RECRUITER: 'Recruiter', FREELANCER: 'Freelancer', OTHER: 'Other',
};
let ai = null;
function getAI() {
    if (!ai) {
        if (!process.env.OPENAI_API_KEY)
            return null;
        ai = (0, ai_1.createAIService)({ provider: 'openai', model: 'gpt-4o-mini' });
    }
    return ai;
}
async function chatWithCleo(userId, message, conversationHistory = []) {
    const aiInstance = getAI();
    if (!aiInstance) {
        return {
            content: getFallbackResponse(message),
            success: true,
            fallback: true,
        };
    }
    const [user, matches] = await Promise.all([
        db_1.prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true },
        }),
        db_1.prisma.match.findMany({
            where: {
                OR: [{ userAId: userId }, { userBId: userId }],
                status: { not: 'REJECTED' },
            },
            include: {
                userA: { include: { profile: true } },
                userB: { include: { profile: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
        }),
    ]);
    const profile = user?.profile;
    let context = `\n\nUser Profile:\n`;
    if (profile) {
        context += `- Persona: ${personaLabel[profile.persona || ''] || profile.persona || 'Not set'}\n`;
        context += `- Role: ${profile.currentRole || 'Not set'}\n`;
        context += `- Company: ${profile.companyName || 'Not set'}\n`;
        context += `- Industries: ${profile.industries?.join(', ') || 'Not set'}\n`;
        context += `- Skills: ${profile.skills?.join(', ') || 'Not set'}\n`;
        context += `- Looking for: ${profile.lookingFor?.join(', ') || 'Not set'}\n`;
        context += `- Location: ${profile.location || 'Not set'}\n`;
        if (profile.headline)
            context += `- Headline: ${profile.headline}\n`;
    }
    else {
        context += `- No profile yet\n`;
    }
    if (matches.length > 0) {
        context += `\nRecent Matches (${matches.length}):\n`;
        for (const m of matches) {
            const other = m.userAId === userId ? m.userB : m.userA;
            const otherProfile = other.profile;
            const myResponse = m.userAId === userId ? m.userAResponse : m.userBResponse;
            context += `- ${otherProfile?.currentRole || other.email.split('@')[0]}`;
            if (otherProfile?.companyName)
                context += ` at ${otherProfile.companyName}`;
            context += ` (${personaLabel[otherProfile?.persona || ''] || 'Unknown'})`;
            context += ` — Score: ${Math.round(m.score * 100)}%, Status: ${m.status}, Your response: ${myResponse}`;
            if (m.reason)
                context += `, Reason: ${m.reason}`;
            context += `\n`;
        }
    }
    else {
        context += `\nNo matches yet.\n`;
    }
    const historyMessages = conversationHistory.slice(-20).map(m => ({ ...m, role: m.role }));
    const lastMsg = historyMessages[historyMessages.length - 1];
    const isDuplicate = lastMsg && lastMsg.role === 'user' && lastMsg.content === message;
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT + context },
        ...historyMessages,
        ...(isDuplicate ? [] : [{ role: 'user', content: message }]),
    ];
    try {
        const response = await aiInstance.chat(messages);
        return { content: response.content, success: true, fallback: false };
    }
    catch (err) {
        console.error('AI chat error:', err);
        return {
            content: getFallbackResponse(message),
            success: true,
            fallback: true,
        };
    }
}
function getFallbackResponse(message) {
    const lower = message.toLowerCase();
    if (lower.includes('match') || lower.includes('connection')) {
        return "I can help you with your matches! Check the Matches page to review your pending connections, or use the 'Find Matches' button on your dashboard to discover new ones.";
    }
    if (lower.includes('profile') || lower.includes('update')) {
        return "You can update your profile from the Profile page — a complete profile helps Cleya find better matches for you!";
    }
    if (lower.includes('network') || lower.includes('tip') || lower.includes('advice')) {
        return "Great networking tip: Be specific about what you're looking for and what you can offer. The more detailed your profile, the better matches Cleya can find for you.";
    }
    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
        return "Hey there! I'm Cleya, your AI networking assistant. I can help you with your matches, suggest connections, and offer networking tips. What would you like to know?";
    }
    return "I'm here to help with your networking goals! You can ask me about your matches, get networking tips, or learn more about how Cleya works. What's on your mind?";
}
//# sourceMappingURL=ai.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.automationService = exports.AutomationService = void 0;
const db_1 = require("@cleya/db");
const callService_1 = require("./voice/callService");
const messagingService_1 = require("./messagingService");
const matchingService_1 = require("./matchingService");
const whatsappTemplates_1 = require("./whatsappTemplates");
const matchScheduler_1 = require("./matchScheduler");
const email_1 = require("./email");
// Cadence for the "still working on your matches" reassurance emails.
// All three fire only if the user STILL has zero matches at trigger time.
//   T+2h   — first interim ("still finding your matches")
//   T+24h  — day-1 follow-up ("still searching for the right match")
//   T+48h  — day-2 honest update ("haven't found one yet, will keep looking")
// After T+48h we go quiet until matches actually appear.
const INTERIM_MATCH_EMAIL_DELAY_MS = 2 * 60 * 60 * 1000; // 2 hours
const INTERIM_MATCH_EMAIL_DAY1_DELAY_MS = 24 * 60 * 60 * 1000; // 24 hours
const INTERIM_MATCH_EMAIL_DAY2_DELAY_MS = 48 * 60 * 60 * 1000; // 48 hours
class AutomationService {
    // In-memory dedupe so retried/replayed onboarding completions don't queue
    // multiple interim-email timers for the same user. Process-local; restart
    // resets it, which is fine because onboarding completion is the source
    // event and replays would also need a process to be live to re-trigger.
    // Keys are composite: `${userId}:${stage}` where stage ∈ {2h, 24h, 48h}.
    interimEmailScheduled = new Set();
    async onOnboardingComplete(userId, context) {
        console.log(`Running post-onboarding automation for user ${userId}`);
        const user = await db_1.prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true },
        });
        if (!user) {
            console.error(`User ${userId} not found for automation`);
            return;
        }
        const phoneNumber = user.phone || user.profile?.phoneNumber;
        const userName = user.profile?.currentRole || user.email.split('@')[0];
        const persona = user.profile?.persona;
        matchScheduler_1.matchScheduler.enqueueUserCheck(userId);
        matchScheduler_1.matchScheduler.enqueueRecheckPeers(userId).catch((err) => console.log(`[AutoMatch] Peer re-queue failed for ${userId}:`, err));
        this.scheduleInterimMatchEmail(userId, user.email, userName);
        this.scheduleInterimMatchEmailDay1(userId, user.email, userName);
        this.scheduleInterimMatchEmailDay2(userId, user.email, userName);
        if (persona === 'DEAL_PARTNER') {
            this.scheduleDealPartnerScout(userId);
        }
        else if (persona === 'EVENT_PARTICIPANT') {
            this.scheduleEventRegistration(userId, context);
        }
        if (!phoneNumber) {
            console.log(`No phone number for user ${userId}, skipping call/messaging automation`);
            return;
        }
        this.scheduleCall(userId, phoneNumber);
        this.sendWelcomeMessages(userId, phoneNumber, userName);
    }
    scheduleDealPartnerScout(userId) {
        setTimeout(async () => {
            try {
                console.log(`[DealFlow] Starting auto-scout for deal partner ${userId}`);
                const scouted = await matchingService_1.matchingService.autoScoutFounders(userId, 5);
                console.log(`[DealFlow] Auto-scouted ${scouted.length} founders for deal partner ${userId}`);
            }
            catch (error) {
                console.error(`[DealFlow] Auto-scout failed for deal partner ${userId}:`, error);
            }
        }, 5000);
    }
    scheduleEventRegistration(userId, context) {
        setTimeout(async () => {
            try {
                console.log(`[EventFlow] Auto-registering EVENT_PARTICIPANT ${userId} for upcoming Pitch by Deel`);
                const upcomingEvent = await db_1.prisma.event.findFirst({
                    where: {
                        status: 'UPCOMING',
                        date: { gte: new Date() },
                    },
                    orderBy: { date: 'asc' },
                    include: { _count: { select: { participants: true } } },
                });
                if (!upcomingEvent) {
                    console.log(`[EventFlow] No upcoming events found for auto-registration`);
                    return;
                }
                const isAtCapacity = upcomingEvent.maxCapacity && upcomingEvent._count.participants >= upcomingEvent.maxCapacity;
                const participant = await db_1.prisma.eventParticipant.create({
                    data: {
                        eventId: upcomingEvent.id,
                        userId,
                        status: isAtCapacity ? 'WAITLISTED' : 'REGISTERED',
                        eventCode: 'PITCH_BY_DEEL',
                        eventName: upcomingEvent.name,
                        pitchTopic: context.businessDescription || context.pitchTopic || null,
                        preferredMentors: context.preferredMentors || [],
                        registeredAt: new Date(),
                    },
                });
                console.log(`[EventFlow] Auto-registered ${userId} for event ${upcomingEvent.name} (status: ${participant.status})`);
            }
            catch (error) {
                if (error.code === 'P2002') {
                    console.log(`[EventFlow] User ${userId} already registered for event`);
                }
                else {
                    console.error(`[EventFlow] Auto-registration failed for ${userId}:`, error);
                }
            }
        }, 3000);
    }
    /**
     * Schedules the interim "still working on your matches" email.
     *
     * Fires after INTERIM_MATCH_EMAIL_DELAY_MS (2h). At trigger time we
     * re-check the database — if the user already has at least one
     * proposed match by then, we skip (the match-proposed email already
     * communicated the news). Otherwise we send the interim so the user
     * isn't left wondering whether anything is happening.
     *
     * Uses setTimeout for parity with scheduleCall / scheduleDealPartnerScout.
     * If the process restarts inside the 2h window the timer is lost; that's
     * an acceptable trade-off for v1 — the worst case is a missed reassurance
     * email, not a broken match.
     */
    scheduleInterimMatchEmail(userId, email, userName) {
        this.scheduleInterimEmailStage(userId, email, userName, '2h', INTERIM_MATCH_EMAIL_DELAY_MS, (e, n) => email_1.emailService.sendMatchInterim(e, n));
    }
    scheduleInterimMatchEmailDay1(userId, email, userName) {
        this.scheduleInterimEmailStage(userId, email, userName, '24h', INTERIM_MATCH_EMAIL_DAY1_DELAY_MS, (e, n) => email_1.emailService.sendMatchInterimDay1(e, n));
    }
    scheduleInterimMatchEmailDay2(userId, email, userName) {
        this.scheduleInterimEmailStage(userId, email, userName, '48h', INTERIM_MATCH_EMAIL_DAY2_DELAY_MS, (e, n) => email_1.emailService.sendMatchInterimDay2(e, n));
    }
    /**
     * Shared scheduler for all three interim-email stages.
     *
     * Each stage is dedup-keyed independently (`${userId}:${stage}`) so the
     * 2h, 24h, and 48h timers don't collide and a replay of onOnboardingComplete
     * never queues two timers for the same stage. At trigger time we re-check
     * the database and bail out if any matches now exist.
     */
    scheduleInterimEmailStage(userId, email, userName, stage, delayMs, sender) {
        const dedupeKey = `${userId}:${stage}`;
        if (this.interimEmailScheduled.has(dedupeKey)) {
            console.log(`[InterimEmail:${stage}] Already scheduled for ${userId}, skipping duplicate`);
            return;
        }
        this.interimEmailScheduled.add(dedupeKey);
        setTimeout(async () => {
            try {
                const matchCount = await db_1.prisma.match.count({
                    where: { OR: [{ userAId: userId }, { userBId: userId }] },
                });
                if (matchCount > 0) {
                    console.log(`[InterimEmail:${stage}] Skipping for ${userId} — ${matchCount} match(es) already exist`);
                    return;
                }
                const ok = await sender(email, userName);
                console.log(`[InterimEmail:${stage}] Sent to ${email} for user ${userId}: ${ok}`);
            }
            catch (err) {
                console.error(`[InterimEmail:${stage}] Failed to send for ${userId}:`, err);
            }
            finally {
                this.interimEmailScheduled.delete(dedupeKey);
            }
        }, delayMs);
    }
    scheduleCall(userId, phoneNumber) {
        setTimeout(async () => {
            try {
                console.log(`Initiating post-onboarding call to ${phoneNumber}`);
                await callService_1.callService.initiateCall(userId, phoneNumber);
            }
            catch (error) {
                console.error(`Failed to initiate call for user ${userId}:`, error);
            }
        }, 30000);
    }
    async sendWelcomeMessages(userId, phoneNumber, userName) {
        const result = await whatsappTemplates_1.whatsappTemplates.triggerWelcome(userId);
        if (!result || result.status === 'FAILED') {
            console.log(`WhatsApp template failed for ${userId}, falling back to plain SMS`);
            const welcomeMessage = messagingService_1.messagingService.getWelcomeMessage(userName);
            await messagingService_1.messagingService.sendSMS(userId, phoneNumber, welcomeMessage);
        }
    }
    async schedulePostEventFollowUp(eventId, delayMs = 24 * 60 * 60 * 1000) {
        console.log(`[EventFlow] Scheduling post-event follow-up for event ${eventId} in ${delayMs / 1000}s`);
        setTimeout(async () => {
            try {
                console.log(`[EventFlow] Running post-event follow-up for event ${eventId}`);
                const event = await db_1.prisma.event.findUnique({
                    where: { id: eventId },
                    include: {
                        participants: {
                            where: { status: { in: ['REGISTERED', 'CONFIRMED', 'ATTENDED'] } },
                            include: {
                                user: {
                                    select: { id: true, email: true, phone: true, profile: { select: { currentRole: true, phoneNumber: true } } },
                                },
                            },
                        },
                    },
                });
                if (!event) {
                    console.log(`[EventFlow] Event ${eventId} not found for follow-up`);
                    return;
                }
                let sent = 0;
                for (const participant of event.participants) {
                    const phone = participant.user.phone || participant.user.profile?.phoneNumber;
                    if (!phone)
                        continue;
                    const matches = await db_1.prisma.match.findMany({
                        where: {
                            OR: [{ userAId: participant.userId }, { userBId: participant.userId }],
                            eventId: eventId,
                            status: { in: ['PROPOSED', 'PENDING_A', 'PENDING_B', 'ACCEPTED'] },
                        },
                        include: {
                            userA: { select: { profile: { select: { headline: true, companyName: true } } } },
                            userB: { select: { profile: { select: { headline: true, companyName: true } } } },
                        },
                        take: 5,
                    });
                    const matchNames = matches.map(m => {
                        const other = m.userAId === participant.userId ? m.userB : m.userA;
                        return `${other.profile?.headline || 'Professional'} at ${other.profile?.companyName || 'a company'}`;
                    });
                    const userName = participant.user.profile?.currentRole || participant.user.email.split('@')[0];
                    const message = matchNames.length > 0
                        ? `Hi ${userName}! Thanks for attending "${event.name}"! Your top matches:\n\n${matchNames.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nOpen Cleya.ai to review and accept introductions!`
                        : `Hi ${userName}! Thanks for attending "${event.name}"! We're finding connections for you — check Cleya.ai soon!`;
                    try {
                        const result = await messagingService_1.messagingService.sendWhatsApp(participant.userId, phone, message);
                        if (result && result.status === 'FAILED') {
                            await messagingService_1.messagingService.sendSMS(participant.userId, phone, message);
                        }
                        sent++;
                    }
                    catch (err) {
                        console.error(`[EventFlow] Follow-up failed for ${participant.userId}:`, err);
                    }
                }
                console.log(`[EventFlow] Post-event follow-up sent to ${sent}/${event.participants.length} participants`);
            }
            catch (error) {
                console.error(`[EventFlow] Post-event follow-up failed for event ${eventId}:`, error);
            }
        }, delayMs);
    }
    async triggerCallForUser(userId, phoneNumber) {
        return callService_1.callService.initiateCall(userId, phoneNumber);
    }
    async triggerMessageForUser(userId, phoneNumber, channel, message) {
        if (channel === 'WHATSAPP') {
            return messagingService_1.messagingService.sendWhatsApp(userId, phoneNumber, message);
        }
        return messagingService_1.messagingService.sendSMS(userId, phoneNumber, message);
    }
}
exports.AutomationService = AutomationService;
exports.automationService = new AutomationService();
//# sourceMappingURL=automationService.js.map
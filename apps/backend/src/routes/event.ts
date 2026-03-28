import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '@cleya/db';
import { matchingService } from '../services/matchingService';
import { messagingService } from '../services/messagingService';
import { automationService } from '../services/automationService';

export const eventRouter = Router();

eventRouter.get('/admin/all', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const events = await prisma.event.findMany({
      include: {
        organizer: { select: { id: true, email: true } },
        participants: {
          include: {
            user: { select: { id: true, email: true, profile: { select: { headline: true, persona: true, companyName: true } } } },
          },
        },
        _count: { select: { participants: true } },
      },
      orderBy: { date: 'desc' },
    });

    const stats = {
      total: events.length,
      upcoming: events.filter(e => e.status === 'UPCOMING').length,
      active: events.filter(e => e.status === 'ACTIVE').length,
      completed: events.filter(e => e.status === 'COMPLETED').length,
      totalParticipants: events.reduce((sum, e) => sum + e._count.participants, 0),
    };

    res.json({ success: true, data: { events, stats } });
  } catch (error) {
    next(error);
  }
});

eventRouter.post('/match-participants', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { eventId, limit: rawLimit } = req.body;
    if (!eventId) {
      return res.status(400).json({ success: false, error: 'eventId is required' });
    }

    const limit = Math.min(Math.max(parseInt(rawLimit) || 3, 1), 10);
    const results = await matchingService.matchEventParticipants(eventId, limit);

    res.json({
      success: true,
      data: {
        eventId,
        participantsMatched: results.length,
        results,
      },
    });
  } catch (error) {
    next(error);
  }
});

eventRouter.post('/follow-up', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { eventId } = req.body;
    if (!eventId) {
      return res.status(400).json({ success: false, error: 'eventId is required' });
    }

    const event = await prisma.event.findUnique({
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
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    const sent: string[] = [];
    const failed: string[] = [];

    for (const participant of event.participants) {
      const phone = participant.user.phone || (participant.user.profile as any)?.phoneNumber;
      if (!phone) {
        failed.push(participant.userId);
        continue;
      }

      const matches = await prisma.match.findMany({
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

      const matchSummaries = matches.map(m => {
        const other = m.userAId === participant.userId ? m.userB : m.userA;
        return `${other.profile?.headline || 'Professional'} at ${other.profile?.companyName || 'a company'}`;
      });

      const userName = (participant.user.profile as any)?.currentRole || participant.user.email.split('@')[0];
      const message = matchSummaries.length > 0
        ? `Hi ${userName}! Thanks for attending "${event.name}"! Here are your top matches from the event:\n\n${matchSummaries.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nOpen Cleya.ai to review and accept introductions!`
        : `Hi ${userName}! Thanks for attending "${event.name}"! We're still finding the best connections for you. Check back on Cleya.ai soon!`;

      try {
        const result = await messagingService.sendWhatsApp(participant.userId, phone, message);
        if (result.status === 'FAILED') {
          await messagingService.sendSMS(participant.userId, phone, message);
        }
        sent.push(participant.userId);
      } catch {
        failed.push(participant.userId);
      }
    }

    res.json({
      success: true,
      data: {
        eventId,
        eventName: event.name,
        totalParticipants: event.participants.length,
        messagesSent: sent.length,
        messagesFailed: failed.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

eventRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const events = await prisma.event.findMany({
      include: {
        organizer: { select: { id: true, email: true, profile: { select: { headline: true, persona: true } } } },
        _count: { select: { participants: true } },
      },
      orderBy: { date: 'asc' },
    });
    res.json({ success: true, data: events });
  } catch (error) {
    next(error);
  }
});

eventRouter.get('/:id/my-matches', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const participant = await prisma.eventParticipant.findUnique({
      where: {
        eventId_userId: {
          eventId: req.params.id,
          userId: req.user!.userId,
        },
      },
    });

    if (!participant) {
      return res.status(403).json({ success: false, error: 'You are not registered for this event' });
    }

    const limit = parseInt(req.query.limit as string) || 5;
    const matches = await matchingService.findEventMatches(req.params.id, req.user!.userId, limit);

    res.json({ success: true, data: matches });
  } catch (error) {
    next(error);
  }
});

eventRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: {
        organizer: { select: { id: true, email: true, profile: { select: { headline: true, persona: true } } } },
        participants: {
          include: {
            user: { select: { id: true, email: true, profile: { select: { headline: true, persona: true, companyName: true } } } },
          },
        },
      },
    });
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    res.json({ success: true, data: event });
  } catch (error) {
    next(error);
  }
});

eventRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { name, description, date, endDate, location, isVirtual, maxCapacity } = req.body;

    if (!name || !date) {
      return res.status(400).json({ success: false, error: 'name and date are required' });
    }

    const event = await prisma.event.create({
      data: {
        name,
        description: description || null,
        date: new Date(date),
        endDate: endDate ? new Date(endDate) : null,
        location: location || null,
        isVirtual: isVirtual || false,
        maxCapacity: maxCapacity ? parseInt(maxCapacity) : null,
        organizerId: req.user!.userId,
      },
      include: {
        organizer: { select: { id: true, email: true } },
        _count: { select: { participants: true } },
      },
    });
    res.status(201).json({ success: true, data: event });
  } catch (error) {
    next(error);
  }
});

eventRouter.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { name, description, date, endDate, location, isVirtual, maxCapacity, status } = req.body;

    const existingEvent = await prisma.event.findUnique({ where: { id: req.params.id } });

    const event = await prisma.event.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(date && { date: new Date(date) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(location !== undefined && { location }),
        ...(isVirtual !== undefined && { isVirtual }),
        ...(maxCapacity !== undefined && { maxCapacity: maxCapacity ? parseInt(maxCapacity) : null }),
        ...(status && { status }),
      },
    });

    if (status === 'COMPLETED' && existingEvent?.status !== 'COMPLETED') {
      automationService.schedulePostEventFollowUp(event.id).catch(e =>
        console.error(`[EventFlow] Failed to schedule follow-up:`, e)
      );
    }

    res.json({ success: true, data: event });
  } catch (error) {
    next(error);
  }
});

eventRouter.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    await prisma.event.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Event deleted' });
  } catch (error) {
    next(error);
  }
});

eventRouter.post('/:id/join', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { participants: true } } },
    });

    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    if (event.status === 'CANCELLED' || event.status === 'COMPLETED') {
      return res.status(400).json({ success: false, error: 'Event is no longer accepting registrations' });
    }

    const isAtCapacity = event.maxCapacity && event._count.participants >= event.maxCapacity;

    const { eventCode, eventName, pitchTopic, preferredMentors } = req.body;

    const participant = await prisma.eventParticipant.create({
      data: {
        eventId: req.params.id,
        userId: req.user!.userId,
        status: isAtCapacity ? 'WAITLISTED' : 'REGISTERED',
        ...(eventCode && { eventCode }),
        ...(eventName && { eventName }),
        ...(pitchTopic && { pitchTopic }),
        ...(preferredMentors && Array.isArray(preferredMentors) && { preferredMentors }),
        registeredAt: new Date(),
      },
    });
    res.status(201).json({ success: true, data: participant });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Already registered for this event' });
    }
    next(error);
  }
});

eventRouter.delete('/:id/leave', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.eventParticipant.delete({
      where: {
        eventId_userId: {
          eventId: req.params.id,
          userId: req.user!.userId,
        },
      },
    });
    res.json({ success: true, message: 'Left event' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Not registered for this event' });
    }
    next(error);
  }
});

eventRouter.patch('/:eventId/participants/:userId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { status, checkedIn, pitchTopic, preferredMentors, eventCode, eventName } = req.body;

    const updated = await prisma.eventParticipant.update({
      where: {
        eventId_userId: {
          eventId: req.params.eventId,
          userId: req.params.userId,
        },
      },
      data: {
        ...(status && { status }),
        ...(checkedIn !== undefined && { checkedIn }),
        ...(pitchTopic !== undefined && { pitchTopic }),
        ...(preferredMentors && Array.isArray(preferredMentors) && { preferredMentors }),
        ...(eventCode !== undefined && { eventCode }),
        ...(eventName !== undefined && { eventName }),
      },
      include: {
        user: { select: { id: true, email: true, profile: { select: { headline: true, persona: true } } } },
      },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

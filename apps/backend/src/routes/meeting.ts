import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { sendToUser } from '../websocket/server';
import { whatsappTemplates } from '../services/whatsappTemplates';

const prisma = new PrismaClient();
export const meetingRouter = Router();

meetingRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    const meetings = await prisma.meeting.findMany({
      where: {
        OR: [{ organizerId: userId }, { participantId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        organizer: { select: { id: true, name: true, email: true, profile: { select: { persona: true, headline: true, companyName: true } } } },
        participant: { select: { id: true, name: true, email: true, profile: { select: { persona: true, headline: true, companyName: true } } } },
      },
    });

    res.json({ success: true, data: meetings });
  } catch (error) {
    next(error);
  }
});

meetingRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { participantId, title, description, proposedTimes, duration, location, meetingUrl, matchId } = req.body;

    if (!participantId || !title) {
      res.status(400).json({ success: false, error: { message: 'Participant and title are required' } });
      return;
    }

    if (!proposedTimes || !Array.isArray(proposedTimes) || proposedTimes.length === 0) {
      res.status(400).json({ success: false, error: { message: 'At least one proposed time is required' } });
      return;
    }

    const hasAcceptedMatch = await prisma.match.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { userAId: userId, userBId: participantId },
          { userAId: participantId, userBId: userId },
        ],
      },
    });

    if (!hasAcceptedMatch) {
      res.status(403).json({ success: false, error: { message: 'You can only schedule meetings with accepted matches' } });
      return;
    }

    const meeting = await prisma.meeting.create({
      data: {
        organizerId: userId,
        participantId,
        matchId: matchId || hasAcceptedMatch.id,
        title,
        description,
        proposedTimes: proposedTimes.map((t: string) => new Date(t)),
        duration: duration || 30,
        location,
        meetingUrl,
      },
      include: {
        organizer: { select: { id: true, name: true, email: true } },
        participant: { select: { id: true, name: true, email: true } },
      },
    });

    sendToUser(participantId, 'meeting:proposed', {
      meeting: { id: meeting.id, title: meeting.title, organizerName: meeting.organizer.name || meeting.organizer.email },
    });

    whatsappTemplates.triggerMeetingScheduled(
      participantId,
      meeting.title,
      meeting.organizer.name || meeting.organizer.email,
      proposedTimes[0] ? new Date(proposedTimes[0]).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : undefined
    ).catch((e) => console.log('[Meeting] WhatsApp scheduled failed:', e));

    res.json({ success: true, data: meeting });
  } catch (error) {
    next(error);
  }
});

meetingRouter.put('/:meetingId/confirm', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { meetingId } = req.params;
    const { confirmedTime } = req.body;

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) {
      res.status(404).json({ success: false, error: { message: 'Meeting not found' } });
      return;
    }

    if (meeting.participantId !== userId && meeting.organizerId !== userId) {
      res.status(403).json({ success: false, error: { message: 'Not authorized' } });
      return;
    }

    if (!confirmedTime) {
      res.status(400).json({ success: false, error: { message: 'Confirmed time is required' } });
      return;
    }

    const updated = await prisma.meeting.update({
      where: { id: meetingId },
      data: { confirmedTime: new Date(confirmedTime), status: 'CONFIRMED' },
      include: {
        organizer: { select: { id: true, name: true, email: true } },
        participant: { select: { id: true, name: true, email: true } },
      },
    });

    const notifyUserId = userId === meeting.organizerId ? meeting.participantId : meeting.organizerId;
    sendToUser(notifyUserId, 'meeting:confirmed', {
      meeting: { id: updated.id, title: updated.title, confirmedTime: updated.confirmedTime },
    });

    const confirmedTimeStr = new Date(confirmedTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const otherUser = userId === meeting.organizerId ? updated.participant : updated.organizer;
    const currentUser = userId === meeting.organizerId ? updated.organizer : updated.participant;
    whatsappTemplates.triggerMeetingConfirmed(
      notifyUserId, updated.title,
      currentUser.name || currentUser.email,
      confirmedTimeStr, updated.location || undefined
    ).catch((e) => console.log('[Meeting] WhatsApp confirmed failed:', e));
    whatsappTemplates.triggerMeetingConfirmed(
      userId, updated.title,
      otherUser.name || otherUser.email,
      confirmedTimeStr, updated.location || undefined
    ).catch((e) => console.log('[Meeting] WhatsApp confirmed (self) failed:', e));

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

meetingRouter.put('/:meetingId/cancel', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { meetingId } = req.params;

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) {
      res.status(404).json({ success: false, error: { message: 'Meeting not found' } });
      return;
    }

    if (meeting.participantId !== userId && meeting.organizerId !== userId) {
      res.status(403).json({ success: false, error: { message: 'Not authorized' } });
      return;
    }

    const updated = await prisma.meeting.update({
      where: { id: meetingId },
      data: { status: 'CANCELLED' },
    });

    const notifyUserId = userId === meeting.organizerId ? meeting.participantId : meeting.organizerId;
    sendToUser(notifyUserId, 'meeting:cancelled', {
      meeting: { id: updated.id, title: updated.title },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

meetingRouter.get('/:meetingId/ics', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { meetingId } = req.params;

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        organizer: { select: { name: true, email: true } },
        participant: { select: { name: true, email: true } },
      },
    });

    if (!meeting) {
      res.status(404).json({ success: false, error: { message: 'Meeting not found' } });
      return;
    }

    if (meeting.organizerId !== userId && meeting.participantId !== userId) {
      res.status(403).json({ success: false, error: { message: 'Not authorized' } });
      return;
    }

    if (!meeting.confirmedTime) {
      res.status(400).json({ success: false, error: { message: 'Meeting not yet confirmed' } });
      return;
    }

    const start = meeting.confirmedTime;
    const end = new Date(start.getTime() + meeting.duration * 60 * 1000);
    const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Cleya.ai//Meeting//EN',
      'BEGIN:VEVENT',
      `DTSTART:${formatDate(start)}`,
      `DTEND:${formatDate(end)}`,
      `SUMMARY:${meeting.title}`,
      `DESCRIPTION:${meeting.description || 'Meeting scheduled via Cleya.ai'}`,
      `LOCATION:${meeting.location || meeting.meetingUrl || 'TBD'}`,
      `ORGANIZER;CN=${meeting.organizer.name || 'Organizer'}:mailto:${meeting.organizer.email}`,
      `ATTENDEE;CN=${meeting.participant.name || 'Participant'}:mailto:${meeting.participant.email}`,
      `UID:${meeting.id}@cleya.ai`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=meeting-${meetingId}.ics`);
    res.send(ics);
  } catch (error) {
    next(error);
  }
});

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '@boardy/db';

export const eventRouter = Router();

eventRouter.get('/admin/all', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'ADMIN') {
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
    if (req.user!.role !== 'ADMIN') {
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
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { name, description, date, endDate, location, isVirtual, maxCapacity, status } = req.body;

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
    res.json({ success: true, data: event });
  } catch (error) {
    next(error);
  }
});

eventRouter.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'ADMIN') {
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

    const participant = await prisma.eventParticipant.create({
      data: {
        eventId: req.params.id,
        userId: req.user!.userId,
        status: isAtCapacity ? 'WAITLISTED' : 'REGISTERED',
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
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { status, checkedIn } = req.body;

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

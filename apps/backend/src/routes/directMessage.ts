import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireEmailVerified } from '../middleware/auth';
import { sendToUser } from '../websocket/server';

const prisma = new PrismaClient();
export const directMessageRouter = Router();

directMessageRouter.get('/conversations', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    const profileSelect = { persona: true, headline: true, companyName: true, currentRole: true, location: true, avatarUrl: true } as const;
    const userSelect = { id: true, email: true, name: true, profile: { select: profileSelect } } as const;

    const [messages, acceptedMatches] = await Promise.all([
      prisma.directMessage.findMany({
        where: { OR: [{ senderId: userId }, { recipientId: userId }] },
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: userSelect },
          recipient: { select: userSelect },
        },
      }),
      prisma.match.findMany({
        where: {
          status: 'ACCEPTED',
          OR: [{ userAId: userId }, { userBId: userId }],
        },
        include: {
          userA: { select: userSelect },
          userB: { select: userSelect },
        },
      }),
    ]);

    const conversationMap = new Map<string, any>();
    for (const msg of messages) {
      const otherId = msg.senderId === userId ? msg.recipientId : msg.senderId;
      if (!conversationMap.has(otherId)) {
        const other = msg.senderId === userId ? msg.recipient : msg.sender;
        const unreadCount = await prisma.directMessage.count({
          where: { senderId: otherId, recipientId: userId, readAt: null },
        });
        conversationMap.set(otherId, {
          partnerId: otherId,
          partner: other,
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt,
          unreadCount,
        });
      }
    }

    for (const match of acceptedMatches) {
      const isA = match.userAId === userId;
      const partnerId = isA ? match.userBId : match.userAId;
      if (!conversationMap.has(partnerId)) {
        const partner = isA ? match.userB : match.userA;
        conversationMap.set(partnerId, {
          partnerId,
          partner,
          lastMessage: null,
          lastMessageAt: match.updatedAt,
          unreadCount: 0,
        });
      }
    }

    const conversations = Array.from(conversationMap.values()).sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );

    res.json({ success: true, data: conversations });
  } catch (error) {
    next(error);
  }
});

directMessageRouter.get('/:partnerId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { partnerId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const before = req.query.before as string | undefined;

    const hasAcceptedMatch = await prisma.match.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { userAId: userId, userBId: partnerId },
          { userAId: partnerId, userBId: userId },
        ],
      },
    });

    if (!hasAcceptedMatch) {
      res.status(403).json({ success: false, error: { message: 'You can only message accepted matches' } });
      return;
    }

    const whereClause: any = {
      OR: [
        { senderId: userId, recipientId: partnerId },
        { senderId: partnerId, recipientId: userId },
      ],
    };
    if (before) {
      whereClause.createdAt = { lt: new Date(before) };
    }

    const messages = await prisma.directMessage.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        sender: { select: { id: true, name: true, email: true } },
      },
    });

    await prisma.directMessage.updateMany({
      where: { senderId: partnerId, recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });

    res.json({ success: true, data: messages.reverse() });
  } catch (error) {
    next(error);
  }
});

directMessageRouter.post('/:partnerId', authenticate, requireEmailVerified, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { partnerId } = req.params;
    const { content } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({ success: false, error: { message: 'Message content is required' } });
      return;
    }

    if (content.length > 2000) {
      res.status(400).json({ success: false, error: { message: 'Message too long (max 2000 characters)' } });
      return;
    }

    const hasAcceptedMatch = await prisma.match.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { userAId: userId, userBId: partnerId },
          { userAId: partnerId, userBId: userId },
        ],
      },
    });

    if (!hasAcceptedMatch) {
      res.status(403).json({ success: false, error: { message: 'You can only message accepted matches' } });
      return;
    }

    const blocked = await prisma.blockedUser.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: partnerId },
          { blockerId: partnerId, blockedId: userId },
        ],
      },
      select: { blockerId: true },
    });
    if (blocked) {
      const youBlocked = blocked.blockerId === userId;
      res.status(403).json({
        success: false,
        error: { message: youBlocked ? 'You have blocked this user. Unblock them to send messages.' : 'You cannot send messages to this user.' },
      });
      return;
    }

    const message = await prisma.directMessage.create({
      data: {
        senderId: userId,
        recipientId: partnerId,
        matchId: hasAcceptedMatch.id,
        content: content.trim(),
      },
      include: {
        sender: { select: { id: true, name: true, email: true } },
      },
    });

    sendToUser(partnerId, 'dm:new', {
      message: {
        id: message.id,
        senderId: message.senderId,
        content: message.content,
        createdAt: message.createdAt,
        sender: message.sender,
      },
    });

    res.json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
});

directMessageRouter.post('/:partnerId/read', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { partnerId } = req.params;

    await prisma.directMessage.updateMany({
      where: { senderId: partnerId, recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });

    sendToUser(partnerId, 'dm:read', { readBy: userId });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { conversationService } from '../services/conversationService';

const prisma = new PrismaClient();
export const conversationRouter = Router();

conversationRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { userId: req.user!.userId },
      orderBy: { startedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    res.json({
      success: true,
      data: conversations.map((c: any) => ({
        id: c.id,
        flowId: c.flowId,
        status: c.status,
        startedAt: c.startedAt,
        completedAt: c.completedAt,
        lastMessage: c.messages[0] || null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

conversationRouter.post('/start', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { flowId } = req.body;
    const result = await conversationService.startConversation(req.user!.userId, flowId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Resume an existing conversation
conversationRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conv = await prisma.conversation.findUnique({ where: { id: req.params.id }, select: { userId: true } });
    if (!conv || conv.userId !== req.user!.userId) {
      res.status(404).json({ success: false, error: { message: 'Conversation not found' } });
      return;
    }
    const result = await conversationService.resumeConversation(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

const messageHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conv = await prisma.conversation.findUnique({ where: { id: req.params.id }, select: { userId: true } });
    if (!conv || conv.userId !== req.user!.userId) {
      res.status(404).json({ success: false, error: { message: 'Conversation not found' } });
      return;
    }
    const { choiceValue, formData, textInput } = req.body;
    const result = await conversationService.processInput(req.params.id, {
      choiceValue,
      formData,
      textInput,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

conversationRouter.post('/:id/message', authenticate, messageHandler);
conversationRouter.post('/:id/messages', authenticate, messageHandler);

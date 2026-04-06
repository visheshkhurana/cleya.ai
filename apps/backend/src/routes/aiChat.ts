import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { chatWithCleo } from '../services/ai';
import { prisma } from '@cleya/db';

export const aiChatRouter = Router();

const AI_CHAT_FLOW_ID = 'ai_chat_freeform';

async function getOrCreateAIChatConversation(userId: string) {
  let conversation = await prisma.conversation.findFirst({
    where: { userId, flowId: AI_CHAT_FLOW_ID, status: 'ACTIVE' },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        userId,
        flowId: AI_CHAT_FLOW_ID,
        status: 'ACTIVE',
        currentNode: 'ai_chat',
        context: {},
      },
    });
  }

  return conversation;
}

aiChatRouter.get('/history', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { userId: req.user!.userId, flowId: AI_CHAT_FLOW_ID, status: 'ACTIVE' },
    });

    if (!conversation) {
      res.json({ success: true, data: { messages: [] } });
      return;
    }

    const messagesDesc = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    if (messagesDesc.length === 0) {
      res.json({ success: true, data: { messages: [] } });
      return;
    }

    const messages = messagesDesc.reverse();

    res.json({
      success: true,
      data: {
        messages: messages.map((m) => ({
          sender: m.sender,
          content: m.content,
          createdAt: m.createdAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

aiChatRouter.post('/message', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ success: false, error: { message: 'Message is required' } });
      return;
    }
    if (message.length > 2000) {
      res.status(400).json({ success: false, error: { message: 'Message too long (max 2000 characters)' } });
      return;
    }

    const conversation = await getOrCreateAIChatConversation(req.user!.userId);

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        sender: 'USER',
        content: message.trim(),
      },
    });

    const dbHistoryDesc = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const validHistory = dbHistoryDesc.reverse().map((m) => ({
      role: m.sender === 'AI' ? 'assistant' as const : 'user' as const,
      content: m.content,
    }));

    const result = await chatWithCleo(req.user!.userId, message.trim(), validHistory);

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        sender: 'AI',
        content: result.content,
      },
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

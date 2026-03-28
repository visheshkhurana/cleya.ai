import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  chatWithSecretary,
  executeSecretaryAction,
  generateDailyDigest,
  getConversationHistory,
  clearConversationHistory,
} from '../services/secretaryService';
import { emailService } from '../services/email';
import { prisma } from '@cleya/db';

export const secretaryRouter = Router();

secretaryRouter.use(authenticate);

secretaryRouter.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    const result = await chatWithSecretary(req.user!.userId, message.trim());
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('Secretary chat error:', err);
    res.status(500).json({ success: false, error: 'Failed to process message' });
  }
});

secretaryRouter.post('/action', async (req, res) => {
  try {
    const { action } = req.body;
    if (!action || !action.type) {
      return res.status(400).json({ success: false, error: 'Action is required' });
    }

    const result = await executeSecretaryAction(req.user!.userId, action);
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('Secretary action error:', err);
    res.status(500).json({ success: false, error: 'Failed to execute action' });
  }
});

secretaryRouter.get('/digest', async (req, res) => {
  try {
    const digest = await generateDailyDigest(req.user!.userId);
    res.json({ success: true, data: { digest } });
  } catch (err: any) {
    console.error('Digest generation error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate digest' });
  }
});

secretaryRouter.post('/digest/send', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const digest = await generateDailyDigest(req.user!.userId);
    await emailService.sendDailyDigest(user.email, digest);
    res.json({ success: true, message: 'Daily digest sent to your email' });
  } catch (err: any) {
    console.error('Digest send error:', err);
    res.status(500).json({ success: false, error: 'Failed to send digest' });
  }
});

secretaryRouter.get('/history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const history = await getConversationHistory(req.user!.userId, limit);
    res.json({ success: true, data: history });
  } catch (err: any) {
    console.error('History fetch error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});

secretaryRouter.delete('/history', async (req, res) => {
  try {
    await clearConversationHistory(req.user!.userId);
    res.json({ success: true, message: 'Conversation history cleared' });
  } catch (err: any) {
    console.error('History clear error:', err);
    res.status(500).json({ success: false, error: 'Failed to clear history' });
  }
});

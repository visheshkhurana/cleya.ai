import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { conversationService } from '../services/conversationService';

export const conversationRouter = Router();

// Start a new conversation (or resume existing)
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
    const result = await conversationService.resumeConversation(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Send a message / advance conversation
conversationRouter.post('/:id/message', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
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
});

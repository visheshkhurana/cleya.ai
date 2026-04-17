import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { introTemplateService } from '../services/introTemplateService';

export const introTemplateRouter = Router();

introTemplateRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await introTemplateService.list(req.user!.userId);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

introTemplateRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, category, body, description } = req.body || {};
    if (!name || !category || !body) {
      return res.status(400).json({ success: false, error: { message: 'name, category, body required' } });
    }
    const t = await introTemplateService.createCustom(req.user!.userId, { name, category, body, description });
    res.json({ success: true, data: t });
  } catch (e) {
    next(e);
  }
});

introTemplateRouter.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, body, description, category } = req.body || {};
    const updated = await introTemplateService.updateCustom(req.user!.userId, req.params.id, {
      name, body, description, category,
    });
    res.json({ success: true, data: updated });
  } catch (e: any) {
    const msg = e?.message || 'Failed to update template';
    const status = msg === 'Template not found' ? 404 : 400;
    res.status(status).json({ success: false, error: { message: msg } });
  }
});

introTemplateRouter.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await introTemplateService.deleteCustom(req.user!.userId, req.params.id);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

introTemplateRouter.post('/render', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { templateId, body, matchId, overrides } = req.body || {};
    let bodyToFill = body as string | undefined;
    if (!bodyToFill && templateId) {
      const list = await introTemplateService.list(req.user!.userId);
      const t = [...list.defaults, ...list.custom].find((x) => x.id === templateId);
      if (!t) return res.status(404).json({ success: false, error: { message: 'Template not found' } });
      bodyToFill = t.body;
    }
    if (!bodyToFill) return res.status(400).json({ success: false, error: { message: 'templateId or body required' } });
    let vars: Record<string, string> = {};
    if (matchId) vars = await introTemplateService.buildVariablesForMatch(matchId, req.user!.userId);
    if (overrides && typeof overrides === 'object') vars = { ...vars, ...overrides };
    const filled = introTemplateService.fillTemplate(bodyToFill, vars);
    res.json({ success: true, data: { body: filled, variables: vars } });
  } catch (e) {
    next(e);
  }
});

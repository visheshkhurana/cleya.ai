"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.introTemplateRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const introTemplateService_1 = require("../services/introTemplateService");
exports.introTemplateRouter = (0, express_1.Router)();
exports.introTemplateRouter.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const data = await introTemplateService_1.introTemplateService.list(req.user.userId);
        res.json({ success: true, data });
    }
    catch (e) {
        next(e);
    }
});
exports.introTemplateRouter.post('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const { name, category, body, description } = req.body || {};
        if (!name || !category || !body) {
            return res.status(400).json({ success: false, error: { message: 'name, category, body required' } });
        }
        const t = await introTemplateService_1.introTemplateService.createCustom(req.user.userId, { name, category, body, description });
        res.json({ success: true, data: t });
    }
    catch (e) {
        next(e);
    }
});
exports.introTemplateRouter.patch('/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const { name, body, description, category } = req.body || {};
        const updated = await introTemplateService_1.introTemplateService.updateCustom(req.user.userId, req.params.id, {
            name, body, description, category,
        });
        res.json({ success: true, data: updated });
    }
    catch (e) {
        const msg = e?.message || 'Failed to update template';
        const status = msg === 'Template not found' ? 404 : 400;
        res.status(status).json({ success: false, error: { message: msg } });
    }
});
exports.introTemplateRouter.delete('/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        await introTemplateService_1.introTemplateService.deleteCustom(req.user.userId, req.params.id);
        res.json({ success: true });
    }
    catch (e) {
        next(e);
    }
});
exports.introTemplateRouter.post('/render', auth_1.authenticate, async (req, res, next) => {
    try {
        const { templateId, body, matchId, overrides } = req.body || {};
        let bodyToFill = body;
        if (!bodyToFill && templateId) {
            const list = await introTemplateService_1.introTemplateService.list(req.user.userId);
            const t = [...list.defaults, ...list.custom].find((x) => x.id === templateId);
            if (!t)
                return res.status(404).json({ success: false, error: { message: 'Template not found' } });
            bodyToFill = t.body;
        }
        if (!bodyToFill)
            return res.status(400).json({ success: false, error: { message: 'templateId or body required' } });
        let vars = {};
        if (matchId)
            vars = await introTemplateService_1.introTemplateService.buildVariablesForMatch(matchId, req.user.userId);
        if (overrides && typeof overrides === 'object')
            vars = { ...vars, ...overrides };
        const filled = introTemplateService_1.introTemplateService.fillTemplate(bodyToFill, vars);
        res.json({ success: true, data: { body: filled, variables: vars } });
    }
    catch (e) {
        next(e);
    }
});
//# sourceMappingURL=introTemplate.js.map
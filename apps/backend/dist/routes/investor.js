"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.investorRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const investorStatsService_1 = require("../services/investorStatsService");
exports.investorRouter = (0, express_1.Router)();
exports.investorRouter.get('/:id/stats', auth_1.authenticate, async (req, res, next) => {
    try {
        const view = await investorStatsService_1.investorStatsService.getView(req.params.id);
        if (!view)
            return res.json({ success: true, data: null });
        if (view.hidden && req.user.userId !== req.params.id) {
            return res.json({ success: true, data: { hidden: true } });
        }
        res.json({ success: true, data: view });
    }
    catch (e) {
        next(e);
    }
});
exports.investorRouter.post('/me/stats/visibility', auth_1.authenticate, async (req, res, next) => {
    try {
        const { hide } = req.body || {};
        const updated = await investorStatsService_1.investorStatsService.setHideStats(req.user.userId, !!hide);
        res.json({ success: true, data: { hideStats: updated.hideStats } });
    }
    catch (e) {
        next(e);
    }
});
//# sourceMappingURL=investor.js.map
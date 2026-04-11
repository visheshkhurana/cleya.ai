"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const callService_1 = require("../services/voice/callService");
exports.callRouter = (0, express_1.Router)();
exports.callRouter.post('/initiate', auth_1.authenticate, async (req, res, next) => {
    try {
        const { phoneNumber } = req.body;
        const result = await callService_1.callService.initiateCall(req.user.userId, phoneNumber);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
exports.callRouter.get('/history', auth_1.authenticate, async (req, res, next) => {
    try {
        const calls = await callService_1.callService.getCallHistory(req.user.userId);
        res.json({ success: true, data: calls });
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=call.js.map
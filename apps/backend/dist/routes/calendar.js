"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calendarRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const calendarService_1 = require("../services/calendarService");
const env_1 = require("../config/env");
exports.calendarRouter = (0, express_1.Router)();
exports.calendarRouter.get('/status', auth_1.authenticate, async (req, res) => {
    try {
        const configured = (0, calendarService_1.isCalendarConfigured)();
        if (!configured) {
            return res.json({ success: true, data: { configured: false, connected: false } });
        }
        const status = await (0, calendarService_1.getCalendarStatus)(req.user.userId);
        res.json({ success: true, data: { configured: true, ...status } });
    }
    catch (err) {
        console.error('Calendar status error:', err);
        res.status(500).json({ success: false, error: 'Failed to check calendar status' });
    }
});
exports.calendarRouter.get('/connect', auth_1.authenticate, async (req, res) => {
    try {
        if (!(0, calendarService_1.isCalendarConfigured)()) {
            return res.status(400).json({ success: false, error: 'Google Calendar is not configured' });
        }
        const authUrl = await (0, calendarService_1.getAuthUrl)(req.user.userId);
        res.json({ success: true, data: { authUrl } });
    }
    catch (err) {
        console.error('Calendar connect error:', err);
        res.status(500).json({ success: false, error: 'Failed to generate auth URL' });
    }
});
exports.calendarRouter.get('/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        if (!code || !state) {
            return res.redirect(`${env_1.env.FRONTEND_URL}/settings?calendar=error&reason=missing_params`);
        }
        const userId = await (0, calendarService_1.validateState)(state);
        if (!userId) {
            return res.redirect(`${env_1.env.FRONTEND_URL}/settings?calendar=error&reason=invalid_state`);
        }
        await (0, calendarService_1.handleCallback)(code, userId);
        res.redirect(`${env_1.env.FRONTEND_URL}/settings?calendar=connected`);
    }
    catch (err) {
        console.error('Calendar callback error:', err);
        res.redirect(`${env_1.env.FRONTEND_URL}/settings?calendar=error&reason=auth_failed`);
    }
});
exports.calendarRouter.get('/events', auth_1.authenticate, async (req, res) => {
    try {
        const { timeMin, timeMax } = req.query;
        const minDate = timeMin ? new Date(timeMin) : undefined;
        const maxDate = timeMax ? new Date(timeMax) : undefined;
        if ((minDate && isNaN(minDate.getTime())) || (maxDate && isNaN(maxDate.getTime()))) {
            return res.status(400).json({ success: false, error: 'Invalid date format for timeMin or timeMax' });
        }
        const events = await (0, calendarService_1.getEvents)(req.user.userId, minDate, maxDate);
        res.json({
            success: true,
            data: events.map((e) => ({
                id: e.id,
                summary: e.summary,
                description: e.description,
                start: e.start?.dateTime || e.start?.date,
                end: e.end?.dateTime || e.end?.date,
                htmlLink: e.htmlLink,
                attendees: e.attendees?.map((a) => ({ email: a.email, status: a.responseStatus })),
                status: e.status,
            })),
        });
    }
    catch (err) {
        console.error('Calendar events error:', err);
        if (err.message?.includes('not connected') || err.message?.includes('reconnect')) {
            return res.status(401).json({ success: false, error: err.message });
        }
        res.status(500).json({ success: false, error: 'Failed to fetch calendar events' });
    }
});
exports.calendarRouter.post('/events', auth_1.authenticate, async (req, res) => {
    try {
        const { summary, description, start, end, attendees } = req.body;
        if (!summary || !start || !end) {
            return res.status(400).json({ success: false, error: 'summary, start, and end are required' });
        }
        const startDate = new Date(start);
        const endDate = new Date(end);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ success: false, error: 'Invalid date format for start or end' });
        }
        if (endDate <= startDate) {
            return res.status(400).json({ success: false, error: 'end must be after start' });
        }
        if (attendees && !Array.isArray(attendees)) {
            return res.status(400).json({ success: false, error: 'attendees must be an array of email strings' });
        }
        const event = await (0, calendarService_1.createEvent)(req.user.userId, {
            summary,
            description,
            start: startDate,
            end: endDate,
            attendees,
        });
        res.json({
            success: true,
            data: {
                id: event.id,
                summary: event.summary,
                htmlLink: event.htmlLink,
                start: event.start?.dateTime,
                end: event.end?.dateTime,
            },
        });
    }
    catch (err) {
        console.error('Calendar create event error:', err);
        if (err.message?.includes('not connected') || err.message?.includes('reconnect')) {
            return res.status(401).json({ success: false, error: err.message });
        }
        res.status(500).json({ success: false, error: 'Failed to create calendar event' });
    }
});
exports.calendarRouter.get('/availability', auth_1.authenticate, async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ success: false, error: 'date query parameter is required (YYYY-MM-DD)' });
        }
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) {
            return res.status(400).json({ success: false, error: 'Invalid date format' });
        }
        const result = await (0, calendarService_1.checkAvailability)(req.user.userId, dateObj);
        res.json({ success: true, data: result });
    }
    catch (err) {
        console.error('Calendar availability error:', err);
        if (err.message?.includes('not connected') || err.message?.includes('reconnect')) {
            return res.status(401).json({ success: false, error: err.message });
        }
        res.status(500).json({ success: false, error: 'Failed to check availability' });
    }
});
exports.calendarRouter.delete('/disconnect', auth_1.authenticate, async (req, res) => {
    try {
        await (0, calendarService_1.disconnect)(req.user.userId);
        res.json({ success: true, message: 'Google Calendar disconnected' });
    }
    catch (err) {
        console.error('Calendar disconnect error:', err);
        res.status(500).json({ success: false, error: 'Failed to disconnect calendar' });
    }
});
//# sourceMappingURL=calendar.js.map
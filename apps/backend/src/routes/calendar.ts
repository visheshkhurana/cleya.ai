import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  isCalendarConfigured,
  getAuthUrl,
  handleCallback,
  validateState,
  getCalendarStatus,
  getEvents,
  createEvent,
  checkAvailability,
  disconnect,
} from '../services/calendarService';

export const calendarRouter = Router();

calendarRouter.get('/status', authenticate, async (req, res) => {
  try {
    const configured = isCalendarConfigured();
    if (!configured) {
      return res.json({ success: true, data: { configured: false, connected: false } });
    }
    const status = await getCalendarStatus(req.user!.userId);
    res.json({ success: true, data: { configured: true, ...status } });
  } catch (err: any) {
    console.error('Calendar status error:', err);
    res.status(500).json({ success: false, error: 'Failed to check calendar status' });
  }
});

calendarRouter.get('/connect', authenticate, async (req, res) => {
  try {
    if (!isCalendarConfigured()) {
      return res.status(400).json({ success: false, error: 'Google Calendar is not configured' });
    }
    const authUrl = getAuthUrl(req.user!.userId);
    res.json({ success: true, data: { authUrl } });
  } catch (err: any) {
    console.error('Calendar connect error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate auth URL' });
  }
});

calendarRouter.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.redirect(`${process.env.FRONTEND_URL || ''}/settings?calendar=error&reason=missing_params`);
    }
    const userId = validateState(state as string);
    if (!userId) {
      return res.redirect(`${process.env.FRONTEND_URL || ''}/settings?calendar=error&reason=invalid_state`);
    }
    await handleCallback(code as string, userId);
    res.redirect(`${process.env.FRONTEND_URL || ''}/settings?calendar=connected`);
  } catch (err: any) {
    console.error('Calendar callback error:', err);
    res.redirect(`${process.env.FRONTEND_URL || ''}/settings?calendar=error&reason=auth_failed`);
  }
});

calendarRouter.get('/events', authenticate, async (req, res) => {
  try {
    const { timeMin, timeMax } = req.query;
    const minDate = timeMin ? new Date(timeMin as string) : undefined;
    const maxDate = timeMax ? new Date(timeMax as string) : undefined;
    if ((minDate && isNaN(minDate.getTime())) || (maxDate && isNaN(maxDate.getTime()))) {
      return res.status(400).json({ success: false, error: 'Invalid date format for timeMin or timeMax' });
    }
    const events = await getEvents(req.user!.userId, minDate, maxDate);
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
  } catch (err: any) {
    console.error('Calendar events error:', err);
    if (err.message?.includes('not connected') || err.message?.includes('reconnect')) {
      return res.status(401).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: 'Failed to fetch calendar events' });
  }
});

calendarRouter.post('/events', authenticate, async (req, res) => {
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
    const event = await createEvent(req.user!.userId, {
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
  } catch (err: any) {
    console.error('Calendar create event error:', err);
    if (err.message?.includes('not connected') || err.message?.includes('reconnect')) {
      return res.status(401).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: 'Failed to create calendar event' });
  }
});

calendarRouter.get('/availability', authenticate, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, error: 'date query parameter is required (YYYY-MM-DD)' });
    }
    const dateObj = new Date(date as string);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid date format' });
    }
    const result = await checkAvailability(req.user!.userId, dateObj);
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('Calendar availability error:', err);
    if (err.message?.includes('not connected') || err.message?.includes('reconnect')) {
      return res.status(401).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: 'Failed to check availability' });
  }
});

calendarRouter.delete('/disconnect', authenticate, async (req, res) => {
  try {
    await disconnect(req.user!.userId);
    res.json({ success: true, message: 'Google Calendar disconnected' });
  } catch (err: any) {
    console.error('Calendar disconnect error:', err);
    res.status(500).json({ success: false, error: 'Failed to disconnect calendar' });
  }
});

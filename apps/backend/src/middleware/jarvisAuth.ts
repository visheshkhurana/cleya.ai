// JARVIS read/write integration auth.
//
// JARVIS (the operator OS at jarvis-web-pearl.vercel.app) calls this
// backend on a schedule (hourly metrics fetch) and on-demand (operator-
// approved actions). Every request must carry an HMAC-SHA256 signature
// over `${timestamp}.${method}.${path}.${rawBody}` using the shared
// secret in JARVIS_SHARED_SECRET. Replay window: 5 minutes.
//
// Reuses the project's existing HMAC primitives in webhookSecurity.ts
// to keep one canonical implementation per repo.

import { Request, Response, NextFunction } from 'express';
import { verifyWebhookTimestamp, verifyHmacSignature } from './webhookSecurity';

const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

export function jarvisAuth(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.JARVIS_SHARED_SECRET;
  if (!secret) {
    // Fail closed in prod, but keep dev tolerable.
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ ok: false, error: 'JARVIS_SHARED_SECRET not configured' });
    }
    console.warn('[jarvisAuth] JARVIS_SHARED_SECRET unset — bypassing auth (dev only)');
    return next();
  }

  const timestamp = req.header('x-jarvis-timestamp');
  const signature = req.header('x-jarvis-signature');

  if (!timestamp || !signature) {
    return res.status(401).json({ ok: false, error: 'missing x-jarvis-timestamp or x-jarvis-signature' });
  }

  if (!verifyWebhookTimestamp(timestamp, TIMESTAMP_TOLERANCE_MS)) {
    return res.status(401).json({ ok: false, error: 'timestamp outside 5-minute replay window' });
  }

  // Body is the raw JSON string. For GET requests it's empty.
  const rawBody = req.method === 'GET'
    ? ''
    : (req.body ? JSON.stringify(req.body) : '');

  const payload = `${timestamp}.${req.method}.${req.path}.${rawBody}`;

  if (!verifyHmacSignature(payload, signature, secret)) {
    return res.status(401).json({ ok: false, error: 'invalid signature' });
  }

  return next();
}

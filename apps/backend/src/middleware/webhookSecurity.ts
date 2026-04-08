import crypto from 'crypto';
import express, { Request, Response, NextFunction } from 'express';

const WEBHOOK_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

export function verifyWebhookTimestamp(
  timestampHeader: string | undefined,
  toleranceMs: number = WEBHOOK_TIMESTAMP_TOLERANCE_MS
): boolean {
  if (!timestampHeader) return false;

  const timestamp = parseInt(timestampHeader, 10);
  if (isNaN(timestamp)) return false;

  const timestampMs = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  const now = Date.now();
  const age = Math.abs(now - timestampMs);

  return age <= toleranceMs;
}

export function verifyHmacSignature(
  payload: string | Buffer,
  signature: string,
  secret: string,
  algorithm: string = 'sha256'
): boolean {
  const expected = crypto
    .createHmac(algorithm, secret)
    .update(payload)
    .digest('hex');

  const sigHex = signature.startsWith('sha256=')
    ? signature.slice(7)
    : signature.startsWith('sha1=')
      ? signature.slice(5)
      : signature;

  if (sigHex.length !== expected.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(sigHex, 'hex'),
    Buffer.from(expected, 'hex')
  );
}

export function webhookRawBodyParser(maxBytes: number = 512 * 1024) {
  return express.json({
    limit: maxBytes,
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  });
}

export function webhookPayloadSizeLimit(maxBytes: number = 1024 * 1024) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > maxBytes) {
      console.warn(`[Webhook Security] Payload too large: ${contentLength} bytes (max ${maxBytes})`);
      res.status(413).json({ error: 'Payload too large' });
      return;
    }
    next();
  };
}

export function requireWebhookTimestamp(headerName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const timestamp = req.headers[headerName.toLowerCase()] as string | undefined;
    if (!verifyWebhookTimestamp(timestamp)) {
      console.warn(`[Webhook Security] Rejected: missing or stale timestamp header '${headerName}'`);
      res.status(403).json({ error: 'Invalid or expired webhook timestamp' });
      return;
    }
    next();
  };
}

export function getRawBody(req: Request): Buffer | undefined {
  return (req as any).rawBody;
}

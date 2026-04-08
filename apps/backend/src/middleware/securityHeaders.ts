import helmet from 'helmet';
import { RequestHandler } from 'express';

export function configureSecurityHeaders(): RequestHandler[] {
  const helmetMiddleware = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "https://va.vercel-scripts.com",
          "https://us-assets.i.posthog.com",
          "https://us.i.posthog.com",
          "https://*.ingest.sentry.io",
          "https://www.googletagmanager.com",
          "https://www.google-analytics.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: [
          "'self'",
          "data:",
          "https:",
        ],
        connectSrc: [
          "'self'",
          "https://us.i.posthog.com",
          "https://us-assets.i.posthog.com",
          "https://*.ingest.sentry.io",
          "https://www.google-analytics.com",
          "wss:",
          "ws:",
        ],
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
    xContentTypeOptions: true,
    xFrameOptions: { action: 'deny' },
  });

  const permissionsPolicy: RequestHandler = (_req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=()'
    );
    next();
  };

  return [helmetMiddleware, permissionsPolicy];
}

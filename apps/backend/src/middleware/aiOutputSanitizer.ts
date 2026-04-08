const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const PHONE_PATTERN = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;

const AADHAAR_PATTERN = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;

const PAN_PATTERN = /\b[A-Z]{5}\d{4}[A-Z]\b/g;

const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;

const MAX_OUTPUT_LENGTH = 8000;

const ALLOWED_URL_DOMAINS = new Set([
  'cleya.ai',
  'www.cleya.ai',
  'linkedin.com',
  'www.linkedin.com',
  'twitter.com',
  'x.com',
  'github.com',
  'wikipedia.org',
  'en.wikipedia.org',
]);

const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi;

const DANGEROUS_HTML_PATTERNS = [
  /<script[\s\S]*?<\/script>/gi,
  /<style[\s\S]*?<\/style>/gi,
  /<iframe[\s\S]*?<\/iframe>/gi,
  /<object[\s\S]*?<\/object>/gi,
  /<embed[\s\S]*?\/?>/gi,
  /<form[\s\S]*?<\/form>/gi,
  /on\w+\s*=\s*["'][^"']*["']/gi,
  /on\w+\s*=\s*[^\s>]*/gi,
  /javascript\s*:/gi,
  /vbscript\s*:/gi,
  /data\s*:\s*text\/html/gi,
];

interface SanitizeOptions {
  maxLength?: number;
  redactPII?: boolean;
  validateURLs?: boolean;
  sanitizeHTML?: boolean;
}

interface SanitizeResult {
  content: string;
  redactions: string[];
  truncated: boolean;
  urlsRemoved: number;
}

export function sanitizeAIOutput(
  content: string,
  options: SanitizeOptions = {}
): SanitizeResult {
  const {
    maxLength = MAX_OUTPUT_LENGTH,
    redactPII = true,
    validateURLs = true,
    sanitizeHTML = true,
  } = options;

  let sanitized = content;
  const redactions: string[] = [];
  let urlsRemoved = 0;

  if (sanitizeHTML) {
    for (const pattern of DANGEROUS_HTML_PATTERNS) {
      sanitized = sanitized.replace(pattern, '');
    }
  }

  if (redactPII) {
    sanitized = sanitized.replace(EMAIL_PATTERN, (match) => {
      redactions.push(`email:${match.substring(0, 3)}***`);
      return '[EMAIL REDACTED]';
    });

    sanitized = sanitized.replace(AADHAAR_PATTERN, (match) => {
      if (/^\d{4}\s?\d{4}\s?\d{4}$/.test(match.trim())) {
        redactions.push('aadhaar:XXXX-XXXX-XXXX');
        return '[AADHAAR REDACTED]';
      }
      return match;
    });

    sanitized = sanitized.replace(PAN_PATTERN, () => {
      redactions.push('pan:XXXXX0000X');
      return '[PAN REDACTED]';
    });

    sanitized = sanitized.replace(SSN_PATTERN, () => {
      redactions.push('ssn:XXX-XX-XXXX');
      return '[SSN REDACTED]';
    });

    sanitized = sanitized.replace(PHONE_PATTERN, (match) => {
      const digits = match.replace(/\D/g, '');
      if (digits.length >= 10) {
        redactions.push(`phone:***${digits.slice(-4)}`);
        return '[PHONE REDACTED]';
      }
      return match;
    });
  }

  if (validateURLs) {
    sanitized = sanitized.replace(URL_PATTERN, (url) => {
      try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();
        if (ALLOWED_URL_DOMAINS.has(hostname) || hostname.endsWith('.cleya.ai')) {
          return url;
        }
        urlsRemoved++;
        return '[URL REMOVED]';
      } catch {
        urlsRemoved++;
        return '[URL REMOVED]';
      }
    });
  }

  let truncated = false;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '... [truncated]';
    truncated = true;
  }

  return {
    content: sanitized,
    redactions,
    truncated,
    urlsRemoved,
  };
}

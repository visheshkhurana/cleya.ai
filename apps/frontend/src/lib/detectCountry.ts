import { getCountries } from 'react-phone-number-input';
import { COUNTRY_COOKIE, FALLBACK_COUNTRY } from './countryConstants';

export { COUNTRY_COOKIE, FALLBACK_COUNTRY };

const SUPPORTED = new Set<string>(getCountries() as string[]);

export function isSupportedCountry(code: string | undefined | null): code is string {
  if (!code) return false;
  return SUPPORTED.has(code.toUpperCase());
}

export function normaliseCountry(code: string | undefined | null): string | undefined {
  if (!code) return undefined;
  const upper = code.toUpperCase();
  return SUPPORTED.has(upper) ? upper : undefined;
}

export function parseLocaleCountry(locale: string | undefined | null): string | undefined {
  if (!locale) return undefined;
  const match = /[-_]([A-Za-z]{2})\b/.exec(locale);
  return match ? normaliseCountry(match[1]) : undefined;
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp('(?:^|; )' + escaped + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function getDetectedCountryClient(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  const fromCookie = normaliseCountry(readCookie(COUNTRY_COOKIE));
  if (fromCookie) return fromCookie;

  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const candidates: (string | undefined)[] = [];
  if (nav?.languages?.length) candidates.push(...nav.languages);
  if (nav?.language) candidates.push(nav.language);

  for (const candidate of candidates) {
    const parsed = parseLocaleCountry(candidate);
    if (parsed) return parsed;
  }

  return undefined;
}

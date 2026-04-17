import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import { clerkMiddleware } from '@clerk/nextjs/server';
import { COUNTRY_COOKIE } from '@/lib/countryConstants';

const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY;

const clerkHandler = CLERK_ENABLED ? clerkMiddleware() : null;

const COUNTRY_HEADERS = [
  'cf-ipcountry',
  'x-vercel-ip-country',
  'x-country-code',
  'x-appengine-country',
];

function detectCountryFromHeaders(req: NextRequest): string | undefined {
  for (const header of COUNTRY_HEADERS) {
    const value = req.headers.get(header);
    if (value && /^[A-Za-z]{2}$/.test(value) && value.toUpperCase() !== 'XX') {
      return value.toUpperCase();
    }
  }
  return undefined;
}

function applyCountryCookie(req: NextRequest, res: Response | NextResponse): NextResponse {
  const response = res instanceof NextResponse ? res : NextResponse.next();
  const existing = req.cookies.get(COUNTRY_COOKIE)?.value;
  const detected = detectCountryFromHeaders(req);
  if (detected && existing !== detected) {
    response.cookies.set(COUNTRY_COOKIE, detected, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}

export default async function middleware(req: NextRequest, ev: NextFetchEvent) {
  if (clerkHandler) {
    const result = await clerkHandler(req, ev);
    if (result instanceof NextResponse) {
      return applyCountryCookie(req, result);
    }
    return result ?? applyCountryCookie(req, NextResponse.next());
  }
  return applyCountryCookie(req, NextResponse.next());
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};

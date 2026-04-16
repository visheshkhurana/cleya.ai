import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import { clerkMiddleware } from '@clerk/nextjs/server';

const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY;

const clerkHandler = CLERK_ENABLED ? clerkMiddleware() : null;

export default function middleware(req: NextRequest, ev: NextFetchEvent) {
  if (clerkHandler) {
    return clerkHandler(req, ev);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};

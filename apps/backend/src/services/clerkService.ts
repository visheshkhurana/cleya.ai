import { createClerkClient, verifyToken } from '@clerk/backend';
import { env } from '../config/env';
import { authService } from './authService';
import { AppError } from '../middleware/errorHandler';

let clerkClientInstance: ReturnType<typeof createClerkClient> | null = null;

function getClerkClient() {
  if (!env.CLERK_SECRET_KEY) return null;
  if (!clerkClientInstance) {
    clerkClientInstance = createClerkClient({
      secretKey: env.CLERK_SECRET_KEY,
      publishableKey: env.CLERK_PUBLISHABLE_KEY,
    });
  }
  return clerkClientInstance;
}

export interface ClerkVerifiedProfile {
  email: string;
  name?: string;
  clerkUserId: string;
}

export const clerkService = {
  isConfigured(): boolean {
    return !!env.CLERK_SECRET_KEY;
  },

  /**
   * Verify a Clerk session token and return the resolved Clerk profile.
   * Caller should pass the result to authService.findOrCreateClerkUser.
   */
  async verifySessionToken(sessionToken: string): Promise<ClerkVerifiedProfile> {
    if (!env.CLERK_SECRET_KEY) {
      throw new AppError(503, 'Clerk authentication is not configured', 'CLERK_NOT_CONFIGURED');
    }

    let clerkUserId: string | undefined;
    try {
      const payload = await verifyToken(sessionToken, {
        secretKey: env.CLERK_SECRET_KEY,
      });
      clerkUserId = payload.sub;
    } catch {
      throw new AppError(401, 'Invalid Clerk session token', 'INVALID_CLERK_TOKEN');
    }


    if (!clerkUserId) {
      throw new AppError(401, 'Clerk token missing user id', 'INVALID_CLERK_TOKEN');
    }

    const client = getClerkClient();
    if (!client) {
      throw new AppError(503, 'Clerk authentication is not configured', 'CLERK_NOT_CONFIGURED');
    }

    const user = await client.users.getUser(clerkUserId);

    const primaryEmailId = user.primaryEmailAddressId;
    const primary =
      user.emailAddresses.find((e) => e.id === primaryEmailId) || user.emailAddresses[0];
    if (!primary?.emailAddress) {
      throw new AppError(400, 'Clerk account has no email address', 'CLERK_NO_EMAIL');
    }
    if (primary.verification?.status !== 'verified') {
      throw new AppError(400, 'Clerk email is not verified', 'CLERK_EMAIL_UNVERIFIED');
    }

    const fullName =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || undefined;

    return {
      email: primary.emailAddress,
      name: fullName,
      clerkUserId,
    };
  },

  /**
   * Convenience: verify the Clerk token and provision the Cleya user via authService.
   */
  async exchangeSessionToken(sessionToken: string) {
    const profile = await this.verifySessionToken(sessionToken);
    return authService.findOrCreateClerkUser(profile);
  },
};

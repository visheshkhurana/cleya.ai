import { OPTIMIZED_AVATAR_DOMAINS } from './avatarDomains';

function isOptimizedAvatarDomain(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return OPTIMIZED_AVATAR_DOMAINS.includes(hostname) ||
      hostname.endsWith('.googleusercontent.com');
  } catch {
    return false;
  }
}

export { OPTIMIZED_AVATAR_DOMAINS, isOptimizedAvatarDomain };

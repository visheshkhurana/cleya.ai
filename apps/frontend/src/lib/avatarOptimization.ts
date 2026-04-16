const OPTIMIZED_HOSTNAMES = [
  'lh3.googleusercontent.com',
  'avatars.githubusercontent.com',
  'platform-lookaside.fbsbx.com',
  'pbs.twimg.com',
  'media.licdn.com',
  'cdn.discordapp.com',
];

export function isOptimizedAvatarDomain(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return OPTIMIZED_HOSTNAMES.some(
      (h) => hostname === h || hostname.endsWith('.googleusercontent.com'),
    );
  } catch {
    return false;
  }
}

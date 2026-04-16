type SignOutFn = () => Promise<void>;

let clerkSignOut: SignOutFn | null = null;

export function setClerkSignOut(fn: SignOutFn | null) {
  clerkSignOut = fn;
}

export async function runClerkSignOut(): Promise<void> {
  if (!clerkSignOut) return;
  try {
    await clerkSignOut();
  } catch {
    // ignore — best-effort
  }
}

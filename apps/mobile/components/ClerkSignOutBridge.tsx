import { useEffect } from 'react';
import { useClerk } from '@clerk/clerk-expo';
import { setClerkSignOut } from '@/lib/clerkBridge';

export default function ClerkSignOutBridge() {
  const { signOut } = useClerk();
  useEffect(() => {
    setClerkSignOut(() => signOut());
    return () => setClerkSignOut(null);
  }, [signOut]);
  return null;
}

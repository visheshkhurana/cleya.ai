import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function VerifyEmailTokenPage({ params }: { params: { token: string } }) {
  redirect(`/verify-email?token=${encodeURIComponent(params.token)}`);
}

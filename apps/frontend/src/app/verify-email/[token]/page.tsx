export const dynamic = 'force-dynamic';
import VerifyEmailClient from '../PageClient';

export default function VerifyEmailTokenPage({ params }: { params: { token: string } }) {
  return <VerifyEmailClient initialToken={params.token} />;
}

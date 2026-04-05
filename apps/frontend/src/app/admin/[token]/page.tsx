export const dynamic = 'force-dynamic';
import AdminDashboardWrapper from './AdminWrapper';

export default function AdminPage({ params }: { params: { token: string } }) {
  return <AdminDashboardWrapper token={params.token} />;
}

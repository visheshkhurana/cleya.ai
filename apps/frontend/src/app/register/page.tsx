import { redirect } from 'next/navigation';

export default function RegisterPage() {
  redirect('/?action=signup');
}

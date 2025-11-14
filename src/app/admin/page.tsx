import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import AdminDashboard from '@/components/admin/AdminDashboard';
import { isUserAdmin } from '@/lib/admin-auth';

export const metadata = {
  title: 'Admin Dashboard | NEETLogiq',
  description: 'Manage colleges, courses, and cutoff data',
};

export default async function AdminPage() {
  // Check authentication and admin privileges
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Redirect to login if not authenticated
  if (!session) {
    redirect('/login?returnUrl=/admin');
  }

  // Check if user has admin privileges
  const isAdmin = await isUserAdmin(session.user.id);

  if (!isAdmin) {
    // Redirect to home page with error message
    redirect('/?error=unauthorized');
  }

  return <AdminDashboard />;
}

import { redirect } from 'next/navigation';
import { ensureSeeded } from '@/lib/db/seed';
import { getCurrentUser } from '@/lib/auth';
import InvestigationDashboard from '@/components/dashboard/InvestigationDashboard';

export const dynamic = 'force-dynamic';

export default async function CaseDashboardPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  await ensureSeeded();
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }

  const { caseId } = await params;
  return <InvestigationDashboard caseId={caseId} user={user} />;
}

import { ensureSeeded } from '@/lib/db/seed';
import { getCurrentUser } from '@/lib/auth';
import CaseLibraryClient from '@/components/CaseLibraryClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await ensureSeeded();
  const user = await getCurrentUser();
  return <CaseLibraryClient initialUser={user} />;
}

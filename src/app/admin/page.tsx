import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { ensureSeeded } from '@/lib/db/seed';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import AdminCmsWorkspace from '@/components/admin/AdminCmsWorkspace';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  await ensureSeeded();
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }

  if (!isAdmin(user)) {
    return (
      <div className="min-h-screen bg-[#07080b] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-lg border border-[#9e1b24] bg-[#120e12] p-6 text-center space-y-4">
          <ShieldAlert className="w-8 h-8 text-[#dc2626] mx-auto" />
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-[#fca5a5]">
            RBAC ACCESS DENIED — ADMINISTRATOR ROLE REQUIRED
          </div>
          <p className="text-xs text-[#9aa5b8]">
            Signed in as <strong>{user.displayName}</strong> ({user.role}). Only Administrator
            accounts may open the Case Management CMS and Confidential Solution Vault.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded bg-[#9e1b24] px-4 py-2 font-mono text-xs text-white"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> RETURN TO CASE DIRECTORY
          </Link>
        </div>
      </div>
    );
  }

  return <AdminCmsWorkspace adminUser={user} />;
}

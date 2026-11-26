import { ensureSeeded } from '@/lib/db/seed';
import { getCurrentUser } from '@/lib/auth';
import { getPublishedPublicCases } from '@/lib/seo/catalog';
import { buildHomeJsonLd } from '@/lib/seo/schema';
import CaseLibraryClient from '@/components/CaseLibraryClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await ensureSeeded();
  const [user, publicCases] = await Promise.all([
    getCurrentUser(),
    getPublishedPublicCases(),
  ]);

  const jsonLd = buildHomeJsonLd(publicCases);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CaseLibraryClient initialUser={user} publicCases={publicCases} />
    </>
  );
}

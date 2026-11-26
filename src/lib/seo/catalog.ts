import { desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import type { CaseDifficulty, CaseMetadata, EvidenceSection, EvidenceViewerType } from '@/lib/types';

export interface PublicCaseShowcase {
  id: string;
  slug: string;
  caseNumber: string;
  title: string;
  subtitle: string;
  classification: string;
  difficulty: CaseDifficulty;
  priceCents: number;
  currency: string;
  summary: string;
  incidentLocation: string;
  incidentDate: string;
  victimName: string;
  defaultDurationSeconds: number;
  metadata: CaseMetadata;
  evidenceCount: number;
  suspectCount: number;
  hiddenClueCount: number;
  sections: EvidenceSection[];
  viewerTypes: EvidenceViewerType[];
  updatedAt: string;
}

/**
 * Fetches public, spoiler-free commercial case data from PostgreSQL for SSR
 * landing pages, /case-files/[slug], sitemap.xml, and JSON-LD Product schemas.
 * NEVER touches `case_solutions` or private storage URLs.
 */
export async function getPublishedPublicCases(): Promise<PublicCaseShowcase[]> {
  await ensureSeeded();
  const db = await getDb();

  const [publishedCases, allSuspects, allEvidence] = await Promise.all([
    db
      .select()
      .from(schema.cases)
      .where(eq(schema.cases.status, 'published'))
      .orderBy(desc(schema.cases.publishedAt), desc(schema.cases.createdAt)),
    db.select({ caseId: schema.suspects.caseId }).from(schema.suspects),
    db
      .select({
        caseId: schema.evidenceItems.caseId,
        section: schema.evidenceItems.section,
        viewerType: schema.evidenceItems.viewerType,
        isHiddenClue: schema.evidenceItems.isHiddenClue,
      })
      .from(schema.evidenceItems),
  ]);

  const suspectCounts = new Map<string, number>();
  for (const s of allSuspects) {
    suspectCounts.set(s.caseId, (suspectCounts.get(s.caseId) ?? 0) + 1);
  }

  return publishedCases.map((c) => {
    const evList = allEvidence.filter((e) => e.caseId === c.id);
    const sections = Array.from(new Set(evList.map((e) => e.section)));
    const viewerTypes = Array.from(new Set(evList.map((e) => e.viewerType)));
    const hiddenClueCount = evList.filter((e) => e.isHiddenClue).length;

    return {
      id: c.id,
      slug: c.slug,
      caseNumber: c.caseNumber,
      title: c.title,
      subtitle: c.subtitle,
      classification: c.classification,
      difficulty: c.difficulty,
      priceCents: c.priceCents,
      currency: c.currency,
      summary: c.summary,
      incidentLocation: c.incidentLocation,
      incidentDate: c.incidentDate,
      victimName: c.victimName,
      defaultDurationSeconds: c.defaultDurationSeconds,
      metadata: c.metadata,
      evidenceCount: evList.length,
      suspectCount: suspectCounts.get(c.id) ?? 0,
      hiddenClueCount,
      sections,
      viewerTypes,
      updatedAt: c.updatedAt.toISOString(),
    };
  });
}

export async function getPublishedPublicCaseBySlug(
  slug: string,
): Promise<PublicCaseShowcase | null> {
  const all = await getPublishedPublicCases();
  return all.find((c) => c.slug === slug) ?? null;
}

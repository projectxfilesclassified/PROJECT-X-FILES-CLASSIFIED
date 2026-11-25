import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import { extractRequestIp, getCurrentUser, isAdmin, recordAuditLog } from '@/lib/auth';
import { DEFAULT_SCORING_CONFIG } from '@/lib/types';

const createCaseSchema = z.object({
  title: z.string().min(3).max(120),
  caseNumber: z.string().min(2).max(40).optional(),
  subtitle: z.string().max(200).optional(),
  classification: z.string().max(120).optional(),
  difficulty: z.enum(['standard', 'advanced', 'expert']).optional(),
  priceCents: z.number().int().min(0).max(500000).optional(),
  summary: z.string().optional(),
  briefingMarkdown: z.string().optional(),
  incidentLocation: z.string().optional(),
  incidentDate: z.string().optional(),
  victimName: z.string().optional(),
  victimSummary: z.string().optional(),
  defaultDurationSeconds: z.number().int().min(600).max(86400).optional(),
  expiryPolicy: z.enum(['lock_and_auto_submit', 'allow_late_penalty', 'hard_lock']).optional(),
});

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) +
    '-' +
    crypto.randomBytes(2).toString('hex')
  );
}

export async function GET() {
  await ensureSeeded();
  const user = await getCurrentUser();
  if (!isAdmin(user)) {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  }

  const db = await getDb();
  const [casesList, suspectsList, evidenceList, sessionsList] = await Promise.all([
    db.select().from(schema.cases).orderBy(desc(schema.cases.updatedAt)),
    db.select({ caseId: schema.suspects.caseId }).from(schema.suspects),
    db.select({ caseId: schema.evidenceItems.caseId }).from(schema.evidenceItems),
    db.select({ caseId: schema.investigationSessions.caseId }).from(schema.investigationSessions),
  ]);

  const countBy = (rows: { caseId: string }[]) => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.caseId, (map.get(r.caseId) ?? 0) + 1);
    return map;
  };
  const sMap = countBy(suspectsList);
  const eMap = countBy(evidenceList);
  const sessMap = countBy(sessionsList);

  return NextResponse.json({
    cases: casesList.map((c) => ({
      ...c,
      suspectCount: sMap.get(c.id) ?? 0,
      evidenceCount: eMap.get(c.id) ?? 0,
      sessionCount: sessMap.get(c.id) ?? 0,
    })),
  });
}

export async function POST(request: Request) {
  await ensureSeeded();
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createCaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid case payload.' },
      { status: 400 },
    );
  }

  const db = await getDb();
  const caseId = `case-${crypto.randomUUID().slice(0, 12)}`;
  const d = parsed.data;
  const caseNumber =
    d.caseNumber?.trim() || `CF-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 899)}`;

  const inserted = await db
    .insert(schema.cases)
    .values({
      id: caseId,
      slug: slugify(d.title),
      caseNumber,
      title: d.title.trim(),
      subtitle: d.subtitle?.trim() || '',
      classification: d.classification?.trim() || 'RESTRICTED — HOMICIDE DIVISION',
      status: 'draft',
      difficulty: d.difficulty ?? 'standard',
      priceCents: d.priceCents ?? 1999,
      currency: 'USD',
      summary: d.summary?.trim() || 'Draft case summary pending configuration.',
      briefingMarkdown: d.briefingMarkdown?.trim() || `### INCIDENT BRIEFING // ${caseNumber}\n\nEnter operational briefing details here.`,
      incidentLocation: d.incidentLocation?.trim() || 'Undisclosed Location',
      incidentDate: d.incidentDate?.trim() || new Date().toISOString().slice(0, 16),
      victimName: d.victimName?.trim() || 'John Doe',
      victimSummary: d.victimSummary?.trim() || '',
      defaultDurationSeconds: d.defaultDurationSeconds ?? 14400,
      expiryPolicy: d.expiryPolicy ?? 'allow_late_penalty',
      latePenaltyPercent: 15,
      maxAccusationAttempts: 1,
      scoringConfig: DEFAULT_SCORING_CONFIG,
      metadata: {
        agencyName: 'Metropolitan Homicide Intelligence Unit',
        tags: ['Draft'],
        estimatedMinutes: 90,
      },
      createdBy: user.id,
    })
    .returning();

  await db.insert(schema.caseSolutions).values({
    id: `sol-${crypto.randomUUID().slice(0, 12)}`,
    caseId,
    killerSuspectId: null,
    accompliceSuspectIds: [],
    motiveKeywords: [],
    motiveCanonical: '',
    methodKeywords: [],
    methodCanonical: '',
    requiredEvidenceIds: [],
    bonusEvidenceIds: [],
    canonicalTimelineOrder: [],
    solutionNarrative: '',
    updatedBy: user.id,
  });

  await recordAuditLog({
    actorUserId: user.id,
    actorRole: user.role,
    action: 'CASE_CREATED',
    targetType: 'case',
    targetId: caseId,
    caseId,
    details: { title: d.title, caseNumber },
    ipAddress: extractRequestIp(request),
  });

  return NextResponse.json({ case: inserted[0] }, { status: 201 });
}

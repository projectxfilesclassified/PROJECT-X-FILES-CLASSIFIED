import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { recordAuditLog, type AuthenticatedUser } from '@/lib/auth';
import type { ExpiryPolicy, InvestigationSessionStatus } from '@/lib/types';

export interface ServerTimerSnapshot {
  sessionId: string;
  status: InvestigationSessionStatus;
  startedAt: string | null;
  deadlineAt: string | null;
  submittedAt: string | null;
  serverNow: string;
  baseDurationSeconds: number;
  totalExtensionSeconds: number;
  totalDurationSeconds: number;
  remainingSeconds: number;
  elapsedSeconds: number;
  isExpired: boolean;
  canSubmit: boolean;
  expiryPolicy: ExpiryPolicy;
  latePenaltyPercent: number;
}

export function computeTimerSnapshot(
  session: typeof schema.investigationSessions.$inferSelect,
  caseRecord: Pick<
    typeof schema.cases.$inferSelect,
    'defaultDurationSeconds' | 'expiryPolicy' | 'latePenaltyPercent'
  >,
  now: Date = new Date(),
): ServerTimerSnapshot {
  const baseDurationSeconds = session.baseDurationSeconds || caseRecord.defaultDurationSeconds || 14400;
  const totalExtensionSeconds = session.totalExtensionSeconds || 0;
  const totalDurationSeconds = baseDurationSeconds + totalExtensionSeconds;

  if (!session.startedAt || !session.deadlineAt || session.status === 'not_started') {
    return {
      sessionId: session.id,
      status: 'not_started',
      startedAt: null,
      deadlineAt: null,
      submittedAt: null,
      serverNow: now.toISOString(),
      baseDurationSeconds,
      totalExtensionSeconds,
      totalDurationSeconds,
      remainingSeconds: totalDurationSeconds,
      elapsedSeconds: 0,
      isExpired: false,
      canSubmit: false,
      expiryPolicy: caseRecord.expiryPolicy,
      latePenaltyPercent: caseRecord.latePenaltyPercent,
    };
  }

  const startedMs = session.startedAt.getTime();
  const deadlineMs = session.deadlineAt.getTime();
  const effectiveNowMs =
    session.status === 'submitted' && session.submittedAt
      ? session.submittedAt.getTime()
      : now.getTime();

  const elapsedSeconds = Math.max(0, Math.floor((effectiveNowMs - startedMs) / 1000));
  const remainingSeconds = Math.max(0, Math.floor((deadlineMs - effectiveNowMs) / 1000));
  const isExpired = session.status !== 'submitted' && effectiveNowMs >= deadlineMs;

  let derivedStatus: InvestigationSessionStatus = session.status;
  if (session.status === 'active' && isExpired) {
    derivedStatus = 'expired';
  }

  const canSubmit =
    derivedStatus === 'active' ||
    (derivedStatus === 'expired' && caseRecord.expiryPolicy === 'allow_late_penalty');

  return {
    sessionId: session.id,
    status: derivedStatus,
    startedAt: session.startedAt.toISOString(),
    deadlineAt: session.deadlineAt.toISOString(),
    submittedAt: session.submittedAt ? session.submittedAt.toISOString() : null,
    serverNow: now.toISOString(),
    baseDurationSeconds,
    totalExtensionSeconds,
    totalDurationSeconds,
    remainingSeconds,
    elapsedSeconds,
    isExpired,
    canSubmit,
    expiryPolicy: caseRecord.expiryPolicy,
    latePenaltyPercent: caseRecord.latePenaltyPercent,
  };
}

export async function getOrCreateInvestigationSession(
  userId: string,
  caseId: string,
): Promise<{
  session: typeof schema.investigationSessions.$inferSelect;
  workspace: typeof schema.workspaceStates.$inferSelect;
}> {
  const db = await getDb();

  const existing = await db
    .select()
    .from(schema.investigationSessions)
    .where(
      and(
        eq(schema.investigationSessions.userId, userId),
        eq(schema.investigationSessions.caseId, caseId),
      ),
    )
    .limit(1);

  let session = existing[0];
  if (!session) {
    const caseRows = await db
      .select({ defaultDurationSeconds: schema.cases.defaultDurationSeconds })
      .from(schema.cases)
      .where(eq(schema.cases.id, caseId))
      .limit(1);

    const baseDuration = caseRows[0]?.defaultDurationSeconds ?? 14400;
    const sessionId = crypto.randomUUID();
    const inserted = await db
      .insert(schema.investigationSessions)
      .values({
        id: sessionId,
        userId,
        caseId,
        status: 'not_started',
        baseDurationSeconds: baseDuration,
        totalExtensionSeconds: 0,
      })
      .returning();
    session = inserted[0];
  }

  // Synchronize expired state in database if server clock crossed deadline
  if (session.status === 'active' && session.deadlineAt && Date.now() >= session.deadlineAt.getTime()) {
    const updated = await db
      .update(schema.investigationSessions)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(eq(schema.investigationSessions.id, session.id))
      .returning();
    if (updated[0]) session = updated[0];
  }

  const wsRows = await db
    .select()
    .from(schema.workspaceStates)
    .where(eq(schema.workspaceStates.sessionId, session.id))
    .limit(1);

  let workspace = wsRows[0];
  if (!workspace) {
    // Seed initial timeline order from case timeline events
    const events = await db
      .select({ id: schema.caseTimelineEvents.id, sortOrder: schema.caseTimelineEvents.sortOrder })
      .from(schema.caseTimelineEvents)
      .where(eq(schema.caseTimelineEvents.caseId, caseId));

    const initialOrder = events.sort((a, b) => a.sortOrder - b.sortOrder).map((e) => e.id);

    const insertedWs = await db
      .insert(schema.workspaceStates)
      .values({
        id: crypto.randomUUID(),
        sessionId: session.id,
        boardState: { nodes: [], edges: [], zoom: 1, panX: 0, panY: 0 },
        timelineState: { orderedEventIds: initialOrder, customEvents: [], notesByEvent: {} },
        notebookEntries: [],
        suspectNotes: {},
        evidenceAnnotations: {},
        accusationDraft: {
          accusedSuspectId: '',
          motiveExplanation: '',
          methodExplanation: '',
          reconstructedTimeline: initialOrder,
          supportingEvidenceIds: [],
        },
        version: 1,
      })
      .returning();
    workspace = insertedWs[0];
  }

  return { session, workspace };
}

export async function startInvestigationSession(
  user: AuthenticatedUser,
  caseId: string,
  ipAddress?: string | null,
  now: Date = new Date(),
): Promise<ServerTimerSnapshot> {
  const db = await getDb();
  const caseRows = await db.select().from(schema.cases).where(eq(schema.cases.id, caseId)).limit(1);
  const caseRecord = caseRows[0];
  if (!caseRecord) throw new Error('Case not found');

  const { session } = await getOrCreateInvestigationSession(user.id, caseId);

  // Server-authoritative idempotency: once started, never reset startedAt or deadlineAt from client
  if (session.startedAt && session.deadlineAt && session.status !== 'not_started') {
    return computeTimerSnapshot(session, caseRecord, now);
  }

  const baseDurationSeconds = caseRecord.defaultDurationSeconds || 14400;
  const totalSeconds = baseDurationSeconds + (session.totalExtensionSeconds || 0);
  const deadlineAt = new Date(now.getTime() + totalSeconds * 1000);

  const updatedRows = await db
    .update(schema.investigationSessions)
    .set({
      status: 'active',
      startedAt: now,
      deadlineAt,
      baseDurationSeconds,
      updatedAt: now,
    })
    .where(eq(schema.investigationSessions.id, session.id))
    .returning();

  const updated = updatedRows[0] ?? session;

  await recordAuditLog({
    actorUserId: user.id,
    actorRole: user.role,
    action: 'SESSION_STARTED',
    targetType: 'investigation_session',
    targetId: updated.id,
    caseId,
    details: {
      startedAt: now.toISOString(),
      deadlineAt: deadlineAt.toISOString(),
      baseDurationSeconds,
    },
    ipAddress,
  });

  return computeTimerSnapshot(updated, caseRecord, now);
}

export async function extendInvestigationTimer(params: {
  adminUser: AuthenticatedUser;
  sessionId: string;
  extensionMinutes: number;
  reason: string;
  ipAddress?: string | null;
}): Promise<ServerTimerSnapshot> {
  if (params.adminUser.role !== 'admin') {
    throw new Error('Administrator privileges required to extend investigation timer.');
  }
  if (!Number.isFinite(params.extensionMinutes) || params.extensionMinutes <= 0 || params.extensionMinutes > 480) {
    throw new Error('Extension must be between 1 and 480 minutes.');
  }
  if (!params.reason.trim()) {
    throw new Error('An audit reason is required for administrative timer extensions.');
  }

  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.investigationSessions)
    .where(eq(schema.investigationSessions.id, params.sessionId))
    .limit(1);

  const session = rows[0];
  if (!session) throw new Error('Investigation session not found.');
  if (session.status === 'submitted') {
    throw new Error('Cannot extend timer for an already submitted investigation.');
  }

  const caseRows = await db
    .select()
    .from(schema.cases)
    .where(eq(schema.cases.id, session.caseId))
    .limit(1);
  const caseRecord = caseRows[0];
  if (!caseRecord) throw new Error('Associated case not found.');

  const addedSeconds = Math.round(params.extensionMinutes * 60);
  const now = new Date();
  const newTotalExtensions = (session.totalExtensionSeconds || 0) + addedSeconds;

  let newDeadlineAt = session.deadlineAt;
  let newStatus = session.status;

  if (session.deadlineAt) {
    // If expired, extend from max(now, previousDeadline) so the player actually gets the granted time
    const anchorMs = Math.max(session.deadlineAt.getTime(), now.getTime());
    newDeadlineAt = new Date(anchorMs + addedSeconds * 1000);
    if (session.status === 'expired') {
      newStatus = 'active';
    }
  }

  const updatedRows = await db
    .update(schema.investigationSessions)
    .set({
      totalExtensionSeconds: newTotalExtensions,
      deadlineAt: newDeadlineAt,
      status: newStatus,
      updatedAt: now,
    })
    .where(eq(schema.investigationSessions.id, session.id))
    .returning();

  const updated = updatedRows[0];

  await recordAuditLog({
    actorUserId: params.adminUser.id,
    actorRole: params.adminUser.role,
    action: 'TIMER_EXTENDED',
    targetType: 'investigation_session',
    targetId: session.id,
    caseId: session.caseId,
    details: {
      targetUserId: session.userId,
      addedMinutes: params.extensionMinutes,
      addedSeconds,
      reason: params.reason.trim(),
      previousDeadlineAt: session.deadlineAt?.toISOString() ?? null,
      newDeadlineAt: newDeadlineAt?.toISOString() ?? null,
      totalExtensionSeconds: newTotalExtensions,
    },
    ipAddress: params.ipAddress,
  });

  return computeTimerSnapshot(updated, caseRecord, now);
}

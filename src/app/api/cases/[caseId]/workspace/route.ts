import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import { checkCaseEntitlement, getCurrentUser } from '@/lib/auth';
import { getOrCreateInvestigationSession } from '@/lib/engine/timer';

const workspaceUpdateSchema = z.object({
  boardState: z.any().optional(),
  timelineState: z.any().optional(),
  notebookEntries: z.array(z.any()).optional(),
  suspectNotes: z.record(z.any()).optional(),
  evidenceAnnotations: z.record(z.any()).optional(),
  accusationDraft: z.any().optional(),
  viewedEvidenceIds: z.array(z.string()).optional(),
  bookmarkedEvidenceIds: z.array(z.string()).optional(),
});

/**
 * Automatic progress persistence endpoint.
 * Enforces strict session ownership (only modifies authenticated user's own session).
 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { caseId } = await context.params;
  const access = await checkCaseEntitlement(user, caseId);
  if (!access.allowed) {
    return NextResponse.json({ error: access.reason || 'Access denied.' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = workspaceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid workspace payload.' }, { status: 400 });
  }

  const db = await getDb();
  const { session, workspace } = await getOrCreateInvestigationSession(user.id, caseId);

  // Double-check strict ownership
  if (session.userId !== user.id) {
    return NextResponse.json({ error: 'Session ownership mismatch.' }, { status: 403 });
  }

  const now = new Date();
  const data = parsed.data;

  // Update session tracking sets (viewed/bookmarked)
  if (data.viewedEvidenceIds !== undefined || data.bookmarkedEvidenceIds !== undefined) {
    const mergedViewed = data.viewedEvidenceIds
      ? Array.from(new Set([...(session.viewedEvidenceIds ?? []), ...data.viewedEvidenceIds]))
      : session.viewedEvidenceIds;

    await db
      .update(schema.investigationSessions)
      .set({
        viewedEvidenceIds: mergedViewed,
        bookmarkedEvidenceIds:
          data.bookmarkedEvidenceIds !== undefined
            ? Array.from(new Set(data.bookmarkedEvidenceIds))
            : session.bookmarkedEvidenceIds,
        updatedAt: now,
      })
      .where(eq(schema.investigationSessions.id, session.id));
  }

  const nextVersion = (workspace.version ?? 1) + 1;

  await db
    .update(schema.workspaceStates)
    .set({
      boardState: data.boardState !== undefined ? data.boardState : workspace.boardState,
      timelineState: data.timelineState !== undefined ? data.timelineState : workspace.timelineState,
      notebookEntries:
        data.notebookEntries !== undefined ? data.notebookEntries : workspace.notebookEntries,
      suspectNotes: data.suspectNotes !== undefined ? data.suspectNotes : workspace.suspectNotes,
      evidenceAnnotations:
        data.evidenceAnnotations !== undefined
          ? data.evidenceAnnotations
          : workspace.evidenceAnnotations,
      accusationDraft:
        data.accusationDraft !== undefined ? data.accusationDraft : workspace.accusationDraft,
      version: nextVersion,
      updatedAt: now,
    })
    .where(eq(schema.workspaceStates.id, workspace.id));

  return NextResponse.json({
    ok: true,
    version: nextVersion,
    savedAt: now.toISOString(),
  });
}

import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { extractRequestIp, getCurrentUser, isAdmin, recordAuditLog } from '@/lib/auth';

export async function POST(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  }

  const { caseId } = await context.params;
  const body = await request.json();
  const db = await getDb();

  const title = (body.title || '').trim();
  if (!title) {
    return NextResponse.json({ error: 'Timeline event title is required.' }, { status: 400 });
  }

  const eventId = body.id || `tl-${crypto.randomUUID().slice(0, 10)}`;
  const record = {
    id: eventId,
    caseId,
    eventCode: (body.eventCode || `TL-${Math.floor(10 + Math.random() * 89)}`).trim().toUpperCase(),
    title,
    description: body.description || '',
    displayTime: body.displayTime || 'Unknown Time',
    occurredAtIso: body.occurredAtIso || null,
    location: body.location || '',
    involvedSuspectIds: Array.isArray(body.involvedSuspectIds) ? body.involvedSuspectIds : [],
    linkedEvidenceIds: Array.isArray(body.linkedEvidenceIds) ? body.linkedEvidenceIds : [],
    isAnchor: Boolean(body.isAnchor),
    category: body.category || 'movement',
    sortOrder: Number(body.sortOrder) || 0,
  };

  await db
    .insert(schema.caseTimelineEvents)
    .values(record)
    .onConflictDoUpdate({
      target: schema.caseTimelineEvents.id,
      set: {
        eventCode: record.eventCode,
        title: record.title,
        description: record.description,
        displayTime: record.displayTime,
        occurredAtIso: record.occurredAtIso,
        location: record.location,
        involvedSuspectIds: record.involvedSuspectIds,
        linkedEvidenceIds: record.linkedEvidenceIds,
        isAnchor: record.isAnchor,
        category: record.category,
        sortOrder: record.sortOrder,
      },
    });

  await recordAuditLog({
    actorUserId: user.id,
    actorRole: user.role,
    action: body.id ? 'TIMELINE_EVENT_UPDATED' : 'TIMELINE_EVENT_CREATED',
    targetType: 'timeline_event',
    targetId: eventId,
    caseId,
    details: { eventCode: record.eventCode, title },
    ipAddress: extractRequestIp(request),
  });

  return NextResponse.json({ ok: true, event: record });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  }

  const { caseId } = await context.params;
  const eventId = new URL(request.url).searchParams.get('eventId');
  if (!eventId) {
    return NextResponse.json({ error: 'eventId is required.' }, { status: 400 });
  }

  const db = await getDb();
  await db
    .delete(schema.caseTimelineEvents)
    .where(and(eq(schema.caseTimelineEvents.id, eventId), eq(schema.caseTimelineEvents.caseId, caseId)));

  return NextResponse.json({ ok: true });
}

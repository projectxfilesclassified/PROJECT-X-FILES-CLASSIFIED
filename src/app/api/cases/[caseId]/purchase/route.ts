import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { extractRequestIp, getCurrentUser, recordAuditLog } from '@/lib/auth';

export async function POST(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { caseId } = await context.params;
  const db = await getDb();

  const caseRows = await db
    .select()
    .from(schema.cases)
    .where(eq(schema.cases.id, caseId))
    .limit(1);
  const caseRow = caseRows[0];

  if (!caseRow || caseRow.status !== 'published') {
    return NextResponse.json({ error: 'Published case not found.' }, { status: 404 });
  }

  const existing = await db
    .select()
    .from(schema.caseEntitlements)
    .where(
      and(
        eq(schema.caseEntitlements.userId, user.id),
        eq(schema.caseEntitlements.caseId, caseId),
      ),
    )
    .limit(1);

  const purchaseRef = `ORD-CF-${Date.now().toString(36).toUpperCase()}`;

  if (existing[0]) {
    await db
      .update(schema.caseEntitlements)
      .set({ status: 'active', purchaseRef, grantedAt: new Date() })
      .where(eq(schema.caseEntitlements.id, existing[0].id));
  } else {
    await db.insert(schema.caseEntitlements).values({
      id: crypto.randomUUID(),
      userId: user.id,
      caseId,
      status: 'active',
      purchaseRef,
      grantedBy: user.id,
    });
  }

  await recordAuditLog({
    actorUserId: user.id,
    actorRole: user.role,
    action: 'ENTITLEMENT_PURCHASED',
    targetType: 'case_entitlement',
    targetId: `${user.id}:${caseId}`,
    caseId,
    details: { purchaseRef, priceCents: caseRow.priceCents, currency: caseRow.currency },
    ipAddress: extractRequestIp(request),
  });

  return NextResponse.json({
    ok: true,
    caseId,
    purchaseRef,
  });
}

import { NextResponse } from 'next/server';
import { checkCaseEntitlement, extractRequestIp, getCurrentUser } from '@/lib/auth';
import { startInvestigationSession } from '@/lib/engine/timer';

/**
 * Starts the server-authoritative 4-hour timer ONLY when the player explicitly
 * clicks "START INVESTIGATION". Ignores any client-sent timestamps.
 */
export async function POST(
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

  const timer = await startInvestigationSession(user, caseId, extractRequestIp(request));
  return NextResponse.json({ timer });
}

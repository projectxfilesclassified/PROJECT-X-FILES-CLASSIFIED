import { NextResponse } from 'next/server';
import { clearSessionCookie, extractRequestIp, getCurrentUser, recordAuditLog } from '@/lib/auth';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (user) {
    await recordAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'AUTH_LOGOUT',
      targetType: 'user',
      targetId: user.id,
      ipAddress: extractRequestIp(request),
    });
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}

import { NextResponse } from 'next/server';
import { extractRequestIp, getCurrentUser, isAdmin, recordAuditLog } from '@/lib/auth';
import { runCaseValidationSuite } from '@/lib/validation/case-validator';

export async function POST(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  }

  const { caseId } = await context.params;
  try {
    const report = await runCaseValidationSuite(caseId);
    await recordAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'CASE_VALIDATED',
      targetType: 'case',
      targetId: caseId,
      caseId,
      details: {
        validForPublish: report.validForPublish,
        passed: report.passed,
        warnings: report.warnings,
        failures: report.failures,
      },
      ipAddress: extractRequestIp(request),
    });
    return NextResponse.json({ report });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Validation failed.';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import { runCaseValidationSuite } from './case-validator';

async function main() {
  await ensureSeeded();
  const db = await getDb();
  const publishedCases = await db
    .select({ id: schema.cases.id, title: schema.cases.title, caseNumber: schema.cases.caseNumber })
    .from(schema.cases)
    .where(eq(schema.cases.status, 'published'));

  let hasFailures = false;
  for (const c of publishedCases) {
    const report = await runCaseValidationSuite(c.id);
    console.log(`\n[${c.caseNumber}] ${c.title} -> ${report.validForPublish ? 'PASS' : 'FAIL'} (${report.passed} pass, ${report.warnings} warn, ${report.failures} fail)`);
    for (const check of report.checks) {
      if (check.status !== 'pass') {
        console.log(`  [${check.status.toUpperCase()}] ${check.title}: ${check.detail}`);
      }
    }
    if (!report.validForPublish) hasFailures = true;
  }

  process.exit(hasFailures ? 1 : 0);
}

main().catch((err) => {
  console.error('Validation CLI failed:', err);
  process.exit(1);
});

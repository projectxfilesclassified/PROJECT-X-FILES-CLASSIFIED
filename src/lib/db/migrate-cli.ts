import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { ensureEnvLoaded } from '@/lib/env';

async function main() {
  ensureEnvLoaded();
  const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20261125000000_case_files_schema.sql',
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (databaseUrl && !databaseUrl.startsWith('pglite://')) {
    const isSsl =
      databaseUrl.includes('supabase.co') ||
      databaseUrl.includes('supabase.com') ||
      databaseUrl.includes('sslmode=require') ||
      process.env.DATABASE_SSL === 'true';

    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: isSsl ? { rejectUnauthorized: false } : undefined,
    });
    try {
      await pool.query(sql);
      const res = await pool.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`,
      );
      console.log(
        `Applied Supabase/PostgreSQL migration cleanly. Tables in public (${res.rows.length}):`,
        res.rows.map((r) => r.table_name).join(', '),
      );
    } finally {
      await pool.end();
    }
    return;
  }

  const dataDir = process.env.PGLITE_DATA_DIR?.trim() || path.join(process.cwd(), 'data', 'pglite');
  fs.mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  try {
    await client.exec(sql);
    const res = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`,
    );
    console.log(
      `Applied PostgreSQL migration to local PGlite cleanly. Tables in public (${res.rows.length}):`,
      res.rows.map((r) => r.table_name).join(', '),
    );
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

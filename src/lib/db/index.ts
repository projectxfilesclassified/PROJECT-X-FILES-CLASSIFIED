import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { BOOTSTRAP_SQL } from './bootstrap';
import { ensureEnvLoaded } from '@/lib/env';

export type CaseFilesDb = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

interface DbHolder {
  db: CaseFilesDb;
  driver: 'postgres' | 'pglite';
  initialized: Promise<void>;
  pgliteClient?: PGlite;
  pgPool?: Pool;
}

const globalForDb = globalThis as unknown as {
  __caseFilesDbHolder?: DbHolder;
  __caseFilesSeedPromise?: Promise<void>;
};

function createDbHolder(): DbHolder {
  ensureEnvLoaded();
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (databaseUrl && !databaseUrl.startsWith('pglite://')) {
    const isSupabaseOrRemoteSsl =
      databaseUrl.includes('supabase.co') ||
      databaseUrl.includes('supabase.com') ||
      databaseUrl.includes('sslmode=require') ||
      process.env.DATABASE_SSL === 'true';

    const pool = new Pool({
      connectionString: databaseUrl,
      max: 15,
      idleTimeoutMillis: 30000,
      ssl: isSupabaseOrRemoteSsl ? { rejectUnauthorized: false } : undefined,
    });
    const db = drizzlePg(pool, { schema });
    const initialized = pool.query(BOOTSTRAP_SQL).then(() => undefined);
    return { db, driver: 'postgres', initialized, pgPool: pool };
  }

  // Embedded PostgreSQL (PGlite) for zero-config local execution and isolated test runs
  const dataDir =
    process.env.PGLITE_DATA_DIR?.trim() ||
    (process.env.NODE_ENV === 'test' ? 'memory://' : path.join(process.cwd(), 'data', 'pglite'));

  if (dataDir !== 'memory://') {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const client = dataDir === 'memory://' ? new PGlite() : new PGlite(dataDir);
  const db = drizzlePglite(client, { schema });
  const initialized = client.exec(BOOTSTRAP_SQL).then(() => undefined);
  return { db, driver: 'pglite', initialized, pgliteClient: client };
}

function getHolder(): DbHolder {
  if (!globalForDb.__caseFilesDbHolder) {
    globalForDb.__caseFilesDbHolder = createDbHolder();
  }
  return globalForDb.__caseFilesDbHolder;
}

export async function getDb(): Promise<CaseFilesDb> {
  const holder = getHolder();
  await holder.initialized;
  return holder.db;
}

export function getDbDriver(): 'postgres' | 'pglite' {
  return getHolder().driver;
}

export async function resetTestDatabase(): Promise<void> {
  const holder = globalForDb.__caseFilesDbHolder;
  if (holder?.pgliteClient) {
    await holder.pgliteClient.close();
  }
  if (holder?.pgPool) {
    await holder.pgPool.end();
  }
  globalForDb.__caseFilesDbHolder = undefined;
  globalForDb.__caseFilesSeedPromise = undefined;
}

export { schema };

import fs from 'node:fs';
import path from 'node:path';

let envLoaded = false;

/**
 * Loads `.env` and `.env.local` into process.env for CLI scripts (`db:seed`, `validate:cases`)
 * when executed outside Next.js's built-in env loader. Existing env vars take precedence.
 */
export function ensureEnvLoaded(): void {
  if (envLoaded || process.env.NODE_ENV === 'test') return;
  envLoaded = true;

  for (const filename of ['.env', '.env.local']) {
    const fullPath = path.join(process.cwd(), filename);
    if (!fs.existsSync(fullPath)) continue;
    const raw = fs.readFileSync(fullPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  }
}

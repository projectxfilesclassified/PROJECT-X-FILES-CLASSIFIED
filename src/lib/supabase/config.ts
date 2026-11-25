import { ensureEnvLoaded } from '@/lib/env';

export interface SupabaseProjectConfig {
  url: string;
  projectRef: string;
  publishableKey: string;
  secretKey: string;
  storageBucket: string;
  configured: boolean;
}

export function getSupabaseProjectConfig(): SupabaseProjectConfig {
  ensureEnvLoaded();
  const url = (
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    ''
  ).replace(/\/+$/, '');
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || '';
  const secretKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    '';
  const projectRef =
    process.env.SUPABASE_PROJECT_REF?.trim() ||
    url.match(/^https:\/\/([^.]+)\.supabase\.co/i)?.[1] ||
    '';
  const storageBucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'casefiles-private';

  return {
    url,
    projectRef,
    publishableKey,
    secretKey,
    storageBucket,
    configured: Boolean(url && (publishableKey || secretKey)),
  };
}

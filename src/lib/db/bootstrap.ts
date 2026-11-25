export const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'investigator',
  badge_number TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS auth_sessions_token_hash_idx ON auth_sessions (token_hash);
CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions (user_id);

CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  case_number TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  classification TEXT NOT NULL DEFAULT 'RESTRICTED — HOMICIDE DIVISION',
  status TEXT NOT NULL DEFAULT 'draft',
  difficulty TEXT NOT NULL DEFAULT 'standard',
  price_cents INTEGER NOT NULL DEFAULT 1999,
  currency TEXT NOT NULL DEFAULT 'USD',
  summary TEXT NOT NULL DEFAULT '',
  briefing_markdown TEXT NOT NULL DEFAULT '',
  incident_location TEXT NOT NULL DEFAULT '',
  incident_date TEXT NOT NULL DEFAULT '',
  victim_name TEXT NOT NULL DEFAULT '',
  victim_summary TEXT NOT NULL DEFAULT '',
  victim_photo_asset_id TEXT,
  default_duration_seconds INTEGER NOT NULL DEFAULT 14400,
  expiry_policy TEXT NOT NULL DEFAULT 'allow_late_penalty',
  late_penalty_percent INTEGER NOT NULL DEFAULT 15,
  max_accusation_attempts INTEGER NOT NULL DEFAULT 1,
  scoring_config JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS cases_slug_idx ON cases (slug);
CREATE INDEX IF NOT EXISTS cases_status_idx ON cases (status);

CREATE TABLE IF NOT EXISTS case_entitlements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  purchase_ref TEXT NOT NULL,
  granted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS case_entitlements_user_case_idx ON case_entitlements (user_id, case_id);
CREATE INDEX IF NOT EXISTS case_entitlements_case_idx ON case_entitlements (case_id);

CREATE TABLE IF NOT EXISTS suspects (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  suspect_code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  role_type TEXT NOT NULL DEFAULT 'suspect',
  age INTEGER,
  date_of_birth TEXT NOT NULL DEFAULT '',
  occupation TEXT NOT NULL DEFAULT '',
  residence TEXT NOT NULL DEFAULT '',
  relationship_to_victim TEXT NOT NULL DEFAULT '',
  photo_asset_id TEXT,
  status_tag TEXT NOT NULL DEFAULT 'person_of_interest',
  threat_level TEXT NOT NULL DEFAULT 'moderate',
  bio_summary TEXT NOT NULL DEFAULT '',
  motive_summary TEXT NOT NULL DEFAULT '',
  alibi_summary TEXT NOT NULL DEFAULT '',
  alibi_time_window TEXT NOT NULL DEFAULT '',
  alibi_verified BOOLEAN NOT NULL DEFAULT FALSE,
  interview_records JSONB NOT NULL DEFAULT '[]'::jsonb,
  contradictions JSONB NOT NULL DEFAULT '[]'::jsonb,
  personal_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS suspects_case_code_idx ON suspects (case_id, suspect_code);
CREATE INDEX IF NOT EXISTS suspects_case_idx ON suspects (case_id);

CREATE TABLE IF NOT EXISTS suspect_relationships (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  source_suspect_id TEXT NOT NULL REFERENCES suspects(id) ON DELETE CASCADE,
  target_suspect_id TEXT NOT NULL REFERENCES suspects(id) ON DELETE CASCADE,
  relationship_label TEXT NOT NULL,
  relationship_type TEXT NOT NULL DEFAULT 'professional',
  strength INTEGER NOT NULL DEFAULT 3,
  notes TEXT NOT NULL DEFAULT '',
  linked_evidence_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS suspect_relationships_case_idx ON suspect_relationships (case_id);

CREATE TABLE IF NOT EXISTS evidence_items (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  evidence_code TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  section TEXT NOT NULL,
  viewer_type TEXT NOT NULL,
  classification TEXT NOT NULL DEFAULT 'CONFIDENTIAL',
  source_origin TEXT NOT NULL DEFAULT '',
  collected_at TEXT NOT NULL DEFAULT '',
  collected_by TEXT NOT NULL DEFAULT '',
  location_found TEXT NOT NULL DEFAULT '',
  chain_of_custody JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  structured_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  access_rules JSONB NOT NULL DEFAULT '{"locked":false}'::jsonb,
  is_hidden_clue BOOLEAN NOT NULL DEFAULT FALSE,
  hidden_clue_hint TEXT NOT NULL DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  related_suspect_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS evidence_items_case_code_idx ON evidence_items (case_id, evidence_code);
CREATE INDEX IF NOT EXISTS evidence_items_case_section_idx ON evidence_items (case_id, section);

CREATE TABLE IF NOT EXISTS evidence_assets (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  evidence_item_id TEXT REFERENCES evidence_items(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS evidence_assets_case_idx ON evidence_assets (case_id);
CREATE INDEX IF NOT EXISTS evidence_assets_item_idx ON evidence_assets (evidence_item_id);

CREATE TABLE IF NOT EXISTS evidence_relations (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  source_evidence_id TEXT NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
  target_evidence_id TEXT NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL DEFAULT 'links_to',
  label TEXT NOT NULL DEFAULT '',
  is_canonical BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS evidence_relations_case_idx ON evidence_relations (case_id);

CREATE TABLE IF NOT EXISTS case_timeline_events (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  event_code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  display_time TEXT NOT NULL,
  occurred_at_iso TEXT,
  location TEXT NOT NULL DEFAULT '',
  involved_suspect_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_anchor BOOLEAN NOT NULL DEFAULT FALSE,
  category TEXT NOT NULL DEFAULT 'movement',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS case_timeline_events_case_idx ON case_timeline_events (case_id);

CREATE TABLE IF NOT EXISTS case_solutions (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  killer_suspect_id TEXT REFERENCES suspects(id) ON DELETE SET NULL,
  accomplice_suspect_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  motive_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  motive_canonical TEXT NOT NULL DEFAULT '',
  method_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  method_canonical TEXT NOT NULL DEFAULT '',
  required_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  bonus_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  canonical_timeline_order JSONB NOT NULL DEFAULT '[]'::jsonb,
  solution_narrative TEXT NOT NULL DEFAULT '',
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS case_solutions_case_idx ON case_solutions (case_id);

CREATE TABLE IF NOT EXISTS investigation_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started',
  started_at TIMESTAMPTZ,
  deadline_at TIMESTAMPTZ,
  base_duration_seconds INTEGER NOT NULL DEFAULT 14400,
  total_extension_seconds INTEGER NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ,
  unlocked_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  viewed_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  bookmarked_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS investigation_sessions_user_case_idx ON investigation_sessions (user_id, case_id);
CREATE INDEX IF NOT EXISTS investigation_sessions_case_idx ON investigation_sessions (case_id);

CREATE TABLE IF NOT EXISTS workspace_states (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES investigation_sessions(id) ON DELETE CASCADE,
  board_state JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[],"zoom":1,"panX":0,"panY":0}'::jsonb,
  timeline_state JSONB NOT NULL DEFAULT '{"orderedEventIds":[],"customEvents":[],"notesByEvent":{}}'::jsonb,
  notebook_entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  suspect_notes JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_annotations JSONB NOT NULL DEFAULT '{}'::jsonb,
  accusation_draft JSONB NOT NULL DEFAULT '{"accusedSuspectId":"","motiveExplanation":"","methodExplanation":"","reconstructedTimeline":[],"supportingEvidenceIds":[]}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS workspace_states_session_idx ON workspace_states (session_id);

CREATE TABLE IF NOT EXISTS accusation_submissions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES investigation_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  accused_suspect_id TEXT NOT NULL,
  motive_explanation TEXT NOT NULL,
  method_explanation TEXT NOT NULL,
  reconstructed_timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  supporting_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_late BOOLEAN NOT NULL DEFAULT FALSE,
  elapsed_seconds INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL,
  rank TEXT NOT NULL,
  score_breakdown JSONB NOT NULL,
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS accusation_submissions_session_idx ON accusation_submissions (session_id);
CREATE INDEX IF NOT EXISTS accusation_submissions_case_idx ON accusation_submissions (case_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL DEFAULT 'system',
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  case_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_logs_case_idx ON audit_logs (case_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs (action);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs (created_at);

-- Lock down direct PostgREST/anon access on Supabase by enabling Row-Level Security
-- without public policies; server-side Drizzle (postgres role) retains authoritative access.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE suspects ENABLE ROW LEVEL SECURITY;
ALTER TABLE suspect_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_solutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE investigation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE accusation_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
`;

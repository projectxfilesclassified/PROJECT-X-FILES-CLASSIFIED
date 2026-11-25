import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import type {
  AccusationDraft,
  AccusationScoreBreakdown,
  BoardState,
  CanonicalTimelineSlot,
  CaseDifficulty,
  CaseMetadata,
  CaseStatus,
  ChainOfCustodyEntry,
  EvidenceAccessRules,
  EvidenceAnnotation,
  EvidenceClassification,
  EvidenceRelationType,
  EvidenceSection,
  EvidenceViewerType,
  ExpiryPolicy,
  InvestigationSessionStatus,
  NotebookEntry,
  RelationshipType,
  ScoringConfig,
  StructuredEvidenceContent,
  SuspectContradiction,
  SuspectInterviewRecord,
  SuspectPlayerNote,
  SuspectRoleType,
  SuspectStatusTag,
  TimelineState,
  UserRole,
} from '@/lib/types';

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull(),
    role: text('role').$type<UserRole>().notNull().default('investigator'),
    badgeNumber: text('badge_number').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('users_email_idx').on(table.email)],
);

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('auth_sessions_token_hash_idx').on(table.tokenHash),
    index('auth_sessions_user_id_idx').on(table.userId),
  ],
);

export const cases = pgTable(
  'cases',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    caseNumber: text('case_number').notNull(),
    title: text('title').notNull(),
    subtitle: text('subtitle').notNull().default(''),
    classification: text('classification').notNull().default('RESTRICTED — HOMICIDE DIVISION'),
    status: text('status').$type<CaseStatus>().notNull().default('draft'),
    difficulty: text('difficulty').$type<CaseDifficulty>().notNull().default('standard'),
    priceCents: integer('price_cents').notNull().default(1999),
    currency: text('currency').notNull().default('USD'),
    summary: text('summary').notNull().default(''),
    briefingMarkdown: text('briefing_markdown').notNull().default(''),
    incidentLocation: text('incident_location').notNull().default(''),
    incidentDate: text('incident_date').notNull().default(''),
    victimName: text('victim_name').notNull().default(''),
    victimSummary: text('victim_summary').notNull().default(''),
    victimPhotoAssetId: text('victim_photo_asset_id'),
    defaultDurationSeconds: integer('default_duration_seconds').notNull().default(14400),
    expiryPolicy: text('expiry_policy').$type<ExpiryPolicy>().notNull().default('allow_late_penalty'),
    latePenaltyPercent: integer('late_penalty_percent').notNull().default(15),
    maxAccusationAttempts: integer('max_accusation_attempts').notNull().default(1),
    scoringConfig: jsonb('scoring_config').$type<ScoringConfig>().notNull(),
    metadata: jsonb('metadata').$type<CaseMetadata>().notNull().default({}),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('cases_slug_idx').on(table.slug),
    index('cases_status_idx').on(table.status),
  ],
);

export const caseEntitlements = pgTable(
  'case_entitlements',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    caseId: text('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    status: text('status').$type<'active' | 'revoked' | 'refunded'>().notNull().default('active'),
    purchaseRef: text('purchase_ref').notNull(),
    grantedBy: text('granted_by').references(() => users.id, { onDelete: 'set null' }),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('case_entitlements_user_case_idx').on(table.userId, table.caseId),
    index('case_entitlements_case_idx').on(table.caseId),
  ],
);

export const suspects = pgTable(
  'suspects',
  {
    id: text('id').primaryKey(),
    caseId: text('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    suspectCode: text('suspect_code').notNull(),
    fullName: text('full_name').notNull(),
    aliases: jsonb('aliases').$type<string[]>().notNull().default([]),
    roleType: text('role_type').$type<SuspectRoleType>().notNull().default('suspect'),
    age: integer('age'),
    dateOfBirth: text('date_of_birth').notNull().default(''),
    occupation: text('occupation').notNull().default(''),
    residence: text('residence').notNull().default(''),
    relationshipToVictim: text('relationship_to_victim').notNull().default(''),
    photoAssetId: text('photo_asset_id'),
    statusTag: text('status_tag').$type<SuspectStatusTag>().notNull().default('person_of_interest'),
    threatLevel: text('threat_level').$type<'low' | 'moderate' | 'high'>().notNull().default('moderate'),
    bioSummary: text('bio_summary').notNull().default(''),
    motiveSummary: text('motive_summary').notNull().default(''),
    alibiSummary: text('alibi_summary').notNull().default(''),
    alibiTimeWindow: text('alibi_time_window').notNull().default(''),
    alibiVerified: boolean('alibi_verified').notNull().default(false),
    interviewRecords: jsonb('interview_records').$type<SuspectInterviewRecord[]>().notNull().default([]),
    contradictions: jsonb('contradictions').$type<SuspectContradiction[]>().notNull().default([]),
    personalDetails: jsonb('personal_details').$type<Record<string, string>>().notNull().default({}),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('suspects_case_code_idx').on(table.caseId, table.suspectCode),
    index('suspects_case_idx').on(table.caseId),
  ],
);

export const suspectRelationships = pgTable(
  'suspect_relationships',
  {
    id: text('id').primaryKey(),
    caseId: text('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    sourceSuspectId: text('source_suspect_id')
      .notNull()
      .references(() => suspects.id, { onDelete: 'cascade' }),
    targetSuspectId: text('target_suspect_id')
      .notNull()
      .references(() => suspects.id, { onDelete: 'cascade' }),
    relationshipLabel: text('relationship_label').notNull(),
    relationshipType: text('relationship_type').$type<RelationshipType>().notNull().default('professional'),
    strength: integer('strength').notNull().default(3),
    notes: text('notes').notNull().default(''),
    linkedEvidenceId: text('linked_evidence_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('suspect_relationships_case_idx').on(table.caseId)],
);

export const evidenceItems = pgTable(
  'evidence_items',
  {
    id: text('id').primaryKey(),
    caseId: text('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    evidenceCode: text('evidence_code').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull().default(''),
    description: text('description').notNull().default(''),
    section: text('section').$type<EvidenceSection>().notNull(),
    viewerType: text('viewer_type').$type<EvidenceViewerType>().notNull(),
    classification: text('classification').$type<EvidenceClassification>().notNull().default('CONFIDENTIAL'),
    sourceOrigin: text('source_origin').notNull().default(''),
    collectedAt: text('collected_at').notNull().default(''),
    collectedBy: text('collected_by').notNull().default(''),
    locationFound: text('location_found').notNull().default(''),
    chainOfCustody: jsonb('chain_of_custody').$type<ChainOfCustodyEntry[]>().notNull().default([]),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    structuredContent: jsonb('structured_content').$type<StructuredEvidenceContent>().notNull().default({}),
    accessRules: jsonb('access_rules').$type<EvidenceAccessRules>().notNull().default({ locked: false }),
    isHiddenClue: boolean('is_hidden_clue').notNull().default(false),
    hiddenClueHint: text('hidden_clue_hint').notNull().default(''),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    relatedSuspectIds: jsonb('related_suspect_ids').$type<string[]>().notNull().default([]),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('evidence_items_case_code_idx').on(table.caseId, table.evidenceCode),
    index('evidence_items_case_section_idx').on(table.caseId, table.section),
  ],
);

export const evidenceAssets = pgTable(
  'evidence_assets',
  {
    id: text('id').primaryKey(),
    caseId: text('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    evidenceItemId: text('evidence_item_id').references(() => evidenceItems.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull(),
    originalFilename: text('original_filename').notNull(),
    mimeType: text('mime_type').notNull(),
    byteSize: integer('byte_size').notNull().default(0),
    sha256: text('sha256').notNull(),
    caption: text('caption').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('evidence_assets_case_idx').on(table.caseId),
    index('evidence_assets_item_idx').on(table.evidenceItemId),
  ],
);

export const evidenceRelations = pgTable(
  'evidence_relations',
  {
    id: text('id').primaryKey(),
    caseId: text('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    sourceEvidenceId: text('source_evidence_id')
      .notNull()
      .references(() => evidenceItems.id, { onDelete: 'cascade' }),
    targetEvidenceId: text('target_evidence_id')
      .notNull()
      .references(() => evidenceItems.id, { onDelete: 'cascade' }),
    relationType: text('relation_type').$type<EvidenceRelationType>().notNull().default('links_to'),
    label: text('label').notNull().default(''),
    isCanonical: boolean('is_canonical').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('evidence_relations_case_idx').on(table.caseId)],
);

export const caseTimelineEvents = pgTable(
  'case_timeline_events',
  {
    id: text('id').primaryKey(),
    caseId: text('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    eventCode: text('event_code').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    displayTime: text('display_time').notNull(),
    occurredAtIso: text('occurred_at_iso'),
    location: text('location').notNull().default(''),
    involvedSuspectIds: jsonb('involved_suspect_ids').$type<string[]>().notNull().default([]),
    linkedEvidenceIds: jsonb('linked_evidence_ids').$type<string[]>().notNull().default([]),
    isAnchor: boolean('is_anchor').notNull().default(false),
    category: text('category')
      .$type<'incident' | 'movement' | 'communication' | 'forensic' | 'alibi'>()
      .notNull()
      .default('movement'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('case_timeline_events_case_idx').on(table.caseId)],
);

/**
 * STRICTLY CONFIDENTIAL TABLE.
 * Never join or expose in player-facing API payloads.
 * Accessible only inside Admin CMS endpoints and server-side scoring engine.
 */
export const caseSolutions = pgTable(
  'case_solutions',
  {
    id: text('id').primaryKey(),
    caseId: text('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    killerSuspectId: text('killer_suspect_id').references(() => suspects.id, { onDelete: 'set null' }),
    accompliceSuspectIds: jsonb('accomplice_suspect_ids').$type<string[]>().notNull().default([]),
    motiveKeywords: jsonb('motive_keywords').$type<string[]>().notNull().default([]),
    motiveCanonical: text('motive_canonical').notNull().default(''),
    methodKeywords: jsonb('method_keywords').$type<string[]>().notNull().default([]),
    methodCanonical: text('method_canonical').notNull().default(''),
    requiredEvidenceIds: jsonb('required_evidence_ids').$type<string[]>().notNull().default([]),
    bonusEvidenceIds: jsonb('bonus_evidence_ids').$type<string[]>().notNull().default([]),
    canonicalTimelineOrder: jsonb('canonical_timeline_order').$type<CanonicalTimelineSlot[]>().notNull().default([]),
    solutionNarrative: text('solution_narrative').notNull().default(''),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('case_solutions_case_idx').on(table.caseId)],
);

export const investigationSessions = pgTable(
  'investigation_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    caseId: text('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    status: text('status').$type<InvestigationSessionStatus>().notNull().default('not_started'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    deadlineAt: timestamp('deadline_at', { withTimezone: true }),
    baseDurationSeconds: integer('base_duration_seconds').notNull().default(14400),
    totalExtensionSeconds: integer('total_extension_seconds').notNull().default(0),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    unlockedEvidenceIds: jsonb('unlocked_evidence_ids').$type<string[]>().notNull().default([]),
    viewedEvidenceIds: jsonb('viewed_evidence_ids').$type<string[]>().notNull().default([]),
    bookmarkedEvidenceIds: jsonb('bookmarked_evidence_ids').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('investigation_sessions_user_case_idx').on(table.userId, table.caseId),
    index('investigation_sessions_case_idx').on(table.caseId),
  ],
);

export const workspaceStates = pgTable(
  'workspace_states',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => investigationSessions.id, { onDelete: 'cascade' }),
    boardState: jsonb('board_state')
      .$type<BoardState>()
      .notNull()
      .default({ nodes: [], edges: [], zoom: 1, panX: 0, panY: 0 }),
    timelineState: jsonb('timeline_state')
      .$type<TimelineState>()
      .notNull()
      .default({ orderedEventIds: [], customEvents: [], notesByEvent: {} }),
    notebookEntries: jsonb('notebook_entries').$type<NotebookEntry[]>().notNull().default([]),
    suspectNotes: jsonb('suspect_notes').$type<Record<string, SuspectPlayerNote>>().notNull().default({}),
    evidenceAnnotations: jsonb('evidence_annotations')
      .$type<Record<string, EvidenceAnnotation>>()
      .notNull()
      .default({}),
    accusationDraft: jsonb('accusation_draft')
      .$type<AccusationDraft>()
      .notNull()
      .default({
        accusedSuspectId: '',
        motiveExplanation: '',
        methodExplanation: '',
        reconstructedTimeline: [],
        supportingEvidenceIds: [],
      }),
    version: integer('version').notNull().default(1),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('workspace_states_session_idx').on(table.sessionId)],
);

export const accusationSubmissions = pgTable(
  'accusation_submissions',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => investigationSessions.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    caseId: text('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    accusedSuspectId: text('accused_suspect_id').notNull(),
    motiveExplanation: text('motive_explanation').notNull(),
    methodExplanation: text('method_explanation').notNull(),
    reconstructedTimeline: jsonb('reconstructed_timeline').$type<string[]>().notNull().default([]),
    supportingEvidenceIds: jsonb('supporting_evidence_ids').$type<string[]>().notNull().default([]),
    isLate: boolean('is_late').notNull().default(false),
    elapsedSeconds: integer('elapsed_seconds').notNull().default(0),
    totalScore: integer('total_score').notNull(),
    rank: text('rank').notNull(),
    scoreBreakdown: jsonb('score_breakdown').$type<AccusationScoreBreakdown>().notNull(),
    passed: boolean('passed').notNull().default(false),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('accusation_submissions_session_idx').on(table.sessionId),
    index('accusation_submissions_case_idx').on(table.caseId),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    actorRole: text('actor_role').notNull().default('system'),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    caseId: text('case_id'),
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_logs_case_idx').on(table.caseId),
    index('audit_logs_action_idx').on(table.action),
    index('audit_logs_created_idx').on(table.createdAt),
  ],
);

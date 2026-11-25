export type UserRole = 'investigator' | 'admin' | 'reviewer';

export type CaseStatus = 'draft' | 'published' | 'archived';

export type CaseDifficulty = 'standard' | 'advanced' | 'expert';

export type ExpiryPolicy = 'lock_and_auto_submit' | 'allow_late_penalty' | 'hard_lock';

export type NavSectionId =
  | 'case_overview'
  | 'original_case_files'
  | 'crime_scene'
  | 'suspect_database'
  | 'witness_statements'
  | 'interrogation_records'
  | 'documents'
  | 'cctv_archive'
  | 'audio_archive'
  | 'physical_evidence'
  | 'forensic_reports'
  | 'digital_forensics'
  | 'detective_board'
  | 'timeline_reconstruction'
  | 'investigator_notebook'
  | 'final_accusation';

export type EvidenceSection =
  | 'original_case_files'
  | 'crime_scene'
  | 'witness_statements'
  | 'interrogation_records'
  | 'documents'
  | 'cctv_archive'
  | 'audio_archive'
  | 'physical_evidence'
  | 'forensic_reports'
  | 'digital_forensics';

export type EvidenceViewerType =
  | 'pdf'
  | 'image'
  | 'audio'
  | 'video'
  | 'transcript'
  | 'spreadsheet'
  | 'digital_comm'
  | 'metadata';

export type EvidenceClassification =
  | 'PUBLIC_RECORD'
  | 'CONFIDENTIAL'
  | 'RESTRICTED'
  | 'CHAIN_OF_CUSTODY'
  | 'FORENSIC_SEALED';

export type SuspectRoleType = 'suspect' | 'witness' | 'victim_associate';

export type SuspectStatusTag =
  | 'person_of_interest'
  | 'cleared'
  | 'unverified_alibi'
  | 'key_witness'
  | 'detained';

export type RelationshipType =
  | 'family'
  | 'financial'
  | 'romantic'
  | 'professional'
  | 'conflict'
  | 'secret';

export type EvidenceRelationType =
  | 'corroborates'
  | 'contradicts'
  | 'links_to'
  | 'derived_from'
  | 'timeline_adjacent';

export type InvestigationSessionStatus =
  | 'not_started'
  | 'active'
  | 'expired'
  | 'submitted';

export interface ScoringConfig {
  weights: {
    killer: number;
    motive: number;
    method: number;
    timeline: number;
    evidence: number;
  };
  passThreshold: number;
  rankThresholds: {
    masterDetective: number;
    seniorInvestigator: number;
    fieldDetective: number;
  };
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  weights: {
    killer: 35,
    motive: 20,
    method: 15,
    timeline: 15,
    evidence: 15,
  },
  passThreshold: 65,
  rankThresholds: {
    masterDetective: 90,
    seniorInvestigator: 75,
    fieldDetective: 60,
  },
};

export interface CaseMetadata {
  agencyName?: string;
  jurisdiction?: string;
  leadInvestigatorTitle?: string;
  tags?: string[];
  estimatedMinutes?: number;
  accentLabel?: string;
}

export interface ChainOfCustodyEntry {
  timestamp: string;
  handler: string;
  action: string;
  location: string;
  sealId?: string;
}

export interface EvidenceAccessRules {
  locked: boolean;
  unlockType?: 'none' | 'passcode' | 'viewed_evidence' | 'time_elapsed';
  passcode?: string;
  requiredEvidenceCodes?: string[];
  minElapsedSeconds?: number;
  hint?: string;
  lockReason?: string;
}

export interface TranscriptLine {
  id: string;
  timestamp: string;
  seconds?: number;
  speaker: string;
  role?: string;
  text: string;
  redacted?: boolean;
  highlight?: boolean;
}

export interface SpreadsheetData {
  sheetName: string;
  columns: { key: string; label: string; type?: 'text' | 'number' | 'currency' | 'date' | 'flag' }[];
  rows: Record<string, string | number | boolean | null>[];
  summaryNote?: string;
}

export interface DigitalCommMessage {
  id: string;
  timestamp: string;
  sender: string;
  senderHandle?: string;
  recipient?: string;
  channel: 'sms' | 'email' | 'encrypted_chat' | 'call_log' | 'voicemail_log';
  subject?: string;
  body: string;
  deletedRecovered?: boolean;
  attachmentLabel?: string;
  direction?: 'incoming' | 'outgoing' | 'internal';
}

export interface ImageHotspot {
  id: string;
  xPercent: number;
  yPercent: number;
  label: string;
  detail: string;
  linkedEvidenceCode?: string;
}

export interface CctvReelEvent {
  second: number;
  label: string;
  severity?: 'normal' | 'alert' | 'critical';
  description: string;
}

export interface StructuredEvidenceContent {
  // Transcript / Audio / Video synchronized transcript
  transcriptLines?: TranscriptLine[];
  // Spreadsheet data
  spreadsheet?: SpreadsheetData;
  // Digital Communications
  commChannel?: 'sms' | 'email' | 'encrypted_chat' | 'call_log';
  commHeader?: {
    deviceOwner?: string;
    account?: string;
    extractionTool?: string;
    dateRange?: string;
  };
  messages?: DigitalCommMessage[];
  // Document / PDF fallback pages for accessible search & comparison
  documentPages?: { pageNumber: number; heading?: string; body: string }[];
  // Image / Crime Scene interactive hotspots
  hotspots?: ImageHotspot[];
  // Metadata records structured sections
  metadataSections?: {
    section: string;
    entries: { key: string; value: string; anomaly?: boolean; note?: string }[];
  }[];
  // CCTV / Audio event markers
  mediaMarkers?: CctvReelEvent[];
  mediaDurationSeconds?: number;
}

export interface SuspectInterviewRecord {
  id: string;
  title: string;
  recordedAt: string;
  interviewer: string;
  location: string;
  excerpt: string;
  linkedEvidenceCode?: string;
}

export interface SuspectContradiction {
  id: string;
  statement: string;
  conflictingDetail: string;
  linkedEvidenceCodes: string[];
  severity: 'minor' | 'major' | 'critical';
}

export interface CanonicalTimelineSlot {
  eventId: string;
  expectedOrder: number;
  weight: number;
}

// Workspace persistent structures (saved automatically to PostgreSQL)
export interface BoardNode {
  id: string;
  type: 'evidence' | 'suspect' | 'note' | 'hypothesis';
  refId?: string; // evidenceId or suspectId
  code?: string;
  title: string;
  subtitle?: string;
  content?: string;
  x: number;
  y: number;
  color: 'red' | 'amber' | 'slate' | 'cyan' | 'emerald';
}

export interface BoardEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label: string;
  color: 'red' | 'amber' | 'cyan' | 'slate';
  style?: 'solid' | 'dashed';
}

export interface BoardState {
  nodes: BoardNode[];
  edges: BoardEdge[];
  zoom: number;
  panX: number;
  panY: number;
}

export interface CustomTimelineEvent {
  id: string;
  title: string;
  displayTime: string;
  description: string;
  linkedEvidenceIds: string[];
  suspectId?: string;
}

export interface TimelineState {
  orderedEventIds: string[];
  customEvents: CustomTimelineEvent[];
  notesByEvent: Record<string, string>;
}

export interface NotebookEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
  linkedEvidenceCodes: string[];
  linkedSuspectCodes: string[];
  pinned: boolean;
  updatedAt: string;
}

export interface SuspectPlayerNote {
  notes: string;
  suspicionLevel: number; // 0 to 100
  customContradictions: string[];
  updatedAt: string;
}

export interface EvidenceAnnotation {
  note: string;
  flag: 'none' | 'key' | 'contradiction' | 'verify';
  updatedAt: string;
}

export interface AccusationDraft {
  accusedSuspectId: string;
  motiveExplanation: string;
  methodExplanation: string;
  reconstructedTimeline: string[];
  supportingEvidenceIds: string[];
}

export interface WorkspacePayload {
  boardState: BoardState;
  timelineState: TimelineState;
  notebookEntries: NotebookEntry[];
  suspectNotes: Record<string, SuspectPlayerNote>;
  evidenceAnnotations: Record<string, EvidenceAnnotation>;
  accusationDraft: AccusationDraft;
}

export interface ScoreBreakdownItem {
  category: 'killer' | 'motive' | 'method' | 'timeline' | 'evidence';
  label: string;
  score: number;
  maxScore: number;
  matchedDetails: string[];
  feedback: string;
}

export interface AccusationScoreBreakdown {
  items: ScoreBreakdownItem[];
  rawTotal: number;
  latePenaltyApplied: number;
  finalScore: number;
  solutionNarrative: string;
  canonicalKillerName: string;
  canonicalMotive: string;
  canonicalMethod: string;
}

export interface ValidationCheckResult {
  id: string;
  category: 'structure' | 'security' | 'assets' | 'gameplay' | 'scoring';
  status: 'pass' | 'warn' | 'fail';
  title: string;
  detail: string;
}

export interface CaseValidationReport {
  caseId: string;
  caseTitle: string;
  validForPublish: boolean;
  passed: number;
  warnings: number;
  failures: number;
  checkedAt: string;
  checks: ValidationCheckResult[];
}

export const NAV_SECTIONS: {
  id: NavSectionId;
  label: string;
  shortLabel: string;
  group: 'BRIEFING' | 'CASE ARCHIVE' | 'FORENSICS & MEDIA' | 'INTELLIGENCE' | 'INVESTIGATION TOOLS' | 'RESOLUTION';
  evidenceSection?: EvidenceSection;
}[] = [
  { id: 'case_overview', label: 'Case Overview', shortLabel: 'Overview', group: 'BRIEFING' },
  { id: 'original_case_files', label: 'Original Case Files', shortLabel: 'Case Files', group: 'CASE ARCHIVE', evidenceSection: 'original_case_files' },
  { id: 'crime_scene', label: 'Crime Scene', shortLabel: 'Crime Scene', group: 'CASE ARCHIVE', evidenceSection: 'crime_scene' },
  { id: 'documents', label: 'Documents', shortLabel: 'Documents', group: 'CASE ARCHIVE', evidenceSection: 'documents' },
  { id: 'physical_evidence', label: 'Physical Evidence', shortLabel: 'Physical', group: 'FORENSICS & MEDIA', evidenceSection: 'physical_evidence' },
  { id: 'forensic_reports', label: 'Forensic Reports', shortLabel: 'Forensics', group: 'FORENSICS & MEDIA', evidenceSection: 'forensic_reports' },
  { id: 'cctv_archive', label: 'CCTV Archive', shortLabel: 'CCTV', group: 'FORENSICS & MEDIA', evidenceSection: 'cctv_archive' },
  { id: 'audio_archive', label: 'Audio Archive', shortLabel: 'Audio', group: 'FORENSICS & MEDIA', evidenceSection: 'audio_archive' },
  { id: 'digital_forensics', label: 'Digital Forensics', shortLabel: 'Digital', group: 'FORENSICS & MEDIA', evidenceSection: 'digital_forensics' },
  { id: 'suspect_database', label: 'Suspect Database', shortLabel: 'Suspects', group: 'INTELLIGENCE' },
  { id: 'witness_statements', label: 'Witness Statements', shortLabel: 'Witnesses', group: 'INTELLIGENCE', evidenceSection: 'witness_statements' },
  { id: 'interrogation_records', label: 'Interrogation Records', shortLabel: 'Interrogations', group: 'INTELLIGENCE', evidenceSection: 'interrogation_records' },
  { id: 'detective_board', label: 'Detective Board', shortLabel: 'Board', group: 'INVESTIGATION TOOLS' },
  { id: 'timeline_reconstruction', label: 'Timeline Reconstruction', shortLabel: 'Timeline', group: 'INVESTIGATION TOOLS' },
  { id: 'investigator_notebook', label: 'Investigator Notebook', shortLabel: 'Notebook', group: 'INVESTIGATION TOOLS' },
  { id: 'final_accusation', label: 'Final Accusation', shortLabel: 'Accusation', group: 'RESOLUTION' },
];

export const EVIDENCE_SECTIONS: { value: EvidenceSection; label: string }[] = [
  { value: 'original_case_files', label: 'Original Case Files' },
  { value: 'crime_scene', label: 'Crime Scene' },
  { value: 'witness_statements', label: 'Witness Statements' },
  { value: 'interrogation_records', label: 'Interrogation Records' },
  { value: 'documents', label: 'Documents' },
  { value: 'cctv_archive', label: 'CCTV Archive' },
  { value: 'audio_archive', label: 'Audio Archive' },
  { value: 'physical_evidence', label: 'Physical Evidence' },
  { value: 'forensic_reports', label: 'Forensic Reports' },
  { value: 'digital_forensics', label: 'Digital Forensics' },
];

export const VIEWER_TYPES: { value: EvidenceViewerType; label: string }[] = [
  { value: 'pdf', label: 'PDF Document' },
  { value: 'image', label: 'Forensic Image' },
  { value: 'audio', label: 'Audio Recording' },
  { value: 'video', label: 'Video / CCTV' },
  { value: 'transcript', label: 'Transcript' },
  { value: 'spreadsheet', label: 'Spreadsheet' },
  { value: 'digital_comm', label: 'Digital Communications' },
  { value: 'metadata', label: 'Metadata Record' },
];

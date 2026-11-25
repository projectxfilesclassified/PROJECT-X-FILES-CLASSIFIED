import type {
  AccusationDraft,
  AccusationScoreBreakdown,
  BoardState,
  CaseDifficulty,
  CaseMetadata,
  CaseStatus,
  ChainOfCustodyEntry,
  EvidenceAnnotation,
  EvidenceClassification,
  EvidenceRelationType,
  EvidenceSection,
  EvidenceViewerType,
  ExpiryPolicy,
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
import type { ServerTimerSnapshot } from '@/lib/engine/timer';

export interface ClientUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  badgeNumber: string;
}

export interface ClientAsset {
  id: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  caption: string;
  url: string;
  expiresAt: string;
}

export interface ClientEvidence {
  id: string;
  evidenceCode: string;
  title: string;
  summary: string;
  description: string;
  section: EvidenceSection;
  viewerType: EvidenceViewerType;
  classification: EvidenceClassification;
  sourceOrigin: string;
  collectedAt: string;
  collectedBy: string;
  locationFound: string;
  chainOfCustody: ChainOfCustodyEntry[];
  metadata: Record<string, string>;
  structuredContent: StructuredEvidenceContent;
  accessRules: {
    locked: boolean;
    unlockType?: 'none' | 'passcode' | 'viewed_evidence' | 'time_elapsed';
    requiredEvidenceCodes?: string[];
    minElapsedSeconds?: number;
    hint?: string;
    lockReason?: string;
  };
  isHiddenClue: boolean;
  tags: string[];
  relatedSuspectIds: string[];
  assets: ClientAsset[];
  sortOrder: number;
}

export interface ClientSuspect {
  id: string;
  suspectCode: string;
  fullName: string;
  aliases: string[];
  roleType: SuspectRoleType;
  age: number | null;
  dateOfBirth: string;
  occupation: string;
  residence: string;
  relationshipToVictim: string;
  photoUrl: string | null;
  statusTag: SuspectStatusTag;
  threatLevel: 'low' | 'moderate' | 'high';
  bioSummary: string;
  motiveSummary: string;
  alibiSummary: string;
  alibiTimeWindow: string;
  alibiVerified: boolean;
  interviewRecords: SuspectInterviewRecord[];
  contradictions: SuspectContradiction[];
  personalDetails: Record<string, string>;
  sortOrder: number;
}

export interface ClientSuspectRelationship {
  id: string;
  caseId: string;
  sourceSuspectId: string;
  targetSuspectId: string;
  relationshipLabel: string;
  relationshipType: RelationshipType;
  strength: number;
  notes: string;
  linkedEvidenceId: string | null;
}

export interface ClientEvidenceRelation {
  id: string;
  caseId: string;
  sourceEvidenceId: string;
  targetEvidenceId: string;
  relationType: EvidenceRelationType;
  label: string;
  isCanonical: boolean;
}

export interface ClientTimelineEvent {
  id: string;
  caseId: string;
  eventCode: string;
  title: string;
  description: string;
  displayTime: string;
  occurredAtIso: string | null;
  location: string;
  involvedSuspectIds: string[];
  linkedEvidenceIds: string[];
  isAnchor: boolean;
  category: 'incident' | 'movement' | 'communication' | 'forensic' | 'alibi';
  sortOrder: number;
}

export interface ClientSubmission {
  id: string;
  accusedSuspectId: string;
  motiveExplanation: string;
  methodExplanation: string;
  reconstructedTimeline: string[];
  supportingEvidenceIds: string[];
  isLate: boolean;
  elapsedSeconds: number;
  totalScore: number;
  rank: string;
  passed: boolean;
  scoreBreakdown: AccusationScoreBreakdown;
  submittedAt: string;
}

export interface DashboardPayload {
  isPreview: boolean;
  case: {
    id: string;
    slug: string;
    caseNumber: string;
    title: string;
    subtitle: string;
    classification: string;
    status: CaseStatus;
    difficulty: CaseDifficulty;
    summary: string;
    briefingMarkdown: string;
    incidentLocation: string;
    incidentDate: string;
    victimName: string;
    victimSummary: string;
    victimPhotoUrl: string | null;
    defaultDurationSeconds: number;
    expiryPolicy: ExpiryPolicy;
    latePenaltyPercent: number;
    maxAccusationAttempts: number;
    scoringWeights: ScoringConfig['weights'];
    metadata: CaseMetadata;
  };
  timer: ServerTimerSnapshot;
  session: {
    id: string;
    unlockedEvidenceIds: string[];
    viewedEvidenceIds: string[];
    bookmarkedEvidenceIds: string[];
  };
  workspace: {
    boardState: BoardState;
    timelineState: TimelineState;
    notebookEntries: NotebookEntry[];
    suspectNotes: Record<string, SuspectPlayerNote>;
    evidenceAnnotations: Record<string, EvidenceAnnotation>;
    accusationDraft: AccusationDraft;
    version: number;
    updatedAt: string;
  };
  suspects: ClientSuspect[];
  suspectRelationships: ClientSuspectRelationship[];
  evidence: ClientEvidence[];
  evidenceRelations: ClientEvidenceRelation[];
  timelineEvents: ClientTimelineEvent[];
  submissions: ClientSubmission[];
}

export function formatDurationHms(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

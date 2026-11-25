import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { putPrivateObject } from '@/lib/storage';
import {
  generateCctvReelBuffer,
  generateCrimeSceneBlueprintSvg,
  generateForensicAudioWav,
  generateForensicPdf,
  generatePhysicalEvidenceSvg,
  generateSuspectPortraitSvg,
} from '@/lib/db/asset-generators';
import {
  DEFAULT_SCORING_CONFIG,
  type EvidenceAccessRules,
  type StructuredEvidenceContent,
} from '@/lib/types';

export const SEED_USERS = {
  admin: {
    id: 'usr-admin-001',
    email: 'admin@casefiles.local',
    password: 'AdminPassword123!',
    displayName: 'Director Claire Mercer',
    role: 'admin' as const,
    badgeNumber: 'ADM-0001',
  },
  investigator: {
    id: 'usr-inv-001',
    email: 'detective@casefiles.local',
    password: 'DetectivePassword123!',
    displayName: 'Det. Alex Morgan',
    role: 'investigator' as const,
    badgeNumber: 'INV-4409',
  },
};

export const SEED_CASE_IDS = {
  ashford: 'case-ashford-041',
  meridian: 'case-meridian-088',
};

const globalForSeed = globalThis as unknown as {
  __caseFilesSeedPromise?: Promise<void>;
};

async function saveAsset(params: {
  id: string;
  caseId: string;
  evidenceItemId?: string | null;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  caption: string;
  buffer: Buffer;
}) {
  const db = await getDb();
  const stored = await putPrivateObject(params.storageKey, params.buffer, params.mimeType);
  await db
    .insert(schema.evidenceAssets)
    .values({
      id: params.id,
      caseId: params.caseId,
      evidenceItemId: params.evidenceItemId ?? null,
      storageKey: stored.storageKey,
      originalFilename: params.originalFilename,
      mimeType: stored.mimeType,
      byteSize: stored.byteSize,
      sha256: stored.sha256,
      caption: params.caption,
      sortOrder: 0,
    })
    .onConflictDoNothing();
}

export async function seedDatabase(options?: { force?: boolean }): Promise<void> {
  const db = await getDb();

  if (!options?.force) {
    const existingUsers = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
    const existingCases = await db.select({ id: schema.cases.id }).from(schema.cases).limit(1);
    if (existingUsers.length > 0 && existingCases.length > 0) {
      return;
    }
  }

  // 1. Seed Users (Admin + Demo Investigator)
  for (const u of [SEED_USERS.admin, SEED_USERS.investigator]) {
    await db
      .insert(schema.users)
      .values({
        id: u.id,
        email: u.email,
        passwordHash: hashPassword(u.password),
        displayName: u.displayName,
        role: u.role,
        badgeNumber: u.badgeNumber,
      })
      .onConflictDoNothing();
  }

  // =========================================================================
  // CASE 1: THE ASHFORD ESTATE HOMICIDE (Published, Full Flagship Case)
  // =========================================================================
  const case1Id = SEED_CASE_IDS.ashford;
  const existingCase1 = await db
    .select({ id: schema.cases.id })
    .from(schema.cases)
    .where(eq(schema.cases.id, case1Id))
    .limit(1);

  if (existingCase1.length === 0) {
    const victimPhotoId = 'ast-ashford-victim';

    await db.insert(schema.cases).values({
      id: case1Id,
      slug: 'ashford-estate-homicide',
      caseNumber: 'CF-2026-041',
      title: 'The Ashford Estate Homicide',
      subtitle: 'Locked-Room Poisoning Inside the Ashford Hall Conservatory',
      classification: 'RESTRICTED — MAJOR CRIMES HOMICIDE',
      status: 'published',
      difficulty: 'advanced',
      priceCents: 2499,
      currency: 'USD',
      summary:
        'Biotech patriarch Julian Ashford was discovered dead inside the bolted glass Conservatory of Ashford Hall at 23:18. Initial responders suspected acute cardiac arrest, but sealed toxicology and estate security logs point to a calculated poisoning executed during a 25-minute blackout window.',
      briefingMarkdown: `### INCIDENT BRIEFING // CF-2026-041

On **November 14, 2026 at 23:19**, emergency services received a distress call from Ashford Hall reporting that **Julian Ashford (58)**, Chairman of Ashford BioLabs, had collapsed inside the estate Conservatory.

The main double doors were bolted from the interior. However, forensic technicians identified a secondary **RFID maintenance entrance** connecting the Conservatory to the West Service Corridor, along with a shattered crystal Bordeaux decanter and disturbed greenhouse drainage grate outside.

### INVESTIGATIVE MANDATE
1. Establish the exact **time and mechanism of death** using the Autopsy, Physical Evidence, and CCTV Archives.
2. Audit every suspect's alibi against **electronic access logs, CCTV timestamps, and recovered digital communications**.
3. Decrypt any restricted laboratory or security logs discovered during your analysis.
4. Submit a formal **Final Accusation** identifying the perpetrator, motive, method, chronological timeline, and decisive exhibits before your 4-hour operational window expires.`,
      incidentLocation: 'Ashford Hall Conservatory, Blackwood Ridge',
      incidentDate: '2026-11-14 22:20 UTC',
      victimName: 'Julian Ashford',
      victimSummary:
        'Age 58. Chairman of Ashford BioLabs and rare antiquities collector. Had scheduled an emergency 09:00 regulatory disclosure call for the following morning.',
      victimPhotoAssetId: victimPhotoId,
      defaultDurationSeconds: 14400, // 4 hours
      expiryPolicy: 'allow_late_penalty',
      latePenaltyPercent: 15,
      maxAccusationAttempts: 1,
      scoringConfig: DEFAULT_SCORING_CONFIG,
      metadata: {
        agencyName: 'Metropolitan Homicide Intelligence Unit',
        jurisdiction: 'Blackwood County — District 4',
        leadInvestigatorTitle: 'Special Investigator',
        tags: ['Locked Room', 'Toxicology', 'Corporate Fraud', 'CCTV Analysis', 'Digital Forensics'],
        estimatedMinutes: 90,
        accentLabel: 'CLASS-A HOMICIDE',
      },
      createdBy: SEED_USERS.admin.id,
      publishedAt: new Date('2026-11-16T10:00:00Z'),
    });

    // Grant entitlement to Demo Investigator and Admin for Case 1
    await db
      .insert(schema.caseEntitlements)
      .values([
        {
          id: 'ent-inv-ashford',
          userId: SEED_USERS.investigator.id,
          caseId: case1Id,
          status: 'active',
          purchaseRef: 'ORD-CF-2026-8812',
          grantedBy: SEED_USERS.admin.id,
        },
        {
          id: 'ent-adm-ashford',
          userId: SEED_USERS.admin.id,
          caseId: case1Id,
          status: 'active',
          purchaseRef: 'ADM-INTERNAL-001',
          grantedBy: SEED_USERS.admin.id,
        },
      ])
      .onConflictDoNothing();

    await saveAsset({
      id: victimPhotoId,
      caseId: case1Id,
      storageKey: `${case1Id}/portraits/victim-julian-ashford.svg`,
      originalFilename: 'victim-julian-ashford.svg',
      mimeType: 'image/svg+xml',
      caption: 'Victim File Photograph — Julian Ashford (58)',
      buffer: generateSuspectPortraitSvg({
        code: 'VIC-00',
        name: 'JULIAN ASHFORD',
        subtitle: 'DECEASED // CHAIRMAN, ASHFORD BIOLABS',
        accentHex: '#9e1b24',
        heightCm: 181,
        silhouetteVariant: 3,
      }),
    });

    // Suspects & Witnesses (Strictly NO spoilers revealing killer!)
    const suspectDefs = [
      {
        id: 'sus-ash-01',
        suspectCode: 'SUS-01',
        fullName: 'Eleanor Ashford',
        aliases: ['Eleanor Voss-Ashford'],
        roleType: 'suspect' as const,
        age: 51,
        dateOfBirth: '1975-03-19',
        occupation: 'Art Historian & Estate Foundation Director',
        residence: 'Ashford Hall — East Wing Suite',
        relationshipToVictim: 'Estranged Wife (19 years)',
        photoAssetId: 'ast-ash-sus-01',
        statusTag: 'unverified_alibi' as const,
        threatLevel: 'moderate' as const,
        bioSummary:
          'Found Julian unresponsive at 23:18 and placed the 911 call. Had been in acrimonious divorce negotiations over control of the Ashford Antiquities Trust.',
        motiveSummary:
          'A newly drafted estate codicil threatened to freeze her foundation endowment and reduce her settlement by $14 million upon finalization.',
        alibiSummary:
          'Claims she remained in the East Wing Study on a video conference with Geneva auctioneers from 21:45 to 23:05 before walking down to check on Julian.',
        alibiTimeWindow: '21:45 — 23:05',
        alibiVerified: false,
        interviewRecords: [
          {
            id: 'int-el-1',
            title: 'Initial On-Scene Statement',
            recordedAt: '2026-11-15 00:40',
            interviewer: 'Sgt. R. Cole',
            location: 'Ashford Hall Drawing Room',
            excerpt:
              'I knocked on the Conservatory doors around 23:15 because his reading lamp was still blazing. When I saw him slumped beside the overturned wine glass, I forced the latch with the brass fire poker.',
            linkedEvidenceCode: 'EV-008',
          },
        ],
        contradictions: [
          {
            id: 'con-el-1',
            statement: 'Stated she stayed continuously connected to the East Wing Study video call until 23:05.',
            conflictingDetail: 'Router diagnostic shows her laptop dropped off the East Wing access point between 22:08 and 22:25.',
            linkedEvidenceCodes: ['EV-002', 'EV-014'],
            severity: 'major' as const,
          },
        ],
        personalDetails: {
          Phone: '+1 (555) 014-8821',
          Vehicle: 'Silver Jaguar XJ (Parked in North Garage)',
          'Access Credentials': 'Master Keycard RFID-01A (Logged inactive after 21:30)',
          'Prior Record': 'None',
        },
        sortOrder: 1,
        heightCm: 169,
        variant: 2,
        accent: '#c88a2e',
      },
      {
        id: 'sus-ash-02',
        suspectCode: 'SUS-02',
        fullName: 'Dr. Marcus Vance',
        aliases: ['M. Vance, MD PhD'],
        roleType: 'suspect' as const,
        age: 46,
        dateOfBirth: '1980-08-04',
        occupation: 'Chief Clinical Officer, Ashford BioLabs & Personal Physician',
        residence: '412 Cedar Crest Terrace, Blackwood',
        relationshipToVictim: 'Personal Physician & Senior Executive (12 years)',
        photoAssetId: 'ast-ash-sus-02',
        statusTag: 'unverified_alibi' as const,
        threatLevel: 'high' as const,
        bioSummary:
          'Oversaw Julian Ashford’s cardiac medication regimen and directed Ashford BioLabs’ flagship Phase-III neurology trial. Holds unrestricted access to clinical alkaloid compounds.',
        motiveSummary:
          'Internal compliance audit uncovered fabricated Phase-III toxicology datasets signed by Vance. Julian threatened to notify federal regulators and the Medical Licensing Board at 09:00.',
        alibiSummary:
          'Maintains he finished examining Julian’s blood pressure chart at 21:35, left the estate through the South Gate at 22:10, and drove straight home.',
        alibiTimeWindow: '22:10 — 23:30',
        alibiVerified: false,
        interviewRecords: [
          {
            id: 'int-mv-1',
            title: 'Formal Precinct Interrogation — Session 1',
            recordedAt: '2026-11-15 11:15',
            interviewer: 'Det. C. Mercer',
            location: 'Metro Precinct — Room B',
            excerpt:
              'I departed Ashford Hall through the South Gate at 22:10 sharp. Ask the gate camera. I never went near the West Service Corridor and I certainly never touched his wine.',
            linkedEvidenceCode: 'EV-011',
          },
        ],
        contradictions: [
          {
            id: 'con-mv-1',
            statement: 'Claimed he drove directly away from the South Estate Gate at 22:10.',
            conflictingDetail: 'South Gate LPR camera recorded his dark sedan pulling past the barrier at 22:09, extinguishing headlights, and idling just outside the perimeter until 22:34.',
            linkedEvidenceCodes: ['EV-007', 'EV-011'],
            severity: 'critical' as const,
          },
          {
            id: 'con-mv-2',
            statement: 'Denied entering the West Service Corridor or possessing a maintenance RFID credential.',
            conflictingDetail: 'CAM-04 captured an adult male of matching stature carrying a dark leather satchel entering the service corridor at 22:18, seconds before cloned badge RFID-09B unlocked the Conservatory side door.',
            linkedEvidenceCodes: ['EV-006', 'EV-013'],
            severity: 'critical' as const,
          },
        ],
        personalDetails: {
          Phone: '+1 (555) 019-3304',
          Vehicle: 'Midnight Blue Audi A6 (Plate: BWR-774)',
          'Access Credentials': 'Executive Card RFID-03C + Clinical Dispensary Vault',
          'Prior Record': '2021 Sealed Civil Malpractice Settlement',
        },
        sortOrder: 2,
        heightCm: 183,
        variant: 1,
        accent: '#9e1b24',
      },
      {
        id: 'sus-ash-03',
        suspectCode: 'SUS-03',
        fullName: 'Victor Thorne',
        aliases: ['V. Thorne Esq.'],
        roleType: 'suspect' as const,
        age: 54,
        dateOfBirth: '1972-11-27',
        occupation: 'Senior Estate Attorney & Trust Executor',
        residence: '88 Harborview Plaza, Apt 14B',
        relationshipToVictim: 'Legal Counsel & Estate Executor',
        photoAssetId: 'ast-ash-sus-03',
        statusTag: 'person_of_interest' as const,
        threatLevel: 'moderate' as const,
        bioSummary:
          'Longtime legal architect for the Ashford family trusts. Visited Ashford Hall on the evening of November 14 to present a revised codicil and argued loudly with Julian in the foyer at 21:40.',
        motiveSummary:
          'Facing severe personal margin calls ($1.8M) and suspected of diverting escrow interest from an Ashford holding company; Julian ordered an independent audit starting Monday.',
        alibiSummary:
          'States he left the estate angrily at 21:55 and met a client at the Blackwood Club bar at 22:25 (receipt timestamped 22:29).',
        alibiTimeWindow: '21:55 — 23:40',
        alibiVerified: true,
        interviewRecords: [
          {
            id: 'int-vt-1',
            title: 'Attorney Counsel Interview',
            recordedAt: '2026-11-15 14:20',
            interviewer: 'Det. C. Mercer',
            location: 'Thorne & Partners Office',
            excerpt:
              'Yes, we shouted in the foyer. Julian wanted to torch fifteen years of tax structures overnight. I left at 21:55 and was ordering scotch at the Blackwood Club by 22:25.',
            linkedEvidenceCode: 'EV-012',
          },
        ],
        contradictions: [
          {
            id: 'con-vt-1',
            statement: 'Insisted his relationship with Dr. Vance was strictly board-level.',
            conflictingDetail: 'Recovered encrypted messages show Thorne warning an undisclosed recipient on November 13 about Julian’s impending regulatory filing.',
            linkedEvidenceCodes: ['EV-014'],
            severity: 'minor' as const,
          },
        ],
        personalDetails: {
          Phone: '+1 (555) 012-7740',
          Vehicle: 'Black Mercedes E-Class (Exited South Gate 21:56)',
          'Access Credentials': 'Visitor Pass RFID-V14 (Expired 22:00)',
          'Prior Record': '2019 Bar Association Ethics Warning',
        },
        sortOrder: 3,
        heightCm: 178,
        variant: 0,
        accent: '#c88a2e',
      },
      {
        id: 'sus-ash-04',
        suspectCode: 'SUS-04',
        fullName: 'Clara Lin',
        aliases: [],
        roleType: 'suspect' as const,
        age: 34,
        dateOfBirth: '1992-05-11',
        occupation: 'Chief Archivist & Rare Collection Curator',
        residence: 'Ashford Hall — West Gatehouse Cottage',
        relationshipToVictim: 'Private Curator (4 years)',
        photoAssetId: 'ast-ash-sus-04',
        statusTag: 'person_of_interest' as const,
        threatLevel: 'low' as const,
        bioSummary:
          'Curated Julian’s private botanical manuscripts and renaissance apothecary artifacts — including historic texts on *Aconitum* alkaloids stored in the Conservatory cabinet.',
        motiveSummary:
          'Julian suspected someone inside the estate had swapped two rare illuminated folios with museum-grade reproductions and threatened to call Interpol art crimes.',
        alibiSummary:
          'Claims she walked back to the West Gatehouse Cottage at 22:00 during heavy rain and worked on catalog digitization until police sirens arrived.',
        alibiTimeWindow: '22:00 — 23:25',
        alibiVerified: false,
        interviewRecords: [
          {
            id: 'int-cl-1',
            title: 'Curator Witness & Inquiry Statement',
            recordedAt: '2026-11-15 02:10',
            interviewer: 'Sgt. R. Cole',
            location: 'West Gatehouse Cottage',
            excerpt:
              'I noticed the apothecary ledger missing from its glass case two days ago. And someone asked me last week how the groundskeeper maintenance badges work on the Conservatory side door.',
            linkedEvidenceCode: 'EV-014',
          },
        ],
        contradictions: [
          {
            id: 'con-cl-1',
            statement: 'Claimed she had no communications after 21:30.',
            conflictingDetail: 'Deleted encrypted chat log recovered at 22:05 shows her texting a gallery buyer: "He knows about the provenance tags. Do not wire the second half."',
            linkedEvidenceCodes: ['EV-014'],
            severity: 'major' as const,
          },
        ],
        personalDetails: {
          Phone: '+1 (555) 017-5129',
          Vehicle: 'None registered',
          'Access Credentials': 'Curator Card RFID-06F (Conservatory daytime only)',
          'Prior Record': 'None',
        },
        sortOrder: 4,
        heightCm: 164,
        variant: 2,
        accent: '#3b82a6',
      },
      {
        id: 'wit-ash-01',
        suspectCode: 'WIT-01',
        fullName: 'Arthur Pendelton',
        aliases: [],
        roleType: 'witness' as const,
        age: 63,
        dateOfBirth: '1963-01-30',
        occupation: 'Head Groundskeeper, Ashford Hall',
        residence: 'South Grounds Maintenance Lodge',
        relationshipToVictim: 'Employee (28 years)',
        photoAssetId: 'ast-ash-wit-01',
        statusTag: 'key_witness' as const,
        threatLevel: 'low' as const,
        bioSummary:
          'Veteran estate groundskeeper whose spare maintenance badge (`RFID-09B`) went missing from the tool-shed key peg earlier in the week.',
        motiveSummary: 'No known motive. Loyal long-term employee named in Julian’s pension trust.',
        alibiSummary:
          'Performing storm drainage inspection along the Conservatory exterior terrace between 22:15 and 22:35.',
        alibiTimeWindow: '22:15 — 22:35',
        alibiVerified: true,
        interviewRecords: [
          {
            id: 'int-ap-1',
            title: 'Sworn Witness Testimony',
            recordedAt: '2026-11-15 01:05',
            interviewer: 'Det. C. Mercer',
            location: 'South Grounds Lodge',
            excerpt:
              'At 22:24 sharp I heard glass shatter inside the Conservatory. Two minutes later a tall figure in a dark raincoat hurried out the service exit holding a leather doctor-style bag and dropped something metallic near the drain grate.',
            linkedEvidenceCode: 'EV-010',
          },
        ],
        contradictions: [],
        personalDetails: {
          Phone: '+1 (555) 010-4490',
          Vehicle: 'Estate Utility Pickup',
          'Access Credentials': 'Maintenance Master RFID-09A (Spare RFID-09B reported missing Nov 12)',
          'Prior Record': 'None',
        },
        sortOrder: 5,
        heightCm: 175,
        variant: 4,
        accent: '#2e7d5b',
      },
    ];

    for (const s of suspectDefs) {
      await db.insert(schema.suspects).values({
        id: s.id,
        caseId: case1Id,
        suspectCode: s.suspectCode,
        fullName: s.fullName,
        aliases: s.aliases,
        roleType: s.roleType,
        age: s.age,
        dateOfBirth: s.dateOfBirth,
        occupation: s.occupation,
        residence: s.residence,
        relationshipToVictim: s.relationshipToVictim,
        photoAssetId: s.photoAssetId,
        statusTag: s.statusTag,
        threatLevel: s.threatLevel,
        bioSummary: s.bioSummary,
        motiveSummary: s.motiveSummary,
        alibiSummary: s.alibiSummary,
        alibiTimeWindow: s.alibiTimeWindow,
        alibiVerified: s.alibiVerified,
        interviewRecords: s.interviewRecords,
        contradictions: s.contradictions,
        personalDetails: s.personalDetails,
        sortOrder: s.sortOrder,
      });

      await saveAsset({
        id: s.photoAssetId,
        caseId: case1Id,
        storageKey: `${case1Id}/portraits/${s.suspectCode.toLowerCase()}.svg`,
        originalFilename: `${s.suspectCode.toLowerCase()}-${s.fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.svg`,
        mimeType: 'image/svg+xml',
        caption: `${s.suspectCode} — ${s.fullName}`,
        buffer: generateSuspectPortraitSvg({
          code: s.suspectCode,
          name: s.fullName.toUpperCase(),
          subtitle: s.occupation.toUpperCase(),
          accentHex: s.accent,
          heightCm: s.heightCm,
          silhouetteVariant: s.variant,
        }),
      });
    }

    // Suspect Relationships
    await db.insert(schema.suspectRelationships).values([
      {
        id: 'srel-ash-1',
        caseId: case1Id,
        sourceSuspectId: 'sus-ash-01',
        targetSuspectId: 'sus-ash-03',
        relationshipLabel: 'Contested Codicil Counsel',
        relationshipType: 'conflict',
        strength: 4,
        notes: 'Eleanor accused Victor of orchestrating the codicil that cut her trust.',
      },
      {
        id: 'srel-ash-2',
        caseId: case1Id,
        sourceSuspectId: 'sus-ash-02',
        targetSuspectId: 'sus-ash-03',
        relationshipLabel: 'Quiet Regulatory Warning',
        relationshipType: 'secret',
        strength: 4,
        notes: 'Victor tipped off Marcus that Julian was delivering trial data to regulators Monday morning.',
      },
      {
        id: 'srel-ash-3',
        caseId: case1Id,
        sourceSuspectId: 'sus-ash-02',
        targetSuspectId: 'sus-ash-04',
        relationshipLabel: 'Botanical Manuscript Inquiry',
        relationshipType: 'professional',
        strength: 3,
        notes: 'Marcus consulted Clara’s rare botanical catalog regarding alkaloid extractions two weeks prior.',
      },
      {
        id: 'srel-ash-4',
        caseId: case1Id,
        sourceSuspectId: 'sus-ash-04',
        targetSuspectId: 'sus-ash-01',
        relationshipLabel: 'Foundation Antiquities Alliance',
        relationshipType: 'financial',
        strength: 3,
        notes: 'Clara relied on Eleanor’s foundation grant for manuscript restoration.',
      },
      {
        id: 'srel-ash-5',
        caseId: case1Id,
        sourceSuspectId: 'wit-ash-01',
        targetSuspectId: 'sus-ash-02',
        relationshipLabel: 'Missing Maintenance Badge',
        relationshipType: 'conflict',
        strength: 5,
        notes: 'Arthur spotted Dr. Vance near the maintenance shed on November 12, the day RFID-09B disappeared.',
      },
    ]);

    // Evidence Items covering ALL 10 navigation sections and ALL 8 universal viewer formats
    const evidenceDefs = [
      {
        id: 'ev-ash-001',
        evidenceCode: 'EV-001',
        title: 'Original Homicide Incident Report & Dispatch Dossier',
        summary: 'First-responder scene arrival log, locked-door entry findings, and preliminary patrol assessment.',
        description:
          'Compiled by Sgt. R. Cole upon arrival at Ashford Hall at 23:27 on November 14, 2026. Documents initial forced entry into the Conservatory, scene perimeter sealing, and list of estate occupants.',
        section: 'original_case_files' as const,
        viewerType: 'pdf' as const,
        classification: 'PUBLIC_RECORD' as const,
        sourceOrigin: 'Blackwood County Patrol Division',
        collectedAt: '2026-11-15 00:15 UTC',
        collectedBy: 'Sgt. R. Cole (Badge #3112)',
        locationFound: 'Ashford Hall — Main Conservatory',
        chainOfCustody: [
          { timestamp: '2026-11-15 00:15', handler: 'Sgt. R. Cole', action: 'Filed Initial Report', location: 'Ashford Hall Mobile Unit', sealId: 'IR-2026-041' },
          { timestamp: '2026-11-15 02:00', handler: 'Det. C. Mercer', action: 'Accepted to Homicide File', location: 'Metro HQ Vault', sealId: 'HQ-4101' },
        ],
        metadata: {
          'Report ID': 'BCP-2026-1114-09',
          'Dispatch Arrival': '23:27:14 UTC',
          'Scene Weather': 'Heavy Rain, 6°C, Wind NW 24 km/h',
          'Initial Entry': 'Conservatory main bolt forced by spouse at 23:18',
        },
        structuredContent: {
          documentPages: [
            {
              pageNumber: 1,
              heading: 'Initial Responder Narrative',
              body: 'At 23:19 UTC dispatch received a 911 emergency call from Eleanor Ashford reporting her husband Julian Ashford unresponsive inside the Conservatory. Patrol units arrived at 23:27. Subject exhibited no pulse, lividity consistent with death occurring 50 to 70 minutes prior (est. 22:15–22:35). Main French doors were locked from interior; however, the West Service Corridor steel door operated via an electronic RFID latch that self-locks upon closing.',
            },
            {
              pageNumber: 2,
              heading: 'Preliminary Scene Observations & Occupant Roster',
              body: 'A crystal wine glass lay shattered 1.2 meters southeast of the victim’s armchair beside a half-empty decanter of 1998 Chateau Margaux. Slight bitter herbal odor detected on rim. Occupants confirmed on premises at 23:27: Eleanor Ashford (East Wing), Clara Lin (West Gatehouse), Arthur Pendelton (South Grounds Lodge). Departed visitors logged earlier: Victor Thorne (21:56), Dr. Marcus Vance (22:09 South Gate LPR).',
            },
          ],
        },
        accessRules: { locked: false },
        tags: ['incident-report', 'locked-room', 'first-responder'],
        relatedSuspectIds: ['sus-ash-01', 'sus-ash-02', 'sus-ash-03', 'sus-ash-04', 'wit-ash-01'],
        sortOrder: 1,
      },
      {
        id: 'ev-ash-002',
        evidenceCode: 'EV-002',
        title: 'Conservatory Wing Forensic Blueprint & Scene Markers',
        summary: 'Interactive architectural diagram mapping victim position, shattered glass, RFID side door, CAM-04 cone, and exterior drain grate.',
        description:
          'Laser-measured floorplan produced by Crime Scene Investigation Unit. Click numbered yellow markers directly on the blueprint to inspect linked physical and electronic evidence.',
        section: 'crime_scene' as const,
        viewerType: 'image' as const,
        classification: 'CHAIN_OF_CUSTODY' as const,
        sourceOrigin: 'CSI Spatial Reconstruction Team',
        collectedAt: '2026-11-15 03:30 UTC',
        collectedBy: 'Tech. L. Park',
        locationFound: 'Ashford Hall — Ground Floor West Wing',
        chainOfCustody: [
          { timestamp: '2026-11-15 03:30', handler: 'Tech. L. Park', action: 'LIDAR Scan Exported', location: 'Ashford Hall', sealId: 'CSI-MAP-02' },
        ],
        metadata: {
          'Scan Resolution': '2mm LIDAR Point Cloud',
          'Interior Temp': '19.5°C (Climate Controlled)',
          'Primary Point of Entry': 'West Service Corridor RFID Door #04',
        },
        structuredContent: {
          hotspots: [
            { id: 'hs-1', xPercent: 23, yPercent: 34, label: 'Marker #1 — Victim Body', detail: 'Julian Ashford found slumped beside leather wingback chair; no external blunt trauma.', linkedEvidenceCode: 'EV-003' },
            { id: 'hs-2', xPercent: 34.5, yPercent: 34, label: 'Marker #2 — Bordeaux Decanter', detail: 'Crystal decanter & shattered tasting glass testing positive for concentrated alkaloid.', linkedEvidenceCode: 'EV-004' },
            { id: 'hs-3', xPercent: 43.8, yPercent: 49.5, label: 'Marker #3 — Self-Locking RFID Door', detail: 'Secondary entry from West Service Corridor. Unlocked at 22:19:42 by cloned badge RFID-09B.', linkedEvidenceCode: 'EV-013' },
            { id: 'hs-4', xPercent: 49.5, yPercent: 31, label: 'Marker #4 — CAM-04 Blind Corridor', detail: 'Overhead security camera covering West Service Corridor; captured gloved intruder at 22:18.', linkedEvidenceCode: 'EV-006' },
            { id: 'hs-5', xPercent: 18.2, yPercent: 75.5, label: 'Marker #5 — Exterior Drain Grate', detail: 'Snapped 5mL glass ampoule & dark leather fiber recovered beneath storm grate.', linkedEvidenceCode: 'EV-005' },
            { id: 'hs-6', xPercent: 77, yPercent: 34, label: 'Marker #6 — East Wing Study AP', detail: 'Wireless access point showing Eleanor Ashford’s laptop disconnect between 22:08 and 22:25.', linkedEvidenceCode: 'EV-014' },
          ],
        },
        accessRules: { locked: false },
        tags: ['blueprint', 'crime-scene', 'hotspots', 'rfid-door'],
        relatedSuspectIds: ['sus-ash-01', 'sus-ash-02', 'wit-ash-01'],
        sortOrder: 2,
      },
      {
        id: 'ev-ash-003',
        evidenceCode: 'EV-003',
        title: 'Medical Examiner Autopsy & Toxicology Report',
        summary: 'Confirms death by acute Aconitine (Aconitum napellus) poisoning ingested 10–15 minutes before collapse; rules out natural cardiac failure.',
        description:
          'Complete post-mortem pathology and LC-MS/MS toxicology panel performed by Dr. Priya Nair, Deputy Chief Medical Examiner.',
        section: 'forensic_reports' as const,
        viewerType: 'pdf' as const,
        classification: 'FORENSIC_SEALED' as const,
        sourceOrigin: 'County Medical Examiner Office',
        collectedAt: '2026-11-15 16:45 UTC',
        collectedBy: 'Dr. Priya Nair, MD',
        locationFound: 'Central Morgue — Autopsy Suite 2',
        chainOfCustody: [
          { timestamp: '2026-11-15 05:10', handler: 'Coroner Transport', action: 'Body Logged', location: 'Central Morgue', sealId: 'ME-2026-904' },
          { timestamp: '2026-11-15 16:45', handler: 'Dr. Priya Nair', action: 'Signed Toxicology Addendum', location: 'Forensic Tox Lab', sealId: 'TOX-904-A' },
        ],
        metadata: {
          'Cause of Death': 'Ventricular Fibrillation Secondary to Acute Aconitine Toxicity',
          'Manner of Death': 'HOMICIDE',
          'Estimated Time of Death': '22:20 — 22:32 UTC (Nov 14, 2026)',
          'Toxicant Concentration': '4.8 mg purified Aconitine extract (2.4x lethal dose)',
          'Absorption Vehicle': 'Red wine (ethanol accelerates buccal/gastric uptake)',
        },
        structuredContent: {
          documentPages: [
            {
              pageNumber: 1,
              heading: 'Pathology Summary & Time-of-Death Determination',
              body: 'External inspection reveals zero defensive wounds or blunt-force trauma. Vitreous potassium and core hepatic temperature (34.8°C at 00:10) place time of death tightly between 22:20 and 22:32 UTC. Gastric contents contain 140 mL dark red wine laced with high-purity Aconitine alkaloid. Onset of fatal cardiac arrhythmia from purified liquid aconitine in alcohol occurs within 4 to 9 minutes of ingestion — meaning the wine was poisoned immediately prior to or between 22:15 and 22:24.',
            },
            {
              pageNumber: 2,
              heading: 'Forensic Pharmaceutical Assessment',
              body: 'Crucially, GC-MS purity profiling confirms this was NOT crude garden monkshood tea. The compound is 99.4% laboratory-grade crystalline Aconitine suspended in pharmaceutical propylene glycol — matching research reference stock used exclusively in neuro-cardiac ion-channel laboratories such as Ashford BioLabs Clinical Dispensary. Notably, victim’s prescribed beta-blocker bottle on the mantel was untouched.',
            },
          ],
        },
        accessRules: { locked: false },
        tags: ['autopsy', 'toxicology', 'aconitine', 'time-of-death', 'decisive'],
        relatedSuspectIds: ['sus-ash-02'],
        sortOrder: 3,
      },
      {
        id: 'ev-ash-004',
        evidenceCode: 'EV-004',
        title: 'Shattered Crystal Decanter & Residue Plate',
        summary: 'Macro lab plate of the 1998 Bordeaux decanter showing concentrated alkaloid ring and absence of suspect fingerprints due to nitrile gloves.',
        description:
          'Recovered beside the victim’s armchair. Only Julian Ashford’s prints appear on the stemware; wiped smudge marks along the decanter neck match smooth medical nitrile gloves.',
        section: 'physical_evidence' as const,
        viewerType: 'image' as const,
        classification: 'CHAIN_OF_CUSTODY' as const,
        sourceOrigin: 'Forensic Trace Chemistry Lab',
        collectedAt: '2026-11-15 01:50 UTC',
        collectedBy: 'CSI M. Sato',
        locationFound: 'Conservatory — Side Table & Floor',
        chainOfCustody: [
          { timestamp: '2026-11-15 01:50', handler: 'CSI M. Sato', action: 'Bagged & Sealed', location: 'Conservatory', sealId: 'PE-041-04' },
          { timestamp: '2026-11-15 08:20', handler: 'Lab Tech D. Wu', action: 'Mass-Spec Swab Completed', location: 'Trace Lab 3', sealId: 'TL-8841' },
        ],
        metadata: {
          'Residue Compound': 'Aconitine + Propylene Glycol Carrier',
          'Latent Prints': 'Victim only; nitrile glove wipe on decanter collar',
          'Glass Breakage Time': 'Consistent with 22:24 acoustic impact',
        },
        structuredContent: {},
        accessRules: { locked: false },
        tags: ['physical', 'poison', 'decanter', 'nitrile-gloves'],
        relatedSuspectIds: ['sus-ash-02'],
        sortOrder: 4,
      },
      {
        id: 'ev-ash-005',
        evidenceCode: 'EV-005',
        title: 'Recovered 5mL Glass Ampoule & Satchel Fiber',
        summary: 'Snapped clinical ampoule Lot #VNC-44B found under the exterior greenhouse drain grate with dark calfskin leather fibers.',
        description:
          'Located by K9 sweep inside the storm grate 8 meters from the Conservatory service exit, exactly where groundskeeper Arthur Pendelton saw a figure drop an object at 22:26.',
        section: 'physical_evidence' as const,
        viewerType: 'image' as const,
        classification: 'CHAIN_OF_CUSTODY' as const,
        sourceOrigin: 'Forensic Trace & Micro-Fiber Unit',
        collectedAt: '2026-11-15 07:40 UTC',
        collectedBy: 'CSI M. Sato',
        locationFound: 'Conservatory Exterior — Storm Drainage Grate',
        chainOfCustody: [
          { timestamp: '2026-11-15 07:40', handler: 'CSI M. Sato', action: 'Extracted from Grate', location: 'Ashford Exterior', sealId: 'PE-041-05' },
          { timestamp: '2026-11-15 12:15', handler: 'Lab Tech D. Wu', action: 'Lot Number & Fiber Match', location: 'Trace Lab 3', sealId: 'TL-8859' },
        ],
        metadata: {
          'Lot Marking': 'VNC-44B (Ashford BioLabs Neurology Reference Stock)',
          'Residual Volume': '0.12 mL — 99.4% Aconitine in Propylene Glycol',
          'Trace Fiber': 'Waxed oxblood/dark-brown Italian calfskin (physician satchel strap)',
        },
        structuredContent: {},
        accessRules: { locked: false },
        tags: ['ampoule', 'clinical-lot', 'fiber', 'drain-grate'],
        relatedSuspectIds: ['sus-ash-02', 'wit-ash-01'],
        sortOrder: 5,
      },
      {
        id: 'ev-ash-006',
        evidenceCode: 'EV-006',
        title: 'CAM-04 — West Service Corridor Footage (22:14–22:29)',
        summary: 'Infrared CCTV recording capturing a 183cm hooded figure in nitrile gloves carrying a leather medical satchel toward Conservatory RFID Door #04.',
        description:
          'Extracted directly from the estate NVR hard drive. Overhead infrared camera covers the West Service Corridor connecting the exterior boiler hatch to the Conservatory maintenance door.',
        section: 'cctv_archive' as const,
        viewerType: 'video' as const,
        classification: 'RESTRICTED' as const,
        sourceOrigin: 'Ashford Estate Security NVR (Channel 04)',
        collectedAt: '2026-11-15 03:10 UTC',
        collectedBy: 'Det. C. Mercer',
        locationFound: 'Estate Server Closet',
        chainOfCustody: [
          { timestamp: '2026-11-15 03:10', handler: 'Det. C. Mercer', action: 'Bit-stream Exported', location: 'Ashford Hall', sealId: 'NVR-CH04' },
        ],
        metadata: {
          'Camera ID': 'CAM-04 (IR Night Vision)',
          'Time Window': '2026-11-14 22:14:00 — 22:29:00 UTC',
          'Clock Drift Verified': '+0.2 seconds vs NTP (Accurate)',
          'Subject Stature Estimate': '182–185 cm (Photogrammetry)',
        },
        structuredContent: {
          mediaDurationSeconds: 45,
          mediaMarkers: [
            { second: 4, label: 'Corridor Clear', severity: 'normal', description: 'Empty corridor. Rain audible through boiler vent.' },
            { second: 12, label: 'Intruder Enters Frame (22:18:14)', severity: 'critical', description: 'Figure (~183cm) wearing raincoat, nitrile gloves, and leather satchel enters from exterior service hatch.' },
            { second: 21, label: 'RFID Badge Swipe (22:19:42)', severity: 'critical', description: 'Subject presents maintenance badge at Conservatory Door #04; green LED unlock flash visible.' },
            { second: 36, label: 'Rapid Exit Toward Exterior (22:25:50)', severity: 'alert', description: 'Same figure exits Conservatory hastily 90 seconds after glass shatter timestamp.' },
          ],
        },
        accessRules: { locked: false },
        tags: ['cctv', 'service-corridor', 'intruder', 'decisive'],
        relatedSuspectIds: ['sus-ash-02'],
        sortOrder: 6,
      },
      {
        id: 'ev-ash-007',
        evidenceCode: 'EV-007',
        title: 'CAM-09 — South Estate Gate LPR Recording (21:55–22:40)',
        summary: 'Proves Dr. Marcus Vance exited the inner gate at 22:09 but extinguished his headlights and remained parked outside the perimeter until 22:34.',
        description:
          'Automated License Plate Recognition camera facing the South Estate Gate and adjacent tree-lined service pull-off.',
        section: 'cctv_archive' as const,
        viewerType: 'video' as const,
        classification: 'RESTRICTED' as const,
        sourceOrigin: 'Estate Perimeter Gate NVR (Channel 09)',
        collectedAt: '2026-11-15 03:22 UTC',
        collectedBy: 'Det. C. Mercer',
        locationFound: 'South Gate Guardhouse',
        chainOfCustody: [
          { timestamp: '2026-11-15 03:22', handler: 'Det. C. Mercer', action: 'Exported Gate Archive', location: 'South Gate', sealId: 'NVR-CH09' },
        ],
        metadata: {
          'Camera ID': 'CAM-09 (LPR + Wide Exterior)',
          'Plate BWR-774 (Vance)': 'Cleared barrier 22:09:11; departed roadway 22:34:48',
          'Plate VTH-902 (Thorne)': 'Cleared barrier 21:56:04; departed roadway immediately',
        },
        structuredContent: {
          mediaDurationSeconds: 40,
          mediaMarkers: [
            { second: 5, label: 'Thorne Sedan Departs (21:56)', severity: 'normal', description: 'Black Mercedes exits gate and accelerates down Blackwood Rd.' },
            { second: 14, label: 'Vance Sedan Clears Barrier (22:09)', severity: 'alert', description: 'Audi A6 (BWR-774) crosses gate sensor — establishing fake departure log — then pulls into dark verge 30m outside.' },
            { second: 22, label: 'Headlights Cut / Driver Exits (22:11)', severity: 'critical', description: 'Brake lights off; silhouette walks back along perimeter hedge toward exterior boiler path.' },
            { second: 34, label: 'Vance Sedan Finally Departs (22:34)', severity: 'critical', description: 'Headlights ignite 8 minutes after conservatory exit; vehicle accelerates south.' },
          ],
        },
        accessRules: { locked: false },
        tags: ['cctv', 'alibi-breaker', 'south-gate', 'lpr'],
        relatedSuspectIds: ['sus-ash-02', 'sus-ash-03'],
        sortOrder: 7,
      },
      {
        id: 'ev-ash-008',
        evidenceCode: 'EV-008',
        title: '911 Emergency Dispatch Audio — 23:19:04',
        summary: 'Eleanor Ashford’s emergency call reporting Julian’s collapse inside the Conservatory.',
        description:
          'Original 16kHz municipal dispatch recording with verified carrier timestamp and synchronized transcript.',
        section: 'audio_archive' as const,
        viewerType: 'audio' as const,
        classification: 'PUBLIC_RECORD' as const,
        sourceOrigin: 'Blackwood County 911 PSAP',
        collectedAt: '2026-11-15 01:30 UTC',
        collectedBy: 'Dispatch Supervisor H. Grant',
        locationFound: 'County 911 Archive Server',
        chainOfCustody: [
          { timestamp: '2026-11-15 01:30', handler: 'H. Grant', action: 'Certified WAV Export', location: 'County PSAP', sealId: 'AUD-911-08' },
        ],
        metadata: {
          'Caller ID': '+1 (555) 014-8821 (Eleanor Ashford)',
          'Call Start': '2026-11-14 23:19:04 UTC',
          'Duration': '00:18 (Excerpt)',
        },
        structuredContent: {
          mediaDurationSeconds: 18,
          transcriptLines: [
            { id: 't8-1', timestamp: '00:01', seconds: 1, speaker: 'DISPATCHER', role: '911 Operator', text: '911 Emergency, state your location and emergency.' },
            { id: 't8-2', timestamp: '00:04', seconds: 4, speaker: 'ELEANOR ASHFORD', role: 'Caller', text: 'Ashford Hall! Please send an ambulance right now—my husband Julian isn’t breathing!' },
            { id: 't8-3', timestamp: '00:09', seconds: 9, speaker: 'DISPATCHER', role: '911 Operator', text: 'Ma’am, is he conscious? Is there any sign of trauma or medication nearby?' },
            { id: 't8-4', timestamp: '00:13', seconds: 13, speaker: 'ELEANOR ASHFORD', role: 'Caller', text: 'No, he’s ice cold! The Conservatory door was bolted from inside—I had to pry the latch. There’s broken wine glass everywhere!', highlight: true },
          ],
        },
        accessRules: { locked: false },
        tags: ['audio', '911', 'eleanor'],
        relatedSuspectIds: ['sus-ash-01'],
        sortOrder: 8,
      },
      {
        id: 'ev-ash-009',
        evidenceCode: 'EV-009',
        title: 'Victim Landline Voicemail Intercept — 21:52:11',
        summary: 'Julian Ashford’s final outgoing message to Dr. Marcus Vance confronting him over falsified Phase-III trial data and mentioning the dispensary audit code 4819.',
        description:
          'Recovered from the Ashford Estate Office PBX auto-recording archive. Captured 28 minutes before Julian’s death.',
        section: 'audio_archive' as const,
        viewerType: 'audio' as const,
        classification: 'CONFIDENTIAL' as const,
        sourceOrigin: 'Estate PBX Voice Archive',
        collectedAt: '2026-11-15 09:05 UTC',
        collectedBy: 'Det. C. Mercer',
        locationFound: 'Main Estate Office — PBX Server',
        chainOfCustody: [
          { timestamp: '2026-11-15 09:05', handler: 'Det. C. Mercer', action: 'Extracted PBX Recording', location: 'Estate Office', sealId: 'PBX-041-09' },
        ],
        metadata: {
          'Originating Extension': 'Ext 101 — Julian Ashford Private Line',
          'Dialed Target': '+1 (555) 019-3304 (Dr. Marcus Vance)',
          'Timestamp': '2026-11-14 21:52:11 UTC',
        },
        structuredContent: {
          mediaDurationSeconds: 20,
          transcriptLines: [
            { id: 't9-1', timestamp: '00:01', seconds: 1, speaker: 'SYSTEM', role: 'Voicemail Prompt', text: '[BEEP] Recording started — 21:52.' },
            { id: 't9-2', timestamp: '00:03', seconds: 3, speaker: 'JULIAN ASHFORD', role: 'Victim', text: 'Marcus, I know you haven’t left the grounds yet. Victor just told me you’re trying to bury the neurology trial discrepancies.' },
            { id: 't9-3', timestamp: '00:10', seconds: 10, speaker: 'JULIAN ASHFORD', role: 'Victim', text: 'I pulled the clinical dispensary audit under vault code 4819. At nine o’clock sharp tomorrow morning, I am handing the entire dossier to the FDA and the Medical Board.', highlight: true },
            { id: 't9-4', timestamp: '00:16', seconds: 16, speaker: 'JULIAN ASHFORD', role: 'Victim', text: 'Your career at Ashford BioLabs is finished. Do not bother coming back to the house.' },
          ],
        },
        accessRules: { locked: false },
        tags: ['audio', 'motive', 'voicemail', 'passcode-clue'],
        relatedSuspectIds: ['sus-ash-02', 'sus-ash-03'],
        sortOrder: 9,
      },
      {
        id: 'ev-ash-010',
        evidenceCode: 'EV-010',
        title: 'Sworn Witness Statement — Arthur Pendelton',
        summary: 'Head Groundskeeper confirms shattering glass at 22:24, dark-coated figure fleeing with a medical satchel, and his spare RFID badge missing since Nov 12.',
        description:
          'Recorded under oath by Det. Claire Mercer at 01:05 on November 15.',
        section: 'witness_statements' as const,
        viewerType: 'transcript' as const,
        classification: 'CONFIDENTIAL' as const,
        sourceOrigin: 'Homicide Witness Intake',
        collectedAt: '2026-11-15 01:05 UTC',
        collectedBy: 'Det. C. Mercer',
        locationFound: 'South Grounds Lodge',
        chainOfCustody: [
          { timestamp: '2026-11-15 01:45', handler: 'Det. C. Mercer', action: 'Signed & Certified', location: 'Metro HQ', sealId: 'WS-041-10' },
        ],
        metadata: {
          'Witness': 'Arthur Pendelton (WIT-01)',
          'Credibility Assessment': 'High — corroborated by physical ampoule recovery',
        },
        structuredContent: {
          transcriptLines: [
            { id: 'w10-1', timestamp: '01:06:12', speaker: 'DET. MERCER', role: 'Interviewer', text: 'Mr. Pendelton, tell me exactly what you saw outside the Conservatory during the storm.' },
            { id: 'w10-2', timestamp: '01:06:34', speaker: 'A. PENDELTON', role: 'Groundskeeper', text: 'I was clearing leaves off the south terrace drains. I checked my watch—22:24—right when a loud crash of glass echoed from inside the Conservatory.' },
            { id: 'w10-3', timestamp: '01:07:10', speaker: 'A. PENDELTON', role: 'Groundskeeper', text: 'About two minutes later, the exterior boiler-corridor door clicked open. A tall man—over six feet—hurried out wearing a dark hooded coat and clutching a leather doctor’s satchel.', highlight: true },
            { id: 'w10-4', timestamp: '01:07:48', speaker: 'DET. MERCER', role: 'Interviewer', text: 'Did he notice you? Did he drop anything?' },
            { id: 'w10-5', timestamp: '01:08:05', speaker: 'A. PENDELTON', role: 'Groundskeeper', text: 'No, the rain was coming down sideways. He paused over the storm grate, tossed something small through the bars, and headed fast toward the South Gate hedge.' },
            { id: 'w10-6', timestamp: '01:09:02', speaker: 'A. PENDELTON', role: 'Groundskeeper', text: 'One more thing, Detective. My spare maintenance keycard—RFID-09B—vanished from the tool shed peg on Tuesday night. Only staff and Dr. Vance were back near that shed checking the backup generator.', highlight: true },
          ],
        },
        accessRules: { locked: false },
        tags: ['witness', 'glass-shatter', 'satchel', 'rfid-theft'],
        relatedSuspectIds: ['wit-ash-01', 'sus-ash-02'],
        sortOrder: 10,
      },
      {
        id: 'ev-ash-011',
        evidenceCode: 'EV-011',
        title: 'Interrogation Transcript — Dr. Marcus Vance (Session 1)',
        summary: 'Vance insists he left the estate at 22:10, denies knowledge of any regulatory complaint, and denies entering the West Service Corridor.',
        description:
          'Verbatim audio-verified interrogation transcript conducted at Metro Homicide Precinct Room B.',
        section: 'interrogation_records' as const,
        viewerType: 'transcript' as const,
        classification: 'RESTRICTED' as const,
        sourceOrigin: 'Metro Homicide Interrogation Unit',
        collectedAt: '2026-11-15 11:15 UTC',
        collectedBy: 'Det. C. Mercer',
        locationFound: 'Precinct Interrogation Room B',
        chainOfCustody: [
          { timestamp: '2026-11-15 12:30', handler: 'Clerk T. Brooks', action: 'Transcript Certified', location: 'Metro HQ', sealId: 'INT-041-11' },
        ],
        metadata: {
          'Subject': 'Dr. Marcus Vance (SUS-02)',
          'Counsel Present': 'Waived (Initial Session)',
          'Duration': '38 minutes (Key Excerpts)',
        },
        structuredContent: {
          transcriptLines: [
            { id: 'i11-1', timestamp: '11:16:04', speaker: 'DET. MERCER', role: 'Lead Detective', text: 'Doctor, walk me through your departure from Ashford Hall on the night of November 14.' },
            { id: 'i11-2', timestamp: '11:16:29', speaker: 'DR. MARCUS VANCE', role: 'Suspect (SUS-02)', text: 'I reviewed Julian’s evening blood pressure readings at 21:35, chatted briefly with Victor, and drove straight out the South Gate at 22:10. I never stopped until I reached my driveway.', highlight: true },
            { id: 'i11-3', timestamp: '11:18:14', speaker: 'DET. MERCER', role: 'Lead Detective', text: 'Did Julian contact you at 21:52 regarding falsified Phase-III neurology trial data?' },
            { id: 'i11-4', timestamp: '11:18:40', speaker: 'DR. MARCUS VANCE', role: 'Suspect (SUS-02)', text: 'My phone was on silent in the car. And any suggestion that I falsified clinical data is absurd—Julian and I had no disagreement whatsoever.', highlight: true },
            { id: 'i11-5', timestamp: '11:21:02', speaker: 'DET. MERCER', role: 'Lead Detective', text: 'Have you ever used the Conservatory’s West Service Corridor or handled maintenance keycard RFID-09B?' },
            { id: 'i11-6', timestamp: '11:21:20', speaker: 'DR. MARCUS VANCE', role: 'Suspect (SUS-02)', text: 'Never. I wouldn’t even know where the service corridor leads. And regarding aconitine—yes, our lab stores reference alkaloids, under dual-key audit control. Nothing is missing.' },
          ],
        },
        accessRules: { locked: false },
        tags: ['interrogation', 'false-alibi', 'vance'],
        relatedSuspectIds: ['sus-ash-02'],
        sortOrder: 11,
      },
      {
        id: 'ev-ash-012',
        evidenceCode: 'EV-012',
        title: 'Ashford Codicil Draft & Clinical Audit Notice',
        summary: 'Estate legal filing confirming both Eleanor’s trust reduction and Julian’s Monday 09:00 regulatory whistleblower submission against Ashford BioLabs.',
        description:
          'Seized from Julian Ashford’s locked briefcase inside the Estate Office.',
        section: 'documents' as const,
        viewerType: 'pdf' as const,
        classification: 'CONFIDENTIAL' as const,
        sourceOrigin: 'Ashford Estate Legal Safe',
        collectedAt: '2026-11-15 10:15 UTC',
        collectedBy: 'Det. C. Mercer',
        locationFound: 'Main Estate Office Safe',
        chainOfCustody: [
          { timestamp: '2026-11-15 10:15', handler: 'Det. C. Mercer', action: 'Warrant Seizure', location: 'Ashford Hall', sealId: 'DOC-041-12' },
        ],
        metadata: {
          'Document Date': '2026-11-14',
          'Drafting Firm': 'Thorne & Partners LLP',
          'Attachments': 'FDA Whistleblower Cover Memo (Scheduled Nov 15, 09:00)',
        },
        structuredContent: {
          documentPages: [
            {
              pageNumber: 1,
              heading: 'Draft Estate Codicil (Unsigned)',
              body: 'Article IV restructures the Ashford Antiquities Foundation, placing board spending under independent trustee review and reducing spousal discretionary draw from $18M to $4M pending divorce resolution. Note in margin by Victor Thorne: "Client insisted on immediate forensic accounting of escrow accounts."',
            },
            {
              pageNumber: 2,
              heading: 'Attachment B — Urgent Regulatory Compliance Referral',
              body: 'TO: Office of Scientific Integrity & State Medical Licensing Board.\nFROM: Julian Ashford, Chairman.\nSUBJECT: Intentional Fabrication of Phase-III Toxicity Adverse Events by Dr. Marcus Vance.\nSUMMARY: Independent biostatistical review proves Dr. Vance purged 14 severe cardiac toxicity incidents from Cohort C and signed false attestations. Supporting clinical dispensary vault logs are sealed under Audit Code 4819.',
            },
          ],
        },
        accessRules: { locked: false },
        tags: ['codicil', 'motive', 'fda-audit', 'financial'],
        relatedSuspectIds: ['sus-ash-01', 'sus-ash-02', 'sus-ash-03'],
        sortOrder: 12,
      },
      {
        id: 'ev-ash-013',
        evidenceCode: 'EV-013',
        title: 'Estate Smart-Lock & RFID Access Ledger (Nov 14)',
        summary: 'Complete electronic door telemetry proving cloned maintenance badge RFID-09B unlocked Conservatory Door #04 at 22:19:42 — 10 minutes after Vance’s South Gate exit.',
        description:
          'Structured CSV/tabular dump extracted from the Ashford Hall Honeywell electronic access controller.',
        section: 'digital_forensics' as const,
        viewerType: 'spreadsheet' as const,
        classification: 'FORENSIC_SEALED' as const,
        sourceOrigin: 'Estate Access Controller DB',
        collectedAt: '2026-11-15 04:00 UTC',
        collectedBy: 'Digital Forensics Specialist K. Reyes',
        locationFound: 'Ashford Server Closet',
        chainOfCustody: [
          { timestamp: '2026-11-15 04:00', handler: 'K. Reyes', action: 'SHA-256 Verified Export', location: 'Ashford Hall', sealId: 'DF-041-13' },
        ],
        metadata: {
          'Controller Model': 'Honeywell ProWatch 6.4',
          'Total Events Exported': '10 key evening entries',
          'Critical Anomaly': 'Badge RFID-09B reported stolen Nov 12; UID cloned signature detected at 22:19:42',
        },
        structuredContent: {
          spreadsheet: {
            sheetName: 'RFID_ACCESS_2026_11_14',
            summaryNote: 'Flagged rows indicate anomalous off-hours or stolen/cloned badge swipes.',
            columns: [
              { key: 'time', label: 'Timestamp (UTC)', type: 'date' },
              { key: 'door', label: 'Door / Zone', type: 'text' },
              { key: 'badge', label: 'Credential ID', type: 'text' },
              { key: 'holder', label: 'Registered Holder', type: 'text' },
              { key: 'result', label: 'Access Status', type: 'text' },
              { key: 'flag', label: 'Forensic Flag', type: 'flag' },
            ],
            rows: [
              { time: '21:28:11', door: 'East Wing Study', badge: 'RFID-01A', holder: 'Eleanor Ashford', result: 'GRANTED', flag: 'NORMAL' },
              { time: '21:34:05', door: 'Main Conservatory', badge: 'RFID-03C', holder: 'Dr. Marcus Vance', result: 'GRANTED', flag: 'NORMAL' },
              { time: '21:44:50', door: 'Main Foyer', badge: 'RFID-V14', holder: 'Victor Thorne', result: 'GRANTED', flag: 'NORMAL' },
              { time: '21:56:04', door: 'South Estate Gate', badge: 'LPR-VTH902', holder: 'Victor Thorne (Exit)', result: 'EXITED', flag: 'NORMAL' },
              { time: '22:01:18', door: 'West Gatehouse', badge: 'RFID-06F', holder: 'Clara Lin', result: 'GRANTED', flag: 'NORMAL' },
              { time: '22:09:11', door: 'South Estate Gate', badge: 'LPR-BWR774', holder: 'Dr. Marcus Vance (Exit)', result: 'EXITED', flag: 'CHECK CAM-09' },
              { time: '22:17:10', door: 'Exterior Boiler Hatch', badge: 'RFID-09B', holder: 'A. Pendelton (MISSING)', result: 'GRANTED', flag: 'ANOMALY' },
              { time: '22:19:42', door: 'Conservatory Side Door #04', badge: 'RFID-09B', holder: 'A. Pendelton (MISSING)', result: 'GRANTED (CLONED UID)', flag: 'CRITICAL' },
              { time: '22:25:46', door: 'Conservatory Side Door #04', badge: 'INTERIOR-PUSH', holder: 'Egress Sensor', result: 'OPENED 4.2s', flag: 'CRITICAL' },
              { time: '23:18:22', door: 'Main Conservatory French Door', badge: 'FORCED-BOLT', holder: 'Mechanical Override', result: 'ALARM', flag: 'VERIFY' },
            ],
          },
        },
        accessRules: { locked: false },
        tags: ['rfid', 'spreadsheet', 'access-log', 'decisive'],
        relatedSuspectIds: ['sus-ash-01', 'sus-ash-02', 'sus-ash-03', 'sus-ash-04', 'wit-ash-01'],
        sortOrder: 13,
      },
      {
        id: 'ev-ash-014',
        evidenceCode: 'EV-014',
        title: 'Recovered Encrypted Chat & SMS Communications Dump',
        summary: 'Forensic mobile extractions revealing Thorne’s warning to Vance, Clara’s folio provenance panic, and Eleanor’s unexplained 17-minute Wi-Fi drop.',
        description:
          'Warrant-authorized Cellebrite extraction combining recovered encrypted messages and estate Wi-Fi router disconnect notifications.',
        section: 'digital_forensics' as const,
        viewerType: 'digital_comm' as const,
        classification: 'RESTRICTED' as const,
        sourceOrigin: 'Metro Cyber Forensics Lab',
        collectedAt: '2026-11-15 15:00 UTC',
        collectedBy: 'Specialist K. Reyes',
        locationFound: 'Cyber Lab Extraction Bay 2',
        chainOfCustody: [
          { timestamp: '2026-11-15 15:00', handler: 'K. Reyes', action: 'Logical Extraction Verified', location: 'Cyber Lab', sealId: 'CYB-041-14' },
        ],
        metadata: {
          'Extraction Suite': 'ForensicVault Mobile 9.2',
          'Recovered Deleted Messages': '2',
        },
        structuredContent: {
          commChannel: 'encrypted_chat',
          commHeader: {
            deviceOwner: 'Multi-Device Warrant Correlation (Case CF-2026-041)',
            account: 'Signal / SMS / Estate Router Telemetry',
            extractionTool: 'ForensicVault Mobile 9.2',
            dateRange: '2026-11-13 20:00 — 2026-11-14 23:15 UTC',
          },
          messages: [
            {
              id: 'm14-1',
              timestamp: '2026-11-13 21:14',
              sender: 'Victor Thorne (SUS-03)',
              senderHandle: '+1-555-012-7740',
              recipient: 'Dr. Marcus Vance (SUS-02)',
              channel: 'encrypted_chat',
              body: 'Heads up, Marcus. Julian pulled your Cohort C mortality spreadsheets and locked the dispensary audit under code 4819. If he files Monday, you lose your license and face federal charges.',
              deletedRecovered: true,
              direction: 'outgoing',
            },
            {
              id: 'm14-2',
              timestamp: '2026-11-13 21:19',
              sender: 'Dr. Marcus Vance (SUS-02)',
              senderHandle: '+1-555-019-3304',
              recipient: 'Victor Thorne (SUS-03)',
              channel: 'encrypted_chat',
              body: 'Delete this thread. I am coming to the estate tomorrow evening to handle his blood pressure review personally.',
              deletedRecovered: true,
              direction: 'incoming',
            },
            {
              id: 'm14-3',
              timestamp: '2026-11-14 22:05',
              sender: 'Clara Lin (SUS-04)',
              senderHandle: 'clara.archivist@proton',
              recipient: 'V. Moreau (Zurich Gallery)',
              channel: 'encrypted_chat',
              body: 'Pause the wire transfer. Julian noticed the folio watermarks earlier today. I am staying inside the gatehouse tonight until this blows over.',
              deletedRecovered: true,
              direction: 'outgoing',
            },
            {
              id: 'm14-4',
              timestamp: '2026-11-14 22:08',
              sender: 'Estate Wi-Fi Controller',
              senderHandle: 'syslog@ashford-net',
              recipient: 'Telemetry Log',
              channel: 'email',
              subject: 'AP-EAST-STUDY Client Deauth',
              body: 'Client MAC 4C:2E:88:11:9A:0F (Eleanor-MacBook) disconnected from AP-EAST-STUDY at 22:08:19 (power-save / walked to dressing room balcony). Reassociated at 22:25:04. No corridor AP handoff detected.',
              direction: 'internal',
            },
          ],
        },
        accessRules: { locked: false },
        tags: ['digital-comms', 'deleted-messages', 'blackmail', 'red-herring'],
        relatedSuspectIds: ['sus-ash-01', 'sus-ash-02', 'sus-ash-03', 'sus-ash-04'],
        sortOrder: 14,
      },
      {
        id: 'ev-ash-015',
        evidenceCode: 'EV-015',
        title: 'ENCRYPTED VAULT: Clinical Dispensary & RFID Cloner Metadata',
        summary: 'Server-locked forensic vault file linking Dr. Vance’s clinic workstation directly to RFID-09B badge cloning and the missing 5mL Aconitine Lot #VNC-44B ampoule.',
        description:
          'High-sensitivity laboratory audit log sealed under Julian Ashford’s 4-digit audit code. Unlock using the code uncovered in the Audio Archive (EV-009) or Documents (EV-012).',
        section: 'digital_forensics' as const,
        viewerType: 'metadata' as const,
        classification: 'FORENSIC_SEALED' as const,
        sourceOrigin: 'Ashford BioLabs Restricted Dispensary Server',
        collectedAt: '2026-11-15 18:10 UTC',
        collectedBy: 'Cyber Forensics Specialist K. Reyes',
        locationFound: 'BioLabs Secure Server Cluster',
        chainOfCustody: [
          { timestamp: '2026-11-15 18:10', handler: 'K. Reyes', action: 'Encrypted Dump Imaged', location: 'BioLabs HQ', sealId: 'VLT-4819' },
        ],
        metadata: {
          'Vault Cipher': 'AES-256-GCM (Audit PIN Protected)',
          'Workstation Host': 'CLINIC-WS-VANCE-02',
          'Dispensary Discrepancy': '-1x 5mL Ampoule Lot #VNC-44B (99.4% Aconitine)',
        },
        structuredContent: {
          metadataSections: [
            {
              section: 'Clinical Dispensary Inventory Log (Nov 13, 2026)',
              entries: [
                { key: 'Compound SKU', value: 'TOX-ACO-994 (Purified Aconitine in Propylene Glycol)' },
                { key: 'Batch Lot Number', value: 'VNC-44B (Exact match to EV-005 drain grate ampoule)', anomaly: true, note: 'Physical ampoule recovered at crime scene matches this exact lot.' },
                { key: 'Biometric Sign-Out', value: 'Dr. Marcus Vance — 2026-11-13 23:14:08 UTC', anomaly: true, note: 'Logged after hours with falsified "calibration disposal" reason.' },
                { key: 'Remaining Stock Variance', value: '1x 5mL glass ampoule unaccounted for', anomaly: true },
              ],
            },
            {
              section: 'USB Peripheral & RFID Writer Forensic Metadata',
              entries: [
                { key: 'Host Machine', value: 'CLINIC-WS-VANCE-02 (Logged in: mvance@ashfordbio.com)' },
                { key: 'Connected Hardware', value: 'Proxmark3 RFID Cloner (USB VID:9AC4 PID:4B8F)', anomaly: true, note: 'Cloned maintenance credential on Nov 12 at 19:42 UTC.' },
                { key: 'Cloned Credential UID', value: 'RFID-09B — Registered to Arthur Pendelton', anomaly: true, note: 'Used to unlock Conservatory Side Door #04 at 22:19:42 on Nov 14.' },
                { key: 'SHA-256 Audit Digest', value: '9b4e11f0a6c34d82e5b77c210f39a841d67e5512c0ab9847f1e3c45299a01b7e' },
              ],
            },
          ],
        },
        accessRules: {
          locked: true,
          unlockType: 'passcode',
          passcode: '4819',
          hint: 'Enter the 4-digit clinical dispensary audit code mentioned by Julian Ashford in his 21:52 voicemail (EV-009) or the Compliance Referral (EV-012).',
          lockReason: 'ENCRYPTED DISPENSARY VAULT — ENTER 4-DIGIT AUDIT PIN TO DECRYPT',
        },
        isHiddenClue: true,
        hiddenClueHint: 'Listen to EV-009 voicemail or read EV-012 page 2 for the 4-digit clinical audit vault code.',
        tags: ['hidden-clue', 'vault', 'metadata', 'smoking-gun', 'decisive'],
        relatedSuspectIds: ['sus-ash-02', 'wit-ash-01'],
        sortOrder: 15,
      },
    ];

    for (const ev of evidenceDefs) {
      await db.insert(schema.evidenceItems).values({
        id: ev.id,
        caseId: case1Id,
        evidenceCode: ev.evidenceCode,
        title: ev.title,
        summary: ev.summary,
        description: ev.description,
        section: ev.section,
        viewerType: ev.viewerType,
        classification: ev.classification,
        sourceOrigin: ev.sourceOrigin,
        collectedAt: ev.collectedAt,
        collectedBy: ev.collectedBy,
        locationFound: ev.locationFound,
        chainOfCustody: ev.chainOfCustody,
        metadata: Object.fromEntries(
          Object.entries(ev.metadata).filter(([, v]) => typeof v === 'string'),
        ) as Record<string, string>,
        structuredContent: ev.structuredContent as unknown as StructuredEvidenceContent,
        accessRules: ev.accessRules as unknown as EvidenceAccessRules,
        isHiddenClue: ev.isHiddenClue ?? false,
        hiddenClueHint: ev.hiddenClueHint ?? '',
        tags: ev.tags,
        relatedSuspectIds: ev.relatedSuspectIds,
        sortOrder: ev.sortOrder,
      });
    }

    // Generate & store REAL private assets for Case 1 exhibits
    await saveAsset({
      id: 'ast-ash-ev001-pdf',
      caseId: case1Id,
      evidenceItemId: 'ev-ash-001',
      storageKey: `${case1Id}/evidence/ev-001-incident-report.pdf`,
      originalFilename: 'EV-001_Incident_Report.pdf',
      mimeType: 'application/pdf',
      caption: 'Certified Incident Report PDF',
      buffer: generateForensicPdf({
        caseNumber: 'CF-2026-041',
        evidenceCode: 'EV-001',
        classification: 'PUBLIC RECORD // HOMICIDE INTAKE',
        title: 'INITIAL HOMICIDE INCIDENT REPORT',
        subtitle: 'Blackwood County Patrol Division — Ashford Hall Conservatory',
        metadataLines: [
          'CASE NUMBER: CF-2026-041   |   INCIDENT DATE: 2026-11-14   |   DISPATCH: 23:19:04 UTC',
          'REPORTING OFFICER: Sgt. R. Cole (#3112)   |   VICTIM: Julian Ashford (Age 58)',
          'SCENE STATUS: Main Conservatory doors bolted internally; RFID side door #04 self-locking.',
        ],
        pages: evidenceDefs[0]!.structuredContent.documentPages!.map((p) => ({
          heading: p.heading,
          body: p.body,
        })),
      }),
    });

    await saveAsset({
      id: 'ast-ash-ev002-img',
      caseId: case1Id,
      evidenceItemId: 'ev-ash-002',
      storageKey: `${case1Id}/evidence/ev-002-crime-scene-blueprint.svg`,
      originalFilename: 'EV-002_Conservatory_Blueprint.svg',
      mimeType: 'image/svg+xml',
      caption: 'LIDAR Forensic Blueprint — Ashford Hall West Wing',
      buffer: generateCrimeSceneBlueprintSvg({
        caseNumber: 'CF-2026-041',
        title: 'Ashford Hall Conservatory & West Service Corridor',
        sceneVariant: 'estate',
      }),
    });

    await saveAsset({
      id: 'ast-ash-ev003-pdf',
      caseId: case1Id,
      evidenceItemId: 'ev-ash-003',
      storageKey: `${case1Id}/evidence/ev-003-autopsy-toxicology.pdf`,
      originalFilename: 'EV-003_Autopsy_Toxicology_Report.pdf',
      mimeType: 'application/pdf',
      caption: 'Medical Examiner Post-Mortem & LC-MS/MS Toxicology Report',
      buffer: generateForensicPdf({
        caseNumber: 'CF-2026-041',
        evidenceCode: 'EV-003',
        classification: 'FORENSIC SEALED // MEDICAL EXAMINER',
        title: 'AUTOPSY & TOXICOLOGY REPORT',
        subtitle: 'Office of the Chief Medical Examiner — Case ME-2026-904',
        metadataLines: [
          'DECEDENT: Julian Ashford (M, 58)   |   EXAMINER: Dr. Priya Nair, MD',
          'CAUSE OF DEATH: Acute Aconitine Alkaloid Toxicity -> Ventricular Fibrillation',
          'MANNER: HOMICIDE   |   EST. TIME OF DEATH: 22:20 - 22:32 UTC (Nov 14, 2026)',
        ],
        pages: evidenceDefs[2]!.structuredContent.documentPages!.map((p) => ({
          heading: p.heading,
          body: p.body,
        })),
      }),
    });

    await saveAsset({
      id: 'ast-ash-ev004-img',
      caseId: case1Id,
      evidenceItemId: 'ev-ash-004',
      storageKey: `${case1Id}/evidence/ev-004-decanter-plate.svg`,
      originalFilename: 'EV-004_Bordeaux_Decanter_Plate.svg',
      mimeType: 'image/svg+xml',
      caption: 'Forensic Trace Plate — Shattered 1998 Bordeaux Decanter',
      buffer: generatePhysicalEvidenceSvg({
        evidenceCode: 'EV-004',
        title: 'Bordeaux Decanter & Alkaloid Residue',
        variant: 'decanter',
        detailLines: [
          'EXHIBIT: 1998 Chateau Margaux Crystal Decanter (Conservatory Side Table)',
          'CHEMISTRY: 4.8mg Purified Aconitine suspended in pharmaceutical propylene glycol',
          'PRINTS: Victim prints on glass stem only; nitrile glove wipe mark on decanter neck',
        ],
      }),
    });

    await saveAsset({
      id: 'ast-ash-ev005-img',
      caseId: case1Id,
      evidenceItemId: 'ev-ash-005',
      storageKey: `${case1Id}/evidence/ev-005-ampoule-plate.svg`,
      originalFilename: 'EV-005_Clinical_Ampoule_Plate.svg',
      mimeType: 'image/svg+xml',
      caption: 'Forensic Trace Plate — Clinical Ampoule Lot #VNC-44B',
      buffer: generatePhysicalEvidenceSvg({
        evidenceCode: 'EV-005',
        title: '5mL Clinical Ampoule & Leather Satchel Fiber',
        variant: 'ampoule',
        detailLines: [
          'EXHIBIT: Snapped 5mL Borosilicate Glass Ampoule recovered under Exterior Storm Grate',
          'MARKING: LOT# VNC-44B — Matches Ashford BioLabs Neurology Dispensary Stock',
          'MICRO-FIBER: Dark waxed calfskin fiber consistent with leather physician satchel',
        ],
      }),
    });

    await saveAsset({
      id: 'ast-ash-ev006-cctv',
      caseId: case1Id,
      evidenceItemId: 'ev-ash-006',
      storageKey: `${case1Id}/evidence/ev-006-cam04-corridor.cctv.json`,
      originalFilename: 'EV-006_CAM04_West_Corridor.cctv.json',
      mimeType: 'application/vnd.casefiles.cctv-reel+json',
      caption: 'CAM-04 Infrared Footage Telemetry — West Service Corridor',
      buffer: generateCctvReelBuffer({
        cameraId: 'CAM-04 // WEST SERVICE CORRIDOR',
        location: 'ASHFORD HALL — BASEMENT/CONSERVATORY LINK',
        recordedDate: '2026-11-14',
        startClock: '22:14:00',
        durationSeconds: 45,
        fps: 24,
        lightingMode: 'ir_night',
        corridorLabel: 'CONSERVATORY RFID DOOR #04',
        tracks: [
          { id: 'trk-1', label: 'SUBJECT A (~183CM / SATCHEL)', startSec: 11, endSec: 23, fromX: 0.14, fromY: 0.72, toX: 0.78, toY: 0.56, kind: 'person', alertBox: true },
          { id: 'trk-2', label: 'RFID-09B UNLOCK FLASH', startSec: 20, endSec: 23, fromX: 0.80, fromY: 0.48, toX: 0.80, toY: 0.48, kind: 'door_flash', alertBox: true },
          { id: 'trk-3', label: 'SUBJECT A (RAPID EGRESS)', startSec: 34, endSec: 42, fromX: 0.78, fromY: 0.56, toX: 0.12, toY: 0.74, kind: 'person', alertBox: true },
        ],
        markers: [
          { second: 4, label: 'Corridor Clear', severity: 'normal', description: 'Corridor empty prior to exterior hatch breach.' },
          { second: 12, label: 'Intruder Enters (22:18)', severity: 'critical', description: 'Hooded ~183cm subject in nitrile gloves carrying leather satchel.' },
          { second: 21, label: 'RFID-09B Swipe (22:19)', severity: 'critical', description: 'Cloned maintenance credential unlocks Conservatory Side Door #04.' },
          { second: 36, label: 'Rapid Exit (22:25)', severity: 'alert', description: 'Subject exits Conservatory immediately following acoustic glass impact.' },
        ],
      }),
    });

    await saveAsset({
      id: 'ast-ash-ev007-cctv',
      caseId: case1Id,
      evidenceItemId: 'ev-ash-007',
      storageKey: `${case1Id}/evidence/ev-007-cam09-southgate.cctv.json`,
      originalFilename: 'EV-007_CAM09_South_Gate_LPR.cctv.json',
      mimeType: 'application/vnd.casefiles.cctv-reel+json',
      caption: 'CAM-09 License Plate & Exterior Perimeter Camera',
      buffer: generateCctvReelBuffer({
        cameraId: 'CAM-09 // SOUTH ESTATE GATE LPR',
        location: 'ASHFORD HALL — PERIMETER ACCESS ROAD',
        recordedDate: '2026-11-14',
        startClock: '21:55:00',
        durationSeconds: 40,
        fps: 24,
        lightingMode: 'low_light_color',
        corridorLabel: 'SOUTH GATE BARRIER & EXTERIOR VERGE',
        tracks: [
          { id: 'trk-g1', label: 'LPR: VTH-902 (THORNE EXIT)', startSec: 3, endSec: 10, fromX: 0.20, fromY: 0.65, toX: 0.92, toY: 0.65, kind: 'vehicle', alertBox: false },
          { id: 'trk-g2', label: 'LPR: BWR-774 (VANCE HALTS OUTSIDE)', startSec: 13, endSec: 34, fromX: 0.22, fromY: 0.66, toX: 0.72, toY: 0.66, kind: 'vehicle', alertBox: true },
          { id: 'trk-g3', label: 'DRIVER WALKS BACK TO HEDGE', startSec: 20, endSec: 26, fromX: 0.70, fromY: 0.62, toX: 0.35, toY: 0.42, kind: 'person', alertBox: true },
          { id: 'trk-g4', label: 'LPR: BWR-774 FINAL DEPARTURE', startSec: 34, endSec: 39, fromX: 0.72, fromY: 0.66, toX: 0.96, toY: 0.66, kind: 'vehicle', alertBox: true },
        ],
        markers: [
          { second: 5, label: 'Thorne Departs (21:56)', severity: 'normal', description: 'Victor Thorne’s Mercedes exits estate roadway cleanly.' },
          { second: 14, label: 'Vance Staged Exit (22:09)', severity: 'alert', description: 'Audi A6 (BWR-774) clears gate sensor then parks outside perimeter.' },
          { second: 22, label: 'Foot Re-Entry (22:11)', severity: 'critical', description: 'Driver kills headlights and walks back along tree line.' },
          { second: 34, label: 'Actual Departure (22:34)', severity: 'critical', description: 'Vehicle finally accelerates away 25 minutes after gate log.' },
        ],
      }),
    });

    await saveAsset({
      id: 'ast-ash-ev008-wav',
      caseId: case1Id,
      evidenceItemId: 'ev-ash-008',
      storageKey: `${case1Id}/evidence/ev-008-911-dispatch.wav`,
      originalFilename: 'EV-008_911_Dispatch_2319.wav',
      mimeType: 'audio/wav',
      caption: 'Municipal 911 Emergency Call Audio (16kHz PCM)',
      buffer: generateForensicAudioWav({ durationSeconds: 18, seed: 4108, beepsAtSeconds: [0.4, 17.2] }),
    });

    await saveAsset({
      id: 'ast-ash-ev009-wav',
      caseId: case1Id,
      evidenceItemId: 'ev-ash-009',
      storageKey: `${case1Id}/evidence/ev-009-pbx-voicemail.wav`,
      originalFilename: 'EV-009_PBX_Voicemail_2152.wav',
      mimeType: 'audio/wav',
      caption: 'Estate PBX Outgoing Voicemail Archive (16kHz PCM)',
      buffer: generateForensicAudioWav({ durationSeconds: 20, seed: 4109, beepsAtSeconds: [0.8, 19.1] }),
    });

    await saveAsset({
      id: 'ast-ash-ev012-pdf',
      caseId: case1Id,
      evidenceItemId: 'ev-ash-012',
      storageKey: `${case1Id}/evidence/ev-012-codicil-audit.pdf`,
      originalFilename: 'EV-012_Codicil_And_Compliance_Referral.pdf',
      mimeType: 'application/pdf',
      caption: 'Estate Codicil Draft & FDA Whistleblower Compliance Referral',
      buffer: generateForensicPdf({
        caseNumber: 'CF-2026-041',
        evidenceCode: 'EV-012',
        classification: 'CONFIDENTIAL // SEIZED LEGAL RECORD',
        title: 'ESTATE CODICIL & REGULATORY REFERRAL',
        subtitle: 'Recovered from Julian Ashford’s Private Briefcase',
        metadataLines: [
          'DATE: November 14, 2026   |   SEIZURE WARRANT: BW-2026-884',
          'CONTENTS: (1) Unsigned Spousal Trust Codicil   (2) FDA Scientific Integrity Referral',
        ],
        pages: evidenceDefs[11]!.structuredContent.documentPages!.map((p) => ({
          heading: p.heading,
          body: p.body,
        })),
      }),
    });

    // Evidence Relationships
    await db.insert(schema.evidenceRelations).values([
      { id: 'erel-ash-1', caseId: case1Id, sourceEvidenceId: 'ev-ash-003', targetEvidenceId: 'ev-ash-004', relationType: 'corroborates', label: 'Aconitine toxicology matches decanter residue' },
      { id: 'erel-ash-2', caseId: case1Id, sourceEvidenceId: 'ev-ash-004', targetEvidenceId: 'ev-ash-005', relationType: 'derived_from', label: 'Same 99.4% clinical Lot #VNC-44B extract' },
      { id: 'erel-ash-3', caseId: case1Id, sourceEvidenceId: 'ev-ash-006', targetEvidenceId: 'ev-ash-013', relationType: 'corroborates', label: 'CAM-04 swipe timestamp matches RFID-09B at 22:19:42' },
      { id: 'erel-ash-4', caseId: case1Id, sourceEvidenceId: 'ev-ash-007', targetEvidenceId: 'ev-ash-011', relationType: 'contradicts', label: 'South Gate camera refutes Vance 22:10 departure claim' },
      { id: 'erel-ash-5', caseId: case1Id, sourceEvidenceId: 'ev-ash-009', targetEvidenceId: 'ev-ash-015', relationType: 'links_to', label: 'Voicemail reveals vault PIN 4819' },
      { id: 'erel-ash-6', caseId: case1Id, sourceEvidenceId: 'ev-ash-010', targetEvidenceId: 'ev-ash-005', relationType: 'corroborates', label: 'Witness saw satchel carrier drop ampoule in drain grate' },
      { id: 'erel-ash-7', caseId: case1Id, sourceEvidenceId: 'ev-ash-015', targetEvidenceId: 'ev-ash-013', relationType: 'corroborates', label: 'Vance clinic workstation cloned RFID-09B' },
    ]);

    // Timeline Events (presented in a slightly scrambled initial order for non-anchor events so players actively reconstruct!)
    await db.insert(schema.caseTimelineEvents).values([
      {
        id: 'tl-ash-01',
        caseId: case1Id,
        eventCode: 'TL-01',
        title: 'Julian Confronts Vance via Voicemail',
        description: 'Julian leaves 21:52 voicemail warning Dr. Vance he will submit clinical fraud dossier & Audit Vault 4819 to regulators at 09:00.',
        displayTime: '21:52 UTC (Anchor)',
        occurredAtIso: '2026-11-14T21:52:11Z',
        location: 'Estate Office PBX',
        involvedSuspectIds: ['sus-ash-02'],
        linkedEvidenceIds: ['ev-ash-009', 'ev-ash-012'],
        isAnchor: true,
        category: 'communication',
        sortOrder: 1,
      },
      {
        id: 'tl-ash-04',
        caseId: case1Id,
        eventCode: 'TL-04',
        title: 'Glass Shatters in Conservatory & Fatal Collapse',
        description: 'Groundskeeper hears crystal glass shatter inside the Conservatory; autopsy places fatal arrhythmia onset right inside this window.',
        displayTime: 'Est. 22:24 UTC',
        occurredAtIso: '2026-11-14T22:24:00Z',
        location: 'Conservatory',
        involvedSuspectIds: ['wit-ash-01', 'sus-ash-02'],
        linkedEvidenceIds: ['ev-ash-003', 'ev-ash-004', 'ev-ash-010'],
        isAnchor: false,
        category: 'incident',
        sortOrder: 2, // intentionally out of chronological order initially!
      },
      {
        id: 'tl-ash-02',
        caseId: case1Id,
        eventCode: 'TL-02',
        title: 'Staged South Gate Exit & Foot Re-Entry',
        description: 'Audi A6 (BWR-774) clears South Gate barrier to create an electronic exit timestamp, parks dark outside verge, and driver returns on foot.',
        displayTime: 'Est. 22:09 — 22:11 UTC',
        occurredAtIso: '2026-11-14T22:09:11Z',
        location: 'South Estate Gate',
        involvedSuspectIds: ['sus-ash-02'],
        linkedEvidenceIds: ['ev-ash-007', 'ev-ash-011'],
        isAnchor: false,
        category: 'alibi',
        sortOrder: 3,
      },
      {
        id: 'tl-ash-05',
        caseId: case1Id,
        eventCode: 'TL-05',
        title: 'Egress & Ampoule Disposal in Storm Grate',
        description: 'Intruder exits Conservatory Door #04, discards snapped 5mL Lot #VNC-44B ampoule down exterior grate, and flees toward parked sedan.',
        displayTime: 'Est. 22:25 — 22:26 UTC',
        occurredAtIso: '2026-11-14T22:25:46Z',
        location: 'Exterior Storm Grate',
        involvedSuspectIds: ['sus-ash-02', 'wit-ash-01'],
        linkedEvidenceIds: ['ev-ash-005', 'ev-ash-006', 'ev-ash-010'],
        isAnchor: false,
        category: 'movement',
        sortOrder: 4,
      },
      {
        id: 'tl-ash-03',
        caseId: case1Id,
        eventCode: 'TL-03',
        title: 'Cloned RFID-09B Entry & Decanter Poisoning',
        description: 'Gloved subject captured on CAM-04 uses cloned maintenance badge RFID-09B to unlock Conservatory Side Door #04 and lace the Bordeaux decanter.',
        displayTime: 'Est. 22:18 — 22:20 UTC',
        occurredAtIso: '2026-11-14T22:19:42Z',
        location: 'West Service Corridor / Door #04',
        involvedSuspectIds: ['sus-ash-02'],
        linkedEvidenceIds: ['ev-ash-006', 'ev-ash-013', 'ev-ash-015'],
        isAnchor: false,
        category: 'forensic',
        sortOrder: 5,
      },
      {
        id: 'tl-ash-06',
        caseId: case1Id,
        eventCode: 'TL-06',
        title: 'Vance Sedan Departs Perimeter & 911 Discovery',
        description: 'Audi A6 accelerates away from South Gate verge at 22:34; Eleanor discovers Julian unresponsive and calls 911 at 23:19.',
        displayTime: '22:34 — 23:19 UTC (Anchor)',
        occurredAtIso: '2026-11-14T23:19:04Z',
        location: 'South Gate / Conservatory',
        involvedSuspectIds: ['sus-ash-02', 'sus-ash-01'],
        linkedEvidenceIds: ['ev-ash-007', 'ev-ash-008'],
        isAnchor: true,
        category: 'incident',
        sortOrder: 6,
      },
    ]);

    // STRICTLY CONFIDENTIAL ANSWER KEY (isolated table)
    await db.insert(schema.caseSolutions).values({
      id: 'sol-ashford-041',
      caseId: case1Id,
      killerSuspectId: 'sus-ash-02',
      accompliceSuspectIds: [],
      motiveKeywords: [
        'falsified|fabricated|fraud|manipulated',
        'clinical trial|phase-iii|phase iii|neurology|toxicity|fda|regulatory',
        'medical board|license|whistleblower|audit|expose|report',
      ],
      motiveCanonical:
        'Dr. Marcus Vance killed Julian Ashford to stop him from submitting proof of fabricated Phase-III clinical trial toxicity data (Audit Vault 4819) to the FDA and Medical Licensing Board at 09:00 the following morning, which would have ended Vance’s career and led to federal prosecution.',
      methodKeywords: [
        'aconitine|poison|alkaloid|ampoule|vnc-44b',
        'wine|bordeaux|decanter',
        'cloned|rfid|rfid-09b|service corridor|side door',
        'staged|south gate|parked|headlights|alibi',
      ],
      methodCanonical:
        'Vance staged an early 22:09 exit past the South Gate LPR sensor, parked dark outside the verge, walked back on foot through the exterior boiler hatch, unlocked Conservatory Side Door #04 at 22:19 using a cloned copy of Arthur Pendelton’s missing maintenance badge (RFID-09B), laced Julian’s 1998 Bordeaux decanter with 99.4% laboratory aconitine (Lot #VNC-44B), discarded the snapped ampoule down the exterior drain grate, and departed at 22:34.',
      requiredEvidenceIds: ['ev-ash-003', 'ev-ash-006', 'ev-ash-013', 'ev-ash-015'],
      bonusEvidenceIds: ['ev-ash-005', 'ev-ash-007', 'ev-ash-009'],
      canonicalTimelineOrder: [
        { eventId: 'tl-ash-01', expectedOrder: 1, weight: 1 },
        { eventId: 'tl-ash-02', expectedOrder: 2, weight: 2 },
        { eventId: 'tl-ash-03', expectedOrder: 3, weight: 2 },
        { eventId: 'tl-ash-04', expectedOrder: 4, weight: 2 },
        { eventId: 'tl-ash-05', expectedOrder: 5, weight: 2 },
        { eventId: 'tl-ash-06', expectedOrder: 6, weight: 1 },
      ],
      solutionNarrative:
        'Case Closed. Dr. Marcus Vance engineered an airtight locked-room illusion by exploiting the self-locking Conservatory RFID maintenance door. Forewarned by Victor Thorne on November 13, Vance cloned groundskeeper Arthur Pendelton’s missing spare credential (RFID-09B) on his clinic workstation and withdrew a 5mL ampoule of purified aconitine (Lot #VNC-44B). After staging a 22:09 South Gate vehicle exit, he re-entered via the West Service Corridor at 22:18, administered the lethal alkaloid into Julian’s Bordeaux decanter, and fled at 22:25 while discarding the glass ampoule down the exterior storm grate. Both Eleanor’s Wi-Fi drop and Clara’s folio provenance dispute served as independent red herrings.',
      updatedBy: SEED_USERS.admin.id,
    });
  }

  // =========================================================================
  // CASE 2: THE MERIDIAN NIGHT EXPRESS (Published, Demonstrates Multi-Case Engine
  //         + Purchase Entitlement Validation — NOT initially unlocked for demo user!)
  // =========================================================================
  const case2Id = SEED_CASE_IDS.meridian;
  const existingCase2 = await db
    .select({ id: schema.cases.id })
    .from(schema.cases)
    .where(eq(schema.cases.id, case2Id))
    .limit(1);

  if (existingCase2.length === 0) {
    const victim2PhotoId = 'ast-meridian-victim';

    await db.insert(schema.cases).values({
      id: case2Id,
      slug: 'meridian-night-express',
      caseNumber: 'CF-2026-088',
      title: 'The Meridian Night Express',
      subtitle: 'Sabotage & Espionage Aboard Car 4 Crossing the Alpine Pass',
      classification: 'TOP SECRET — INTERPOL TRANSIT DESK',
      status: 'published',
      difficulty: 'expert',
      priceCents: 2999,
      currency: 'USD',
      summary:
        'Diplomatic courier Henrik Lindholm was fatally drugged inside Sleeper Compartment 4B while the Meridian Night Express traversed the snowbound Brenner Tunnel. His biometric dispatch case was emptied despite Car 4 corridor doors remaining magnetically sealed.',
      briefingMarkdown: `### INCIDENT BRIEFING // CF-2026-088

At **02:14 CET**, the conductor of the transcontinental **Meridian Night Express** discovered courier **Henrik Lindholm** dead in Compartment 4B with his titanium diplomatic briefcase forced open.

All corridor doors to Car 4 were magnetically locked from **01:15 to 02:10** during the high-altitude snowstorm transit. Only passengers berthed inside Car 4 had physical proximity — or knowledge of the recessed HVAC service hatch connecting Compartments 4B and 4C.`,
      incidentLocation: 'Meridian Express — Sleeper Car 4 (Alpine Pass)',
      incidentDate: '2026-11-19 01:35 CET',
      victimName: 'Henrik Lindholm',
      victimSummary:
        'Age 44. Senior Nordic Diplomatic Courier carrying encrypted treaty encryption keys from Vienna to Zurich.',
      victimPhotoAssetId: victim2PhotoId,
      defaultDurationSeconds: 14400,
      expiryPolicy: 'lock_and_auto_submit',
      latePenaltyPercent: 20,
      maxAccusationAttempts: 1,
      scoringConfig: DEFAULT_SCORING_CONFIG,
      metadata: {
        agencyName: 'Interpol Rail Security Directorate',
        jurisdiction: 'Trans-Alpine Corridor',
        leadInvestigatorTitle: 'Lead Transit Investigator',
        tags: ['Espionage', 'Train Mystery', 'Sealed Car', 'Metadata Forensics'],
        estimatedMinutes: 105,
        accentLabel: 'DIPLOMATIC HOMICIDE',
      },
      createdBy: SEED_USERS.admin.id,
      publishedAt: new Date('2026-11-20T09:00:00Z'),
    });

    // Grant entitlement ONLY to Admin initially (so Demo Investigator sees purchase entitlement gating + unlock button!)
    await db
      .insert(schema.caseEntitlements)
      .values({
        id: 'ent-adm-meridian',
        userId: SEED_USERS.admin.id,
        caseId: case2Id,
        status: 'active',
        purchaseRef: 'ADM-INTERNAL-002',
        grantedBy: SEED_USERS.admin.id,
      })
      .onConflictDoNothing();

    await saveAsset({
      id: victim2PhotoId,
      caseId: case2Id,
      storageKey: `${case2Id}/portraits/victim-lindholm.svg`,
      originalFilename: 'victim-henrik-lindholm.svg',
      mimeType: 'image/svg+xml',
      caption: 'Victim File — Henrik Lindholm',
      buffer: generateSuspectPortraitSvg({
        code: 'VIC-00',
        name: 'HENRIK LINDHOLM',
        subtitle: 'DECEASED // DIPLOMATIC COURIER',
        accentHex: '#9e1b24',
        heightCm: 184,
        silhouetteVariant: 0,
      }),
    });

    const merSuspects = [
      {
        id: 'sus-mer-01',
        suspectCode: 'SUS-M1',
        fullName: 'Soraia Kovacs',
        occupation: 'Former Signal Intelligence Analyst',
        relationshipToVictim: 'Occupant of Compartment 4A (Former Colleague)',
        photoAssetId: 'ast-mer-sus-01',
        statusTag: 'person_of_interest' as const,
        threatLevel: 'moderate' as const,
        bioSummary: 'Booked Compartment 4A under a corporate travel voucher two hours before departure.',
        motiveSummary: 'Previously dismissed after Lindholm reported an unauthorized cipher copy in 2024.',
        alibiSummary: 'Claims she remained inside 4A listening to jazz recordings until conductor knocked at 02:16.',
        alibiTimeWindow: '01:00 — 02:16',
        alibiVerified: true,
        heightCm: 171,
        variant: 2,
        accent: '#c88a2e',
      },
      {
        id: 'sus-mer-02',
        suspectCode: 'SUS-M2',
        fullName: 'Dr. Henrik Vale',
        occupation: 'Aerospace Thermal Engineer & Private Broker',
        relationshipToVictim: 'Occupant of Adjacent Compartment 4C',
        photoAssetId: 'ast-mer-sus-02',
        statusTag: 'unverified_alibi' as const,
        threatLevel: 'high' as const,
        bioSummary: 'Designed the exact railcar ventilation ducting used on Meridian Express sleeper coaches.',
        motiveSummary: 'Deeply indebted to an unregistered Zurich syndicate seeking the courier’s encrypted hardware key.',
        alibiSummary: 'Claims he took sleeping pills at 00:45 and never left Compartment 4C.',
        alibiTimeWindow: '00:45 — 02:20',
        alibiVerified: false,
        heightCm: 179,
        variant: 1,
        accent: '#9e1b24',
      },
      {
        id: 'sus-mer-03',
        suspectCode: 'SUS-M3',
        fullName: 'Lukas Brenner',
        occupation: 'Senior Dining Car Steward',
        relationshipToVictim: 'Served Victim Evening Herbal Tea at 01:05',
        photoAssetId: 'ast-mer-sus-03',
        statusTag: 'person_of_interest' as const,
        threatLevel: 'moderate' as const,
        bioSummary: 'Prepared the victim’s tea tray and held a mechanical corridor passkey.',
        motiveSummary: 'Recent unexplained cash deposits of €15,000 traced to a Vienna account.',
        alibiSummary: 'Logged by dining car POS terminal reconciling receipts with chef from 01:18 to 02:05.',
        alibiTimeWindow: '01:18 — 02:05',
        alibiVerified: true,
        heightCm: 176,
        variant: 4,
        accent: '#3b82a6',
      },
    ];

    for (const [idx, s] of merSuspects.entries()) {
      await db.insert(schema.suspects).values({
        id: s.id,
        caseId: case2Id,
        suspectCode: s.suspectCode,
        fullName: s.fullName,
        roleType: 'suspect',
        occupation: s.occupation,
        relationshipToVictim: s.relationshipToVictim,
        photoAssetId: s.photoAssetId,
        statusTag: s.statusTag,
        threatLevel: s.threatLevel,
        bioSummary: s.bioSummary,
        motiveSummary: s.motiveSummary,
        alibiSummary: s.alibiSummary,
        alibiTimeWindow: s.alibiTimeWindow,
        alibiVerified: s.alibiVerified,
        sortOrder: idx + 1,
      });

      await saveAsset({
        id: s.photoAssetId,
        caseId: case2Id,
        storageKey: `${case2Id}/portraits/${s.suspectCode.toLowerCase()}.svg`,
        originalFilename: `${s.suspectCode.toLowerCase()}.svg`,
        mimeType: 'image/svg+xml',
        caption: `${s.suspectCode} — ${s.fullName}`,
        buffer: generateSuspectPortraitSvg({
          code: s.suspectCode,
          name: s.fullName.toUpperCase(),
          subtitle: s.occupation.toUpperCase(),
          accentHex: s.accent,
          heightCm: s.heightCm,
          silhouetteVariant: s.variant,
        }),
      });
    }

    const merEvidence = [
      {
        id: 'ev-mer-001',
        evidenceCode: 'EV-M01',
        title: 'Interpol Transit Homicide Report — Car 4',
        summary: 'Initial Alpine border police report detailing locked corridor doors and forced titanium briefcase.',
        section: 'original_case_files' as const,
        viewerType: 'pdf' as const,
        classification: 'RESTRICTED' as const,
        structuredContent: {
          documentPages: [
            {
              pageNumber: 1,
              heading: 'Car 4 Sealed Compartment Findings',
              body: 'Henrik Lindholm died between 01:30 and 01:45 CET from rapid aerosolized sedative overdose followed by positional asphyxia. Corridor door magnetic telemetry confirms zero corridor entries to 4B after 01:15. However, the shared maintenance ventilation hatch between 4B and 4C bore fresh hex-wrench tool marks.',
            },
          ],
        },
      },
      {
        id: 'ev-mer-002',
        evidenceCode: 'EV-M02',
        title: 'Sleeper Car 4 Crime Scene Schematic',
        summary: 'Architectural layout of Compartments 4A, 4B, 4C and the concealed HVAC service hatch.',
        section: 'crime_scene' as const,
        viewerType: 'image' as const,
        classification: 'CHAIN_OF_CUSTODY' as const,
        structuredContent: {
          hotspots: [
            { id: 'mhs-1', xPercent: 46, yPercent: 51, label: 'Marker A — Forced Briefcase', detail: 'Biometric clasp bypassed using thermal lance tool.', linkedEvidenceCode: 'EV-M01' },
            { id: 'mhs-2', xPercent: 60.5, yPercent: 35.5, label: 'Marker B — Shared 4B/4C Service Hatch', detail: 'Freshly loosened tamper-proof Torx fasteners from 4C side.', linkedEvidenceCode: 'EV-M04' },
          ],
        },
      },
      {
        id: 'ev-mer-003',
        evidenceCode: 'EV-M03',
        title: 'Car 4 Corridor Magnetic Lock & Cabin Sensor Ledger',
        summary: 'Electronic sensor log showing HVAC airflow drop in 4B/4C at 01:32 while corridor doors stayed sealed.',
        section: 'digital_forensics' as const,
        viewerType: 'spreadsheet' as const,
        classification: 'FORENSIC_SEALED' as const,
        structuredContent: {
          spreadsheet: {
            sheetName: 'CAR4_TELEMETRY',
            columns: [
              { key: 'time', label: 'CET Time', type: 'date' as const },
              { key: 'sensor', label: 'Sensor Node', type: 'text' as const },
              { key: 'event', label: 'Reading', type: 'text' as const },
              { key: 'flag', label: 'Flag', type: 'flag' as const },
            ],
            rows: [
              { time: '01:05:12', sensor: 'DOOR-4B', event: 'Steward Tea Delivery', flag: 'NORMAL' },
              { time: '01:15:00', sensor: 'CORRIDOR-MAGLOCK', event: 'Storm Lock Engaged', flag: 'NORMAL' },
              { time: '01:32:18', sensor: 'HVAC-4C-4B-DUCT', event: 'Hatch Open / Pressure Drop', flag: 'CRITICAL' },
              { time: '01:44:02', sensor: 'HVAC-4C-4B-DUCT', event: 'Hatch Resealed', flag: 'CRITICAL' },
            ],
          },
        },
      },
      {
        id: 'ev-mer-004',
        evidenceCode: 'EV-M04',
        title: 'Thermal Tooling & Compartment 4C Metadata Trace',
        summary: 'Links specialized railcar HVAC blueprint files and Torx bit shavings directly to Dr. Henrik Vale’s luggage.',
        section: 'forensic_reports' as const,
        viewerType: 'metadata' as const,
        classification: 'FORENSIC_SEALED' as const,
        structuredContent: {
          metadataSections: [
            {
              section: 'Luggage & Forensic Micro-Trace (Compartment 4C)',
              entries: [
                { key: 'Subject', value: 'Dr. Henrik Vale (SUS-M2)' },
                { key: 'Recovered Tool', value: 'Custom 5-point Rail HVAC Torx Driver with aluminum dust', anomaly: true },
                { key: 'Aerosol Canister Trace', value: 'Halothane micro-residue matching 4B air filter swab', anomaly: true },
              ],
            },
          ],
        },
      },
    ];

    for (const [idx, ev] of merEvidence.entries()) {
      await db.insert(schema.evidenceItems).values({
        id: ev.id,
        caseId: case2Id,
        evidenceCode: ev.evidenceCode,
        title: ev.title,
        summary: ev.summary,
        description: ev.summary,
        section: ev.section,
        viewerType: ev.viewerType,
        classification: ev.classification,
        structuredContent: ev.structuredContent,
        accessRules: { locked: false },
        tags: ['meridian', ev.section],
        relatedSuspectIds: ['sus-mer-02'],
        sortOrder: idx + 1,
      });
    }

    await saveAsset({
      id: 'ast-mer-ev001-pdf',
      caseId: case2Id,
      evidenceItemId: 'ev-mer-001',
      storageKey: `${case2Id}/evidence/ev-m01-interpol-report.pdf`,
      originalFilename: 'EV-M01_Interpol_Car4_Report.pdf',
      mimeType: 'application/pdf',
      caption: 'Interpol Car 4 Homicide Report',
      buffer: generateForensicPdf({
        caseNumber: 'CF-2026-088',
        evidenceCode: 'EV-M01',
        classification: 'TOP SECRET // INTERPOL TRANSIT',
        title: 'CAR 4 SEALED COMPARTMENT REPORT',
        subtitle: 'Meridian Night Express — Alpine Border Police',
        metadataLines: ['CASE: CF-2026-088   |   VICTIM: Henrik Lindholm   |   CAR 4B'],
        pages: [{ heading: 'Incident Summary', body: merEvidence[0]!.structuredContent.documentPages![0]!.body }],
      }),
    });

    await saveAsset({
      id: 'ast-mer-ev002-img',
      caseId: case2Id,
      evidenceItemId: 'ev-mer-002',
      storageKey: `${case2Id}/evidence/ev-m02-car4-blueprint.svg`,
      originalFilename: 'EV-M02_Car4_Blueprint.svg',
      mimeType: 'image/svg+xml',
      caption: 'Car 4 Sleeper Schematic',
      buffer: generateCrimeSceneBlueprintSvg({
        caseNumber: 'CF-2026-088',
        title: 'Meridian Express Car 4',
        sceneVariant: 'train',
      }),
    });

    await db.insert(schema.caseTimelineEvents).values([
      { id: 'tl-mer-01', caseId: case2Id, eventCode: 'TM-01', title: 'Car 4 Magnetic Storm Lock Engaged', description: 'Corridor locked from 01:15 to 02:10.', displayTime: '01:15 CET (Anchor)', isAnchor: true, category: 'incident', sortOrder: 1 },
      { id: 'tl-mer-02', caseId: case2Id, eventCode: 'TM-02', title: '4C-to-4B HVAC Hatch Opened', description: 'Pressure sensor drop recorded between compartments 4C and 4B.', displayTime: '01:32 CET', isAnchor: false, category: 'forensic', sortOrder: 2 },
      { id: 'tl-mer-03', caseId: case2Id, eventCode: 'TM-03', title: 'Conductor Discovers Body in 4B', description: 'Diplomatic briefcase emptied; alarm pulled.', displayTime: '02:14 CET (Anchor)', isAnchor: true, category: 'incident', sortOrder: 3 },
    ]);

    await db.insert(schema.caseSolutions).values({
      id: 'sol-meridian-088',
      caseId: case2Id,
      killerSuspectId: 'sus-mer-02',
      accompliceSuspectIds: [],
      motiveKeywords: ['debt|syndicate|zurich', 'cipher|key|briefcase|espionage'],
      motiveCanonical: 'Dr. Henrik Vale acted for a Zurich syndicate to steal the encrypted diplomatic key and clear his severe debts.',
      methodKeywords: ['hvac|vent|hatch|4c', 'halothane|aerosol|sedative|torx'],
      methodCanonical: 'Using his proprietary railcar ventilation knowledge and custom Torx tool, Vale opened the shared 4C-4B service hatch during the storm lock, dispensed aerosolized halothane, and breached the diplomatic briefcase.',
      requiredEvidenceIds: ['ev-mer-003', 'ev-mer-004'],
      bonusEvidenceIds: ['ev-mer-002'],
      canonicalTimelineOrder: [
        { eventId: 'tl-mer-01', expectedOrder: 1, weight: 1 },
        { eventId: 'tl-mer-02', expectedOrder: 2, weight: 2 },
        { eventId: 'tl-mer-03', expectedOrder: 3, weight: 1 },
      ],
      solutionNarrative:
        'Dr. Henrik Vale exploited the concealed HVAC service hatch connecting Compartments 4C and 4B while corridor magnetic locks created a false locked-car alibi.',
      updatedBy: SEED_USERS.admin.id,
    });
  }
}

export async function ensureSeeded(): Promise<void> {
  if (!globalForSeed.__caseFilesSeedPromise) {
    globalForSeed.__caseFilesSeedPromise = seedDatabase().catch((err) => {
      globalForSeed.__caseFilesSeedPromise = undefined;
      throw err;
    });
  }
  await globalForSeed.__caseFilesSeedPromise;
}

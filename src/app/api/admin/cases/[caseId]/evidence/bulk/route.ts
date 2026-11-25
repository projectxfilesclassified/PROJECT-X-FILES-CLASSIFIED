import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { extractRequestIp, getCurrentUser, isAdmin, recordAuditLog } from '@/lib/auth';
import { putPrivateObject } from '@/lib/storage';
import type { EvidenceClassification, EvidenceSection, EvidenceViewerType } from '@/lib/types';

function inferViewerType(filename: string, mimeType: string): EvidenceViewerType {
  const lower = filename.toLowerCase();
  const mime = mimeType.toLowerCase();
  if (mime.includes('pdf') || lower.endsWith('.pdf')) return 'pdf';
  if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/.test(lower)) return 'image';
  if (mime.startsWith('audio/') || /\.(wav|mp3|ogg|m4a)$/.test(lower)) return 'audio';
  if (mime.startsWith('video/') || /\.(mp4|webm|mov|cctv\.json)$/.test(lower)) return 'video';
  if (/\.(csv|tsv|xlsx?)$/.test(lower) || mime.includes('csv')) return 'spreadsheet';
  if (/\.(json|xml|log|eml)$/.test(lower)) return 'metadata';
  return 'transcript';
}

function parseCsvToSpreadsheet(filename: string, rawText: string) {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return undefined;
  const headers = lines[0]!.split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const columns = headers.map((label, idx) => ({
    key: `col_${idx}`,
    label: label || `Column ${idx + 1}`,
    type: 'text' as const,
  }));
  const rows = lines.slice(1, 500).map((line) => {
    const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    columns.forEach((c, idx) => {
      row[c.key] = vals[idx] ?? '';
    });
    return row;
  });
  return { sheetName: filename.replace(/\.[^.]+$/, ''), columns, rows };
}

/**
 * Bulk Evidence Upload Endpoint.
 * Accepts multipart/form-data with one or many files, stores every file inside
 * private object storage with SHA-256 verification, auto-assigns sequential
 * evidence codes, and links created exhibits to the specified case.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  }

  const { caseId } = await context.params;
  const formData = await request.formData();
  const files = formData.getAll('files').filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: 'At least one file must be uploaded.' }, { status: 400 });
  }

  const section = (String(formData.get('section') || 'documents')) as EvidenceSection;
  const classification = (String(
    formData.get('classification') || 'CONFIDENTIAL',
  )) as EvidenceClassification;
  const attachToEvidenceId = formData.get('evidenceItemId')
    ? String(formData.get('evidenceItemId'))
    : null;
  const attachToSuspectId = formData.get('suspectId') ? String(formData.get('suspectId')) : null;
  const rawTags = String(formData.get('tags') || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const db = await getDb();
  const existingEvidence = await db
    .select({ id: schema.evidenceItems.id })
    .from(schema.evidenceItems)
    .where(eq(schema.evidenceItems.caseId, caseId));

  let seq = existingEvidence.length + 1;
  const createdItems: { evidenceId: string | null; evidenceCode: string | null; assetId: string; filename: string }[] = [];

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || 'application/octet-stream';
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const assetId = `ast-${crypto.randomUUID().slice(0, 10)}`;
    const storageKey = `${caseId}/uploads/${assetId}-${safeFilename}`;

    const stored = await putPrivateObject(storageKey, buffer, mimeType);

    // Case A: Uploading a portrait directly to an existing suspect
    if (attachToSuspectId) {
      await db.insert(schema.evidenceAssets).values({
        id: assetId,
        caseId,
        evidenceItemId: null,
        storageKey: stored.storageKey,
        originalFilename: file.name,
        mimeType: stored.mimeType,
        byteSize: stored.byteSize,
        sha256: stored.sha256,
        caption: `Suspect Portrait — ${file.name}`,
      });
      await db
        .update(schema.suspects)
        .set({ photoAssetId: assetId, updatedAt: new Date() })
        .where(eq(schema.suspects.id, attachToSuspectId));

      createdItems.push({ evidenceId: null, evidenceCode: null, assetId, filename: file.name });
      continue;
    }

    // Case B: Attaching an additional file to an existing evidence item
    if (attachToEvidenceId) {
      await db.insert(schema.evidenceAssets).values({
        id: assetId,
        caseId,
        evidenceItemId: attachToEvidenceId,
        storageKey: stored.storageKey,
        originalFilename: file.name,
        mimeType: stored.mimeType,
        byteSize: stored.byteSize,
        sha256: stored.sha256,
        caption: file.name,
      });
      createdItems.push({
        evidenceId: attachToEvidenceId,
        evidenceCode: null,
        assetId,
        filename: file.name,
      });
      continue;
    }

    // Case C: Bulk-creating new evidence items from uploaded files
    const evidenceId = `ev-${crypto.randomUUID().slice(0, 10)}`;
    const evidenceCode = `EV-${String(seq).padStart(3, '0')}`;
    seq++;

    const viewerType = inferViewerType(file.name, mimeType);
    const title = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
    const structuredContent: Record<string, unknown> = {};

    if (viewerType === 'spreadsheet' && buffer.byteLength < 1024 * 1024) {
      const sheet = parseCsvToSpreadsheet(file.name, buffer.toString('utf8'));
      if (sheet) structuredContent.spreadsheet = sheet;
    } else if (viewerType === 'transcript' && buffer.byteLength < 512 * 1024) {
      const lines = buffer
        .toString('utf8')
        .split(/\r?\n/)
        .filter((l) => l.trim().length > 0)
        .slice(0, 200);
      structuredContent.transcriptLines = lines.map((line, i) => ({
        id: `ln-${i + 1}`,
        timestamp: `00:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`,
        speaker: 'RECORD',
        text: line,
      }));
    } else if (viewerType === 'metadata' && buffer.byteLength < 512 * 1024) {
      try {
        const parsedJson = JSON.parse(buffer.toString('utf8')) as Record<string, unknown>;
        structuredContent.metadataSections = [
          {
            section: file.name,
            entries: Object.entries(parsedJson).map(([k, v]) => ({
              key: k,
              value: typeof v === 'string' ? v : JSON.stringify(v),
            })),
          },
        ];
      } catch {
        // Store raw metadata hash only
      }
    }

    await db.insert(schema.evidenceItems).values({
      id: evidenceId,
      caseId,
      evidenceCode,
      title,
      summary: `Uploaded forensic exhibit (${file.name}, ${Math.max(1, Math.round(stored.byteSize / 1024))} KB).`,
      description: `Ingested via Administrator CMS Bulk Uploader. SHA-256: ${stored.sha256}`,
      section,
      viewerType,
      classification,
      sourceOrigin: 'CMS Bulk Ingest',
      collectedAt: new Date().toISOString().slice(0, 16) + ' UTC',
      collectedBy: user.displayName,
      metadata: {
        'Original Filename': file.name,
        'MIME Type': mimeType,
        'File Size': `${stored.byteSize} bytes`,
        'SHA-256': stored.sha256.slice(0, 24) + '...',
      },
      structuredContent,
      accessRules: { locked: false },
      tags: rawTags.length > 0 ? rawTags : [section, viewerType],
      sortOrder: seq,
    });

    await db.insert(schema.evidenceAssets).values({
      id: assetId,
      caseId,
      evidenceItemId: evidenceId,
      storageKey: stored.storageKey,
      originalFilename: file.name,
      mimeType: stored.mimeType,
      byteSize: stored.byteSize,
      sha256: stored.sha256,
      caption: title,
    });

    createdItems.push({ evidenceId, evidenceCode, assetId, filename: file.name });
  }

  await recordAuditLog({
    actorUserId: user.id,
    actorRole: user.role,
    action: 'EVIDENCE_BULK_UPLOADED',
    targetType: 'case',
    targetId: caseId,
    caseId,
    details: { count: createdItems.length, files: createdItems.map((i) => i.filename) },
    ipAddress: extractRequestIp(request),
  });

  return NextResponse.json({ ok: true, created: createdItems }, { status: 201 });
}

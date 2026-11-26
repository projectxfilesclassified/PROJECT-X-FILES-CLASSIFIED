/**
 * Programmatic forensic asset generators so every seeded case contains real,
 * valid binary/renderable files stored in private object storage (PDF 1.4,
 * 16-bit PCM WAV audio, forensic SVG dossiers/blueprints/plates, CCTV JSON reels).
 */

function escapePdfText(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, ' ');
}

function wrapLines(text: string, maxChars: number): string[] {
  const result: string[] = [];
  for (const rawParagraph of text.split('\n')) {
    const trimmed = rawParagraph.trimEnd();
    if (!trimmed) {
      result.push('');
      continue;
    }
    const words = trimmed.split(' ');
    let current = '';
    for (const word of words) {
      if ((current + ' ' + word).trim().length > maxChars) {
        if (current) result.push(current.trim());
        current = word;
      } else {
        current = current ? `${current} ${word}` : word;
      }
    }
    if (current) result.push(current.trim());
  }
  return result;
}

export function generateForensicPdf(params: {
  caseNumber: string;
  evidenceCode: string;
  classification: string;
  title: string;
  subtitle: string;
  metadataLines: string[];
  pages: { heading: string; body: string }[];
}): Buffer {
  const objects: string[] = [];
  const addObj = (body: string) => {
    objects.push(body);
    return objects.length; // 1-based PDF object number
  };

  const fontRegularId = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');
  const fontBoldId = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>');

  const pageObjIds: number[] = [];

  params.pages.forEach((page, pageIdx) => {
    const cmds: string[] = [];

    // Header dark rule & classification stamp
    cmds.push('0.10 0.12 0.16 rg 40 755 532 48 re f');
    cmds.push('0.62 0.11 0.14 rg 40 752 532 3 re f');

    // Header text in light grey/white
    cmds.push('1 1 1 rg');
    cmds.push(`BT /F2 11 Tf 52 784 Td (${escapePdfText(`PROJECT X FILES // ${params.caseNumber} // ${params.evidenceCode}`)}) Tj ET`);
    cmds.push('0.85 0.65 0.30 rg');
    cmds.push(`BT /F2 9 Tf 52 766 Td (${escapePdfText(`CLASSIFICATION: ${params.classification}`)}) Tj ET`);

    // Title block
    cmds.push('0.08 0.09 0.11 rg');
    cmds.push(`BT /F2 14 Tf 40 726 Td (${escapePdfText(params.title)}) Tj ET`);
    cmds.push('0.35 0.38 0.44 rg');
    cmds.push(`BT /F1 9 Tf 40 710 Td (${escapePdfText(params.subtitle)}) Tj ET`);

    let y = 690;

    if (pageIdx === 0 && params.metadataLines.length > 0) {
      cmds.push('0.94 0.95 0.96 rg 40 ' + (y - params.metadataLines.length * 13 - 10) + ' 532 ' + (params.metadataLines.length * 13 + 14) + ' re f');
      cmds.push('0.15 0.18 0.22 rg');
      for (const mline of params.metadataLines) {
        cmds.push(`BT /F1 8.5 Tf 50 ${y - 6} Td (${escapePdfText(mline)}) Tj ET`);
        y -= 13;
      }
      y -= 20;
    }

    // Section heading
    cmds.push('0.58 0.10 0.13 rg');
    cmds.push(`BT /F2 11 Tf 40 ${y} Td (${escapePdfText(page.heading.toUpperCase())}) Tj ET`);
    y -= 6;
    cmds.push(`0.80 0.82 0.86 RG 0.5 w 40 ${y} m 572 ${y} l S`);
    y -= 18;

    // Body lines
    cmds.push('0.10 0.11 0.14 rg');
    const wrapped = wrapLines(page.body, 82);
    for (const line of wrapped) {
      if (y < 64) break;
      if (line.trim().length > 0) {
        cmds.push(`BT /F1 9.5 Tf 40 ${y} Td (${escapePdfText(line)}) Tj ET`);
      }
      y -= 13.5;
    }

    // Footer
    cmds.push('0.45 0.48 0.54 rg');
    cmds.push('0.80 0.82 0.86 RG 0.5 w 40 46 m 572 46 l S');
    cmds.push(
      `BT /F1 8 Tf 40 32 Td (${escapePdfText(
        `FORENSIC ARCHIVE COPY — CHAIN OF CUSTODY VERIFIED — PAGE ${pageIdx + 1} OF ${params.pages.length}`,
      )}) Tj ET`,
    );

    const streamStr = cmds.join('\n');
    const contentId = addObj(
      `<< /Length ${Buffer.byteLength(streamStr, 'utf8')} >>\nstream\n${streamStr}\nendstream`,
    );

    // Reserve placeholder; pages parent id will be resolved right after loop
    const pageId = addObj(`__PAGE_PLACEHOLDER__:${contentId}`);
    pageObjIds.push(pageId);
  });

  const pagesId = addObj(
    `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjIds.length} >>`,
  );

  // Patch page placeholders with actual /Parent reference
  for (const pid of pageObjIds) {
    const raw = objects[pid - 1]!;
    const contentId = Number(raw.split(':')[1]);
    objects[pid - 1] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`;
  }

  const catalogId = addObj(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  // Assemble final PDF binary with accurate byte offsets
  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'binary')];
  const offsets: number[] = [0];
  let byteOffset = chunks[0]!.length;

  objects.forEach((obj, idx) => {
    offsets.push(byteOffset);
    const serialized = `${idx + 1} 0 obj\n${obj}\nendobj\n`;
    const buf = Buffer.from(serialized, 'utf8');
    chunks.push(buf);
    byteOffset += buf.length;
  });

  const xrefOffset = byteOffset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(Buffer.from(xref + trailer, 'utf8'));

  return Buffer.concat(chunks);
}

export function generateSuspectPortraitSvg(params: {
  code: string;
  name: string;
  subtitle: string;
  accentHex: string;
  heightCm: number;
  silhouetteVariant: number;
}): Buffer {
  const variant = params.silhouetteVariant % 5;
  const hairPaths = [
    // Variant 0: structured short waves
    'M 152 145 C 150 96, 250 96, 248 145 C 245 125, 232 114, 200 114 C 168 114, 155 125, 152 145 Z',
    // Variant 1: swept-back formal
    'M 150 154 C 148 92, 252 92, 250 154 C 244 128, 224 118, 200 118 C 176 118, 156 128, 150 154 Z',
    // Variant 2: longer bob / collar length
    'M 146 218 C 142 120, 160 92, 200 92 C 240 92, 258 120, 254 218 L 240 210 C 242 150, 235 120, 200 120 C 165 120, 158 150, 160 210 Z',
    // Variant 3: receding / distinguished
    'M 155 148 C 156 108, 244 108, 245 148 C 238 130, 222 124, 200 124 C 178 124, 162 130, 155 148 Z',
    // Variant 4: peaked cap / utility coat
    'M 146 136 L 254 136 L 246 106 C 230 94, 170 94, 154 106 Z',
  ];

  const glassesSvg =
    variant === 1 || variant === 3
      ? `<g stroke="#9aa4b2" stroke-width="2" fill="rgba(16,20,28,0.45)">
           <rect x="167" y="160" width="26" height="16" rx="4"/>
           <rect x="207" y="160" width="26" height="16" rx="4"/>
           <line x1="193" y1="168" x2="207" y2="168"/>
         </g>`
      : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 480" width="400" height="480">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0f131a"/>
      <stop offset="100%" stop-color="#080a0e"/>
    </linearGradient>
    <radialGradient id="spot" cx="50%" cy="38%" r="55%">
      <stop offset="0%" stop-color="#273142" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#080a0e" stop-opacity="0"/>
    </radialGradient>
    <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="4" y2="0" stroke="#ffffff" stroke-opacity="0.03" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="400" height="480" fill="url(#bg)"/>
  <rect width="400" height="480" fill="url(#spot)"/>
  <!-- Height calibration scale -->
  <g stroke="#2a3240" stroke-width="1" opacity="0.75">
    <line x1="20" y1="80" x2="380" y2="80"/>
    <line x1="20" y1="130" x2="380" y2="130"/>
    <line x1="20" y1="180" x2="380" y2="180"/>
    <line x1="20" y1="230" x2="380" y2="230"/>
    <line x1="20" y1="280" x2="380" y2="280"/>
    <line x1="20" y1="330" x2="380" y2="330"/>
  </g>
  <g fill="#5b667a" font-family="monospace" font-size="10">
    <text x="24" y="76">${params.heightCm + 15} CM</text>
    <text x="24" y="126">${params.heightCm + 5} CM</text>
    <text x="24" y="176">${params.heightCm - 5} CM</text>
    <text x="24" y="226">${params.heightCm - 15} CM</text>
    <text x="24" y="276">${params.heightCm - 25} CM</text>
  </g>

  <!-- Shoulders & Coat -->
  <path d="M 88 410 C 96 318, 134 282, 200 282 C 266 282, 304 318, 312 410 Z" fill="#171d27" stroke="#2c3545" stroke-width="2"/>
  <path d="M 174 282 L 200 338 L 226 282 Z" fill="#0d1016"/>
  <path d="M 184 252 L 216 252 L 220 294 L 180 294 Z" fill="#2c3340"/>

  <!-- Head & Facial Structure -->
  <ellipse cx="200" cy="176" rx="46" ry="60" fill="#3a4352" stroke="#4f5b6e" stroke-width="1.5"/>
  <path d="M 156 178 C 158 214, 178 236, 200 236 C 222 236, 242 214, 244 178" fill="#313947"/>
  <!-- Eyes & Brow -->
  <line x1="170" y1="158" x2="191" y2="160" stroke="#181d25" stroke-width="3" stroke-linecap="round"/>
  <line x1="209" y1="160" x2="230" y2="158" stroke="#181d25" stroke-width="3" stroke-linecap="round"/>
  <ellipse cx="180" cy="170" rx="5" ry="3" fill="#12161d"/>
  <ellipse cx="220" cy="170" rx="5" ry="3" fill="#12161d"/>
  <!-- Nose & Mouth -->
  <path d="M 200 172 L 196 196 L 205 198" fill="none" stroke="#1f2530" stroke-width="2" stroke-linecap="round"/>
  <path d="M 186 213 Q 200 218 214 213" fill="none" stroke="#1c212b" stroke-width="2.2" stroke-linecap="round"/>
  <!-- Hair / Hat -->
  <path d="${hairPaths[variant]}" fill="#141820"/>
  ${glassesSvg}

  <!-- Forensic Overlay & Reticle -->
  <rect width="400" height="480" fill="url(#scan)"/>
  <g stroke="${params.accentHex}" stroke-width="1.5" fill="none" opacity="0.7">
    <path d="M 18 42 L 18 18 L 42 18"/>
    <path d="M 358 18 L 382 18 L 382 42"/>
    <path d="M 18 390 L 18 414 L 42 414"/>
    <path d="M 358 414 L 382 414 L 382 390"/>
  </g>

  <!-- Placard Bar -->
  <rect x="0" y="408" width="400" height="72" fill="#0b0d12" stroke-top="#262d3a"/>
  <line x1="0" y1="408" x2="400" y2="408" stroke="${params.accentHex}" stroke-width="2"/>
  <text x="22" y="434" fill="${params.accentHex}" font-family="monospace" font-size="12" font-weight="bold">${params.code} // BIOMETRIC DOSSIER</text>
  <text x="22" y="454" fill="#e8ecf2" font-family="sans-serif" font-size="16" font-weight="bold">${params.name}</text>
  <text x="22" y="470" fill="#8b96a8" font-family="monospace" font-size="10">${params.subtitle}</text>
</svg>`;
  return Buffer.from(svg, 'utf8');
}

export function generateCrimeSceneBlueprintSvg(params: {
  caseNumber: string;
  title: string;
  sceneVariant: 'estate' | 'train';
}): Buffer {
  if (params.sceneVariant === 'train') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 560" width="960" height="560">
      <rect width="960" height="560" fill="#090c11"/>
      <g stroke="#1b2330" stroke-width="1">
        ${Array.from({ length: 24 }, (_, i) => `<line x1="${i * 40}" y1="0" x2="${i * 40}" y2="560"/>`).join('')}
        ${Array.from({ length: 14 }, (_, i) => `<line x1="0" y1="${i * 40}" x2="960" y2="${i * 40}"/>`).join('')}
      </g>
      <text x="32" y="42" fill="#c88a2e" font-family="monospace" font-size="13" font-weight="bold">${params.caseNumber} // CRIME SCENE SCHEMATIC — ${params.title.toUpperCase()}</text>
      <!-- Train Car Outline -->
      <rect x="60" y="120" width="840" height="310" rx="18" fill="#10151e" stroke="#475569" stroke-width="3"/>
      <!-- Corridor -->
      <rect x="60" y="340" width="840" height="90" fill="#0d1118" stroke="#334155" stroke-width="1.5"/>
      <text x="415" y="392" fill="#64748b" font-family="monospace" font-size="13">CAR 4 SLEEPER CORRIDOR — LOCKED AT 01:15</text>
      <!-- Compartments -->
      <rect x="110" y="120" width="210" height="220" fill="#131924" stroke="#475569" stroke-width="2"/>
      <text x="145" y="155" fill="#94a3b8" font-family="monospace" font-size="12">COMPARTMENT 4A</text>
      <text x="145" y="175" fill="#64748b" font-family="monospace" font-size="10">S. KOVACS</text>

      <rect x="320" y="120" width="260" height="220" fill="#1a1216" stroke="#9e1b24" stroke-width="2.5"/>
      <text x="355" y="155" fill="#f87171" font-family="monospace" font-size="12" font-weight="bold">COMPARTMENT 4B (INCIDENT)</text>
      <text x="355" y="175" fill="#cbd5e1" font-family="monospace" font-size="10">H. LINDHOLM — DIPLOMATIC COURIER</text>
      <rect x="355" y="210" width="110" height="44" rx="4" fill="#23161b" stroke="#9e1b24" stroke-dasharray="4 3"/>
      <text x="366" y="236" fill="#fca5a5" font-family="monospace" font-size="10">FORCED BRIEFCASE</text>

      <rect x="580" y="120" width="240" height="220" fill="#131924" stroke="#475569" stroke-width="2"/>
      <text x="615" y="155" fill="#94a3b8" font-family="monospace" font-size="12">COMPARTMENT 4C</text>
      <text x="615" y="175" fill="#64748b" font-family="monospace" font-size="10">DR. H. VALE</text>

      <!-- Connecting Vent & Vestibule -->
      <rect x="556" y="185" width="48" height="26" fill="#291d12" stroke="#c88a2e" stroke-width="1.5"/>
      <text x="540" y="228" fill="#e0a548" font-family="monospace" font-size="9">SERVICE HATCH</text>

      <!-- Markers -->
      <circle cx="445" cy="285" r="14" fill="#9e1b24"/><text x="441" y="290" fill="#fff" font-family="monospace" font-size="12" font-weight="bold">A</text>
      <circle cx="580" cy="198" r="14" fill="#c88a2e"/><text x="576" y="203" fill="#090c11" font-family="monospace" font-size="12" font-weight="bold">B</text>
      <circle cx="855" cy="385" r="14" fill="#3b82a6"/><text x="851" y="390" fill="#fff" font-family="monospace" font-size="12" font-weight="bold">C</text>

      <text x="32" y="528" fill="#64748b" font-family="monospace" font-size="11">SCALE 1:50 // ALPINE TRANSIT FORENSIC UNIT // CLICK HOTSPOTS IN VIEWER FOR LINKED EXHIBITS</text>
    </svg>`;
    return Buffer.from(svg, 'utf8');
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 600" width="960" height="600">
  <defs>
    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#1a212d" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="960" height="600" fill="#090b10"/>
  <rect width="960" height="600" fill="url(#grid)"/>

  <!-- Header -->
  <rect x="0" y="0" width="960" height="54" fill="#0f131a"/>
  <line x1="0" y1="54" x2="960" y2="54" stroke="#9e1b24" stroke-width="2"/>
  <text x="28" y="33" fill="#e8ecf2" font-family="monospace" font-size="14" font-weight="bold">${params.caseNumber} // CRIME SCENE ARCHITECTURAL BLUEPRINT — ${params.title.toUpperCase()}</text>
  <text x="735" y="33" fill="#c88a2e" font-family="monospace" font-size="11">FORENSIC SCALE 1:80</text>

  <!-- Main Building Outer Walls -->
  <rect x="70" y="95" width="820" height="420" fill="#0e1219" stroke="#475569" stroke-width="3"/>

  <!-- Conservatory (Primary Crime Scene) -->
  <rect x="70" y="95" width="350" height="270" fill="#171115" stroke="#9e1b24" stroke-width="2.5"/>
  <text x="92" y="126" fill="#f87171" font-family="monospace" font-size="13" font-weight="bold">CONSERVATORY (PRIMARY SCENE)</text>
  <text x="92" y="144" fill="#94a3b8" font-family="monospace" font-size="10">LOCKED FROM INSIDE (MAIN BOLT) — SIDE RFID DOOR #04</text>

  <!-- Victim Position Outline -->
  <ellipse cx="220" cy="240" rx="54" ry="26" fill="#2d1216" stroke="#dc2626" stroke-width="1.8" stroke-dasharray="6 4"/>
  <text x="176" y="244" fill="#fca5a5" font-family="monospace" font-size="10" font-weight="bold">VICTIM POSITION</text>

  <!-- Side Table & Decanter -->
  <rect x="296" y="184" width="66" height="44" rx="4" fill="#1e2430" stroke="#c88a2e" stroke-width="1.5"/>
  <text x="303" y="210" fill="#e0a548" font-family="monospace" font-size="9">DECANTER</text>

  <!-- Shattered Glass Zone -->
  <polygon points="274,262 322,276 298,312 262,292" fill="#2e2214" stroke="#c88a2e" stroke-dasharray="3 2"/>
  <text x="260" y="328" fill="#cbd5e1" font-family="monospace" font-size="9">SHATTERED CRYSTAL</text>

  <!-- West Service Corridor -->
  <rect x="420" y="95" width="110" height="420" fill="#111620" stroke="#475569" stroke-width="2"/>
  <text x="432" y="182" fill="#94a3b8" font-family="monospace" font-size="11" transform="rotate(90 432 182)">WEST SERVICE CORRIDOR</text>

  <!-- CAM-04 Vision Cone -->
  <polygon points="475,112 428,255 522,255" fill="#3b82a6" fill-opacity="0.16" stroke="#3b82a6" stroke-dasharray="4 3"/>
  <rect x="458" y="102" width="34" height="16" rx="2" fill="#3b82a6"/>
  <text x="462" y="114" fill="#fff" font-family="monospace" font-size="9" font-weight="bold">CAM04</text>

  <!-- RFID Side Door Marker -->
  <rect x="412" y="276" width="16" height="44" fill="#c88a2e"/>
  <text x="336" y="302" fill="#e0a548" font-family="monospace" font-size="9" font-weight="bold">RFID DOOR</text>

  <!-- East Wing Library / Study -->
  <rect x="530" y="95" width="360" height="210" fill="#121721" stroke="#475569" stroke-width="2"/>
  <text x="554" y="126" fill="#cbd5e1" font-family="monospace" font-size="13" font-weight="bold">EAST WING STUDY &amp; LIBRARY</text>
  <text x="554" y="144" fill="#64748b" font-family="monospace" font-size="10">ELEANOR ASHFORD VIDEO CALL TERMINAL</text>
  <rect x="680" y="176" width="120" height="62" rx="4" fill="#1b2230" stroke="#475569"/>
  <text x="706" y="211" fill="#94a3b8" font-family="monospace" font-size="10">DESK / WI-FI AP</text>

  <!-- Drawing Room / Main Hall -->
  <rect x="530" y="305" width="360" height="210" fill="#10151e" stroke="#475569" stroke-width="2"/>
  <text x="554" y="336" fill="#cbd5e1" font-family="monospace" font-size="13" font-weight="bold">MAIN FOYER &amp; ESTATE OFFICE</text>
  <text x="554" y="354" fill="#64748b" font-family="monospace" font-size="10">LANDLINE VOICEMAIL UNIT — VICTOR THORNE MEETING 21:40</text>

  <!-- Exterior Greenhouse Grate -->
  <rect x="70" y="365" width="350" height="150" fill="#0b1116" stroke="#334155" stroke-width="2" stroke-dasharray="8 4"/>
  <text x="92" y="396" fill="#64748b" font-family="monospace" font-size="12">EXTERIOR TERRACE &amp; DRAINAGE GRATE</text>
  <rect x="132" y="438" width="84" height="32" rx="3" fill="#1b242c" stroke="#c88a2e" stroke-width="1.5"/>
  <text x="142" y="458" fill="#e0a548" font-family="monospace" font-size="9">DRAIN GRATE</text>

  <!-- Yellow Evidence Tent Badges -->
  <g font-family="monospace" font-size="11" font-weight="bold">
    <circle cx="220" cy="204" r="13" fill="#dc2626"/><text x="216" y="208" fill="#fff">1</text>
    <circle cx="330" cy="204" r="13" fill="#c88a2e"/><text x="326" y="208" fill="#090b10">2</text>
    <circle cx="420" cy="298" r="13" fill="#c88a2e"/><text x="416" y="302" fill="#090b10">3</text>
    <circle cx="475" cy="186" r="13" fill="#3b82a6"/><text x="471" y="190" fill="#fff">4</text>
    <circle cx="174" cy="454" r="13" fill="#c88a2e"/><text x="170" y="458" fill="#090b10">5</text>
    <circle cx="740" cy="206" r="13" fill="#475569"/><text x="736" y="210" fill="#fff">6</text>
  </g>

  <!-- Legend Footer -->
  <rect x="70" y="534" width="820" height="44" rx="4" fill="#10141c" stroke="#232a36"/>
  <text x="90" y="560" fill="#94a3b8" font-family="monospace" font-size="10.5">[1] Victim Body   [2] Bordeaux Decanter (EV-004)   [3] RFID Side Door (EV-013)   [4] CAM-04 Blind Spot (EV-006)   [5] Glass Ampoule (EV-005)   [6] Study Wi-Fi</text>
</svg>`;
  return Buffer.from(svg, 'utf8');
}

export function generatePhysicalEvidenceSvg(params: {
  evidenceCode: string;
  title: string;
  detailLines: string[];
  variant: 'decanter' | 'ampoule' | 'keycard';
}): Buffer {
  const artwork =
    params.variant === 'decanter'
      ? `<g transform="translate(200,80)">
          <path d="M 110 20 L 150 20 L 146 95 L 205 170 C 218 190 210 240 180 250 L 80 250 C 50 240 42 190 55 170 L 114 95 Z" fill="#231217" stroke="#c88a2e" stroke-width="2.5"/>
          <path d="M 62 195 C 90 185 170 205 198 195 L 185 244 L 75 244 Z" fill="#7f1d1d" opacity="0.8"/>
          <line x1="115" y1="120" x2="152" y2="178" stroke="#fca5a5" stroke-width="2"/>
          <line x1="145" y1="138" x2="110" y2="188" stroke="#fca5a5" stroke-width="1.5"/>
          <circle cx="130" cy="212" r="34" fill="none" stroke="#e0a548" stroke-dasharray="5 3" stroke-width="1.8"/>
          <text x="172" y="216" fill="#e0a548" font-family="monospace" font-size="11">ALKALOID RESIDUE RING</text>
        </g>`
      : params.variant === 'ampoule'
        ? `<g transform="translate(170,95)">
            <rect x="45" y="95" width="230" height="58" rx="14" fill="#131c28" stroke="#94a3b8" stroke-width="2.5"/>
            <polygon points="275,108 320,120 320,128 275,140" fill="#1e293b" stroke="#cbd5e1" stroke-width="2"/>
            <rect x="75" y="108" width="135" height="32" fill="#0f172a" stroke="#c88a2e" stroke-width="1.5"/>
            <text x="86" y="128" fill="#e0a548" font-family="monospace" font-size="11" font-weight="bold">LOT# VNC-44B // 5ML</text>
            <path d="M 278 108 L 288 140" stroke="#dc2626" stroke-width="2.5"/>
            <text x="235" y="75" fill="#f87171" font-family="monospace" font-size="11">SNAPPED NECK + TRACE LEATHER FIBER</text>
            <line x1="282" y1="84" x2="282" y2="104" stroke="#f87171" stroke-width="1.5"/>
          </g>`
        : `<g transform="translate(180,95)">
            <rect x="35" y="40" width="290" height="180" rx="12" fill="#141a24" stroke="#64748b" stroke-width="2.5"/>
            <rect x="35" y="72" width="290" height="34" fill="#090c11"/>
            <rect x="65" y="126" width="54" height="42" rx="6" fill="#c88a2e" opacity="0.85"/>
            <text x="138" y="142" fill="#e8ecf2" font-family="monospace" font-size="13" font-weight="bold">RFID-09B (CLONED)</text>
            <text x="138" y="162" fill="#94a3b8" font-family="monospace" font-size="10">NON-FACTORY UID SIGNATURE</text>
          </g>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">
  <rect width="800" height="500" fill="#0a0c10"/>
  <!-- Calibration Ruler Top -->
  <rect x="30" y="24" width="740" height="28" fill="#141821" stroke="#28303e"/>
  ${Array.from({ length: 36 }, (_, i) => `<line x1="${40 + i * 20}" y1="24" x2="${40 + i * 20}" y2="${i % 5 === 0 ? 44 : 36}" stroke="#64748b" stroke-width="1"/>`).join('')}
  <text x="42" y="70" fill="#c88a2e" font-family="monospace" font-size="12" font-weight="bold">FORENSIC LAB PLATE // ${params.evidenceCode} — ${params.title.toUpperCase()}</text>
  ${artwork}
  <!-- Evidence Lab Metadata Bar -->
  <rect x="30" y="388" width="740" height="86" rx="4" fill="#10141c" stroke="#27303f"/>
  ${params.detailLines
    .map(
      (line, idx) =>
        `<text x="48" y="${414 + idx * 20}" fill="${idx === 0 ? '#e8ecf2' : '#94a3b8'}" font-family="monospace" font-size="11">${line}</text>`,
    )
    .join('')}
</svg>`;
  return Buffer.from(svg, 'utf8');
}

/**
 * Generates a genuine 16-bit mono PCM WAV audio buffer with forensic tape ambiance,
 * timestamp alert tones, and modulated voice-band cadence pulses.
 */
export function generateForensicAudioWav(params: {
  durationSeconds: number;
  seed: number;
  beepsAtSeconds: number[];
}): Buffer {
  const sampleRate = 16000;
  const numSamples = Math.floor(sampleRate * params.durationSeconds);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // Byte rate
  buffer.writeUInt16LE(2, 32); // Block align
  buffer.writeUInt16LE(16, 34); // Bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let rng = params.seed * 2654435761;
  const nextNoise = () => {
    rng = (rng ^ (rng << 13)) >>> 0;
    rng = (rng ^ (rng >>> 17)) >>> 0;
    rng = (rng ^ (rng << 5)) >>> 0;
    return (rng / 0xffffffff) * 2 - 1;
  };

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Low subtle tape floor + mains 60Hz hum
    let sample = nextNoise() * 0.025 + Math.sin(2 * Math.PI * 60 * t) * 0.015;

    // Alert/dispatch beeps
    for (const beepSec of params.beepsAtSeconds) {
      if (t >= beepSec && t <= beepSec + 0.32) {
        const env = Math.sin(((t - beepSec) / 0.32) * Math.PI);
        sample += Math.sin(2 * Math.PI * 1046 * t) * 0.32 * env;
      }
    }

    // Speech-band cadence bursts simulating telephone/radio recording envelope
    const cadence = Math.sin(2 * Math.PI * 0.45 * t + params.seed) * Math.sin(2 * Math.PI * 2.1 * t);
    if (cadence > 0.25 && t > 1.0 && t < params.durationSeconds - 0.8) {
      const f1 = 210 + 45 * Math.sin(2 * Math.PI * 1.4 * t);
      const f2 = 430 + 60 * Math.cos(2 * Math.PI * 0.9 * t);
      sample +=
        (Math.sin(2 * Math.PI * f1 * t) * 0.12 + Math.sin(2 * Math.PI * f2 * t) * 0.06) *
        Math.min(1, cadence);
    }

    const clamped = Math.max(-0.95, Math.min(0.95, sample));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }

  return buffer;
}

export interface CctvReelPayload {
  cameraId: string;
  location: string;
  recordedDate: string;
  startClock: string;
  durationSeconds: number;
  fps: number;
  lightingMode: 'ir_night' | 'low_light_color';
  corridorLabel: string;
  tracks: {
    id: string;
    label: string;
    startSec: number;
    endSec: number;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    kind: 'person' | 'vehicle' | 'door_flash';
    alertBox?: boolean;
  }[];
  markers: {
    second: number;
    label: string;
    severity: 'normal' | 'alert' | 'critical';
    description: string;
  }[];
}

export function generateCctvReelBuffer(payload: CctvReelPayload): Buffer {
  return Buffer.from(JSON.stringify(payload, null, 2), 'utf8');
}

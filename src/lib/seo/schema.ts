import type { PublicCaseShowcase } from './catalog';

export function getSiteUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'https://projectxfiles.vercel.app';
  return configured.replace(/\/+$/, '');
}

export interface CommercialFaqItem {
  question: string;
  answer: string;
}

export const COMMERCIAL_FAQS: CommercialFaqItem[] = [
  {
    question: 'What is PROJECT X FILES — CLASSIFIED?',
    answer:
      'PROJECT X FILES — CLASSIFIED is an interactive digital murder mystery platform built around a live forensic intelligence terminal. Instead of paper folders, players investigate authentic PDF autopsy reports, CCTV recordings, 911 audio wiretaps, digital forensics spreadsheets, encrypted chats, suspect dossiers, and an interactive detective board directly in the browser.',
  },
  {
    question: 'How does the 4-hour investigation timer work?',
    answer:
      'Every case defaults to a 4-hour operational window backed by a tamper-proof server clock. The timer remains on standby after purchase and begins only when you explicitly click Begin Investigation. Your workspace, detective board, timeline, and notebook auto-save continuously to PostgreSQL so you can refresh or switch devices without losing progress.',
  },
  {
    question: 'Can we play solo, as a couple, or with a group?',
    answer:
      'Yes. Each classified case is designed for 1 to 6 investigators—ideal for solo detective sessions, immersive date nights, game nights, or remote team-building events. Desktop-first responsive layouts also work cleanly across tablets and mobile screens.',
  },
  {
    question: 'How is the Final Accusation graded without spoilers?',
    answer:
      'Confidential case solutions are stored in an isolated server-only vault and never transmitted to the browser. When you file your Final Accusation—naming the killer, motive, execution method, reconstructed timeline, and supporting exhibits—our server-side forensic scoring engine evaluates all five pillars and unlocks the declassified debrief.',
  },
  {
    question: 'Do I get instant access after purchasing a case file?',
    answer:
      'Yes. Once an entitlement is unlocked for your investigator badge, the full classified dossier, private signed evidence assets, interactive tools, and 4-hour operational terminal are available immediately in your browser with zero downloads required.',
  },
  {
    question: 'Are new murder mystery cases added regularly?',
    answer:
      'Yes. PROJECT X FILES — CLASSIFIED runs on a modular, database-driven investigation engine with a built-in Administrator CMS, allowing brand-new independently configured murder mysteries to be published seamlessly into the same forensic terminal.',
  },
];

export function buildHomeJsonLd(cases: PublicCaseShowcase[]) {
  const siteUrl = getSiteUrl();

  const productItems = cases.map((c, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    item: {
      '@type': 'Product',
      '@id': `${siteUrl}/case-files/${c.slug}#product`,
      name: `${c.title} (${c.caseNumber})`,
      description: c.summary,
      sku: c.caseNumber,
      category: 'Interactive Murder Mystery Game',
      image: `${siteUrl}/brand/og-image.png`,
      url: `${siteUrl}/case-files/${c.slug}`,
      brand: {
        '@type': 'Brand',
        name: 'PROJECT X FILES — CLASSIFIED',
      },
      offers: {
        '@type': 'Offer',
        url: `${siteUrl}/case-files/${c.slug}`,
        priceCurrency: c.currency || 'USD',
        price: (c.priceCents / 100).toFixed(2),
        availability: 'https://schema.org/InStock',
        itemCondition: 'https://schema.org/NewCondition',
      },
    },
  }));

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${siteUrl}/#organization`,
        name: 'PROJECT X FILES — CLASSIFIED',
        url: siteUrl,
        logo: {
          '@type': 'ImageObject',
          url: `${siteUrl}/brand/logo-square.png`,
          width: 1024,
          height: 1024,
        },
        sameAs: ['https://github.com/projectxfilesclassified/PROJECT-X-FILES-CLASSIFIED'],
      },
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        url: siteUrl,
        name: 'PROJECT X FILES — CLASSIFIED',
        description:
          'Interactive forensic murder mystery platform with live CCTV archives, audio intercepts, suspect databases, detective boards, and server-scored accusations.',
        publisher: { '@id': `${siteUrl}/#organization` },
        inLanguage: 'en-US',
      },
      {
        '@type': 'VideoGame',
        '@id': `${siteUrl}/#game`,
        name: 'PROJECT X FILES — CLASSIFIED',
        description:
          'Browser-based forensic criminal investigation game featuring multi-format evidence analysis, drag-and-drop detective boards, timeline reconstruction, and a 4-hour server-authoritative clock.',
        url: siteUrl,
        image: `${siteUrl}/brand/og-image.png`,
        genre: ['Mystery', 'Detective', 'Crime Investigation', 'Puzzle'],
        gamePlatform: ['Web Browser', 'Desktop', 'Tablet', 'Mobile'],
        applicationCategory: 'GameApplication',
        operatingSystem: 'Any (Web Browser)',
        playMode: ['SinglePlayer', 'CoOp'],
        publisher: { '@id': `${siteUrl}/#organization` },
      },
      {
        '@type': 'ItemList',
        '@id': `${siteUrl}/#catalog`,
        name: 'Published Murder Mystery Case Files',
        numberOfItems: productItems.length,
        itemListElement: productItems,
      },
      {
        '@type': 'FAQPage',
        '@id': `${siteUrl}/#faq`,
        mainEntity: COMMERCIAL_FAQS.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      },
    ],
  };
}

export function buildCaseProductJsonLd(c: PublicCaseShowcase) {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/case-files/${c.slug}`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'PROJECT X FILES — CLASSIFIED',
            item: siteUrl,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Classified Case Catalog',
            item: `${siteUrl}/#cases`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: c.title,
            item: pageUrl,
          },
        ],
      },
      {
        '@type': 'Product',
        '@id': `${pageUrl}#product`,
        name: `${c.title} — Digital Murder Mystery Case File`,
        description: c.summary,
        sku: c.caseNumber,
        mpn: c.caseNumber,
        category: 'Interactive Murder Mystery Game',
        image: [`${siteUrl}/brand/og-image.png`, `${siteUrl}/brand/logo-square.png`],
        url: pageUrl,
        brand: {
          '@type': 'Brand',
          name: 'PROJECT X FILES — CLASSIFIED',
        },
        additionalProperty: [
          { '@type': 'PropertyValue', name: 'Difficulty', value: c.difficulty.toUpperCase() },
          { '@type': 'PropertyValue', name: 'Evidence Exhibits', value: String(c.evidenceCount) },
          { '@type': 'PropertyValue', name: 'Suspect & Witness Profiles', value: String(c.suspectCount) },
          {
            '@type': 'PropertyValue',
            name: 'Operational Time Limit',
            value: `${Math.round(c.defaultDurationSeconds / 3600)} Hours`,
          },
        ],
        offers: {
          '@type': 'Offer',
          url: pageUrl,
          priceCurrency: c.currency || 'USD',
          price: (c.priceCents / 100).toFixed(2),
          availability: 'https://schema.org/InStock',
          itemCondition: 'https://schema.org/NewCondition',
        },
      },
    ],
  };
}

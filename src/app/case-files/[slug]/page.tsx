import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Clock,
  FileSearch,
  Users,
  Lock,
  ShieldCheck,
  MapPin,
  Calendar,
  ChevronRight,
  Cpu,
} from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { getPublishedPublicCaseBySlug } from '@/lib/seo/catalog';
import { buildCaseProductJsonLd, getSiteUrl } from '@/lib/seo/schema';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = await getPublishedPublicCaseBySlug(slug);
  if (!item) {
    return {
      title: 'Classified Case Not Found',
      robots: { index: false, follow: false },
    };
  }

  const siteUrl = getSiteUrl();
  const canonicalUrl = `${siteUrl}/case-files/${item.slug}`;
  const priceText = `$${(item.priceCents / 100).toFixed(2)} ${item.currency}`;

  return {
    title: `${item.title} (${item.caseNumber}) — Interactive Murder Mystery Case`,
    description: `${item.summary} Examine ${item.evidenceCount} forensic exhibits and ${item.suspectCount} suspect profiles under a ${Math.round(
      item.defaultDurationSeconds / 3600,
    )}-hour server clock. Instant digital access (${priceText}).`,
    keywords: [
      item.title,
      item.caseNumber,
      'interactive murder mystery game',
      'digital cold case file',
      ...(item.metadata?.tags ?? []),
    ],
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${item.title} | PROJECT X FILES — CLASSIFIED`,
      description: item.summary,
      url: canonicalUrl,
      type: 'website',
      images: [
        {
          url: '/brand/og-image.png',
          width: 1200,
          height: 630,
          alt: `${item.title} — PROJECT X FILES CLASSIFIED`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${item.title} (${item.caseNumber})`,
      description: item.summary,
      images: ['/brand/og-image.png'],
    },
  };
}

export default async function PublicCaseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = await getPublishedPublicCaseBySlug(slug);
  if (!item) notFound();

  const jsonLd = buildCaseProductJsonLd(item);
  const hours = Math.round(item.defaultDurationSeconds / 3600);

  return (
    <div className="min-h-screen flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="sticky top-0 z-30 border-b border-[#222a3a] bg-[#070a10]/88 backdrop-blur-md px-5 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="hover:opacity-90 transition">
          <BrandLogo variant="wordmark" size="sm" subtitle="CLASSIFIED CASE BRIEFING" />
        </Link>
        <div className="flex items-center gap-2.5">
          <Link
            href="/#cases"
            className="inline-flex items-center gap-1.5 rounded border border-[#2a354a] bg-[#101521]/90 hover:border-[#22d3ee]/60 px-3 py-1.5 font-mono text-xs text-[#cbd5e1] transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> ALL CASES
          </Link>
          <Link
            href="/#terminal-access"
            className="inline-flex items-center gap-1.5 rounded bg-[#9e1b24] hover:bg-[#b8202b] px-3.5 py-1.5 font-mono text-xs font-semibold text-white transition"
          >
            ENTER TERMINAL <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-5 py-10 space-y-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="font-mono text-[11px] text-[#7f8ca1] flex items-center gap-2">
          <Link href="/" className="hover:text-[#22d3ee]">
            HOME
          </Link>
          <span>/</span>
          <Link href="/#cases" className="hover:text-[#22d3ee]">
            CASE CATALOG
          </Link>
          <span>/</span>
          <span className="text-[#e3a74c]">{item.caseNumber}</span>
        </nav>

        {/* Commercial Case Hero Card */}
        <article className="cyborg-panel cyborg-panel-glow rounded-xl p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#22d3ee] via-[#dc2626] to-[#e3a74c]" />

          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
              <span className="px-2.5 py-0.5 rounded bg-[#9e1b24]/25 border border-[#dc2626]/60 text-[#fca5a5] font-semibold">
                {item.caseNumber}
              </span>
              <span className="px-2.5 py-0.5 rounded bg-[#22d3ee]/10 border border-[#22d3ee]/40 text-[#67e8f9] uppercase">
                {item.difficulty} DIFFICULTY
              </span>
              <span className="text-[#8b98ae] uppercase">{item.classification}</span>
            </div>

            <div className="font-mono text-xl font-bold text-[#e3a74c]">
              ${(item.priceCents / 100).toFixed(2)}{' '}
              <span className="text-xs font-normal text-[#8b98ae]">{item.currency}</span>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">
            {item.title}
          </h1>
          {item.subtitle && <p className="text-base text-[#22d3ee] mt-1.5">{item.subtitle}</p>}

          <p className="mt-5 text-sm sm:text-base text-[#cbd5e1] leading-relaxed">
            {item.summary}
          </p>

          <div className="mt-5 flex flex-wrap gap-5 font-mono text-xs text-[#9aa5b8]">
            {item.incidentLocation && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#22d3ee]" /> {item.incidentLocation}
              </span>
            )}
            {item.incidentDate && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#e3a74c]" /> {item.incidentDate}
              </span>
            )}
            {item.victimName && (
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#f87171]" /> Victim: {item.victimName}
              </span>
            )}
          </div>

          {/* Key Specifications Grid */}
          <div className="mt-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border border-[#243045] bg-[#0a0e16]/85 p-3.5">
              <div className="font-mono text-[10px] text-[#7f8ca1] flex items-center gap-1.5">
                <FileSearch className="w-3.5 h-3.5 text-[#22d3ee]" /> EXHIBITS
              </div>
              <div className="font-mono text-xl font-bold text-white mt-1">{item.evidenceCount}</div>
            </div>
            <div className="rounded-lg border border-[#243045] bg-[#0a0e16]/85 p-3.5">
              <div className="font-mono text-[10px] text-[#7f8ca1] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#e3a74c]" /> PROFILES
              </div>
              <div className="font-mono text-xl font-bold text-white mt-1">{item.suspectCount}</div>
            </div>
            <div className="rounded-lg border border-[#243045] bg-[#0a0e16]/85 p-3.5">
              <div className="font-mono text-[10px] text-[#7f8ca1] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#dc2626]" /> SERVER CLOCK
              </div>
              <div className="font-mono text-xl font-bold text-white mt-1">{hours} HOURS</div>
            </div>
            <div className="rounded-lg border border-[#243045] bg-[#0a0e16]/85 p-3.5">
              <div className="font-mono text-[10px] text-[#7f8ca1] flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#6ee7b7]" /> SEALED VAULTS
              </div>
              <div className="font-mono text-xl font-bold text-white mt-1">
                {item.hiddenClueCount}
              </div>
            </div>
          </div>

          {/* Archive Formats Included */}
          <div className="mt-6 pt-5 border-t border-[#222a3a] grid md:grid-cols-2 gap-4">
            <div>
              <h2 className="font-mono text-xs uppercase tracking-wider text-[#22d3ee] mb-2 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" /> INCLUDED EVIDENCE ARCHIVES
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {item.sections.map((sec) => (
                  <span
                    key={sec}
                    className="font-mono text-[10px] uppercase px-2 py-1 rounded border border-[#2a354a] bg-[#0e1420] text-[#dce2ec]"
                  >
                    {sec.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h2 className="font-mono text-xs uppercase tracking-wider text-[#e3a74c] mb-2">
                FORENSIC MEDIA FORMATS
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {item.viewerTypes.map((vt) => (
                  <span
                    key={vt}
                    className="font-mono text-[10px] uppercase px-2 py-1 rounded border border-[#c88a2e]/40 bg-[#19150f] text-[#e3a74c]"
                  >
                    {vt.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Commercial Conversion CTA */}
          <div className="mt-8 pt-6 border-t border-[#222a3a] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="font-mono text-xs text-[#6ee7b7]">
                INSTANT BROWSER ACCESS · AUTO-SAVE ENABLED · ZERO SPOILERS
              </div>
              <p className="text-xs text-[#9aa5b8] mt-1">
                Sign in or issue a free Investigator Badge to unlock and launch this dossier inside
                the forensic terminal.
              </p>
            </div>
            <Link
              href="/#terminal-access"
              className="inline-flex items-center gap-2 rounded bg-[#9e1b24] hover:bg-[#b8202b] px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white shadow-lg shadow-[#9e1b24]/30 transition shrink-0"
            >
              UNLOCK &amp; INVESTIGATE CASE <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}

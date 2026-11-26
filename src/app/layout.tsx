import type { Metadata, Viewport } from 'next';
import CyborgNeonBackground from '@/components/CyborgNeonBackground';
import './globals.css';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://projectxfiles.vercel.app');

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: 'PROJECT X FILES — CLASSIFIED',
  title: {
    default: 'PROJECT X FILES — CLASSIFIED | Interactive Forensic Murder Mystery Games',
    template: '%s | PROJECT X FILES — CLASSIFIED',
  },
  description:
    'Solve realistic interactive murder mystery cases inside a live forensic intelligence terminal. Analyze CCTV footage, autopsy reports, wiretaps, digital forensics, and detective boards under a 4-hour server clock.',
  keywords: [
    'murder mystery game online',
    'interactive detective game',
    'cold case files game',
    'forensic investigation game',
    'online criminal investigation mystery',
    'virtual escape room murder mystery',
    'date night mystery game',
    'unsolved case files digital',
    'PROJECT X FILES CLASSIFIED',
  ],
  authors: [{ name: 'PROJECT X FILES — CLASSIFIED' }],
  creator: 'PROJECT X FILES — CLASSIFIED',
  publisher: 'PROJECT X FILES — CLASSIFIED',
  category: 'games',
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/brand/logo-mark.png', type: 'image/png', sizes: '512x512' },
    ],
    shortcut: ['/favicon.ico'],
    apple: [{ url: '/brand/logo-mark.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'PROJECT X FILES — CLASSIFIED | Interactive Murder Mystery Platform',
    description:
      'Step inside a live forensic intelligence terminal. Examine classified dossiers, CCTV archives, audio intercepts, and digital forensics to solve realistic criminal cases.',
    url: SITE_URL,
    siteName: 'PROJECT X FILES — CLASSIFIED',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/brand/og-image.png',
        width: 1200,
        height: 630,
        alt: 'PROJECT X FILES — CLASSIFIED — Interactive Forensic Murder Mystery Terminal',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PROJECT X FILES — CLASSIFIED | Interactive Murder Mystery Games',
    description:
      'Examine authentic forensic evidence, interrogate suspect alibis, and crack classified murder mysteries before the 4-hour clock expires.',
    images: ['/brand/og-image.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#05070b',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="min-h-screen bg-[#05070b] text-[#e8ecf2] antialiased selection:bg-[#9e1b24]/60 selection:text-white relative overflow-x-hidden">
        <CyborgNeonBackground />
        <div className="relative z-10 min-h-screen">{children}</div>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://projectxfiles.vercel.app'),
  ),
  applicationName: 'PROJECT X FILES — CLASSIFIED',
  title: {
    default: 'PROJECT X FILES — CLASSIFIED | Forensic Investigation Terminal',
    template: '%s | PROJECT X FILES — CLASSIFIED',
  },
  description:
    'PROJECT X FILES — CLASSIFIED: Modular forensic criminal investigation dashboard and case intelligence platform.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/brand/logo-mark.png', type: 'image/png', sizes: '512x512' },
    ],
    shortcut: ['/favicon.ico'],
    apple: [{ url: '/brand/logo-mark.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'PROJECT X FILES — CLASSIFIED',
    description:
      'Forensic criminal investigation dashboard, evidence archive, and intelligence terminal.',
    siteName: 'PROJECT X FILES — CLASSIFIED',
    type: 'website',
    images: [
      {
        url: '/brand/og-image.png',
        width: 1200,
        height: 630,
        alt: 'PROJECT X FILES — CLASSIFIED',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PROJECT X FILES — CLASSIFIED',
    description:
      'Forensic criminal investigation dashboard and classified case intelligence platform.',
    images: ['/brand/og-image.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#07080b',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#07080b] text-[#e8ecf2] antialiased selection:bg-[#9e1b24]/60 selection:text-white">
        {children}
      </body>
    </html>
  );
}

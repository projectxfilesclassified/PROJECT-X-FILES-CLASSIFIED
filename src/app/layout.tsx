import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'THE CASE FILES — Forensic Investigation Intelligence Terminal',
  description:
    'Modular criminal investigation dashboard and case intelligence platform.',
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

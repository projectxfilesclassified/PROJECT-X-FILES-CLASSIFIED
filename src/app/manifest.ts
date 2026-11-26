import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PROJECT X FILES — CLASSIFIED',
    short_name: 'PROJECT X FILES',
    description:
      'Forensic criminal investigation terminal and classified case intelligence platform.',
    start_url: '/',
    display: 'standalone',
    background_color: '#07080b',
    theme_color: '#07080b',
    icons: [
      {
        src: '/brand/logo-mark.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/logo-square.png',
        sizes: '1024x1024',
        type: 'image/png',
      },
    ],
  };
}

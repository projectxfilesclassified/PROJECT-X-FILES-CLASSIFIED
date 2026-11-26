import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/seo/schema';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/case-files/', '/manifest.webmanifest', '/brand/'],
        disallow: ['/api/', '/admin', '/cases/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}

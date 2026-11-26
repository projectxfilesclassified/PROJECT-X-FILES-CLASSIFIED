import type { MetadataRoute } from 'next';
import { getPublishedPublicCases } from '@/lib/seo/catalog';
import { getSiteUrl } from '@/lib/seo/schema';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const publishedCases = await getPublishedPublicCases();

  const caseEntries: MetadataRoute.Sitemap = publishedCases.map((c) => ({
    url: `${siteUrl}/case-files/${c.slug}`,
    lastModified: new Date(c.updatedAt),
    changeFrequency: 'weekly',
    priority: 0.9,
  }));

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    ...caseEntries,
  ];
}

import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

// Public marketing surface (root, login, signup) is crawlable. Anything that
// deals with a real user session or vault content is disallowed so share URLs,
// unlock screens, and API endpoints never end up in a search index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/signup'],
        disallow: ['/api/', '/vault', '/onboard', '/unlock', '/share/'],
      },
    ],
    sitemap: `${env.APP_URL}/sitemap.xml`,
  };
}

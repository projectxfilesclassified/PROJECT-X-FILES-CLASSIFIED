import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@electric-sql/pglite', 'pg', 'pg-native'],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

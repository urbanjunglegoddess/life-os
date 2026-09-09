import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // packages/tokens ships TypeScript source rather than a build artifact — one
  // definition, no build step to fall out of date. Next has to compile it.
  transpilePackages: ['@life-os/tokens'],
  reactStrictMode: true,
};

export default nextConfig;

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Type errors must fail the build. Next's default already does this, but
  // stating it means a future `ignoreBuildErrors: true` needs a deliberate edit.
  typescript: { ignoreBuildErrors: false },
  // Next 16 removed the `eslint` config key — linting is no longer part of
  // `next build`. Biome covers it here, via `npm run lint` and `npm run ci`.
};

export default nextConfig;

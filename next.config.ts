import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack config (Next.js 16 default)
  turbopack: {},
  // Webpack config for compatibility
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize heavy dependencies to reduce bundle size
      config.externals = [...(config.externals || []), 'canvas', 'jsdom'];
    }
    return config;
  },
};

export default nextConfig;

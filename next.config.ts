import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack config (Next.js 16 default)
  turbopack: {},
  // Webpack config for compatibility (if needed)
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Handle pdf-parse on server side
      config.externals = [...(config.externals || []), 'canvas', 'jsdom'];
      // Fix for pdf-parse worker issues - disable worker
      config.resolve.alias = {
        ...config.resolve.alias,
      };
      // Ignore worker files
      config.module = config.module || {};
      config.module.rules = config.module.rules || [];
      config.module.rules.push({
        test: /pdf\.worker\.(min\.)?js/,
        type: 'asset/resource',
        generator: {
          filename: 'static/worker/[hash][ext][query]',
        },
      });
    }
    return config;
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack config (Next.js 16 default)
  turbopack: {},
  // Webpack config for compatibility
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Handle pdfjs-dist on server side - externalize canvas/jsdom to reduce bundle size
      config.externals = [...(config.externals || []), 'canvas', 'jsdom'];
      
      // Configure pdfjs-dist to work in serverless
      // Note: We import the legacy build directly in code, so no alias needed
      config.resolve.alias = {
        ...config.resolve.alias,
      };
      
      // Ignore worker files (we disable workers in code)
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

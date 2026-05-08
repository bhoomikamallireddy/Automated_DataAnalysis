import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable Turbopack for now to use stable Webpack polling
  // This is the most reliable way to stay on E: drive
  webpack: (config) => {
    config.watchOptions = {
      poll: 1000,
      aggregateTimeout: 300,
    };
    return config;
  },
  experimental: {},
};

export default nextConfig;

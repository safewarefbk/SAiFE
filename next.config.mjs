// next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output: copies only the required server files into .next/standalone
  // This produces a minimal Docker image without bundling node_modules entirely.
  output: "standalone",
  turbopack: {},
};

export default nextConfig;

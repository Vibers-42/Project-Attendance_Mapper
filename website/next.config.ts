import type { NextConfig } from "next";

const BACKEND_URL =
  process.env.BACKEND_URL ?? 'https://attendancemapper-backend.onrender.com';

const nextConfig: NextConfig = {
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${BACKEND_URL}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      '/api/generate-barcode': ['./public/fonts/**/*'],
    },
  }
};

export default nextConfig;


/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["mongoose", "node-cron"],
};

export default nextConfig;

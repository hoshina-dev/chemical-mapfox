/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@repo/api-client", "@repo/forms"],
};

export default nextConfig;

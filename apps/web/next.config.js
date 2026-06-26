/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@repo/api-client", "@repo/forms"],
  async redirects() {
    return [
      {
        // Superseded by /admin (the bold experiment listing); kept as a
        // permanent redirect so old links/bookmarks keep working.
        source: "/internal/experiment/listing",
        destination: "/admin",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

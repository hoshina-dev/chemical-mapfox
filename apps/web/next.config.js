import createNextIntlPlugin from "next-intl/plugin";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@repo/api-client", "@repo/forms"],
  async headers() {
    return [
      {
        // One click on the consent screen grants access: never allow framing.
        source: "/oauth/authorize",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        // Legacy hub URL; staff listing lives under /internal/experiment/listing.
        source: "/admin",
        destination: "/internal/experiment/listing",
        permanent: true,
      },
      {
        source: "/experiment",
        destination: "/experiment/listing",
        permanent: false,
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);

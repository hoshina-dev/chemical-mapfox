import { createRequire } from "node:module";

import createNextIntlPlugin from "next-intl/plugin";

const { version: pyodideVersion } = createRequire(import.meta.url)(
  "pyodide/package.json",
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@repo/api-client", "@repo/forms"],
  // Where the calculation worker loads Pyodide from (scripts/copy-pyodide.mjs).
  env: { NEXT_PUBLIC_PYODIDE_VERSION: pyodideVersion },
  async headers() {
    return [
      {
        // Versioned path, so a cached copy can never be stale.
        source: "/pyodide/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
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

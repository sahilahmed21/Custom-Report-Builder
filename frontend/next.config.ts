// frontend/next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // Keep or adjust based on your preference
  async headers() {
    return [
      {
        // Apply these headers to all routes except internal Next.js ones and API routes.
        // Adjust the source pattern if you have other paths that should be excluded.
        source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            // Allows popups opened by your page (same origin) to interact with it.
            // Necessary for Google Sign-In popup flow.
            value: 'same-origin-allow-popups',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            // Allows embedding cross-origin resources without requiring CORP headers.
            // Start with 'unsafe-none' for compatibility with Google Sign-In.
            // Consider 'require-corp' or 'credentialless' for higher security if compatible.
            value: 'unsafe-none',
          },
        ],
      },
    ];
  },
};

// Use module.exports if your project uses CommonJS for config
// module.exports = nextConfig;
// Use export default if your project uses ES Modules for config
export default nextConfig;
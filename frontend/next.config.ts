/** @type {import('next').NextConfig} */

// Define your backend URL - IMPORTANT: Use the actual URL, not from env var here
// as this config runs at build time on Vercel where runtime env vars might not be fully ready
// for header generation in this specific way. Hardcoding is safer for CSP headers.
const backendUrl = 'https://custom-report-builder.onrender.com';
// Define your frontend URL for websocket connections if needed (likely for Next.js dev server)
const frontendUrl = 'custom-report-builder.vercel.app'; // Just the hostname

const nextConfig = {
  reactStrictMode: true, // Or your existing config
  // Add the headers configuration
  async headers() {
    return [
      {
        source: '/(.*)', // Apply this header to all routes
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              // Base policy: allow resources from self
              "default-src 'self'",
              // Allow fonts from self and Google Fonts
              "font-src 'self' https://fonts.gstatic.com",
              // Allow images from self, data URIs, and potentially Google profile pics
              "img-src 'self' data: https://lh3.googleusercontent.com",
              // Allow scripts from self, Google Accounts, GStatic, and Google APIs
              // Added 'unsafe-inline' and 'unsafe-eval' which might be needed by some libraries (like GAPI script),
              // review if you can tighten this later.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://www.gstatic.com https://apis.google.com",
              // Allow styles from self, Google Fonts, and 'unsafe-inline' for inline styles
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // *** THIS IS THE KEY FIX ***
              // Allow connections (fetch/XHR/WebSockets) to self, the backend, Google APIs, and websockets for Next.js dev/HMR
              `connect-src 'self' ${backendUrl} https://accounts.google.com https://www.googleapis.com https://generativelanguage.googleapis.com ws://${frontendUrl} wss://${frontendUrl}`,
              // Allow framing from Google for Sign-in button
              "frame-src 'self' https://accounts.google.com",
            ].join('; '), // Join directives with a semicolon
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
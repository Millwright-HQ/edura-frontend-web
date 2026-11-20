import type { NextConfig } from 'next';

const dev = process.env.NODE_ENV !== 'production';
// Where uploaded files are served from. Files open in frames and players and are uploaded straight to it.
const storage = process.env.STORAGE_ORIGIN ?? (dev ? 'http://localhost:8333' : '');

/**
 * What a page may load. Next writes small inline scripts itself, so inline scripts are allowed;
 * everything else must come from this site or the file storage. No form-action rule on purpose:
 * connecting Zoom redirects a form to Zoom, which that rule would block.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${storage}`,
  `media-src 'self' blob: ${storage}`,
  `frame-src https://challenges.cloudflare.com ${storage || ''}`.trim(),
  `connect-src 'self' https://challenges.cloudflare.com ${storage}${dev ? ' ws: wss:' : ''}`,
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** The one page that runs Zoom needs Zoom's own scripts, media and connections; no other page gets them. */
// A wildcard does not cover the bare domain, and Zoom calls zoom.us itself, so both are listed.
const zoomHosts = 'https://zoom.us https://*.zoom.us https://zoom.com https://*.zoom.com';
const liveCsp = csp
  .replace("script-src 'self'", "script-src 'self' 'wasm-unsafe-eval' blob: " + zoomHosts)
  .replace('img-src', 'img-src ' + zoomHosts)
  .replace('media-src', 'media-src ' + zoomHosts)
  .replace('frame-src', 'frame-src ' + zoomHosts)
  .replace('connect-src', 'connect-src ' + zoomHosts + ' wss://*.zoom.us wss://*.zoom.com')
  .replace("font-src 'self' data:", "font-src 'self' data: " + zoomHosts)
  .replace("style-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline' " + zoomHosts + "; worker-src 'self' blob: " + zoomHosts);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The default bottom-left spot covers the sidebar's sign-out button.
  devIndicators: { position: 'bottom-right' },
  // Each tenant is its own origin in development, so dev tooling must accept them all.
  allowedDevOrigins: ['edura.localhost', '*.edura.localhost'],
  async headers() {
    return [
      {
        source: '/:path((?!live/).*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
        ],
      },
      {
        source: '/live/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: liveCsp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          // Lets Zoom use shared memory for HD video and gallery view.
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
        ],
      },
    ];
  },
};

export default nextConfig;

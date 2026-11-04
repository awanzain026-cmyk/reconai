/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    // Browsers probe /favicon.ico directly; serve the app icon there so the
    // console stays clean instead of logging a 404 on every page load.
    return [{ source: "/favicon.ico", destination: "/icon.svg" }]
  },
}

export default nextConfig

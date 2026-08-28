/** @type {import('next').NextConfig} */
const nextConfig = {
  // Proxy API calls to the Express backend so the frontend and backend share a
  // single origin. This lets the httpOnly, sameSite=strict refresh cookie work
  // without CORS, and fixes 404s from hitting the Next.js dev server.
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:4000";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
      {
        // Socket.IO transport upgrades share the backend origin.
        source: "/socket.io/:path*",
        destination: `${backendUrl}/socket.io/:path*`,
      },
      {
        source: "/socket.io",
        destination: `${backendUrl}/socket.io`,
      },
    ];
  },
};

export default nextConfig;

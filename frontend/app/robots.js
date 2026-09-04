import { SITE_URL } from "@/lib/seo";

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/app", // the authenticated chat app shell
          "/admin", // admin panel
          "/api", // backend API (proxied on this origin)
          "/oauth", // OAuth callback landing (tokens in query string)
          "/verify-email", // one-time email-verification tokens
          "/reset-password", // one-time password-reset tokens
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

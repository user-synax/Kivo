import { Inter, Outfit } from "next/font/google";
import {
  AUTHOR,
  defaultOgImage,
  SITE_DEFAULT_TITLE,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
} from "@/lib/seo";
import "./globals.css";

// Single instance for the root layout (inherited by every child segment that
// does not define its own og:image — verified to render correctly).
const OG_IMAGE = defaultOgImage();

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_DEFAULT_TITLE,
  description: SITE_DESCRIPTION,
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
  },
  // Google Search Console domain verification.
  verification: {
    google: "mtSQQTLUoP5DvYa7RCE6CnrEoUYfmWX0FdkkYzDO8Po",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: SITE_DEFAULT_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_US",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_DEFAULT_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

// Organization + WebSite structured data (server-rendered on every page of the
// marketing/docs tree). Founder attribution supports Google E-E-A-T for a
// brand-new, solo-built domain.
const orgJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: "en",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      slogan: SITE_TAGLINE,
      logo: `${SITE_URL}/icons/icon-512.png`,
      founder: {
        "@type": "Person",
        name: AUTHOR.name,
        url: `${SITE_URL}/author`,
        sameAs: [AUTHOR.url],
      },
    },
  ],
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#090909",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${outfit.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* JSON-LD is static, built from local constants (no user input). React
            19 renders <script> children verbatim, so no dangerouslySetInnerHTML
            is needed here. */}
          <script type="application/ld+json">{JSON.stringify(orgJsonLd)}</script>
          {children}
      </body>
    </html>
  );
}

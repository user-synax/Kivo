import { DocsScreen } from "@/components/docs/docs-screen";
import { defaultOgImage } from "@/lib/seo";

export const metadata = {
  title: "Docs — How to use Kivo",
  description:
    "What Kivo is and how to use DMs, groups, Spaces, mentions, notifications, and more. Live at kivo.usersynax.dev.",
  openGraph: {
    type: "website",
    url: "/docs",
    siteName: "Kivo",
    title: "Docs — How to use Kivo",
    description:
      "What Kivo is and how to use DMs, groups, Spaces, mentions, notifications, and more.",
    locale: "en_US",
    images: [defaultOgImage()],
  },
  twitter: {
    card: "summary_large_image",
    title: "Docs — How to use Kivo",
    description:
      "What Kivo is and how to use DMs, groups, Spaces, mentions, notifications, and more.",
    images: [defaultOgImage().url],
  },
};

export default function DocsPage() {
  return <DocsScreen />;
}

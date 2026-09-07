import { PlusScreen } from "@/components/plus/plus-screen";
import { defaultOgImage } from "@/lib/seo";

export const metadata = {
  title: "Kivo Plus — ₹49/month",
  description:
    "Get Kivo Plus for ₹49/month: custom banners, profile effects, and higher limits. Pay by UPI, activated within 24 hours.",
  openGraph: {
    type: "website",
    url: "/plus",
    siteName: "Kivo",
    title: "Kivo Plus — ₹49/month",
    description:
      "Custom banners, profile effects, and higher limits. Pay by UPI, activated within 24 hours.",
    locale: "en_US",
    images: [defaultOgImage()],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kivo Plus — ₹49/month",
    description:
      "Custom banners, profile effects, and higher limits. Pay by UPI, activated within 24 hours.",
    images: [defaultOgImage().url],
  },
};

export default function PlusPage() {
  return <PlusScreen />;
}

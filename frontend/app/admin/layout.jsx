import { Inter, Outfit } from "next/font/google";
import "../globals.css";

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
  title: "Kivo Admin",
  description: "Kivo admin panel",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${outfit.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#090909] text-white">
        {children}
      </body>
    </html>
  );
}

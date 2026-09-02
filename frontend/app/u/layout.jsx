import ThemeProvider from "@/components/theme-provider";

export const metadata = {
  title: "Kivo — Profile",
};

/**
 * Public profile layout. ThemeProvider applies CSS variables so the
 * page renders correctly, but there is NO AuthGate — unauthenticated
 * visitors can view public profiles. A "Join Kivo" modal is shown
 * inside the page component when appropriate.
 */
export default function PublicLayout({ children }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

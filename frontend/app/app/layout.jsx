import { AuthGate } from "@/components/auth-guard";
import ThemeProvider from "@/components/theme-provider";

export const metadata = {
  title: "Kivo — Chat",
};

export default function AppLayout({ children }) {
  // AuthGate keeps unauthenticated visitors out of /app (redirects to /login);
  // ThemeProvider applies the single theme object as CSS variables at the root
  // of /app. Everything below consumes colors only through those variables.
  return (
    <ThemeProvider>
      <AuthGate>{children}</AuthGate>
    </ThemeProvider>
  );
}

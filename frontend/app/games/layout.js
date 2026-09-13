import { AuthGate } from "@/components/auth-guard";
import { SocketProvider } from "@/components/socket-provider";
import ThemeProvider from "@/components/theme-provider";

export const metadata = {
  title: "Kivo — Games",
  // The games arena is an authenticated surface — never a search result.
  robots: { index: false, follow: false },
};

// /games is a top-level route, so it re-declares the same provider shell the
// chat app uses (app/app/layout.jsx). AuthGate keeps anonymous visitors out,
// ThemeProvider applies the account's theme tokens, and SocketProvider opens the
// realtime connection the arena needs for presence and live race progress.
export default function GamesLayout({ children }) {
  return (
    <ThemeProvider>
      <AuthGate>
        <SocketProvider>{children}</SocketProvider>
      </AuthGate>
    </ThemeProvider>
  );
}

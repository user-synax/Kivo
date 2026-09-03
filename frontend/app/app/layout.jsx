import { AuthGate } from "@/components/auth-guard";
import { OutboxFlusher } from "@/components/outbox/outbox-flusher";
import { PwaRegister } from "@/components/pwa-register";
import { SocketProvider } from "@/components/socket-provider";
import ThemeProvider from "@/components/theme-provider";

export const metadata = {
  title: "Kivo — Chat",
};

export default function AppLayout({ children }) {
  // AuthGate keeps unauthenticated visitors out of /app (redirects to /login);
  // ThemeProvider applies the single theme object as CSS variables at the root
  // of /app. SocketProvider opens one realtime connection for the session.
  // OutboxFlusher (invisible) retries queued offline sends when connectivity
  // returns.
  return (
    <ThemeProvider>
      <AuthGate>
        <SocketProvider>
          <OutboxFlusher />
          <PwaRegister />
          {children}
        </SocketProvider>
      </AuthGate>
    </ThemeProvider>
  );
}

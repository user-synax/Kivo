import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import AuthCard from "../../components/auth-card";
import { useAuth } from "../../components/auth-provider";
import { setSession } from "../../lib/auth";
import { apiUrl } from "../../lib/config";

// Landing route for the backend OAuth callback deep link:
//   kivo://oauth/callback?accessToken=...&refreshToken=... -> store + /(tabs)
//   kivo://oauth/callback?twoFactor=1&ticket=...           -> login verify step
//   kivo://oauth/callback?oauth_error=...                 -> show error
export default function OAuthCallback() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { setUser } = useAuth();
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Working…");

  // Deep-link params are static per navigation — run once on mount.
  // biome-ignore lint/correctness/useExhaustiveDependencies: one-shot deep link handler
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const first = (v) => (Array.isArray(v) ? v[0] : v);

      const oauthError = first(params.oauth_error);
      if (oauthError) {
        if (!cancelled) {
          setError(
            first(params.message) ||
              "Google/GitHub sign-in failed. Please try again.",
          );
          setStatus("");
        }
        return;
      }

      const twoFactor = first(params.twoFactor);
      const ticket = first(params.ticket);
      if (twoFactor && ticket) {
        if (!cancelled) setStatus("Second step needed — confirm it's you…");
        setTimeout(() => {
          if (!cancelled)
            router.replace({ pathname: "/(auth)/login", params: { ticket } });
        }, 700);
        return;
      }

      const accessToken = first(params.accessToken);
      if (accessToken) {
        if (!cancelled) setStatus("Signed in! Loading your chats…");
        try {
          const refreshToken = first(params.refreshToken) || undefined;
          // Fetch the profile with the fresh token (memory token is empty
          // here), mirroring the web /oauth/callback page.
          const res = await fetch(apiUrl("/api/v1/users/me"), {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!res.ok) throw new Error("Could not load profile");
          const json = await res.json();
          const me = json?.data;
          await setSession(me, accessToken, refreshToken);
          if (!cancelled) {
            setUser(me || null);
            router.replace("/(tabs)");
          }
        } catch {
          if (!cancelled) {
            setError(
              "Signed in, but couldn't load your profile. Please log in again.",
            );
            setStatus("");
          }
        }
        return;
      }

      if (!cancelled) {
        setError("Nothing to finish here. Please try signing in again.");
        setStatus("");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthCard>
      <View className="flex-col items-center gap-4 py-6">
        {!error ? (
          <>
            <ActivityIndicator size="large" color="#4ba9e1" />
            <Text className="text-center text-sm text-muted">{status}</Text>
          </>
        ) : (
          <>
            <View className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2.5">
              <Text className="text-[13px] text-red-400">{error}</Text>
            </View>
            <Link
              href="/(auth)/login"
              className="text-sm font-medium text-accent"
            >
              Back to log in
            </Link>
          </>
        )}
      </View>
    </AuthCard>
  );
}

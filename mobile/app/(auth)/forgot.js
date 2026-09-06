import { Link } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import AuthCard from "../../components/auth-card";
import AuthInput from "../../components/auth-input";
import { apiPost } from "../../lib/api";

export default function Forgot() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit() {
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiPost("/api/v1/auth/forgot-password", {
        email: email.trim().toLowerCase(),
      });
      setSent(true);
    } catch (e) {
      setError(e?.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard>
      <View className="flex-col gap-5">
        <View className="flex-col gap-1.5">
          <Text className="text-xs font-medium uppercase tracking-widest text-muted">
            Recovery
          </Text>
          <Text className="text-[28px] font-semibold leading-tight tracking-tight text-white">
            Reset password
          </Text>
          <Text className="text-sm leading-relaxed text-muted">
            {sent
              ? "Check your inbox for the reset link, then open it to choose a new password."
              : "Enter your account email and we'll send you a reset link."}
          </Text>
        </View>

        {sent ? (
          <View className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2.5">
            <Text className="text-[13px] text-white">
              If an account exists for {email.trim()}, a reset link is on its
              way.
            </Text>
          </View>
        ) : (
          <>
            {error ? (
              <View className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2.5">
                <Text className="text-[13px] text-red-400">{error}</Text>
              </View>
            ) : null}
            <AuthInput
              label="Email"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                if (error) setError("");
              }}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <Pressable
              onPress={onSubmit}
              disabled={busy}
              className="items-center rounded-full bg-white px-6 py-3.5 active:opacity-90 disabled:opacity-60"
            >
              {busy ? (
                <ActivityIndicator color="#090909" />
              ) : (
                <Text className="text-[15px] font-medium text-black">
                  Send reset link
                </Text>
              )}
            </Pressable>
          </>
        )}

        <Text className="text-center text-sm text-muted">
          <Link href="/(auth)/login" className="font-medium text-accent">
            ← Back to log in
          </Link>
        </Text>
      </View>
    </AuthCard>
  );
}

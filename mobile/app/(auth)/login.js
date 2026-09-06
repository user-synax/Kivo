import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import AuthCard from "../../components/auth-card";
import AuthInput from "../../components/auth-input";
import { useAuth } from "../../components/auth-provider";
import OAuthButtons from "../../components/oauth-buttons";
import { apiPost } from "../../lib/api";
import { setSession } from "../../lib/auth";
import { API_URL } from "../../lib/config";
import { oauthProviders, startOAuth } from "../../lib/oauth";

function validateCredentials({ identifier, password }) {
  const errors = {};
  if (!identifier.trim()) errors.identifier = "Email or username is required.";
  if (!password) errors.password = "Password is required.";
  return errors;
}

export default function Login() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { setUser } = useAuth();
  // Two-step flow like web: credentials first, TOTP/backup code if 2FA is on
  // (ticket comes from password login or from the OAuth callback route).
  const [step, setStep] = useState("credentials");
  const [ticket, setTicket] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState({ google: true, github: true });

  useEffect(() => {
    oauthProviders().then(setProviders);
  }, []);

  useEffect(() => {
    if (typeof params.ticket === "string" && params.ticket) {
      setTicket(params.ticket);
      setStep("verify");
    }
    if (typeof params.oauth_error === "string" && params.oauth_error) {
      setServerError("Google/GitHub sign-in failed. Please try again.");
    }
  }, [params.ticket, params.oauth_error]);

  function clearFieldError(name) {
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    if (serverError) setServerError("");
  }

  async function finishSession(data) {
    await setSession(data.user, data.accessToken, data.refreshToken);
    setUser(data.user || null);
    router.replace("/(tabs)");
  }

  async function onSubmit() {
    if (step === "verify") {
      if (!code.trim()) {
        setErrors({ code: "Authentication code is required." });
        return;
      }
      setBusy(true);
      setServerError("");
      try {
        const data = await apiPost("/api/v1/auth/login/2fa", {
          ticket,
          code: code.trim(),
        });
        await finishSession(data);
      } catch (e) {
        if (e?.code === "TWO_FACTOR_TICKET_EXPIRED") {
          setServerError(
            "That verification session expired — please log in again.",
          );
          setStep("credentials");
          setTicket("");
          setCode("");
        } else {
          setServerError(e?.message || "Invalid code. Please try again.");
        }
      } finally {
        setBusy(false);
      }
      return;
    }

    const fieldErrors = validateCredentials({ identifier, password });
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setBusy(true);
    setServerError("");
    try {
      const data = await apiPost("/api/v1/auth/login", {
        identifier: identifier.trim(),
        password,
      });
      if (data?.twoFactorRequired) {
        setTicket(data.ticket);
        setStep("verify");
        setErrors({});
        return;
      }
      await finishSession(data);
    } catch (e) {
      setServerError(e?.message || "Invalid credentials. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard scrollable>
      <View className="flex-col gap-5">
        <View className="flex-col gap-1.5">
          <Text className="text-xs font-medium uppercase tracking-widest text-muted">
            {step === "verify" ? "Two-factor authentication" : "Welcome"}
          </Text>
          <Text className="text-[28px] font-semibold leading-tight tracking-tight text-white">
            {step === "verify" ? "Confirm it's you" : "Log in to Kivo"}
          </Text>
          <Text className="text-sm leading-relaxed text-muted">
            {step === "verify"
              ? "Enter the 6-digit code from your authenticator app, or one of your backup codes."
              : "Pick up where your conversations left off."}
          </Text>
        </View>

        {serverError ? (
          <View className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2.5">
            <Text className="text-[13px] text-red-400">{serverError}</Text>
          </View>
        ) : null}

        {step === "credentials" ? (
          <>
            <OAuthButtons
              mode="login"
              onStart={startOAuth}
              providers={providers}
            />
            <AuthInput
              label="Email or Username"
              value={identifier}
              onChangeText={(v) => {
                setIdentifier(v);
                clearFieldError("identifier");
              }}
              error={errors.identifier}
              autoCapitalize="none"
              autoComplete="username"
            />
            <AuthInput
              label="Password"
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                clearFieldError("password");
              }}
              error={errors.password}
              secureTextEntry
              autoComplete="current-password"
            />
            <View className="flex-row justify-end">
              <Link
                href="/(auth)/forgot"
                className="text-[13px] font-medium text-accent"
              >
                Forgot password?
              </Link>
            </View>
          </>
        ) : (
          <View className="flex-col gap-3">
            <AuthInput
              label="Authentication code"
              value={code}
              onChangeText={(v) => {
                setCode(v);
                clearFieldError("code");
              }}
              error={errors.code}
              placeholder="123456 or ABCDE-FGHIJ"
              autoCapitalize="none"
              autoComplete="one-time-code"
            />
            <Pressable
              onPress={() => {
                setStep("credentials");
                setTicket("");
                setCode("");
                setErrors({});
                setServerError("");
              }}
            >
              <Text className="text-[13px] font-medium text-accent">
                ← Back to log in
              </Text>
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={onSubmit}
          disabled={busy}
          className="items-center rounded-full bg-white px-6 py-3.5 active:opacity-90 disabled:opacity-60"
        >
          {busy ? (
            <ActivityIndicator color="#090909" />
          ) : (
            <Text className="text-[15px] font-medium text-black">
              {step === "verify" ? "Verify Code" : "Log In"}
            </Text>
          )}
        </Pressable>

        {step === "credentials" ? (
          <Text className="text-center text-sm text-muted">
            Don&apos;t have an account?{" "}
            <Link href="/(auth)/signup" className="font-medium text-accent">
              Sign up
            </Link>
          </Text>
        ) : null}

        <Text className="text-center text-[11px] text-muted opacity-70">
          Server: {API_URL}
        </Text>
      </View>
    </AuthCard>
  );
}

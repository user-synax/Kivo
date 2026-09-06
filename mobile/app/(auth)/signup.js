import { Link, useRouter } from "expo-router";
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

function validate({ displayName, username, email, password, confirmPassword }) {
  const errors = {};
  if (!displayName.trim()) errors.displayName = "Display name is required.";
  if (!username.trim()) errors.username = "Username is required.";
  if (!email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Please enter a valid email address.";
  }
  if (!password) {
    errors.password = "Password is required.";
  } else if (password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }
  if (!confirmPassword) {
    errors.confirmPassword = "Please confirm your password.";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }
  return errors;
}

export default function Signup() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState({ google: true, github: true });

  useEffect(() => {
    oauthProviders().then(setProviders);
  }, []);

  function bind(setter, name) {
    return (v) => {
      setter(v);
      setErrors((prev) => {
        if (!prev[name]) return prev;
        const next = { ...prev };
        delete next[name];
        return next;
      });
      if (serverError) setServerError("");
    };
  }

  async function onSubmit() {
    const fieldErrors = validate({
      displayName,
      username,
      email,
      password,
      confirmPassword,
    });
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setBusy(true);
    setServerError("");
    try {
      const data = await apiPost("/api/v1/auth/register", {
        displayName: displayName.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        password,
      });
      await setSession(data.user, data.accessToken, data.refreshToken);
      setUser(data.user || null);
      router.replace("/(tabs)");
    } catch (e) {
      setServerError(e?.message || "Sign-up failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard scrollable>
      <View className="flex-col gap-5">
        <View className="flex-col gap-1.5">
          <Text className="text-xs font-medium uppercase tracking-widest text-muted">
            Welcome
          </Text>
          <Text className="text-[28px] font-semibold leading-tight tracking-tight text-white">
            Create your account
          </Text>
          <Text className="text-sm leading-relaxed text-muted">
            One identity for DMs, groups, and Spaces.
          </Text>
        </View>

        {serverError ? (
          <View className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2.5">
            <Text className="text-[13px] text-red-400">{serverError}</Text>
          </View>
        ) : null}

        <OAuthButtons
          mode="signup"
          onStart={startOAuth}
          providers={providers}
        />

        <AuthInput
          label="Display name"
          value={displayName}
          onChangeText={bind(setDisplayName, "displayName")}
          error={errors.displayName}
          placeholder="Ayush"
          autoComplete="name"
        />
        <AuthInput
          label="Username"
          value={username}
          onChangeText={bind(setUsername, "username")}
          error={errors.username}
          placeholder="ayush"
          autoCapitalize="none"
          autoComplete="username"
        />
        <AuthInput
          label="Email"
          value={email}
          onChangeText={bind(setEmail, "email")}
          error={errors.email}
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <AuthInput
          label="Password"
          value={password}
          onChangeText={bind(setPassword, "password")}
          error={errors.password}
          secureTextEntry
          autoComplete="new-password"
        />
        <AuthInput
          label="Confirm password"
          value={confirmPassword}
          onChangeText={bind(setConfirmPassword, "confirmPassword")}
          error={errors.confirmPassword}
          secureTextEntry
          autoComplete="new-password"
        />

        <Pressable
          onPress={onSubmit}
          disabled={busy}
          className="items-center rounded-full bg-white px-6 py-3.5 active:opacity-90 disabled:opacity-60"
        >
          {busy ? (
            <ActivityIndicator color="#090909" />
          ) : (
            <Text className="text-[15px] font-medium text-black">Sign Up</Text>
          )}
        </Pressable>

        <Text className="text-center text-sm text-muted">
          Have an account?{" "}
          <Link href="/(auth)/login" className="font-medium text-accent">
            Log in
          </Link>
        </Text>

        <Text className="text-center text-[11px] text-muted opacity-70">
          Server: {API_URL}
        </Text>
      </View>
    </AuthCard>
  );
}

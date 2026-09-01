"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check if already logged in via backend verify endpoint
  useEffect(() => {
    let active = true;
    fetch("/api/admin/verify", { credentials: "include" })
      .then((res) => {
        if (active && res.ok) router.replace("/admin/dashboard");
        else if (active) setChecking(false);
      })
      .catch(() => {
        if (active) setChecking(false);
      });
    return () => { active = false; };
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json?.error?.message || "Login failed");
        return;
      }

      // The cookie is set by the server; redirect to dashboard
      router.replace("/admin/dashboard");
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[#090909]">
        <div className="size-6 animate-spin rounded-full border-2 border-[#262626] border-t-[#4ba9e1]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#090909] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
            Kivo Admin
          </h1>
          <p className="mt-2 text-sm text-[#999]">
            Sign in to the admin panel
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="admin-email"
              className="mb-1.5 block text-[13px] font-medium text-[#999]"
            >
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full rounded-xl border border-[#262626] bg-[#141414] px-3.5 py-2.5 text-sm text-white placeholder:text-[#666] focus:border-[#4ba9e1] focus:outline-none"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="mb-1.5 block text-[13px] font-medium text-[#999]"
            >
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-[#262626] bg-[#141414] px-3.5 py-2.5 text-sm text-white placeholder:text-[#666] focus:border-[#4ba9e1] focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-[#ff5577]/10 px-3 py-2 text-[13px] text-[#ff5577]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Sign in"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

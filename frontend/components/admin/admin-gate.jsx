"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Wrap the authenticated admin dashboard. On mount, calls GET /api/admin/verify
 * which checks the httpOnly admin_token cookie server-side. If the cookie is
 * missing/invalid, redirects to /admin (login page). Completely independent
 * of AuthGate / SocketProvider used by the regular app.
 */
export function AdminGate({ children }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/verify", { credentials: "include" })
      .then((res) => {
        if (!active) return;
        if (res.ok) {
          setReady(true);
        } else {
          router.replace("/admin");
        }
      })
      .catch(() => {
        if (active) router.replace("/admin");
      });
    return () => {
      active = false;
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[#090909]">
        <div className="size-6 animate-spin rounded-full border-2 border-[#262626] border-t-[#4ba9e1]" />
      </div>
    );
  }

  return children;
}

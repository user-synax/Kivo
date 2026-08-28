"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { getSession } from "@/lib/auth";
import { ChatPanel } from "./chat-panel";
import { Sidebar } from "./sidebar";

// Restrained easing — matches the rest of the app (no bounce).
const EASE = [0.22, 1, 0.36, 1];
const COLLAPSE_KEY = "kivo:sidebar-collapsed";
const MOBILE_QUERY = "(min-width: 768px)";

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

export function DashboardShell() {
  const isDesktop = useIsDesktop();
  const reduce = useReducedMotion();
  const [selectedId, setSelectedId] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  // Persist collapse state (desktop only) across reloads.
  useEffect(() => {
    const saved = localStorage.getItem(COLLAPSE_KEY);
    if (saved !== null) setCollapsed(saved === "1");
  }, []);
  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const currentUser = getSession();
  const selected = null; // conversation list is empty until backend wiring
  const slide = reduce ? { duration: 0 } : { duration: 0.28, ease: EASE };

  // Mobile: stack navigation. List is the default full-screen view; selecting a
  // conversation pushes a full-screen chat view in (and pops back out).
  if (!isDesktop) {
    return (
      <div className="relative h-[100dvh] overflow-hidden bg-[var(--bg-base)]">
        <AnimatePresence initial={false}>
          {selected ? (
            <motion.div
              key="chat"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={slide}
              className="absolute inset-0 bg-[var(--bg-base)]"
            >
              <ChatPanel
                conversation={selected}
                onBack={() => setSelectedId(null)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ x: 0 }}
              animate={{ x: 0 }}
              exit={{ x: "-28%" }}
              transition={slide}
              className="absolute inset-0 bg-[var(--bg-base)]"
            >
              <Sidebar
                conversations={[]}
                selectedId={selectedId}
                onSelect={setSelectedId}
                collapsed={false}
                showToggle={false}
                currentUser={currentUser}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Desktop: sidebar + chat side by side. Sidebar animates its width on toggle.
  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[var(--bg-base)]">
      <motion.div
        animate={{ width: collapsed ? 76 : 320 }}
        transition={reduce ? { duration: 0 } : { duration: 0.28, ease: EASE }}
        className="h-full shrink-0 overflow-hidden border-r border-[var(--border)] bg-[var(--bg-elevated)]"
      >
        <Sidebar
          conversations={[]}
          selectedId={selectedId}
          onSelect={setSelectedId}
          collapsed={collapsed}
          showToggle
          onToggle={() => setCollapsed((v) => !v)}
          currentUser={currentUser}
        />
      </motion.div>

      <div className="flex h-full min-w-0 flex-1 flex-col">
        <ChatPanel conversation={selected} />
      </div>
    </div>
  );
}

export default DashboardShell;

"use client";

import { Check, Copy, Languages, Sparkles, Wand2, X } from "lucide-react";
import { useState } from "react";
import { StreamingText } from "@/components/ui/streaming-text";
import { ThinkingIndicator } from "@/components/ui/thinking-indicator";
import {
  onDeviceCaps,
  proofreadText,
  rewriteText,
  suggestReplies,
  translateText,
} from "@/lib/ai";
import { copyText } from "@/lib/clipboard";

const TONES = [
  { id: "fix", label: "Fix grammar" },
  { id: "friendly", label: "Friendly" },
  { id: "formal", label: "Formal" },
  { id: "shorter", label: "Shorter" },
  { id: "longer", label: "Longer" },
  { id: "confident", label: "Confident" },
];

const THINK_WORDS = {
  fix: ["Checking grammar…", "Polishing…"],
  friendly: ["Warming it up…", "Rewriting…"],
  formal: ["Making it formal…", "Rewriting…"],
  shorter: ["Shortening…", "Trimming…"],
  longer: ["Expanding…", "Rewriting…"],
  confident: ["Sharpening…", "Rewriting…"],
  translate: ["Detecting language…", "Translating…"],
  replies: ["Reading chat…", "Drafting replies…"],
};

// Composer AI panel: actions operate on the current draft `text`.
// Result preview streams via <StreamingText>; <ThinkingIndicator> shows
// while generating. Insert writes back via onInsert (chat input), never sends.
export function AiAssist({
  text = "",
  contextMessages = [],
  onInsert,
  onClose,
}) {
  const [busy, setBusy] = useState(null);
  const [result, setResult] = useState("");
  const [meta, setMeta] = useState(null);
  const [replies, setReplies] = useState([]);
  const [error, setError] = useState(null);
  const [targetLang, setTargetLang] = useState("en");
  const [copied, setCopied] = useState(false);
  const caps = onDeviceCaps();
  const draft = String(text || "").trim();

  const run = async (action, fn) => {
    setBusy(action);
    setError(null);
    setResult("");
    setReplies([]);
    setMeta(null);
    try {
      const out = await fn();
      if (out?.replies?.length) {
        setReplies(out.replies);
        setMeta({ source: out.source });
      } else {
        setResult(out?.text || "");
        setMeta({
          source: out?.source,
          quota: out?.quota,
          cached: out?.cached,
        });
      }
    } catch (e) {
      const code = e?.code || e?.data?.code;
      if (code === "AI_NOT_CONFIGURED")
        setError("AI isn't configured yet — add GROQ_API_KEY on the server.");
      else if (code === "AI_DAILY_LIMIT" || e?.status === 429)
        setError(e?.message || "Daily AI limit reached. Try again tomorrow.");
      else setError(e?.message || "AI failed. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const needDraft = !draft && busy !== "replies";
  const canDraftAction = Boolean(draft) && !busy;

  return (
    <div
      role="dialog"
      aria-label="AI writing assist"
      className="w-[320px] max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 shadow-xl"
    >
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[var(--accent)]" aria-hidden />
        <p className="flex-1 text-[13px] font-semibold text-[var(--text-primary)]">
          AI assist
        </p>
        <span
          title={
            caps.available
              ? "On-device AI available — private + unlimited"
              : "Cloud fallback (Groq → Gemini)"
          }
          className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]"
        >
          {caps.available ? "on-device" : "cloud"}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close AI assist"
          className="flex size-7 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!draft && (
        <p className="mb-2 rounded-lg bg-[var(--bg-surface)] px-2.5 py-2 text-[12px] leading-snug text-[var(--text-muted)]">
          Type a message first — or use Replies from recent chat.
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {TONES.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={!canDraftAction}
            onClick={() =>
              run(t.id, () =>
                t.id === "fix"
                  ? proofreadText(draft)
                  : rewriteText(draft, t.id),
              )
            }
            className="rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1 text-[12px] text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)] disabled:opacity-40"
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <Languages
          className="h-4 w-4 shrink-0 text-[var(--text-muted)]"
          aria-hidden
        />
        <input
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value.slice(0, 12))}
          placeholder="en"
          aria-label="Target language code"
          className="w-16 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[12px] text-[var(--text-primary)] focus:outline-none"
        />
        <button
          type="button"
          disabled={!canDraftAction}
          onClick={() =>
            run("translate", () =>
              translateText(draft, targetLang.trim() || "en"),
            )
          }
          className="rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1 text-[12px] text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)] disabled:opacity-40"
        >
          Translate
        </button>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() =>
            run("replies", () =>
              suggestReplies(
                contextMessages.length ? contextMessages : [draft],
              ),
            )
          }
          className="rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1 text-[12px] text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)] disabled:opacity-40"
        >
          Replies
        </button>
      </div>

      {needDraft && !busy && !result && !replies.length && !error ? null : null}

      <div className="mt-2 min-h-[28px]">
        {busy && (
          <ThinkingIndicator
            words={THINK_WORDS[busy] || ["Thinking…"]}
            className="text-[12px]"
          />
        )}
        {!busy && error && (
          <p className="text-[12px] text-[var(--destructive)]">{error}</p>
        )}
        {!busy && !error && replies.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {replies.map((r, i) => (
              <button
                key={`${i}-${r.slice(0, 20)}`}
                type="button"
                onClick={() => {
                  onInsert?.(r);
                  onClose?.();
                }}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-left text-[13px] text-[var(--text-primary)] hover:border-[var(--accent)]"
              >
                {r}
              </button>
            ))}
            {meta?.source && (
              <span className="text-[10px] text-[var(--text-muted)]">
                via {meta.source}
              </span>
            )}
          </div>
        )}
        {!busy && !error && !replies.length && result && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2.5">
            <StreamingText
              text={result}
              speed={40}
              className="text-[13px] leading-snug"
            />
            <div className="mt-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onInsert?.(result);
                  onClose?.();
                }}
                className="flex items-center gap-1 rounded-full bg-[var(--accent)] px-3 py-1 text-[12px] font-medium text-white hover:brightness-110"
              >
                <Check className="h-3.5 w-3.5" /> Insert
              </button>
              <button
                type="button"
                onClick={async () => {
                  await copyText(result);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1200);
                }}
                className="flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1 text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setResult("");
                  setMeta(null);
                }}
                className="rounded-full px-2.5 py-1 text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                Discard
              </button>
            </div>
            {meta?.source && (
              <p className="mt-1.5 text-[10px] text-[var(--text-muted)]">
                via {meta.source}
                {meta?.quota
                  ? ` · ${meta.quota.remaining}/${meta.quota.limit} left today`
                  : ""}
              </p>
            )}
          </div>
        )}
        {!busy && !error && !result && !replies.length && (
          <p className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
            <Wand2 className="h-3.5 w-3.5" aria-hidden /> Pick an action —
            result previews here, nothing sends automatically.
          </p>
        )}
      </div>
    </div>
  );
}

export default AiAssist;

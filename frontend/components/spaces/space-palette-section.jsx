"use client";

import { Check, Loader2, Palette } from "lucide-react";
import { useEffect, useState } from "react";
import {
  BubbleStylePicker,
  WallpaperPicker,
} from "@/components/dashboard/chat-style-picker";
import { ColorDot, ColorInput } from "@/components/dashboard/settings-panel";
import { useTheme } from "@/components/theme-provider";
import { apiPatch } from "@/lib/api";
import { wallpaperCss } from "@/lib/chat-style";
import {
  ACCENT_PRESETS,
  cssVarsForColors,
  derivePalette,
  TINT_PRESETS,
} from "@/lib/theme";

// Per-Space look editor. Owners/admins pick an accent + canvas tint, a chat
// wallpaper, and a bubble style that members' clients layer on top of their
// own theme while viewing this Space's channels (chat-panel scopes the tokens
// to the open channel view). The same derivePalette engine drives it, so
// contrast is preserved exactly like the personal theme studio in Settings.
// Wallpaper/bubbleStyle use null = "each member's own" (inherit), mirroring
// how null accent/tint keep the member's own colors.
export function SpacePaletteSection({ space, onUpdated, canEdit }) {
  const { colors: baseColors } = useTheme();
  const saved = space?.appearance || null;

  const [accent, setAccent] = useState(saved?.accent || null);
  const [tint, setTint] = useState(saved?.tint || null);
  const [wallpaper, setWallpaper] = useState(saved?.wallpaper || null);
  const [bubbleStyle, setBubbleStyle] = useState(saved?.bubbleStyle || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setAccent(space?.appearance?.accent || null);
    setTint(space?.appearance?.tint || null);
    setWallpaper(space?.appearance?.wallpaper || null);
    setBubbleStyle(space?.appearance?.bubbleStyle || null);
    setError(null);
  }, [space]);

  const hasChanges =
    (accent?.toLowerCase() || null) !==
      (saved?.accent?.toLowerCase() || null) ||
    (tint?.toLowerCase() || null) !== (saved?.tint?.toLowerCase() || null) ||
    (wallpaper || null) !== (saved?.wallpaper || null) ||
    (bubbleStyle || null) !== (saved?.bubbleStyle || null);
  const hasLook = Boolean(
    saved?.accent ||
      saved?.tint ||
      saved?.wallpaper ||
      saved?.bubbleStyle,
  );

  // Live preview: layer the draft palette on the member's current colors and
  // paint the draft wallpaper / bubble style onto the mini chat mock.
  const colorVars =
    accent || tint
      ? cssVarsForColors(derivePalette(baseColors, { accent, tint }))
      : null;
  const previewWallCss = wallpaperCss(wallpaper || "none");
  const sentBubbleStyle =
    bubbleStyle === "outline"
      ? {
          background: "transparent",
          border: "1.5px solid var(--accent)",
          color: "var(--accent)",
        }
      : {
          background: "var(--bubble-sent)",
          color: "var(--bubble-sent-fg)",
        };
  const miniRadius = bubbleStyle === "squared" ? 4 : bubbleStyle === "rounded" ? 10 : 9;

  const save = async (values) => {
    if (!canEdit) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiPatch(`/api/v1/spaces/${space.id}`, {
        appearance: values,
      });
      onUpdated?.(updated);
    } catch (e) {
      setError(e?.message || "Could not save look");
    } finally {
      setBusy(false);
    }
  };

  const saveLook = () =>
    save({ accent, tint, wallpaper: wallpaper || null, bubbleStyle: bubbleStyle || null });
  const resetLook = () => {
    setAccent(null);
    setTint(null);
    setWallpaper(null);
    setBubbleStyle(null);
    save({
      accent: null,
      tint: null,
      wallpaper: null,
      bubbleStyle: null,
    });
  };

  const accentSelected = (hex) =>
    Boolean(accent) && accent.toLowerCase() === hex.toLowerCase();
  const tintSelected = (hex) =>
    Boolean(tint) && tint.toLowerCase() === hex.toLowerCase();

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-elevated)] text-[var(--text-muted)]">
          <Palette className="h-4 w-4" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">
            Space look
          </h3>
          <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-muted)]">
            Give this Space its own accent, canvas tone, chat wallpaper, and
            bubble style. Members see these layered on their theme while
            viewing its channels.
          </p>
        </div>
      </div>

      {canEdit ? (
        <>
          <div className="mt-4">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <p className="text-[12px] font-medium text-[var(--text-primary)]">
                Accent
              </p>
              <p className="text-[10px] text-[var(--text-muted)]">
                links · buttons · badges
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <ColorDot
                color={null}
                label="No custom accent — members keep their own"
                selected={!accent}
                onClick={() => setAccent(null)}
              />
              {ACCENT_PRESETS.map((hex) => (
                <ColorDot
                  key={hex}
                  color={hex}
                  label={`Accent ${hex}`}
                  selected={accentSelected(hex)}
                  onClick={() => setAccent(hex)}
                />
              ))}
              <ColorInput
                value={accent || "#4ba9e1"}
                label="Pick a custom accent color"
                badge={!accent}
                onChange={setAccent}
              />
            </div>
          </div>

          <div className="mt-3">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <p className="text-[12px] font-medium text-[var(--text-primary)]">
                Canvas tone
              </p>
              <p className="text-[10px] text-[var(--text-muted)]">
                washes surfaces · keeps contrast
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {TINT_PRESETS.map((p) =>
                p.hex ? (
                  <ColorDot
                    key={p.hex}
                    color={p.hex}
                    label={`Canvas tint ${p.label}`}
                    selected={tintSelected(p.hex)}
                    onClick={() => setTint(p.hex)}
                  />
                ) : (
                  <ColorDot
                    key="neutral"
                    color={null}
                    label="Neutral canvas — keep the members' own theme colors"
                    selected={!tint}
                    onClick={() => setTint(null)}
                  />
                ),
              )}
              <ColorInput
                value={tint || "#f43f5e"}
                label="Pick a custom canvas tint"
                badge={!tint}
                onChange={setTint}
              />
            </div>
          </div>

          <div className="mt-3">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <p className="text-[12px] font-medium text-[var(--text-primary)]">
                Chat wallpaper
              </p>
              <p className="text-[10px] text-[var(--text-muted)]">
                pattern behind messages
              </p>
            </div>
            <WallpaperPicker
              value={wallpaper}
              onChange={setWallpaper}
              allowInherit
            />
          </div>

          <div className="mt-3">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <p className="text-[12px] font-medium text-[var(--text-primary)]">
                Bubble style
              </p>
              <p className="text-[10px] text-[var(--text-muted)]">
                shape of message bubbles
              </p>
            </div>
            <BubbleStylePicker
              value={bubbleStyle}
              onChange={setBubbleStyle}
              allowInherit
            />
          </div>

          {/* Live mini preview composed from the draft tokens */}
          <div
            className="mt-3 rounded-lg border border-[var(--border)] p-3"
            style={{ ...colorVars, background: "var(--bg-base)", ...previewWallCss }}
          >
            <div className="flex">
              <div
                className="max-w-[75%] px-2.5 py-1.5 text-[11px] leading-snug"
                style={{
                  background: "var(--bubble-received)",
                  color: "var(--text-primary)",
                  borderRadius: miniRadius,
                }}
              >
                Hey everyone 👋
              </div>
            </div>
            <div className="mt-1.5 flex justify-end">
              <div
                className="max-w-[75%] px-2.5 py-1.5 text-[11px] leading-snug"
                style={sentBubbleStyle}
              >
                Welcome to the Space ✨
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-semibold"
                style={{
                  background: "var(--accent)",
                  color: "var(--on-accent)",
                }}
              >
                #general
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-medium"
                style={{
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                }}
              >
                accent preview
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {hasChanges && (
              <button
                type="button"
                onClick={saveLook}
                disabled={busy}
                className="inline-flex items-center gap-1.5 self-start rounded-full bg-[var(--accent)] px-4 py-2 text-[12px] font-semibold text-[var(--on-accent)] transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Save look
              </button>
            )}
            {hasLook && !hasChanges && (
              <button
                type="button"
                onClick={resetLook}
                disabled={busy}
                className="inline-flex items-center self-start rounded-full border border-[var(--border)] px-4 py-2 text-[12px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)] disabled:opacity-40"
              >
                Reset to default
              </button>
            )}
            {error && (
              <span className="text-[11px] text-[var(--destructive)]">
                {error}
              </span>
            )}
          </div>
        </>
      ) : (
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
          {hasLook
            ? "This Space has a custom look — you'll see it while viewing its channels."
            : "This Space uses the default look. Only owners and admins can change it."}
        </p>
      )}
    </div>
  );
}

export default SpacePaletteSection;

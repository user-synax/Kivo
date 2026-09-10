"use client";

import { useEffect, useRef, useState } from "react";

// Curated, dependency-free emoji set grouped by category. Kept lean so the
// picker stays fast and fully themeable (no external asset/font required).
const CATEGORIES = [
  {
    id: "smileys",
    label: "Smileys",
    emojis: [
      "😀",
      "😃",
      "😄",
      "😁",
      "😆",
      "😅",
      "🤣",
      "😂",
      "🙂",
      "🙃",
      "😉",
      "😊",
      "😇",
      "🥰",
      "😍",
      "🤩",
      "😘",
      "😋",
      "😛",
      "😜",
      "🤪",
      "🤔",
      "😐",
      "😏",
      "😒",
      "🙄",
      "😬",
      "😌",
      "😔",
      "🥳",
      "🥺",
      "😎",
      "🤓",
      "🧐",
      "😴",
      "🤤",
      "😷",
      "🤒",
      "🤕",
      "🥱",
    ],
  },
  {
    id: "gestures",
    label: "People",
    emojis: [
      "👍",
      "👎",
      "👏",
      "🙌",
      "👐",
      "🤲",
      "🤝",
      "✊",
      "✋",
      "🖐",
      "👌",
      "🤏",
      "✌️",
      "🤞",
      "🤟",
      "🤘",
      "🤙",
      "👈",
      "👉",
      "👆",
      "👇",
      "☝️",
      "🖖",
      "🤛",
      "🤜",
      "👋",
      "🤚",
      "💪",
      "🙏",
      "👀",
    ],
  },
  {
    id: "love",
    label: "Hearts",
    emojis: [
      "❤️",
      "🧡",
      "💛",
      "💚",
      "💙",
      "💜",
      "🖤",
      "🤍",
      "🤎",
      "💔",
      "❣️",
      "💕",
      "💞",
      "💓",
      "💗",
      "💖",
      "💘",
      "💝",
      "💟",
      "💌",
    ],
  },
  {
    id: "animals",
    label: "Animals",
    emojis: [
      "🐶",
      "🐱",
      "🐭",
      "🐹",
      "🐰",
      "🦊",
      "🐻",
      "🐼",
      "🐨",
      "🐯",
      "🦁",
      "🐮",
      "🐷",
      "🐸",
      "🐵",
      "🐔",
      "🐧",
      "🦄",
      "🐝",
      "🦋",
      "🐢",
      "🐍",
      "🐙",
      "🐠",
      "🐳",
      "🐬",
      "🦖",
      "🐾",
      "🐥",
      "🐺",
    ],
  },
  {
    id: "food",
    label: "Food",
    emojis: [
      "🍎",
      "🍐",
      "🍊",
      "🍋",
      "🍌",
      "🍉",
      "🍇",
      "🍓",
      "🫐",
      "🍒",
      "🍑",
      "🥭",
      "🍍",
      "🥥",
      "🍅",
      "🥑",
      "🍔",
      "🍟",
      "🍕",
      "🌭",
      "🌮",
      "🌯",
      "🍜",
      "🍣",
      "🍱",
      "🍦",
      "🍰",
      "🎂",
      "🍪",
      "🍫",
    ],
  },
  {
    id: "activity",
    label: "Activity",
    emojis: [
      "⚽",
      "🏀",
      "🏈",
      "⚾",
      "🎾",
      "🏐",
      "🏉",
      "🎱",
      "🏓",
      "🏸",
      "🥅",
      "🏒",
      "🏏",
      "⛳",
      "🎿",
      "🥊",
      "🥋",
      "🎽",
      "🎮",
      "🎲",
      "🎯",
      "🎳",
      "🎸",
      "🎺",
      "🎻",
      "🎤",
      "🎧",
      "🎬",
      "🎨",
      "🎉",
    ],
  },
  {
    id: "travel",
    label: "Travel",
    emojis: [
      "🚗",
      "🚕",
      "🚙",
      "🚌",
      "🚎",
      "🏎️",
      "🚓",
      "🚑",
      "🚒",
      "🚐",
      "🚚",
      "🚛",
      "🚜",
      "🛵",
      "🏍️",
      "🚲",
      "✈️",
      "🚀",
      "🛸",
      "🚁",
      "⛵",
      "🚤",
      "🏝️",
      "🗺️",
      "🏔️",
      "🌋",
      "🏕️",
      "🌃",
      "🌉",
      "🌟",
    ],
  },
  {
    id: "objects",
    label: "Objects",
    emojis: [
      "⌚",
      "📱",
      "💻",
      "⌨️",
      "🖥️",
      "🖨️",
      "📷",
      "🎥",
      "📺",
      "💡",
      "🔦",
      "📚",
      "📖",
      "✏️",
      "🖊️",
      "📝",
      "📌",
      "📎",
      "🔑",
      "🔒",
      "🔓",
      "💰",
      "💎",
      "🔔",
      "🎵",
      "🎶",
      "🌈",
      "⚡",
      "🔥",
      "💧",
    ],
  },
  {
    id: "symbols",
    label: "Symbols",
    emojis: [
      "✅",
      "❌",
      "❓",
      "❗",
      "⚠️",
      "💯",
      "💥",
      "💢",
      "💬",
      "💭",
      "➡️",
      "⬅️",
      "⬆️",
      "⬇️",
      "🔄",
      "🔁",
      "🔃",
      "▶️",
      "⏸️",
      "⏹️",
      "🔔",
      "✔️",
      "🔕",
      "💡",
      "🌟",
      "⭐",
      "✨",
      "🌙",
      "☀️",
      "☁️",
    ],
  },
];

// `ignoreRef` lets the trigger button stay "inside" for the outside-click
// handler, so toggling the picker closed doesn't get cancelled by the
// document mousedown listener.
export function EmojiPicker({ onSelect, onClose, ignoreRef, customEmojis = [], onSelectCustom }) {
  const hasCustom = Array.isArray(customEmojis) && customEmojis.length > 0;
  const [active, setActive] = useState(hasCustom ? "custom" : CATEGORIES[0].id);
  const [customFilter, setCustomFilter] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (hasCustom && active === CATEGORIES[0].id) {
      // keep default as custom when available? user can switch; don't force
    }
  }, [hasCustom]);

  useEffect(() => {
    const onDoc = (e) => {
      const t = e.target;
      if (ref.current?.contains(t)) return;
      if (ignoreRef?.current?.contains(t)) return;
      onClose?.();
    };
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, ignoreRef]);

  const isCustomActive = active === "custom";

  const filteredCustom = hasCustom
    ? customEmojis.filter((e) => {
        if (!customFilter.trim()) return true;
        return e.name.toLowerCase().includes(customFilter.trim().toLowerCase());
      })
    : [];

  const cat = CATEGORIES.find((c) => c.id === active) || CATEGORIES[0];

  return (
    <div
      ref={ref}
      className="t-emoji-picker"
      role="dialog"
      aria-label="Emoji picker"
    >
      <div className="t-emoji-picker__tabs">
        {hasCustom && (
          <button
            type="button"
            data-active={isCustomActive}
            className="t-emoji-picker__tab"
            onClick={() => setActive("custom")}
          >
            Custom
          </button>
        )}
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            data-active={c.id === active}
            className="t-emoji-picker__tab"
            onClick={() => setActive(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      {isCustomActive ? (
        <div className="flex flex-col gap-2 p-2">
          <input
            value={customFilter}
            onChange={(e) => setCustomFilter(e.target.value)}
            placeholder="Search custom emoji…"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
          />
          <div className="t-scroll grid max-h-[220px] grid-cols-6 gap-1 overflow-y-auto">
            {filteredCustom.length === 0 ? (
              <span className="col-span-6 py-6 text-center text-xs text-[var(--text-muted)]">
                {customEmojis.length === 0 ? "No custom emoji yet" : "No match"}
              </span>
            ) : (
              filteredCustom.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => {
                    if (onSelectCustom) onSelectCustom(e);
                    else onSelect?.(`:${e.name}:`);
                  }}
                  title={`:${e.name}:`}
                  aria-label={`Custom emoji :${e.name}:`}
                  className="flex size-9 items-center justify-center rounded-lg hover:bg-[var(--hover)]"
                >
                  <img
                    src={e.url}
                    alt={`:${e.name}:`}
                    width={28}
                    height={28}
                    loading="lazy"
                    decoding="async"
                    className="size-7 object-contain"
                  />
                </button>
              ))
            )}
          </div>
          {filteredCustom.length > 0 && (
            <span className="px-1 text-[10px] text-[var(--text-muted)]">
              {filteredCustom.length} custom emoji
            </span>
          )}
        </div>
      ) : (
        <div className="t-scroll t-emoji-picker__grid">
          {cat.emojis.map((e) => (
            <button
              key={e}
              type="button"
              className="t-emoji-picker__emoji"
              onClick={() => onSelect?.(e)}
              aria-label={`Emoji ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default EmojiPicker;

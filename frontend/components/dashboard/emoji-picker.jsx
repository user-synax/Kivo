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
export function EmojiPicker({ onSelect, onClose, ignoreRef }) {
  const [active, setActive] = useState(CATEGORIES[0].id);
  const ref = useRef(null);

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

  const cat = CATEGORIES.find((c) => c.id === active) || CATEGORIES[0];

  return (
    <div
      ref={ref}
      className="t-emoji-picker"
      role="dialog"
      aria-label="Emoji picker"
    >
      <div className="t-emoji-picker__tabs">
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
    </div>
  );
}

export default EmojiPicker;

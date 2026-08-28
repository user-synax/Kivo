"use client";

import { cn } from "@/lib/utils";
import {
  Bubble,
  BubbleContent,
  BubbleGroup,
  BubbleReactions,
} from "@/components/ui/bubble";

// A reusable chat bubble built on top of shadcn's `Bubble` primitive.
//
// Everything visual is customizable through props — no global CSS required:
//   - role:      "user" | "assistant"  (sets sensible side + variant defaults)
//   - align:     "start" | "end"       (override which side the bubble sits)
//   - variant:   any Bubble variant    (default | secondary | muted | tinted |
//                                       outline | ghost | destructive)
//   - avatar:    ReactNode             (avatar shown beside the bubble)
//   - name/time: ReactNode             (optional header / footer labels)
//   - reactions: ReactNode             (passed to <BubbleReactions/>)
//   - render:    prop for BubbleContent (advanced; render as button/link/etc)
//
// Example:
//   <ChatBubble role="user">Hello there!</ChatBubble>
//   <ChatBubble role="assistant" variant="tinted" avatar={<Avatar/>} name="AI">
//     How can I help?
//   </ChatBubble>

const roleDefaults = {
  user: { align: "end", variant: "default" },
  assistant: { align: "start", variant: "secondary" },
};

export function ChatBubble({
  role = "assistant",
  align,
  variant,
  avatar,
  name,
  time,
  showAvatar = true,
  reactions,
  className,
  contentClassName,
  bubbleClassName,
  children,
  ...props
}) {
  const fallback = roleDefaults[role] ?? roleDefaults.assistant;
  const _align = align ?? fallback.align;
  const _variant = variant ?? fallback.variant;
  const _avatar = showAvatar ? avatar : null;

  const column = (
    <BubbleGroup className={cn("w-full", className)}>
      {name ? (
        <span
          className={cn(
            "px-1 text-xs font-medium text-muted-foreground",
            _align === "end" && "text-right",
          )}
        >
          {name}
        </span>
      ) : null}

      <Bubble variant={_variant} align={_align} className={bubbleClassName}>
        <BubbleContent className={contentClassName} {...props}>
          {children}
        </BubbleContent>
      </Bubble>

      {reactions ? (
        <BubbleReactions side="bottom" align={_align === "end" ? "end" : "start"}>
          {reactions}
        </BubbleReactions>
      ) : null}

      {time ? (
        <span
          className={cn(
            "px-1 text-[11px] text-muted-foreground",
            _align === "end" && "text-right",
          )}
        >
          {time}
        </span>
      ) : null}
    </BubbleGroup>
  );

  if (!_avatar) return column;

  return (
    <div
      className={cn(
        "flex w-full gap-2",
        _align === "end" ? "flex-row-reverse" : "flex-row",
      )}
    >
      <div className="mt-auto shrink-0">{_avatar}</div>
      <div className="min-w-0 flex-1">{column}</div>
    </div>
  );
}

export { ChatBubble as default };

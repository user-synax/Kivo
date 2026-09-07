"use client";

export default function NotFoundClient() {
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) window.history.back();
        else window.location.href = "/";
      }}
      className="kivo-focus inline-flex min-h-[44px] items-center justify-center rounded-pills border border-hairline bg-transparent px-6 text-[14px] font-medium leading-none text-ink-muted transition-colors hover:bg-white/6 hover:text-ink"
    >
      Go back
    </button>
  );
}

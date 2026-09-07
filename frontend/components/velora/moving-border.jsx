import { cn } from "@/lib/utils";

/**
 * Button with a light that laps its border, driven by `offset-path`.
 * Zero dependencies — one keyframe does the whole thing.
 */
export function MovingBorder({
  duration = 4,
  size = 90,
  radius = 12,
  children,
  className,
  style,
  ...props
}) {
  return (
    <button
      {...props}
      data-slot="moving-border"
      style={
        {
          "--mb-duration": `${duration}s`,
          "--mb-size": `${size}px`,
          "--mb-radius": `${radius}px`,
          borderRadius: radius,
          ...style
        }
      }
      className={cn(
        "relative inline-flex h-11 cursor-pointer items-center justify-center overflow-hidden bg-background p-px text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
        className
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 motion-reduce:hidden"
      >
        <span
          className="absolute aspect-square w-(--mb-size) animate-moving-border bg-[radial-gradient(circle,var(--brand-via),transparent_65%)]"
          style={{
            offsetPath: `rect(0 auto auto 0 round var(--mb-radius))`,
          }}
        />
      </span>
      <span className="relative z-10 flex h-full w-full items-center justify-center rounded-[inherit] border bg-background px-6">
        {children}
      </span>
    </button>
  );
}

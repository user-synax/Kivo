"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function Switch({ checked = false, onCheckedChange, disabled = false, ariaLabel, className }) {
  const [isInit, setIsInit] = useState(false);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      data-on={String(checked)}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        if (!isInit) setIsInit(true);
        onCheckedChange?.(!checked);
      }}
      className={cn("t-toggle", isInit && "is-init", disabled && "opacity-50 cursor-not-allowed", className)}
    >
      <span className="t-toggle-thumb" aria-hidden="true" />
    </button>
  );
}

export default Switch;

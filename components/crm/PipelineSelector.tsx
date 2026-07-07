"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { PIPELINE_LABEL, PIPELINE_ORDER, PIPELINE_TONE } from "@/lib/pipeline";
import type { PipelineStatus } from "@/lib/types";
import { cn } from "@/lib/cn";

export function PipelineSelector({
  value,
  onChange,
}: {
  value: PipelineStatus | null;
  onChange: (next: PipelineStatus) => Promise<void> | void;
}) {
  const [busy, setBusy] = useState<PipelineStatus | null>(null);

  const onClick = async (s: PipelineStatus) => {
    if (s === value || busy) return;
    setBusy(s);
    try {
      await onChange(s);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="inline-flex rounded-full border border-mid dark:border-nightBorder bg-white dark:bg-nightSurface p-1 gap-0.5 flex-wrap">
      {PIPELINE_ORDER.map((s) => {
        const active = value === s;
        const tone = PIPELINE_TONE[s];
        const activeClass =
          tone === "accent"
            ? "bg-accent text-white"
            : tone === "accent2"
              ? "bg-accent2 text-white"
              : tone === "warn"
                ? "bg-snooze text-white"
                : tone === "danger"
                  ? "bg-reject text-white"
                  : "bg-mid text-warmDark dark:bg-nightBorder dark:text-cream";
        return (
          <button
            key={s}
            onClick={() => onClick(s)}
            disabled={busy !== null}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
              active ? activeClass : "text-warmDark dark:text-cream hover:bg-mid/60 dark:hover:bg-nightBorder/50",
              busy && "opacity-70"
            )}
          >
            {busy === s && <Loader2 className="h-3 w-3 animate-spin" />}
            {PIPELINE_LABEL[s]}
          </button>
        );
      })}
    </div>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "accent" | "accent2" | "neutral" | "warn" | "danger" | "snooze";

const tones: Record<Tone, string> = {
  accent: "bg-accent/10 text-accent",
  accent2: "bg-accent2/15 text-accent2",
  neutral: "bg-mid/70 text-warmDark",
  warn: "bg-snooze/15 text-snooze",
  danger: "bg-reject/10 text-reject",
  snooze: "bg-snooze/15 text-snooze",
};

export function Pill({
  icon,
  children,
  tone = "accent",
  className,
}: {
  icon?: ReactNode;
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium",
        tones[tone],
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}

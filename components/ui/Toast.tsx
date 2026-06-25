"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ToastTone = "neutral" | "success" | "danger";

const tones: Record<ToastTone, string> = {
  neutral: "bg-warmDark text-cream",
  success: "bg-accent2 text-white",
  danger: "bg-reject text-white",
};

export function Toast({
  open,
  tone = "neutral",
  children,
  action,
}: {
  open: boolean;
  tone?: ToastTone;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 12, opacity: 0 }}
          transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
            "rounded-full px-4 py-2.5 text-sm shadow-warm flex items-center gap-3",
            tones[tone]
          )}
          role="status"
          aria-live="polite"
        >
          <span>{children}</span>
          {action}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

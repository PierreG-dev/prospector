"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Preset = { label: string; days: number };

const PRESETS: Preset[] = [
  { label: "+3 jours", days: 3 },
  { label: "+1 semaine", days: 7 },
  { label: "+2 semaines", days: 14 },
  { label: "+1 mois", days: 30 },
];

function addDays(d: Date, days: number): Date {
  const n = new Date(d);
  n.setDate(n.getDate() + days);
  return n;
}

function toLocalDateInput(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function SnoozeDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (when: Date) => void;
}) {
  const [date, setDate] = useState(() => toLocalDateInput(addDays(new Date(), 7)));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setDate(toLocalDateInput(addDays(new Date(), 7)));
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date]);

  const commit = () => {
    const d = new Date(date + "T09:00:00");
    if (!Number.isFinite(d.getTime())) return;
    onConfirm(d);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 z-40 bg-warmDark/40 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 8 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            className="bg-cream rounded-2xl shadow-warm-lg border border-mid w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-mid">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-snooze" strokeWidth={2} />
                <span className="text-sm font-medium">Snoozer ce prospect</span>
              </div>
              <button
                onClick={onClose}
                aria-label="Fermer"
                className="text-textMuted hover:text-warmDark transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() =>
                      setDate(toLocalDateInput(addDays(new Date(), p.days)))
                    }
                    className="px-3 py-1.5 rounded-full text-xs border border-mid hover:border-snooze hover:bg-snooze/10 transition"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div>
                <label
                  htmlFor="snooze-date"
                  className="text-xs text-textMuted block mb-1"
                >
                  Re-surfaçage le
                </label>
                <input
                  ref={inputRef}
                  id="snooze-date"
                  type="date"
                  value={date}
                  min={toLocalDateInput(addDays(new Date(), 1))}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-mid bg-white px-4 py-2.5 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={onClose} type="button">
                  Annuler
                </Button>
                <Button onClick={commit} type="button">
                  Snoozer
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

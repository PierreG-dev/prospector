"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FileText, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { TriCandidate } from "@/lib/queue/pick";
import { Button } from "@/components/ui/Button";

export function PrepAppelPanel({
  open,
  candidate,
  onClose,
  onSaveNote,
}: {
  open: boolean;
  candidate: TriCandidate | null;
  onClose: () => void;
  onSaveNote: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setNote("");
      setTimeout(() => taRef.current?.focus(), 60);
    }
  }, [open, candidate?.id]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && candidate && (
        <motion.aside
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="fixed top-14 right-0 bottom-0 w-full sm:w-[420px] z-30 bg-cream border-l border-mid shadow-warm-lg overflow-y-auto"
        >
          <div className="sticky top-0 bg-cream/95 backdrop-blur border-b border-mid px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-accent" strokeWidth={2} />
              <span className="text-sm font-medium">Prépa-appel</span>
            </div>
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="text-textMuted hover:text-warmDark transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-5 space-y-5">
            <section>
              <h3 className="text-[11px] uppercase tracking-wider text-textMuted mb-2">
                Identité
              </h3>
              <div className="space-y-1 text-sm">
                <p className="font-medium">{candidate.name}</p>
                {candidate.category && (
                  <p className="text-textMuted">{candidate.category}</p>
                )}
                {candidate.address && (
                  <p className="text-textMuted">
                    {candidate.address}
                    {candidate.city && `, ${candidate.city}`}
                  </p>
                )}
              </div>
            </section>

            <section>
              <h3 className="text-[11px] uppercase tracking-wider text-textMuted mb-2">
                Contacts
              </h3>
              <div className="space-y-2 text-sm">
                {candidate.phone ? (
                  <a
                    href={`tel:${candidate.phone}`}
                    className="flex items-center justify-between rounded-xl border border-mid bg-white px-3 py-2 hover:border-accent transition"
                  >
                    <span className="font-mono">{candidate.phone}</span>
                    <span className="text-xs text-accent">Appeler</span>
                  </a>
                ) : (
                  <p className="text-xs text-textMuted">Pas de téléphone</p>
                )}
                {candidate.website_url && (
                  <a
                    href={candidate.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-xl border border-mid bg-white px-3 py-2 hover:border-accent transition"
                  >
                    <span className="truncate">{candidate.website_url}</span>
                    <span className="text-xs text-accent shrink-0 ml-2">
                      Ouvrir ↗
                    </span>
                  </a>
                )}
                {candidate.gmaps_url && (
                  <a
                    href={candidate.gmaps_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-xl border border-mid bg-white px-3 py-2 hover:border-accent transition"
                  >
                    <span>Fiche Google Maps</span>
                    <span className="text-xs text-accent shrink-0 ml-2">↗</span>
                  </a>
                )}
              </div>
            </section>

            {(candidate.gmaps_rating !== null ||
              candidate.gmaps_reviews !== null) && (
              <section>
                <h3 className="text-[11px] uppercase tracking-wider text-textMuted mb-2">
                  Activité
                </h3>
                <p className="text-sm font-mono">
                  ★ {candidate.gmaps_rating ?? "—"}{" "}
                  <span className="text-textMuted">
                    ({candidate.gmaps_reviews ?? 0} avis)
                  </span>
                </p>
              </section>
            )}

            <section>
              <h3 className="text-[11px] uppercase tracking-wider text-textMuted mb-2">
                Note libre
              </h3>
              <textarea
                ref={taRef}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Accroche, objections anticipées, point de douleur supposé…"
                rows={6}
                className="w-full rounded-xl border border-mid bg-white px-4 py-2.5 text-sm placeholder:text-textMuted/60 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none resize-none"
              />
              <div className="flex justify-end mt-2">
                <Button
                  size="sm"
                  onClick={() => {
                    if (note.trim()) onSaveNote(note.trim());
                    onClose();
                  }}
                  disabled={!note.trim()}
                >
                  Enregistrer
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-textMuted">
                Enregistrée sur la fiche prospect (consultable au Lot 5).
              </p>
            </section>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

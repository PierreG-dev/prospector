"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FileText, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { TriCandidate } from "@/lib/queue/pick";
import { Button } from "@/components/ui/Button";
import { getInvoiceEstimate, formatEur, unitLabel } from "@/lib/trade/invoice";

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
          className="fixed top-14 right-0 bottom-0 w-full sm:w-[420px] z-30 bg-cream dark:bg-nightSurface border-l border-mid dark:border-nightBorder shadow-warm-lg overflow-y-auto"
        >
          <div className="sticky top-0 bg-cream/95 dark:bg-nightSurface/95 backdrop-blur border-b border-mid dark:border-nightBorder px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-accent" strokeWidth={2} />
              <span className="text-sm font-medium dark:text-cream">Prépa-appel</span>
            </div>
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="text-textMuted dark:text-nightMuted hover:text-warmDark dark:hover:text-cream transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-5 space-y-5">
            <section>
              <h3 className="text-[11px] uppercase tracking-wider text-textMuted dark:text-nightMuted mb-2">
                Identité
              </h3>
              <div className="space-y-1 text-sm">
                <p className="font-medium dark:text-cream">{candidate.name}</p>
                {candidate.category && (
                  <p className="text-textMuted dark:text-nightMuted">{candidate.category}</p>
                )}
                {candidate.address && (
                  <p className="text-textMuted dark:text-nightMuted">
                    {candidate.address}
                    {candidate.city && `, ${candidate.city}`}
                  </p>
                )}
              </div>
            </section>

            <section>
              <h3 className="text-[11px] uppercase tracking-wider text-textMuted dark:text-nightMuted mb-2">
                Contacts
              </h3>
              <div className="space-y-2 text-sm">
                {candidate.phone ? (
                  <a
                    href={`tel:${candidate.phone.replace(/[^\d+]/g, "")}`}
                    className="flex items-center justify-between rounded-xl border border-mid dark:border-nightBorder bg-white dark:bg-nightBorder/30 px-3 py-2 hover:border-accent dark:hover:border-accent transition"
                  >
                    <span className="font-mono dark:text-cream">{candidate.phone}</span>
                    <span className="text-xs text-accent">Appeler</span>
                  </a>
                ) : (
                  <p className="text-xs text-textMuted dark:text-nightMuted">Pas de téléphone</p>
                )}
                {candidate.website_url && (
                  <a
                    href={candidate.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-xl border border-mid dark:border-nightBorder bg-white dark:bg-nightBorder/30 px-3 py-2 hover:border-accent dark:hover:border-accent transition"
                  >
                    <span className="truncate dark:text-cream">{candidate.website_url}</span>
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
                    className="flex items-center justify-between rounded-xl border border-mid dark:border-nightBorder bg-white dark:bg-nightBorder/30 px-3 py-2 hover:border-accent dark:hover:border-accent transition"
                  >
                    <span className="dark:text-cream">Fiche Google Maps</span>
                    <span className="text-xs text-accent shrink-0 ml-2">↗</span>
                  </a>
                )}
              </div>
            </section>

            {(candidate.gmaps_rating !== null ||
              candidate.gmaps_reviews !== null) && (
              <section>
                <h3 className="text-[11px] uppercase tracking-wider text-textMuted dark:text-nightMuted mb-2">
                  Activité
                </h3>
                <p className="text-sm font-mono dark:text-cream">
                  ★ {candidate.gmaps_rating ?? "—"}{" "}
                  <span className="text-textMuted dark:text-nightMuted">
                    ({candidate.gmaps_reviews ?? 0} avis)
                  </span>
                </p>
              </section>
            )}

            {candidate.trade && (() => {
              const est = getInvoiceEstimate(candidate.trade);
              if (!est) return null;
              return (
                <section>
                  <h3 className="text-[11px] uppercase tracking-wider text-textMuted dark:text-nightMuted mb-2">
                    Facture moyenne estimée
                  </h3>
                  <div className="rounded-xl border border-mid dark:border-nightBorder bg-white dark:bg-nightBorder/30 px-3 py-2.5">
                    <p className="text-sm">
                      <span className="font-semibold text-warmDark dark:text-cream">{formatEur(est.typical)}</span>
                      <span className="text-textMuted dark:text-nightMuted"> · {unitLabel(est.unit)}</span>
                    </p>
                    <p className="text-[11px] text-textMuted dark:text-nightMuted mt-0.5 font-mono">
                      fourchette {formatEur(est.low)} – {formatEur(est.high)}
                    </p>
                    {est.note && (
                      <p className="text-[11px] text-textMuted dark:text-nightMuted mt-1 italic">{est.note}</p>
                    )}
                  </div>
                </section>
              );
            })()}

            <section>
              <h3 className="text-[11px] uppercase tracking-wider text-textMuted dark:text-nightMuted mb-2">
                Note libre
              </h3>
              <textarea
                ref={taRef}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Accroche, objections anticipées, point de douleur supposé…"
                rows={6}
                className="w-full rounded-xl border border-mid dark:border-nightBorder bg-white dark:bg-nightBorder/30 dark:text-cream px-4 py-2.5 text-sm placeholder:text-textMuted/60 dark:placeholder:text-nightMuted/60 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none resize-none"
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
              <p className="mt-2 text-[11px] text-textMuted dark:text-nightMuted">
                Enregistrée sur la fiche prospect (consultable au Lot 5).
              </p>
            </section>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

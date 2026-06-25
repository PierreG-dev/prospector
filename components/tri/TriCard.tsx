"use client";

import {
  Globe2,
  GlobeLock,
  Phone,
  MapPin,
  Star,
  RotateCcw,
  Eye,
  Clock,
  Check,
  X as XIcon,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
} from "lucide-react";
import { OgPreview } from "./OgPreview";
import { Pill } from "@/components/ui/Pill";
import type { TriCandidate } from "@/lib/queue/pick";
import { isAvoidNow, isOptimalNow } from "@/lib/trade/calltime";
import { cn } from "@/lib/cn";

export function TriCard({
  candidate,
  remaining,
  onQualify,
  onReject,
  onSnooze,
  onOpenPrep,
  onUndo,
  canUndo,
  now,
}: {
  candidate: TriCandidate;
  remaining: number;
  onQualify: () => void;
  onReject: () => void;
  onSnooze: () => void;
  onOpenPrep: () => void;
  onUndo: () => void;
  canUndo: boolean;
  now: Date;
}) {
  const optimal = isOptimalNow(candidate.trade, now);
  const avoid = isAvoidNow(candidate.trade, now);

  return (
    <div className="w-full max-w-2xl">
      {/* En-tête : compteur + undo */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-textMuted">
          <span className="font-mono">{remaining}</span> restant
          {remaining > 1 ? "s" : ""} dans la file
        </div>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition",
            canUndo
              ? "text-warmDark hover:bg-mid"
              : "text-textMuted/40 cursor-not-allowed"
          )}
        >
          <RotateCcw className="h-3 w-3" />
          Annuler <kbd className="font-mono text-[10px] opacity-70">U</kbd>
        </button>
      </div>

      {/* Carte */}
      <div className="rounded-2xl bg-white border border-mid shadow-warm overflow-hidden">
        <div className="p-6">
          {/* Bandeau infos métier */}
          {candidate.trade && (
            <div className="flex items-center justify-between mb-4">
              <Pill tone="accent2" icon={<span aria-hidden>·</span>}>
                {candidate.trade}
              </Pill>
              {optimal && (
                <span className="text-xs text-accent2 font-medium inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" strokeWidth={2} /> Bonne heure
                  pour appeler
                </span>
              )}
              {avoid && !optimal && (
                <span className="text-xs text-textMuted inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" strokeWidth={2} /> Hors créneau
                  idéal
                </span>
              )}
            </div>
          )}

          {/* Nom + catégorie + ville */}
          <h2 className="text-2xl font-semibold leading-tight">
            {candidate.name}
          </h2>
          <p className="mt-1 text-sm text-textMuted">
            {candidate.category ?? "—"}
            {candidate.city && ` · ${candidate.city}`}
          </p>

          {/* Stats principales */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {candidate.has_website ? (
              <Pill tone="accent2" icon={<Globe2 className="h-3.5 w-3.5" />}>
                Site présent
              </Pill>
            ) : (
              <Pill tone="warn" icon={<GlobeLock className="h-3.5 w-3.5" />}>
                Pas de site
              </Pill>
            )}
            {candidate.phone && (
              <a
                href={`tel:${candidate.phone}`}
                className="inline-flex items-center gap-2 text-sm font-mono text-warmDark hover:text-accent transition"
                title="Appeler (T)"
              >
                <Phone className="h-4 w-4" />
                {candidate.phone}
              </a>
            )}
            {(candidate.gmaps_rating !== null ||
              candidate.gmaps_reviews !== null) && (
              <span className="inline-flex items-center gap-1.5 text-sm font-mono text-warmDark">
                <Star
                  className="h-4 w-4 text-snooze fill-snooze"
                  strokeWidth={1.5}
                />
                {candidate.gmaps_rating ?? "—"}
                <span className="text-textMuted">
                  ({candidate.gmaps_reviews ?? 0})
                </span>
              </span>
            )}
          </div>

          {/* OG preview */}
          {candidate.has_website && (
            <div className="mt-5">
              <OgPreview og={candidate.og} websiteUrl={candidate.website_url} />
            </div>
          )}

          {/* Score + signaux secondaires */}
          <div className="mt-5 flex items-center gap-4 text-xs text-textMuted">
            <span>
              score{" "}
              <span className="font-mono text-warmDark">{candidate.score}</span>
            </span>
            {candidate.times_seen > 1 && (
              <Pill tone="neutral">vu {candidate.times_seen}×</Pill>
            )}
          </div>

          {/* Boutons externes (sans avancer la file) */}
          <div className="mt-5 flex flex-wrap gap-2">
            {candidate.website_url && (
              <ExternalLink
                href={candidate.website_url}
                icon={<Globe2 className="h-3.5 w-3.5" />}
                label="Ouvrir le site"
                kbd="O"
              />
            )}
            {candidate.gmaps_url && (
              <ExternalLink
                href={candidate.gmaps_url}
                icon={<MapPin className="h-3.5 w-3.5" />}
                label="Voir Maps"
                kbd="M"
              />
            )}
            <button
              onClick={onOpenPrep}
              className="inline-flex items-center gap-2 rounded-full border border-mid px-3 py-1.5 text-xs hover:border-accent hover:text-accent transition"
            >
              <Eye className="h-3.5 w-3.5" />
              Prépa appel <kbd className="font-mono opacity-70">?</kbd>
            </button>
          </div>
        </div>

        {/* Bandeau actions */}
        <div className="grid grid-cols-3 border-t border-mid divide-x divide-mid bg-cream/40">
          <ActionButton
            tone="reject"
            icon={<XIcon className="h-4 w-4" />}
            label="Rejeter"
            kbd={<><ArrowLeft className="h-3 w-3 inline" /> / K</>}
            onClick={onReject}
          />
          <ActionButton
            tone="snooze"
            icon={<Clock className="h-4 w-4" />}
            label="Snoozer"
            kbd={<><ArrowUp className="h-3 w-3 inline" /> / L</>}
            onClick={onSnooze}
          />
          <ActionButton
            tone="accent2"
            icon={<Check className="h-4 w-4" />}
            label="Qualifier"
            kbd={<><ArrowRight className="h-3 w-3 inline" /> / D</>}
            onClick={onQualify}
          />
        </div>
      </div>
    </div>
  );
}

function ExternalLink({
  href,
  icon,
  label,
  kbd,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  kbd: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-full border border-mid px-3 py-1.5 text-xs hover:border-accent hover:text-accent transition"
    >
      {icon}
      {label} ↗ <kbd className="font-mono opacity-70">{kbd}</kbd>
    </a>
  );
}

function ActionButton({
  tone,
  icon,
  label,
  kbd,
  onClick,
}: {
  tone: "reject" | "snooze" | "accent2";
  icon: React.ReactNode;
  label: string;
  kbd: React.ReactNode;
  onClick: () => void;
}) {
  const toneClass =
    tone === "reject"
      ? "text-reject hover:bg-reject/10"
      : tone === "snooze"
        ? "text-snooze hover:bg-snooze/10"
        : "text-accent2 hover:bg-accent2/10";

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 py-4 transition",
        toneClass
      )}
    >
      <span className="inline-flex items-center gap-2 text-sm font-medium">
        {icon} {label}
      </span>
      <span className="text-[10px] text-textMuted font-mono">{kbd}</span>
    </button>
  );
}

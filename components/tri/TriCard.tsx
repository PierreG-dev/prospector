"use client";

import {
  Globe2,
  GlobeLock,
  Phone,
  Smartphone,
  MapPin,
  Star,
  Flame,
  ImageOff,
  RotateCcw,
  Eye,
  Clock,
  Check,
  X as XIcon,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  Sparkles,
  IdCard,
} from "lucide-react";
import { OgPreview } from "./OgPreview";
import { Pill } from "@/components/ui/Pill";
import type { TriCandidate } from "@/lib/queue/pick";
import { isAvoidNow, isOptimalNow, getCallWindow } from "@/lib/trade/calltime";
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
  const callWindow = getCallWindow(candidate.trade);

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
      <div className="rounded-2xl bg-white dark:bg-nightSurface border border-mid dark:border-nightBorder shadow-warm overflow-hidden">
        {/* Bandeau opportunité : sans site = prospect prioritaire */}
        {!candidate.has_website && (
          <div className="flex items-center gap-2 px-6 py-2.5 bg-accent2/10 border-b border-accent2/20 text-accent2 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
            Sans site web — prospect prioritaire
          </div>
        )}
        <div className="p-6">
          {/* Bandeau infos métier */}
          {candidate.trade && (
            <div className="flex items-center justify-between mb-4">
              <Pill tone="accent2" icon={<span aria-hidden>·</span>}>
                {candidate.trade}
              </Pill>
              {callWindow && (
                <span
                  className={cn(
                    "text-xs font-medium inline-flex items-center gap-1",
                    optimal
                      ? "text-accent2"
                      : avoid
                        ? "text-snooze"
                        : "text-snooze/80"
                  )}
                >
                  <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                  {optimal ? `Idéal maintenant · ${callWindow.label}` : `Idéal : ${callWindow.label}`}
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
                href={`tel:${candidate.phone.replace(/[^\d+]/g, "")}`}
                className="inline-flex items-center gap-2 text-sm font-mono text-warmDark dark:text-cream hover:text-accent transition"
                title={
                  candidate.is_mobile_phone
                    ? "Mobile — ligne directe (T)"
                    : "Appeler (T)"
                }
              >
                {candidate.is_mobile_phone ? (
                  <Smartphone className="h-4 w-4 text-accent2" />
                ) : (
                  <Phone className="h-4 w-4" />
                )}
                {candidate.phone}
              </a>
            )}
            {(candidate.gmaps_rating !== null ||
              candidate.gmaps_reviews !== null) && (
              <span className="inline-flex items-center gap-1.5 text-sm font-mono text-warmDark dark:text-cream">
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
              <span className="font-mono text-warmDark dark:text-cream">{candidate.score}</span>
            </span>
            {candidate.times_seen > 1 && (
              <Pill tone="neutral">vu {candidate.times_seen}×</Pill>
            )}
            {candidate.snooze_count > 0 && (
              <Pill tone="snooze" icon={<Clock className="h-3.5 w-3.5" />}>
                Snoozé {candidate.snooze_count}×
              </Pill>
            )}
            {candidate.gmaps_rank != null && (
              <span>
                Google{" "}
                <span className="font-mono text-warmDark dark:text-cream">
                  #{candidate.gmaps_rank}
                </span>
              </span>
            )}
            {candidate.latest_review_days != null &&
              candidate.latest_review_days < 90 && (
                <Pill tone="accent2" icon={<Flame className="h-3.5 w-3.5" />}>
                  Actif · avis {candidate.latest_review_days}j
                </Pill>
              )}
            {candidate.profile_gaps >= 2 && (
              <Pill tone="warn" icon={<ImageOff className="h-3.5 w-3.5" />}>
                Maps délaissé
              </Pill>
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
            <ExternalLink
              href={`/crm/${candidate.id}`}
              icon={<IdCard className="h-3.5 w-3.5" />}
              label="Fiche"
              kbd="F"
            />
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
        <div className="grid grid-cols-3 border-t border-mid dark:border-nightBorder divide-x divide-mid dark:divide-nightBorder bg-cream/40 dark:bg-nightSurface/60">
          <ActionButton
            tone="reject"
            icon={<XIcon className="h-4 w-4" />}
            label="Pas intéressé"
            kbd={<><ArrowLeft className="h-3 w-3 inline" /> / K</>}
            onClick={onReject}
          />
          <ActionButton
            tone="snooze"
            icon={<Clock className="h-4 w-4" />}
            label="Rappeler plus tard"
            kbd={<><ArrowUp className="h-3 w-3 inline" /> / L</>}
            onClick={onSnooze}
          />
          <ActionButton
            tone="accent2"
            icon={<Check className="h-4 w-4" />}
            label="Intéressé"
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

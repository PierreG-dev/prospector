"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Globe2,
  GlobeLock,
  MapPin,
  Phone,
  Archive,
  RotateCcw,
  Star,
  Loader2,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { PipelineSelector } from "./PipelineSelector";
import { StatusHistory, type StatusEntry } from "./StatusHistory";
import { NotesPanel, type Note } from "./NotesPanel";
import { RemindersSection } from "./RemindersSection";
import type { PipelineStatus } from "@/lib/types";

type Fiche = {
  _id: string;
  name: string;
  category: string | null;
  categories: string[];
  city: string | null;
  address: string | null;
  country_code: string | null;
  phone: string | null;
  website_url: string | null;
  gmaps_url: string | null;
  gmaps_rating: number | null;
  gmaps_reviews: number | null;
  has_website: boolean;
  trade: string | null;
  score: number;
  lifecycle: string;
  pipeline_status: PipelineStatus | null;
  relance_count: number;
  relance_paused: boolean;
  relance_next_at: string | null;
  last_status_at: string | null;
  notes: Note[];
  status_history: StatusEntry[];
  times_seen: number;
};

export function CrmFiche({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<Fiche | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [toast, setToast] = useState<{
    open: boolean;
    text: string;
    tone: "neutral" | "success" | "danger";
  }>({ open: false, text: "", tone: "neutral" });

  const showToast = (
    text: string,
    tone: "neutral" | "success" | "danger" = "neutral"
  ) => {
    setToast({ open: true, text, tone });
    window.setTimeout(() => setToast((t) => ({ ...t, open: false })), 2000);
  };

  const load = async () => {
    setLoading(true);
    const r = await fetch(`/api/prospects/${id}`, { cache: "no-store" });
    if (r.ok) {
      const d = (await r.json()) as Fiche;
      setData(d);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onPipelineChange = async (to: PipelineStatus) => {
    const r = await fetch(`/api/prospects/${id}/pipeline`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to }),
    });
    if (!r.ok) {
      showToast("Erreur", "danger");
      return;
    }
    showToast("Statut mis à jour", "success");
    await load();
  };

  const onAddNote = async (body: string) => {
    const r = await fetch(`/api/prospects/${id}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!r.ok) {
      showToast("Erreur", "danger");
      return;
    }
    showToast("Note ajoutée", "success");
    await load();
  };

  const onArchive = async () => {
    const ok = window.confirm(
      "Archiver ce prospect ? Il sera marqué comme rejeté et sortira de la file de tri. Réversible via 'Restaurer'."
    );
    if (!ok) return;
    setArchiving(true);
    const r = await fetch(`/api/prospects/${id}/decide`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "reject", note: "Archivé depuis la fiche" }),
    });
    setArchiving(false);
    if (!r.ok) {
      showToast("Erreur", "danger");
      return;
    }
    showToast("Prospect archivé", "success");
    router.push("/crm");
  };

  const onReset = async () => {
    const ok = window.confirm(
      "Reset ce prospect ? Il retourne dans la file de tri, toutes les notes, l'historique et les rappels sont supprimés. Action irréversible."
    );
    if (!ok) return;
    setResetting(true);
    const r = await fetch(`/api/prospects/${id}/reset`, { method: "POST" });
    setResetting(false);
    if (!r.ok) {
      showToast("Erreur", "danger");
      return;
    }
    showToast("Prospect remis dans la file", "success");
    router.push("/crm");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-textMuted dark:text-nightMuted">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardBody className="py-12 text-center text-sm text-textMuted dark:text-nightMuted">
          Prospect introuvable.{" "}
          <Link href="/crm" className="text-accent">
            Retour à la liste
          </Link>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/crm"
          className="inline-flex items-center gap-1 text-xs text-textMuted dark:text-nightMuted hover:text-accent transition mb-3"
        >
          <ArrowLeft className="h-3 w-3" /> Retour
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Colonne principale */}
        <div className="space-y-5">
          <Card>
            <CardBody>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <h2 className="text-2xl font-semibold leading-tight dark:text-cream">
                    {data.name}
                  </h2>
                  <p className="mt-1 text-sm text-textMuted dark:text-nightMuted">
                    {data.category ?? "—"}
                    {data.city && ` · ${data.city}`}
                  </p>
                  {data.address && (
                    <p className="text-xs text-textMuted dark:text-nightMuted mt-0.5">
                      {data.address}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {data.trade && <Pill tone="accent2">{data.trade}</Pill>}
                  {data.has_website ? (
                    <Pill tone="accent2" icon={<Globe2 className="h-3.5 w-3.5" />}>
                      Site
                    </Pill>
                  ) : (
                    <Pill tone="warn" icon={<GlobeLock className="h-3.5 w-3.5" />}>
                      Pas de site
                    </Pill>
                  )}
                  {data.times_seen > 1 && (
                    <Pill tone="neutral">vu {data.times_seen}×</Pill>
                  )}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
                {data.phone && (
                  <a
                    href={`tel:${data.phone.replace(/[^\d+]/g, "")}`}
                    className="inline-flex items-center gap-2 rounded-full border border-mid dark:border-nightBorder dark:text-cream px-3 py-1.5 hover:border-accent hover:text-accent dark:hover:text-accent transition"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span className="font-mono text-xs">{data.phone}</span>
                  </a>
                )}
                {data.website_url && (
                  <a
                    href={data.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-mid dark:border-nightBorder dark:text-cream px-3 py-1.5 hover:border-accent hover:text-accent dark:hover:text-accent transition"
                  >
                    <Globe2 className="h-3.5 w-3.5" />
                    <span className="text-xs truncate max-w-[220px]">
                      {data.website_url}
                    </span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {data.gmaps_url && (
                  <a
                    href={data.gmaps_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-mid dark:border-nightBorder dark:text-cream px-3 py-1.5 hover:border-accent hover:text-accent dark:hover:text-accent transition"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="text-xs">Google Maps</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {(data.gmaps_rating !== null ||
                  data.gmaps_reviews !== null) && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-mono dark:text-cream">
                    <Star
                      className="h-4 w-4 text-snooze fill-snooze"
                      strokeWidth={1.5}
                    />
                    {data.gmaps_rating ?? "—"}
                    <span className="text-textMuted dark:text-nightMuted">
                      ({data.gmaps_reviews ?? 0})
                    </span>
                  </span>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="text-[11px] uppercase tracking-wider text-textMuted dark:text-nightMuted mb-3">
                Avancement
              </h3>
              <PipelineSelector
                value={data.pipeline_status}
                onChange={onPipelineChange}
              />
              {data.pipeline_status === "contacte" && (
                <p className="mt-3 text-xs text-textMuted dark:text-nightMuted">
                  Rappels automatiques actifs. {data.relance_paused ? (
                    <span className="text-textMuted dark:text-nightMuted">En pause.</span>
                  ) : (
                    <>
                      {data.relance_count}/3 rappels ·{" "}
                      {data.relance_next_at
                        ? `prochain ${new Date(
                            data.relance_next_at
                          ).toLocaleDateString("fr-FR")}`
                        : "—"}
                    </>
                  )}
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="text-[11px] uppercase tracking-wider text-textMuted dark:text-nightMuted mb-3">
                Rappels
              </h3>
              <RemindersSection prospectId={data._id} />
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="text-[11px] uppercase tracking-wider text-textMuted dark:text-nightMuted mb-3">
                Notes
              </h3>
              <NotesPanel notes={data.notes} onAdd={onAddNote} />
            </CardBody>
          </Card>
        </div>

        {/* Colonne latérale */}
        <div className="space-y-5">
          <Card>
            <CardBody>
              <h3 className="text-[11px] uppercase tracking-wider text-textMuted dark:text-nightMuted mb-3">
                Historique
              </h3>
              <StatusHistory entries={data.status_history} />
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="text-[11px] uppercase tracking-wider text-textMuted dark:text-nightMuted mb-3">
                Infos
              </h3>
              <dl className="text-xs text-textMuted dark:text-nightMuted space-y-1.5">
                <div className="flex justify-between">
                  <dt>Score</dt>
                  <dd className="font-mono text-warmDark dark:text-cream">{data.score}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Statut</dt>
                  <dd className="text-warmDark dark:text-cream">{data.lifecycle}</dd>
                </div>
                {data.last_status_at && (
                  <div className="flex justify-between">
                    <dt>Dernier changement</dt>
                    <dd className="text-warmDark dark:text-cream">
                      {new Date(data.last_status_at).toLocaleDateString("fr-FR")}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt>Vu</dt>
                  <dd className="font-mono text-warmDark dark:text-cream">{data.times_seen}×</dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="text-[11px] uppercase tracking-wider text-textMuted dark:text-nightMuted mb-3">
                Actions
              </h3>
              {data.lifecycle !== "rejected" && (
                <>
                  <button
                    onClick={onArchive}
                    disabled={archiving}
                    className="inline-flex items-center gap-2 rounded-md border border-mid dark:border-nightBorder text-warmDark dark:text-cream px-3 py-1.5 text-xs hover:border-accent hover:text-accent dark:hover:text-accent transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {archiving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Archive className="h-3.5 w-3.5" />
                    )}
                    Archiver le prospect
                  </button>
                  <p className="mt-2 mb-4 text-[11px] text-textMuted dark:text-nightMuted leading-relaxed">
                    Marque le prospect comme rejeté. Notes et historique conservés.
                  </p>
                </>
              )}
              <button
                onClick={onReset}
                disabled={resetting}
                className="inline-flex items-center gap-2 rounded-md border border-reject/40 text-reject px-3 py-1.5 text-xs hover:bg-reject/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                Reset le prospect
              </button>
              <p className="mt-2 text-[11px] text-textMuted dark:text-nightMuted leading-relaxed">
                Retour dans la file de tri. Notes, historique, pipeline et
                rappels supprimés.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      <Toast open={toast.open} tone={toast.tone}>
        {toast.text}
      </Toast>
    </div>
  );
}

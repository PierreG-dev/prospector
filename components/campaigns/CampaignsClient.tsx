"use client";

import { useEffect, useState } from "react";
import { Loader2, Pause, Play, Check, X, Pencil, Upload } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/shell/EmptyState";

type Campaign = {
  id: string;
  label: string;
  source_type: string;
  apify_actor: string | null;
  source_file: string | null;
  imported_at: string;
  raw_count: number;
  new_count: number;
  dup_count: number;
  filtered_count: number;
  paused: boolean;
  current_prospects: number;
};

type EditState =
  | { kind: "none" }
  | { kind: "label"; id: string; value: string }
  | { kind: "date"; id: string; value: string };

function toDateInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function CampaignsClient() {
  const [rows, setRows] = useState<Campaign[] | null>(null);
  const [edit, setEdit] = useState<EditState>({ kind: "none" });
  const [busyId, setBusyId] = useState<string | null>(null);
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
    const r = await fetch("/api/campaigns", { cache: "no-store" });
    const d = (await r.json()) as { campaigns: Campaign[] };
    setRows(d.campaigns);
  };

  useEffect(() => {
    load();
  }, []);

  const patch = async (id: string, body: Record<string, unknown>, msg: string) => {
    setBusyId(id);
    const r = await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusyId(null);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      showToast(d.error ?? "Erreur", "danger");
      return false;
    }
    showToast(msg, "success");
    await load();
    return true;
  };

  const saveLabel = async () => {
    if (edit.kind !== "label") return;
    const ok = await patch(edit.id, { label: edit.value }, "Nom mis à jour");
    if (ok) setEdit({ kind: "none" });
  };

  const saveDate = async () => {
    if (edit.kind !== "date") return;
    const iso = new Date(edit.value).toISOString();
    const ok = await patch(edit.id, { imported_at: iso }, "Date mise à jour");
    if (ok) setEdit({ kind: "none" });
  };

  const togglePause = async (c: Campaign) => {
    await patch(
      c.id,
      { paused: !c.paused },
      c.paused ? "Campagne réactivée" : "Campagne suspendue"
    );
  };

  if (rows === null) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-textMuted" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Upload}
        title="Aucune campagne"
        hint="Les imports Apify (JSON) s'affichent ici. Va sur /import pour en ajouter."
      />
    );
  }

  const activeCount = rows.filter((r) => !r.paused).length;
  const pausedCount = rows.length - activeCount;

  return (
    <>
      <div className="mb-4 flex gap-2 text-xs text-textMuted">
        <span>
          {rows.length} campagne{rows.length > 1 ? "s" : ""}
        </span>
        <span>·</span>
        <span>{activeCount} active{activeCount > 1 ? "s" : ""}</span>
        {pausedCount > 0 && (
          <>
            <span>·</span>
            <span className="text-snooze">{pausedCount} suspendue{pausedCount > 1 ? "s" : ""}</span>
          </>
        )}
      </div>

      <div className="space-y-3">
        {rows.map((c) => {
          const isEditingLabel = edit.kind === "label" && edit.id === c.id;
          const isEditingDate = edit.kind === "date" && edit.id === c.id;
          return (
            <Card key={c.id} className={c.paused ? "opacity-70" : ""}>
              <CardBody className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      {isEditingLabel ? (
                        <>
                          <input
                            autoFocus
                            value={edit.value}
                            onChange={(e) =>
                              setEdit({ kind: "label", id: c.id, value: e.target.value })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveLabel();
                              if (e.key === "Escape") setEdit({ kind: "none" });
                            }}
                            className="flex-1 rounded-lg border border-mid bg-white px-2 py-1 text-base font-medium focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none dark:bg-nightSurface dark:border-nightBorder"
                          />
                          <button
                            onClick={saveLabel}
                            className="p-1.5 rounded-full text-accent2 hover:bg-accent2/10"
                            aria-label="Enregistrer"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEdit({ kind: "none" })}
                            className="p-1.5 rounded-full text-textMuted hover:bg-mid/60"
                            aria-label="Annuler"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <h3 className="text-base font-medium truncate">{c.label}</h3>
                          <button
                            onClick={() =>
                              setEdit({ kind: "label", id: c.id, value: c.label })
                            }
                            className="p-1 rounded-full text-textMuted hover:text-warmDark hover:bg-mid/60 shrink-0"
                            aria-label="Renommer"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {c.paused && <Pill tone="warn">suspendue</Pill>}
                        </>
                      )}
                    </div>

                    <div className="mt-2 flex items-center gap-2 text-xs text-textMuted">
                      {isEditingDate ? (
                        <>
                          <input
                            type="datetime-local"
                            autoFocus
                            value={edit.value}
                            onChange={(e) =>
                              setEdit({ kind: "date", id: c.id, value: e.target.value })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveDate();
                              if (e.key === "Escape") setEdit({ kind: "none" });
                            }}
                            className="rounded-lg border border-mid bg-white px-2 py-1 text-xs focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none dark:bg-nightSurface dark:border-nightBorder"
                          />
                          <button
                            onClick={saveDate}
                            className="p-1 rounded-full text-accent2 hover:bg-accent2/10"
                            aria-label="Enregistrer"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setEdit({ kind: "none" })}
                            className="p-1 rounded-full text-textMuted hover:bg-mid/60"
                            aria-label="Annuler"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <span>
                            Importée le{" "}
                            {new Date(c.imported_at).toLocaleString("fr-FR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <button
                            onClick={() =>
                              setEdit({
                                kind: "date",
                                id: c.id,
                                value: toDateInputValue(c.imported_at),
                              })
                            }
                            className="p-0.5 rounded-full text-textMuted hover:text-warmDark hover:bg-mid/60"
                            aria-label="Modifier la date"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-4 text-xs">
                      <Stat label="Bruts" value={c.raw_count} />
                      <Stat label="Nouveaux" value={c.new_count} tone="accent2" />
                      <Stat label="Doublons" value={c.dup_count} tone="muted" />
                      <Stat
                        label="En base"
                        value={c.current_prospects}
                        tone="accent"
                      />
                      {c.source_file && (
                        <span className="text-textMuted truncate max-w-[240px]">
                          <span className="opacity-60">fichier :</span>{" "}
                          <code className="font-mono">{c.source_file}</code>
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => togglePause(c)}
                    disabled={busyId === c.id}
                    className={`shrink-0 inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium border transition ${
                      c.paused
                        ? "border-accent2 text-accent2 hover:bg-accent2/10"
                        : "border-snooze text-snooze hover:bg-snooze/10"
                    } disabled:opacity-50`}
                  >
                    {busyId === c.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : c.paused ? (
                      <Play className="h-3.5 w-3.5" />
                    ) : (
                      <Pause className="h-3.5 w-3.5" />
                    )}
                    {c.paused ? "Réactiver" : "Suspendre"}
                  </button>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-textMuted">
        Suspendre une campagne masque de la file de tri les prospects dont{" "}
        <strong>toutes</strong> les campagnes d'origine sont suspendues. Ceux qui
        apparaissent aussi dans une autre campagne active restent visibles.
      </p>

      <Toast open={toast.open} tone={toast.tone}>
        {toast.text}
      </Toast>
    </>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "muted" | "accent" | "accent2";
}) {
  const color =
    tone === "muted"
      ? "text-textMuted"
      : tone === "accent"
        ? "text-accent"
        : tone === "accent2"
          ? "text-accent2"
          : "text-warmDark dark:text-cream";
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className={`font-mono font-medium ${color}`}>{value}</span>
      <span className="text-textMuted">{label.toLowerCase()}</span>
    </span>
  );
}

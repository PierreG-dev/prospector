"use client";

import { useRef, useState } from "react";
import { Upload, FileJson, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/cn";

type Result = {
  run_id: string;
  raw_count: number;
  new_count: number;
  dup_count: number;
  filtered_count: number;
  duplicates_by_tier: { T1: number; T2: number; T3: number };
};

export function ImportForm() {
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = (f: File | null | undefined) => {
    if (!f) return;
    if (!/\.json$/i.test(f.name)) {
      setError("Le fichier doit être un .json (export dataset Apify).");
      return;
    }
    setError(null);
    setFile(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Sélectionne un fichier JSON.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("label", label || file.name.replace(/\.json$/i, ""));
      const r = await fetch("/api/import", { method: "POST", body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Erreur d'import");
      setResult(data as Result);
      setFile(null);
      setLabel("");
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardBody>
          <form onSubmit={submit} className="space-y-5">
            <div>
              <label
                htmlFor="label"
                className="text-sm font-medium text-warmDark"
              >
                Label de la campagne
              </label>
              <input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder='Ex : "Plombiers Toulouse 06/2026"'
                className="mt-1 w-full rounded-xl border border-mid bg-white px-4 py-2.5 text-sm placeholder:text-textMuted/60 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition"
              />
              <p className="mt-1 text-xs text-textMuted">
                Vide → le nom du fichier sera utilisé.
              </p>
            </div>

            <div>
              <span className="text-sm font-medium text-warmDark">
                Fichier JSON Apify
              </span>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  onFile(e.dataTransfer.files?.[0]);
                }}
                className={cn(
                  "mt-1 w-full rounded-2xl border-2 border-dashed py-10 px-6 transition-colors text-center group",
                  dragOver
                    ? "border-accent bg-accent/5"
                    : "border-mid bg-cream/40 hover:border-accent/60"
                )}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center group-hover:scale-105 transition-transform">
                    <FileJson className="h-6 w-6" strokeWidth={1.75} />
                  </div>
                  {file ? (
                    <>
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-textMuted">
                        {(file.size / 1024).toFixed(1)} ko · clic pour changer
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm">
                        Glisse ton export dataset ou{" "}
                        <span className="text-accent font-medium">parcours</span>
                      </p>
                      <p className="text-xs text-textMuted">
                        Format JSON uniquement
                      </p>
                    </>
                  )}
                </div>
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-reject/10 px-4 py-3 text-sm text-reject">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button
                type="submit"
                disabled={submitting || !file}
                trailingArrow={!submitting}
                icon={
                  submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )
                }
              >
                {submitting ? "Import en cours…" : "Importer"}
              </Button>
              <p className="text-xs text-textMuted">
                Dédup automatique sur toute la base. Les doublons ne sont pas
                restockés.
              </p>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-textMuted mb-4">
            Résultat
          </h3>
          {!result ? (
            <p className="text-sm text-textMuted">
              Lance un import pour voir les compteurs apparaître ici.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-accent2">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-medium">Import terminé</span>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Stat label="Lus" value={result.raw_count} tone="neutral" />
                <Stat label="Nouveaux" value={result.new_count} tone="accent2" />
                <Stat label="Doublons" value={result.dup_count} tone="warn" />
                <Stat label="Filtrés" value={result.filtered_count} tone="neutral" />
              </dl>
              <div className="pt-3 border-t border-mid">
                <p className="text-xs font-medium text-textMuted mb-2">
                  Doublons par cascade
                </p>
                <div className="flex flex-wrap gap-2">
                  <Pill tone="danger">T1 · {result.duplicates_by_tier.T1}</Pill>
                  <Pill tone="warn">T2 · {result.duplicates_by_tier.T2}</Pill>
                  <Pill tone="neutral">
                    T3 (créés badgés) · {result.duplicates_by_tier.T3}
                  </Pill>
                </div>
              </div>
              <p className="text-xs text-textMuted pt-2">
                Run id <span className="font-mono">{result.run_id}</span>
              </p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "accent2" | "warn";
}) {
  const toneClass =
    tone === "accent2"
      ? "text-accent2"
      : tone === "warn"
        ? "text-snooze"
        : "text-warmDark";
  return (
    <div className="rounded-xl bg-cream/60 border border-mid px-3 py-2">
      <dt className="text-xs text-textMuted">{label}</dt>
      <dd className={cn("text-2xl font-mono leading-tight", toneClass)}>
        {value}
      </dd>
    </div>
  );
}

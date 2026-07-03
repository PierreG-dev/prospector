"use client";

import { useState } from "react";
import Link from "next/link";
import { UserPlus, CheckCircle2, AlertCircle, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/cn";

type Result =
  | { status: "created"; prospect_id: string; tier: null | "T3" }
  | {
      status: "duplicate";
      tier: "T1" | "T2";
      match: { prospectId: string; matchedOn: string };
    };

const empty = {
  name: "",
  phone: "",
  website_url: "",
  city: "",
  gmaps_url: "",
  category: "",
};

export function ManualAddForm() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Le nom est obligatoire.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch("/api/prospects/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Erreur");
      setResult(data as Result);
      if (data.status === "created") setForm(empty);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Card>
      <CardBody>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={open}
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-mid/50 text-textMuted flex items-center justify-center dark:bg-nightBorder/50">
              <UserPlus className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-warmDark dark:text-cream">
                Ajouter à la main
              </h3>
              <p className="text-xs text-textMuted">
                Cas exceptionnel — l&apos;import JSON reste la voie normale.
              </p>
            </div>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-textMuted transition-transform",
              open && "rotate-180"
            )}
          />
        </button>

        {open && (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nom *" required>
                <input
                  value={form.name}
                  onChange={set("name")}
                  required
                  placeholder="Nom de l'entreprise"
                  className={inputCls}
                />
              </Field>
              <Field label="Ville">
                <input
                  value={form.city}
                  onChange={set("city")}
                  placeholder="Toulouse"
                  className={inputCls}
                />
              </Field>
              <Field label="Téléphone">
                <input
                  value={form.phone}
                  onChange={set("phone")}
                  placeholder="05 61 …"
                  className={inputCls}
                />
              </Field>
              <Field label="Site web">
                <input
                  value={form.website_url}
                  onChange={set("website_url")}
                  placeholder="https://…"
                  className={inputCls}
                />
              </Field>
              <Field label="URL Google Maps">
                <input
                  value={form.gmaps_url}
                  onChange={set("gmaps_url")}
                  placeholder="https://www.google.com/maps/place/…"
                  className={inputCls}
                />
              </Field>
              <Field label="Catégorie (indice métier)">
                <input
                  value={form.category}
                  onChange={set("category")}
                  placeholder="Plombier, Boulangerie…"
                  className={inputCls}
                />
              </Field>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-reject/10 px-3 py-2 text-sm text-reject">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {result && result.status === "created" && (
              <div className="flex items-start gap-2 rounded-xl bg-accent2/10 px-3 py-2 text-sm text-accent2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p>
                    Prospect créé
                    {result.tier === "T3" && " (doublon possible T3 — à arbitrer)"}
                    .{" "}
                    <Link
                      href={`/crm/${result.prospect_id}`}
                      className="underline underline-offset-2"
                    >
                      Ouvrir la fiche
                    </Link>
                  </p>
                </div>
              </div>
            )}

            {result && result.status === "duplicate" && (
              <div className="flex items-start gap-2 rounded-xl bg-snooze/10 px-3 py-2 text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-snooze" />
                <div>
                  <p className="font-medium">
                    Doublon <Pill tone="warn">{result.tier}</Pill>{" "}
                    <span className="text-textMuted font-normal">
                      (clé : {result.match.matchedOn})
                    </span>
                  </p>
                  <p className="text-textMuted">
                    Aucun prospect créé.{" "}
                    <Link
                      href={`/crm/${result.match.prospectId}`}
                      className="underline underline-offset-2"
                    >
                      Voir la fiche existante
                    </Link>
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button
                type="submit"
                variant="secondary"
                disabled={submitting || !form.name.trim()}
                icon={
                  submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )
                }
              >
                {submitting ? "Ajout…" : "Créer le prospect"}
              </Button>
              <p className="text-xs text-textMuted">
                Passe par la même cascade de dédup que l&apos;import.
              </p>
            </div>
          </form>
        )}
      </CardBody>
    </Card>
  );
}

const inputCls =
  "mt-1 w-full rounded-xl border border-mid bg-white px-3 py-2 text-sm placeholder:text-textMuted/60 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition dark:bg-nightSurface dark:border-nightBorder dark:text-cream dark:placeholder:text-nightMuted/60";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-medium text-textMuted">
      {label}
      {required && <span className="sr-only"> (obligatoire)</span>}
      {children}
    </label>
  );
}

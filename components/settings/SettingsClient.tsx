"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Toast } from "@/components/ui/Toast";
import { Pill } from "@/components/ui/Pill";

type Settings = {
  relance_delays: [number, number, number];
  auto_perdu: boolean;
};
type EnvStatus = {
  mongodb: boolean;
  pushover: boolean;
  cron_secret: boolean;
  internal_cron_disabled: boolean;
};

export function SettingsClient() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [env, setEnv] = useState<EnvStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    open: boolean;
    text: string;
    tone: "neutral" | "success" | "danger";
  }>({ open: false, text: "", tone: "neutral" });
  const [delays, setDelays] = useState<[string, string, string]>(["3", "7", "14"]);
  const [autoPerdu, setAutoPerdu] = useState(false);

  const showToast = (
    text: string,
    tone: "neutral" | "success" | "danger" = "neutral"
  ) => {
    setToast({ open: true, text, tone });
    window.setTimeout(() => setToast((t) => ({ ...t, open: false })), 2000);
  };

  const load = async () => {
    setLoading(true);
    const r = await fetch("/api/settings", { cache: "no-store" });
    const d = (await r.json()) as { settings: Settings; env: EnvStatus };
    setSettings(d.settings);
    setEnv(d.env);
    setDelays([
      String(d.settings.relance_delays[0]),
      String(d.settings.relance_delays[1]),
      String(d.settings.relance_delays[2]),
    ]);
    setAutoPerdu(d.settings.auto_perdu);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    const parsed: [number, number, number] = [
      Math.max(0, Math.floor(Number(delays[0]) || 0)),
      Math.max(0, Math.floor(Number(delays[1]) || 0)),
      Math.max(0, Math.floor(Number(delays[2]) || 0)),
    ];
    setSaving(true);
    const r = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        relance_delays: parsed,
        auto_perdu: autoPerdu,
      }),
    });
    setSaving(false);
    if (!r.ok) {
      const d = await r.json();
      showToast(d.error ?? "Erreur", "danger");
      return;
    }
    showToast("Réglages enregistrés", "success");
    await load();
  };

  const reset = () => {
    setDelays(["3", "7", "14"]);
    setAutoPerdu(false);
  };

  if (loading || !settings || !env) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-textMuted" />
      </div>
    );
  }

  const dirty =
    delays.some(
      (d, i) => Number(d) !== settings.relance_delays[i]
    ) || autoPerdu !== settings.auto_perdu;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <Card>
          <CardBody>
            <h3 className="text-[11px] uppercase tracking-wider text-textMuted mb-1">
              Moteur d'escalade
            </h3>
            <p className="text-sm text-textMuted mb-5">
              Délais entre échelons consécutifs, en jours. Le passage à{" "}
              <span className="font-medium text-warmDark">Contacté</span> arme la
              première relance.
            </p>

            <div className="grid grid-cols-3 gap-3">
              <DelayInput
                label="R1 (depuis Contacté)"
                value={delays[0]}
                onChange={(v) => setDelays([v, delays[1], delays[2]])}
              />
              <DelayInput
                label="R2 (depuis R1)"
                value={delays[1]}
                onChange={(v) => setDelays([delays[0], v, delays[2]])}
              />
              <DelayInput
                label="R3 (depuis R2)"
                value={delays[2]}
                onChange={(v) => setDelays([delays[0], delays[1], v])}
              />
            </div>

            <div className="mt-6 pt-5 border-t border-mid flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Auto-bascule en « Perdu »</p>
                <p className="mt-1 text-xs text-textMuted">
                  Après la 3ᵉ relance sans réponse, fait passer
                  automatiquement le prospect en <code>perdu</code>. Désactivé
                  par défaut (tu gardes la main).
                </p>
              </div>
              <Toggle checked={autoPerdu} onChange={setAutoPerdu} />
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              {dirty && (
                <button
                  onClick={reset}
                  className="text-xs text-textMuted hover:text-warmDark transition inline-flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  Défauts (3/7/14)
                </button>
              )}
              <Button
                disabled={saving || !dirty}
                icon={
                  saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )
                }
                onClick={save}
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="text-[11px] uppercase tracking-wider text-textMuted mb-3">
              Sauvegarde
            </h3>
            <p className="text-sm text-textMuted">
              La base se sauvegarde avec{" "}
              <code className="text-warmDark">mongodump</code> :
            </p>
            <pre className="mt-3 rounded-xl bg-warmDark text-cream text-xs p-3 overflow-x-auto font-mono">
{`mongodump --uri="$MONGODB_URI" --out=./backup-$(date +%Y%m%d)`}
            </pre>
            <p className="mt-3 text-xs text-textMuted">
              Restauration : <code>mongorestore --uri=&quot;$MONGODB_URI&quot; ./backup-…</code>
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="space-y-5">
        <Card>
          <CardBody>
            <h3 className="text-[11px] uppercase tracking-wider text-textMuted mb-3">
              Statut .env
            </h3>
            <ul className="space-y-2 text-sm">
              <EnvRow label="MONGODB_URI" ok={env.mongodb} />
              <EnvRow label="PUSHOVER_TOKEN / USER" ok={env.pushover} />
              <EnvRow label="CRON_SECRET" ok={env.cron_secret} />
              <li className="flex items-center justify-between pt-2 border-t border-mid">
                <span className="text-xs text-textMuted">Worker interne</span>
                {env.internal_cron_disabled ? (
                  <Pill tone="warn">désactivé</Pill>
                ) : (
                  <Pill tone="accent2">actif</Pill>
                )}
              </li>
            </ul>
            <p className="mt-4 text-[11px] text-textMuted">
              Les valeurs des secrets ne sont jamais affichées. Seul leur
              présence est révélée.
            </p>
          </CardBody>
        </Card>
      </div>

      <Toast open={toast.open} tone={toast.tone}>
        {toast.text}
      </Toast>
    </div>
  );
}

function DelayInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-textMuted">{label}</span>
      <div className="mt-1 relative">
        <input
          type="number"
          min={0}
          step={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-mid bg-white px-3 py-2 text-sm pr-12 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none font-mono"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-textMuted">
          jours
        </span>
      </div>
    </label>
  );
}

function EnvRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-xs">{label}</span>
      {ok ? (
        <span className="inline-flex items-center gap-1 text-xs text-accent2">
          <CheckCircle2 className="h-3.5 w-3.5" /> renseigné
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs text-reject">
          <XCircle className="h-3.5 w-3.5" /> manquant
        </span>
      )}
    </li>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={`h-6 w-11 rounded-full transition-colors relative ${
        checked ? "bg-accent" : "bg-mid"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-warm-sm transition-transform ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

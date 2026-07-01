"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Calendar,
  ZapOff,
  Loader2,
  Check,
  ChevronRight,
  Clock,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { PIPELINE_LABEL } from "@/lib/pipeline";
import { cn } from "@/lib/cn";
import type { LucideIcon } from "lucide-react";

type ReminderRow = {
  _id: string;
  prospect_id: string;
  prospect_name: string;
  due_at: string;
  label: string | null;
  kind: "simple" | "relance" | "sequence_step";
  relance_index: number | null;
  priority: number;
};

type ProspectRow = {
  _id: string;
  name: string;
  city: string | null;
  trade: string | null;
  pipeline_status: string | null;
  relance_count: number;
  relance_paused: boolean;
  last_status_at: string | null;
};

type Buckets = {
  en_retard: ReminderRow[];
  aujourd_hui: ReminderRow[];
  cette_semaine: ReminderRow[];
  relances_epuisees: ProspectRow[];
  sans_prochaine_action: ProspectRow[];
};

function fmtDue(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DashboardClient() {
  const [data, setData] = useState<Buckets | null>(null);
  const [loading, setLoading] = useState(true);
  const [gererOpen, setGererOpen] = useState(false);
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
    window.setTimeout(() => setToast((t) => ({ ...t, open: false })), 1800);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/reminders", { cache: "no-store" });
    const d = (await r.json()) as Buckets;
    setData(d);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markDone = async (id: string) => {
    await fetch(`/api/reminders/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ done: true }),
    });
    showToast("Rappel marqué comme fait", "success");
    load();
  };

  const reschedule = async (id: string, days: number) => {
    const due = new Date();
    due.setDate(due.getDate() + days);
    due.setHours(9, 0, 0, 0);
    await fetch(`/api/reminders/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ due_at: due.toISOString() }),
    });
    showToast(`Reporté à +${days}j`, "neutral");
    load();
  };

  const deleteReminder = async (id: string) => {
    await fetch(`/api/reminders/${id}`, { method: "DELETE" });
    showToast("Rappel supprimé", "neutral");
    load();
  };

  if (loading || !data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 text-textMuted animate-spin" />
      </div>
    );
  }

  const maintenant = [...data.en_retard, ...data.aujourd_hui];
  const maintenantTone: "reject" | "accent" =
    data.en_retard.length > 0 ? "reject" : "accent";

  const gererCount =
    data.relances_epuisees.length + data.sans_prochaine_action.length;

  return (
    <div className="space-y-5">
      {/* Bucket 1 : À faire maintenant (en retard + aujourd'hui fusionnés) */}
      <BucketSection
        icon={Calendar}
        title="À faire maintenant"
        tone={maintenantTone}
        count={maintenant.length}
      >
        {maintenant.length === 0 ? (
          <Empty>Rien d&apos;urgent. Tu es à jour.</Empty>
        ) : (
          <ul className="divide-y divide-mid">
            {maintenant.map((r) => (
              <ReminderItem
                key={r._id}
                row={r}
                accent={data.en_retard.find((x) => x._id === r._id) ? "reject" : "accent"}
                onDone={() => markDone(r._id)}
                onReschedule={(d) => reschedule(r._id, d)}
                onDelete={() => deleteReminder(r._id)}
              />
            ))}
          </ul>
        )}
      </BucketSection>

      {/* Bucket 2 : Cette semaine */}
      <BucketSection
        icon={CalendarDays}
        title="Cette semaine"
        tone="accent2"
        count={data.cette_semaine.length}
      >
        {data.cette_semaine.length === 0 ? (
          <Empty>Rien de prévu cette semaine.</Empty>
        ) : (
          <ul className="divide-y divide-mid">
            {data.cette_semaine.map((r) => (
              <ReminderItem
                key={r._id}
                row={r}
                accent="accent2"
                onDone={() => markDone(r._id)}
                onReschedule={(d) => reschedule(r._id, d)}
                onDelete={() => deleteReminder(r._id)}
              />
            ))}
          </ul>
        )}
      </BucketSection>

      {/* Bucket 3 : À gérer (collapsible, s'ouvre seulement si non vide) */}
      {gererCount > 0 && (
        <div>
          <button
            onClick={() => setGererOpen((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3 rounded-2xl border border-mid dark:border-nightBorder bg-white dark:bg-nightSurface text-sm font-medium hover:bg-cream/60 dark:hover:bg-nightBorder/40 transition"
          >
            <span className="flex items-center gap-2 text-textMuted">
              <ZapOff className="h-4 w-4" />
              À gérer
              <span className="font-mono text-xs">({gererCount})</span>
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-textMuted transition-transform",
                gererOpen && "rotate-180"
              )}
            />
          </button>
          {gererOpen && (
            <div className="mt-2 space-y-3">
              {data.relances_epuisees.length > 0 && (
                <div className="rounded-2xl border border-mid dark:border-nightBorder bg-white dark:bg-nightSurface overflow-hidden">
                  <div className="px-5 py-2.5 border-b border-mid dark:border-nightBorder text-xs font-medium text-textMuted">
                    Rappels épuisés — 3/3 sans réponse · décision manuelle
                  </div>
                  <ul className="divide-y divide-mid dark:divide-nightBorder">
                    {data.relances_epuisees.map((p) => (
                      <ProspectItem key={p._id} row={p} tone="neutral" />
                    ))}
                  </ul>
                </div>
              )}
              {data.sans_prochaine_action.length > 0 && (
                <div className="rounded-2xl border border-mid dark:border-nightBorder bg-white dark:bg-nightSurface overflow-hidden">
                  <div className="px-5 py-2.5 border-b border-mid dark:border-nightBorder text-xs font-medium text-textMuted">
                    Contacts retenus sans rappel programmé
                  </div>
                  <ul className="divide-y divide-mid dark:divide-nightBorder">
                    {data.sans_prochaine_action.map((p) => (
                      <ProspectItem key={p._id} row={p} tone="warn" />
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Toast open={toast.open} tone={toast.tone}>
        {toast.text}
      </Toast>
    </div>
  );
}

function BucketSection({
  icon: Icon,
  title,
  tone,
  count,
  children,
}: {
  icon: LucideIcon;
  title: string;
  tone: "reject" | "accent" | "accent2" | "warn" | "neutral";
  count: number;
  children: React.ReactNode;
}) {
  const dotClass =
    tone === "reject"
      ? "bg-reject"
      : tone === "accent"
        ? "bg-accent"
        : tone === "accent2"
          ? "bg-accent2"
          : tone === "warn"
            ? "bg-snooze"
            : "bg-textMuted";
  return (
    <Card>
      <div className="px-5 py-3 border-b border-mid dark:border-nightBorder flex items-center gap-3">
        <span className={cn("h-2 w-2 rounded-full", dotClass)} />
        <Icon className="h-4 w-4 text-warmDark dark:text-cream" strokeWidth={2} />
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-textMuted font-mono">({count})</span>
      </div>
      <div>{children}</div>
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-6 text-sm text-textMuted">{children}</p>;
}

function ReminderItem({
  row,
  accent,
  onDone,
  onReschedule,
  onDelete,
}: {
  row: ReminderRow;
  accent: "reject" | "accent" | "accent2";
  onDone: () => void;
  onReschedule: (days: number) => void;
  onDelete: () => void;
}) {
  const isRelance = row.kind === "relance";
  return (
    <li className="px-5 py-3 flex items-center gap-4 hover:bg-cream/60 dark:hover:bg-nightBorder/30 transition group">
      <div className="flex-1 min-w-0">
        <Link
          href={`/crm/${row.prospect_id}`}
          className="font-medium hover:text-accent transition"
        >
          {row.prospect_name}
        </Link>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-textMuted">
          <Clock className="h-3 w-3" />
          {fmtDue(row.due_at)}
          {row.label && <span>· {row.label}</span>}
          {isRelance && row.relance_index && (
            <Pill tone="warn">
              Rappel {row.relance_index}/3
            </Pill>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition">
        <ActionIcon
          title="Reporter à +1 jour"
          onClick={() => onReschedule(1)}
          label="+1j"
        />
        <ActionIcon
          title="Reporter à +1 semaine"
          onClick={() => onReschedule(7)}
          label="+7j"
        />
        <button
          onClick={onDone}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs transition",
            accent === "reject"
              ? "text-reject hover:bg-reject/10"
              : accent === "accent"
                ? "text-accent hover:bg-accent/10"
                : "text-accent2 hover:bg-accent2/10"
          )}
        >
          <Check className="h-3 w-3" />
          Fait
        </button>
        <button
          onClick={onDelete}
          title="Supprimer"
          className="text-textMuted/50 hover:text-reject transition p-1.5 rounded-full"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

function ActionIcon({
  onClick,
  label,
  title,
}: {
  onClick: () => void;
  label: string;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="text-xs text-textMuted hover:text-warmDark hover:bg-mid/60 rounded-full px-2 py-1 transition"
    >
      {label}
    </button>
  );
}

function ProspectItem({
  row,
  tone,
}: {
  row: ProspectRow;
  tone: "neutral" | "warn";
}) {
  return (
    <li>
      <Link
        href={`/crm/${row._id}`}
        className="px-5 py-3 flex items-center gap-4 hover:bg-cream/60 transition group"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{row.name}</span>
            {row.trade && (
              <span className="text-xs text-textMuted">· {row.trade}</span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-textMuted flex items-center gap-2">
            {row.city && <span>{row.city}</span>}
            {row.pipeline_status && (
              <Pill tone={tone === "warn" ? "warn" : "neutral"}>
                {PIPELINE_LABEL[row.pipeline_status as keyof typeof PIPELINE_LABEL] ??
                  row.pipeline_status}
              </Pill>
            )}
            {row.relance_count >= 3 && (
              <span>3/3 rappels sans réponse</span>
            )}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-textMuted/60 group-hover:text-accent transition" />
      </Link>
    </li>
  );
}

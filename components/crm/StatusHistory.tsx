import { History } from "lucide-react";
import { PIPELINE_LABEL } from "@/lib/pipeline";
import type { PipelineStatus } from "@/lib/types";

export type StatusEntry = {
  from: string | null;
  to: string;
  note: string | null;
  created_at: string;
};

function fmt(d: string) {
  const date = new Date(d);
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function label(v: string | null): string {
  if (!v) return "—";
  if (v in PIPELINE_LABEL) return PIPELINE_LABEL[v as PipelineStatus];
  // valeurs hors pipeline (qualify/reject/snooze venant de /decide)
  if (v === "qualify") return "Qualifié";
  if (v === "reject") return "Rejeté";
  if (v === "snooze") return "Snoozé";
  if (v === "inbox") return "Inbox";
  if (v === "rejected") return "Rejeté";
  if (v === "qualified") return "Qualifié";
  if (v === "snoozed") return "Snoozé";
  return v;
}

export function StatusHistory({ entries }: { entries: StatusEntry[] }) {
  if (!entries?.length) {
    return (
      <p className="text-sm text-textMuted dark:text-nightMuted">Aucune transition enregistrée.</p>
    );
  }
  const sorted = [...entries].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return (
    <ol className="relative border-l border-mid dark:border-nightBorder pl-5 space-y-4 ml-1.5">
      {sorted.map((e, i) => (
        <li key={i}>
          <span className="absolute -left-[5px] mt-1 h-2.5 w-2.5 rounded-full bg-accent" />
          <div className="text-sm">
            <span className="text-textMuted dark:text-nightMuted">{label(e.from)}</span>
            <span className="text-textMuted dark:text-nightMuted mx-1.5">→</span>
            <span className="font-medium dark:text-cream">{label(e.to)}</span>
          </div>
          <div className="text-xs text-textMuted dark:text-nightMuted mt-0.5 flex items-center gap-1.5">
            <History className="h-3 w-3" />
            {fmt(e.created_at)}
          </div>
          {e.note && (
            <p className="mt-1.5 text-xs text-warmDark/90 dark:text-cream/90 italic bg-cream/60 dark:bg-nightBorder/30 border border-mid dark:border-nightBorder rounded-md px-2.5 py-1.5">
              « {e.note} »
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

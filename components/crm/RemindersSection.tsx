"use client";

import { useEffect, useState } from "react";
import { Plus, Check, Clock, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/cn";

type Row = {
  _id: string;
  due_at: string;
  label: string | null;
  kind: "simple" | "relance" | "sequence_step";
  relance_index: number | null;
  priority: number;
};

function fmtDue(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toLocalDateInput(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function RemindersSection({
  prospectId,
  onChange,
}: {
  prospectId: string;
  onChange?: () => void;
}) {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return toLocalDateInput(d);
  });
  const [time, setTime] = useState("");

  const load = async () => {
    setLoading(true);
    const r = await fetch(
      `/api/reminders?prospect_id=${encodeURIComponent(prospectId)}`,
      { cache: "no-store" }
    );
    const d = (await r.json()) as { items: Row[] };
    setItems(d.items ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospectId]);

  const create = async () => {
    if (!date) return;
    const timePart = /^\d{2}:\d{2}$/.test(time) ? time : "09:00";
    const dt = new Date(`${date}T${timePart}:00`);
    await fetch("/api/reminders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prospect_id: prospectId,
        due_at: dt.toISOString(),
        label: label.trim() || null,
      }),
    });
    setLabel("");
    setTime("");
    setAdding(false);
    await load();
    onChange?.();
  };

  const markDone = async (id: string) => {
    await fetch(`/api/reminders/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ done: true }),
    });
    await load();
    onChange?.();
  };

  const remove = async (id: string) => {
    await fetch(`/api/reminders/${id}`, { method: "DELETE" });
    await load();
    onChange?.();
  };

  return (
    <div className="space-y-3">
      {!adding && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-textMuted">
            {items.length === 0
              ? "Aucun rappel ouvert."
              : `${items.length} rappel${items.length > 1 ? "s" : ""} ouvert${items.length > 1 ? "s" : ""}`}
          </p>
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => setAdding(true)}
          >
            Nouveau
          </Button>
        </div>
      )}

      {adding && (
        <div className="rounded-2xl border border-mid bg-cream/40 p-3 space-y-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder='Label (ex : "Relancer après devis")'
            className="w-full rounded-xl border border-mid bg-white px-3 py-2 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              min={toLocalDateInput(new Date())}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 rounded-xl border border-mid bg-white px-3 py-2 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="09:00"
              title="Heure (optionnelle, défaut 09:00)"
              className="w-28 rounded-xl border border-mid bg-white px-3 py-2 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAdding(false);
                setLabel("");
              }}
            >
              Annuler
            </Button>
            <Button size="sm" onClick={create}>
              Créer
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-4 text-textMuted">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : items.length === 0 ? null : (
        <ul className="space-y-2">
          {items.map((r) => (
            <li
              key={r._id}
              className={cn(
                "rounded-xl border border-mid bg-white px-3 py-2.5 flex items-center gap-3",
                new Date(r.due_at) < new Date() &&
                  "border-reject/40 bg-reject/[0.04]"
              )}
            >
              <Clock className="h-3.5 w-3.5 text-textMuted shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  {r.label ??
                    (r.kind === "relance"
                      ? `Relance ${r.relance_index}/3`
                      : "Rappel")}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-textMuted">
                  <span>{fmtDue(r.due_at)}</span>
                  {r.kind === "relance" && (
                    <Pill tone="warn">
                      relance · priorité {r.priority}
                    </Pill>
                  )}
                </div>
              </div>
              <button
                onClick={() => markDone(r._id)}
                title="Marquer comme fait"
                className="text-accent2 hover:bg-accent2/10 rounded-full px-2 py-1 text-xs inline-flex items-center gap-1 transition"
              >
                <Check className="h-3 w-3" /> Fait
              </button>
              <button
                onClick={() => remove(r._id)}
                title="Supprimer"
                className="text-textMuted/60 hover:text-reject p-1 transition"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

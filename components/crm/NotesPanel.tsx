"use client";

import { useState } from "react";
import { Plus, Loader2, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/Button";

export type Note = { body: string; created_at: string };

function fmt(d: string) {
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotesPanel({
  notes,
  onAdd,
}: {
  notes: Note[];
  onAdd: (body: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await onAdd(text.trim());
      setText("");
    } finally {
      setBusy(false);
    }
  };

  const sorted = [...(notes ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-mid dark:border-nightBorder bg-cream/40 dark:bg-nightBorder/20 p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Une nouvelle note (accroche, objection, retour d'appel…)"
          rows={3}
          className="w-full bg-transparent text-sm dark:text-cream placeholder:text-textMuted/60 dark:placeholder:text-nightMuted/60 focus:outline-none resize-none"
        />
        <div className="flex justify-end mt-1">
          <Button
            size="sm"
            onClick={submit}
            disabled={!text.trim() || busy}
            icon={
              busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )
            }
          >
            Ajouter
          </Button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-textMuted dark:text-nightMuted flex items-center gap-2">
          <NotebookPen className="h-4 w-4" /> Aucune note.
        </p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((n, i) => (
            <li
              key={i}
              className="rounded-xl border border-mid dark:border-nightBorder bg-white dark:bg-nightBorder/30 px-4 py-3 shadow-warm-sm"
            >
              <p className="text-sm whitespace-pre-wrap dark:text-cream">{n.body}</p>
              <p className="mt-1 text-[11px] text-textMuted dark:text-nightMuted">
                {fmt(n.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

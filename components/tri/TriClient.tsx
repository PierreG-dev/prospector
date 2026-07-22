"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useHotkeys } from "react-hotkeys-hook";
import { Inbox, RefreshCw, Check, X as XIcon, Clock, Bell, ArrowRight } from "lucide-react";
import { TriCard } from "./TriCard";
import { SnoozeDialog } from "./SnoozeDialog";
import { PrepAppelPanel } from "./PrepAppelPanel";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import type { TriCandidate } from "@/lib/queue/pick";

type UndoSnapshot = {
  prospectId: string;
  action: "qualify" | "reject" | "snooze";
  lifecycle: string;
  pipeline_status: string | null;
  snooze_until: string | null;
};

type PostActionState = {
  prospectId: string;
  prospectName: string;
  action: "qualify";
};

type SessionStats = { qualified: number; rejected: number; snoozed: number };

type Direction = "right" | "left" | "up" | null;

const UNDO_MAX = 5;

export function TriClient() {
  const [current, setCurrent] = useState<TriCandidate | null>(null);
  const [next, setNext] = useState<TriCandidate | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exitDir, setExitDir] = useState<Direction>(null);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [prepOpen, setPrepOpen] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);
  const [stats, setStats] = useState<SessionStats>({
    qualified: 0,
    rejected: 0,
    snoozed: 0,
  });
  const [toast, setToast] = useState<{
    open: boolean;
    text: string;
    tone: "neutral" | "success" | "danger";
  }>({ open: false, text: "", tone: "neutral" });
  const [postAction, setPostAction] = useState<PostActionState | null>(null);
  const [now, setNow] = useState(() => new Date());
  // IDs déjà vus dans CETTE session, pour éviter de retomber tout de suite dessus en cas d'undo+re-pick.
  const sessionSeen = useRef<Set<string>>(new Set());
  const busyRef = useRef(false);

  // Rafraîchir "now" toutes les minutes pour que les indicateurs de créneau évoluent.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const showToast = useCallback(
    (text: string, tone: "neutral" | "success" | "danger" = "neutral") => {
      setToast({ open: true, text, tone });
      window.setTimeout(() => setToast((t) => ({ ...t, open: false })), 2200);
    },
    []
  );

  const fetchNext = useCallback(
    async (excludeExtra: string[] = []): Promise<TriCandidate | null> => {
      const exclude = Array.from(
        new Set([
          ...Array.from(sessionSeen.current),
          ...excludeExtra,
        ])
      );
      const url = `/api/prospects/next?exclude=${exclude.join(",")}`;
      const r = await fetch(url, { cache: "no-store" });
      const data = (await r.json()) as {
        candidate: TriCandidate | null;
        remaining: number;
      };
      setRemaining(data.remaining);
      return data.candidate;
    },
    []
  );

  // Premier chargement : on tire la carte courante + on précharge la suivante.
  useEffect(() => {
    (async () => {
      setLoading(true);
      const first = await fetchNext();
      setCurrent(first);
      if (first) {
        sessionSeen.current.add(first.id);
        const n = await fetchNext();
        setNext(n);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advance = useCallback(
    async (dir: Direction) => {
      // On promeut `next` en `current`, puis on précharge un nouveau next.
      setExitDir(dir);
      // Laisse 130ms pour l'anim de sortie
      await new Promise((r) => setTimeout(r, 130));
      setExitDir(null);
      const promoted = next;
      if (promoted) sessionSeen.current.add(promoted.id);
      setCurrent(promoted ?? null);
      // Précharge le suivant en arrière-plan
      if (promoted) {
        fetchNext().then((n) => setNext(n));
      } else {
        setNext(null);
        // Recompte simplement (file vide)
        fetchNext().then((again) => {
          if (again) {
            sessionSeen.current.add(again.id);
            setCurrent(again);
            fetchNext().then((n) => setNext(n));
          }
        });
      }
    },
    [next, fetchNext]
  );

  const decide = useCallback(
    async (
      action: "qualify" | "reject" | "snooze",
      opts?: { snooze_until?: Date }
    ) => {
      if (!current || busyRef.current) return;
      busyRef.current = true;
      const prospectId = current.id;
      const prospectName = current.name;
      try {
        const r = await fetch(`/api/prospects/${prospectId}/decide`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action,
            snooze_until: opts?.snooze_until?.toISOString(),
          }),
        });
        const data = (await r.json()) as {
          ok?: boolean;
          snapshot?: UndoSnapshot["lifecycle"] extends never
            ? never
            : {
                lifecycle: string;
                pipeline_status: string | null;
                snooze_until: string | null;
              };
          error?: string;
        };
        if (!r.ok || !data.snapshot) {
          showToast(data.error ?? "Erreur", "danger");
          return;
        }
        setUndoStack((s) =>
          [{ prospectId, action, ...data.snapshot! }, ...s].slice(0, UNDO_MAX)
        );
        setStats((p) => ({
          qualified: p.qualified + (action === "qualify" ? 1 : 0),
          rejected: p.rejected + (action === "reject" ? 1 : 0),
          snoozed: p.snoozed + (action === "snooze" ? 1 : 0),
        }));
        const dir: Direction =
          action === "qualify" ? "right" : action === "reject" ? "left" : "up";
        await advance(dir);
        if (action === "qualify") {
          setPostAction({ prospectId, prospectName, action });
        } else if (action === "snooze") {
          const when = opts?.snooze_until;
          const label = when
            ? when.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
            : null;
          showToast(label ? `Snoozé jusqu'au ${label}` : "Snoozé", "neutral");
        } else {
          showToast("Pas intéressé", "danger");
        }
      } finally {
        busyRef.current = false;
      }
    },
    [current, advance, showToast]
  );

  const onUndo = useCallback(async () => {
    if (undoStack.length === 0 || busyRef.current) return;
    busyRef.current = true;
    try {
      const [last, ...rest] = undoStack;
      const r = await fetch(`/api/prospects/${last.prospectId}/undo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lifecycle: last.lifecycle,
          pipeline_status: last.pipeline_status,
          snooze_until: last.snooze_until,
        }),
      });
      if (!r.ok) {
        showToast("Annulation impossible", "danger");
        return;
      }
      setUndoStack(rest);
      sessionSeen.current.delete(last.prospectId);
      const resurrected = await fetchNext();
      if (current) setNext(current);
      setCurrent(resurrected);
      setStats((p) => ({
        qualified: p.qualified - (last.action === "qualify" ? 1 : 0),
        rejected: p.rejected - (last.action === "reject" ? 1 : 0),
        snoozed: p.snoozed - (last.action === "snooze" ? 1 : 0),
      }));
      showToast("Annulé", "neutral");
    } finally {
      busyRef.current = false;
    }
  }, [undoStack, current, showToast]);

  // --- Hotkeys ---
  const enable = !!current && !snoozeOpen && !prepOpen;
  useHotkeys("right, d", () => enable && decide("qualify"), [enable, decide]);
  useHotkeys("left, k", () => enable && decide("reject"), [enable, decide]);
  useHotkeys("up, l", () => enable && setSnoozeOpen(true), [enable]);
  useHotkeys("u, ctrl+z, meta+z", () => onUndo(), { preventDefault: true }, [onUndo]);
  useHotkeys(
    "shift+slash, /",
    () => enable && setPrepOpen((v) => !v),
    { preventDefault: true },
    [enable]
  );
  useHotkeys(
    "o",
    () => {
      if (!enable) return;
      const url = current?.website_url;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    },
    [enable, current]
  );
  useHotkeys(
    "m",
    () => {
      if (!enable) return;
      const url = current?.gmaps_url;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    },
    [enable, current]
  );
  useHotkeys(
    "t",
    () => {
      if (!enable) return;
      const tel = current?.phone;
      if (tel) window.location.href = `tel:${tel.replace(/[^\d+]/g, "")}`;
    },
    [enable, current]
  );
  useHotkeys(
    "f",
    () => {
      if (!enable || !current) return;
      window.open(`/crm/${current.id}`, "_blank", "noopener,noreferrer");
    },
    [enable, current]
  );

  // --- Render ---
  if (loading) {
    return (
      <div className="flex justify-center pt-8">
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  if (!current) {
    return <EndOfQueue stats={stats} onReload={() => location.reload()} />;
  }

  const exitX = exitDir === "right" ? 320 : exitDir === "left" ? -320 : 0;
  const exitY = exitDir === "up" ? -260 : 0;
  const exitRotate = exitDir === "right" ? 6 : exitDir === "left" ? -6 : 0;

  return (
    <div className="flex justify-center pt-2">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{
            x: exitX,
            y: exitY,
            opacity: 0,
            rotate: exitRotate,
          }}
          transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
          className="w-full flex justify-center"
        >
          <TriCard
            candidate={current}
            remaining={remaining}
            onQualify={() => decide("qualify")}
            onReject={() => decide("reject")}
            onSnooze={() => setSnoozeOpen(true)}
            onOpenPrep={() => setPrepOpen(true)}
            onUndo={onUndo}
            canUndo={undoStack.length > 0}
            now={now}
          />
        </motion.div>
      </AnimatePresence>

      {postAction && (
        <PostActionPanel
          prospectId={postAction.prospectId}
          prospectName={postAction.prospectName}
          action={postAction.action}
          onClose={(note) => {
            if (note) showToast("Note enregistrée", "success");
            else showToast("Intéressé ✓", "success");
            setPostAction(null);
          }}
        />
      )}

      <SnoozeDialog
        open={snoozeOpen}
        onClose={() => setSnoozeOpen(false)}
        onConfirm={(when) => {
          setSnoozeOpen(false);
          decide("snooze", { snooze_until: when });
        }}
      />

      <PrepAppelPanel
        open={prepOpen}
        candidate={current}
        onClose={() => setPrepOpen(false)}
        onSaveNote={async (note) => {
          if (!current) return;
          await fetch(`/api/prospects/${current.id}/notes`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ body: note }),
          });
          showToast("Note enregistrée", "success");
        }}
      />

      <Toast open={toast.open} tone={toast.tone}>
        {toast.text}
      </Toast>
    </div>
  );
}

function EndOfQueue({
  stats,
  onReload,
}: {
  stats: SessionStats;
  onReload: () => void;
}) {
  return (
    <div className="max-w-xl mx-auto pt-8">
      <Card>
        <CardBody className="py-12 text-center">
          <div className="h-14 w-14 mx-auto rounded-xl bg-accent2/15 text-accent2 flex items-center justify-center mb-4">
            <Inbox className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <h2 className="text-xl font-semibold">File terminée</h2>
          <p className="mt-2 text-sm text-textMuted max-w-md mx-auto">
            Plus rien à appeler pour le moment. Les rappels programmés
            réapparaîtront à leur date. Importe un nouveau run pour continuer.
          </p>

          <div className="mt-6 inline-flex gap-3">
            <RecapPill
              icon={<Check className="h-3.5 w-3.5" />}
              tone="accent2"
              value={stats.qualified}
              label="intéressés"
            />
            <RecapPill
              icon={<XIcon className="h-3.5 w-3.5" />}
              tone="reject"
              value={stats.rejected}
              label="archivés"
            />
            <RecapPill
              icon={<Clock className="h-3.5 w-3.5" />}
              tone="snooze"
              value={stats.snoozed}
              label="rappelés"
            />
          </div>

          <div className="mt-7 flex justify-center gap-3">
            <Button
              variant="secondary"
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={onReload}
            >
              Recharger
            </Button>
            <Button trailingArrow onClick={() => (location.href = "/import")}>
              Importer un run
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function PostActionPanel({
  prospectId,
  prospectName,
  action,
  onClose,
}: {
  prospectId: string;
  prospectName: string;
  action: "qualify";
  onClose: (noteSaved: boolean) => void;
}) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");

  const postReminder = async (due: Date, label: string) => {
    await fetch("/api/reminders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prospect_id: prospectId,
        due_at: due.toISOString(),
        label,
        kind: "simple",
      }),
    });
  };

  const addReminderDays = async (days: number) => {
    const due = new Date();
    due.setDate(due.getDate() + days);
    due.setHours(9, 0, 0, 0);
    await postReminder(due, `Rappel J+${days}`);
  };

  const addReminderCustom = async () => {
    const time = customTime || "09:00";
    const due = new Date(`${customDate}T${time}:00`);
    if (!Number.isFinite(due.getTime())) return;
    await postReminder(due, "Rappel");
  };

  const handleContinue = async (reminderDays?: number) => {
    setSaving(true);
    let noteSaved = false;
    try {
      if (note.trim()) {
        await fetch(`/api/prospects/${prospectId}/notes`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body: note.trim() }),
        });
        noteSaved = true;
      }
      if (reminderDays) await addReminderDays(reminderDays);
      else if (customDate) await addReminderCustom();
    } finally {
      setSaving(false);
      onClose(noteSaved);
    }
  };

  const tomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  })();

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 dark:bg-black/50 backdrop-blur-[2px]">
      <div className="bg-white dark:bg-nightSurface rounded-2xl shadow-warm border border-mid dark:border-nightBorder w-full max-w-md mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-mid dark:border-nightBorder flex items-center gap-2">
          {action === "qualify" ? (
            <Check className="h-4 w-4 text-accent2" />
          ) : (
            <Bell className="h-4 w-4 text-snooze" />
          )}
          <span className="font-medium text-sm dark:text-cream">
            {action === "qualify" ? "Noté comme intéressé" : "Rappel programmé"}
          </span>
          <span className="text-xs text-textMuted dark:text-nightMuted ml-1">· {prospectName}</span>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-textMuted dark:text-nightMuted mb-1.5 block">
              Que s&apos;est-il passé ? (optionnel)
            </label>
            <textarea
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Occupé, rappeler la semaine prochaine…"
              rows={2}
              className="w-full rounded-xl border border-mid dark:border-nightBorder bg-white dark:bg-nightBorder/30 dark:text-cream placeholder:text-textMuted/60 dark:placeholder:text-nightMuted/60 px-3 py-2 text-sm resize-none focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
            />
          </div>

          <div>
            <p className="text-xs text-textMuted dark:text-nightMuted mb-2">Programmer un rappel ?</p>
            <div className="flex gap-2 flex-wrap">
              {[
                { days: 3, label: "+3j" },
                { days: 7, label: "+7j" },
                { days: 14, label: "+14j" },
                { days: 30, label: "+30j" },
              ].map(({ days, label }) => (
                <button
                  key={days}
                  disabled={saving}
                  onClick={() => handleContinue(days)}
                  className="rounded-full border border-mid dark:border-nightBorder dark:text-cream px-3 py-1.5 text-xs hover:border-accent hover:text-accent transition"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-end gap-2">
              <div className="flex-1">
                <label className="text-[11px] text-textMuted dark:text-nightMuted block mb-1">
                  Ou date précise
                </label>
                <input
                  type="date"
                  value={customDate}
                  min={tomorrow}
                  onChange={(e) => setCustomDate(e.target.value)}
                  disabled={saving}
                  className="w-full rounded-xl border border-mid dark:border-nightBorder bg-white dark:bg-nightBorder/30 dark:text-cream dark:[color-scheme:dark] px-3 py-2 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
                />
              </div>
              <div className="w-28">
                <label className="text-[11px] text-textMuted dark:text-nightMuted block mb-1">
                  Heure (opt.)
                </label>
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  disabled={saving || !customDate}
                  className="w-full rounded-xl border border-mid dark:border-nightBorder bg-white dark:bg-nightBorder/30 dark:text-cream dark:[color-scheme:dark] px-3 py-2 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-mid dark:border-nightBorder flex items-center justify-between gap-3">
          <button
            disabled={saving}
            onClick={() => handleContinue()}
            className="inline-flex items-center gap-2 text-xs text-textMuted dark:text-nightMuted hover:text-warmDark dark:hover:text-cream transition"
          >
            {customDate
              ? "Enregistrer avec la date choisie"
              : note.trim()
              ? "Enregistrer et continuer"
              : "Continuer sans noter"}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function RecapPill({
  icon,
  tone,
  value,
  label,
}: {
  icon: React.ReactNode;
  tone: "accent2" | "reject" | "snooze";
  value: number;
  label: string;
}) {
  const toneClass =
    tone === "accent2"
      ? "bg-accent2/10 text-accent2"
      : tone === "reject"
        ? "bg-reject/10 text-reject"
        : "bg-snooze/10 text-snooze";
  return (
    <div
      className={`rounded-full ${toneClass} px-3 py-1.5 text-sm inline-flex items-center gap-2`}
    >
      {icon}
      <span className="font-mono">{value}</span>
      <span className="text-xs opacity-80">{label}</span>
    </div>
  );
}

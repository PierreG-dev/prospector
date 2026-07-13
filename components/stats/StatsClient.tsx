"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/shell/EmptyState";
import { cn } from "@/lib/cn";

type StatsBucket = {
  dow: number;
  hour: number;
  total: number;
  qualify: number;
  reject: number;
  snooze: number;
};

type StatsMarginal = {
  key: number;
  total: number;
  qualify: number;
  qualify_rate: number;
};

type StatsResult = {
  range: "7d" | "30d" | "all";
  from: string | null;
  to: string;
  total: number;
  qualify: number;
  qualify_rate: number;
  buckets: StatsBucket[];
  by_dow: StatsMarginal[];
  by_hour: StatsMarginal[];
  best_slot: { dow: number; hour: number; total: number } | null;
};

const DOW_LABEL = ["", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const DOW_FULL = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const RANGES: { key: "7d" | "30d" | "all"; label: string }[] = [
  { key: "7d", label: "7 jours" },
  { key: "30d", label: "30 jours" },
  { key: "all", label: "Tout" },
];

function fmtPct(v: number) {
  return `${Math.round(v * 100)}%`;
}

function fmtHour(h: number) {
  return `${String(h).padStart(2, "0")}h`;
}

export function StatsClient() {
  const [range, setRange] = useState<"7d" | "30d" | "all">("all");
  const [data, setData] = useState<StatsResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/stats/sessions?range=${range}`)
      .then((r) => r.json())
      .then((d: StatsResult) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const heatmap = useMemo(() => {
    const grid: (StatsBucket | null)[][] = Array.from({ length: 7 }, () =>
      Array<StatsBucket | null>(24).fill(null)
    );
    let max = 0;
    let avgRate = 0;
    if (data) {
      for (const b of data.buckets) {
        grid[b.dow - 1][b.hour] = b;
        if (b.total > max) max = b.total;
      }
      avgRate = data.qualify_rate;
    }
    return { grid, max, avgRate };
  }, [data]);

  const bestDay = useMemo(() => {
    if (!data) return null;
    return [...data.by_dow].sort((a, b) => b.total - a.total)[0] ?? null;
  }, [data]);

  const bestHour = useMemo(() => {
    if (!data) return null;
    return [...data.by_hour].sort((a, b) => b.total - a.total)[0] ?? null;
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Range toggle */}
      <div className="flex items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRange(r.key)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm transition-colors border",
              range === r.key
                ? "bg-accent text-white border-accent"
                : "bg-white text-warmDark border-mid hover:bg-mid/50 dark:bg-nightSurface dark:text-cream dark:border-nightBorder"
            )}
          >
            {r.label}
          </button>
        ))}
        {loading && (
          <Loader2 className="h-4 w-4 animate-spin text-textMuted ml-2" />
        )}
      </div>

      {!data || data.total === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Pas encore assez de données"
          hint="Trie quelques prospects dans /tri pour alimenter les stats. Les décisions passées (qualify/reject/snooze) sont automatiquement prises en compte."
        />
      ) : (
        <>
          {/* Résumé */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SummaryCard label="Actions totales" value={String(data.total)} />
            <SummaryCard
              label="Taux de qualify"
              value={fmtPct(data.qualify_rate)}
              hint={`${data.qualify} qualifiés`}
            />
            <SummaryCard
              label="Meilleur créneau"
              value={
                data.best_slot
                  ? `${DOW_LABEL[data.best_slot.dow]} ${fmtHour(data.best_slot.hour)}`
                  : "—"
              }
              hint={
                data.best_slot
                  ? `${data.best_slot.total} action${data.best_slot.total > 1 ? "s" : ""}`
                  : undefined
              }
            />
          </div>

          {/* Meilleurs jours */}
          <Card>
            <CardBody>
              <h2 className="text-lg font-semibold mb-4">Meilleurs jours</h2>
              <MarginalBars
                items={data.by_dow}
                labelFn={(k) => DOW_FULL[k]}
                highlightKey={bestDay?.total ? bestDay.key : null}
              />
            </CardBody>
          </Card>

          {/* Meilleures plages horaires */}
          <Card>
            <CardBody>
              <h2 className="text-lg font-semibold mb-4">Meilleures plages horaires</h2>
              <HourBars items={data.by_hour} highlightKey={bestHour?.total ? bestHour.key : null} />
            </CardBody>
          </Card>

          {/* Heatmap 7×24 */}
          <Card>
            <CardBody>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Heatmap semaine × heure</h2>
                <div className="flex items-center gap-3 text-xs text-textMuted dark:text-nightMuted">
                  <span className="flex items-center gap-1">
                    <span className="h-3 w-3 rounded-sm bg-accent/70" /> qualify &gt; moyenne
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-3 w-3 rounded-sm bg-warmDark/40" /> volume seul
                  </span>
                </div>
              </div>
              <Heatmap
                grid={heatmap.grid}
                max={heatmap.max}
                avgRate={heatmap.avgRate}
              />
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs uppercase tracking-wide text-textMuted dark:text-nightMuted">
          {label}
        </p>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
        {hint && (
          <p className="mt-1 text-sm text-textMuted dark:text-nightMuted">{hint}</p>
        )}
      </CardBody>
    </Card>
  );
}

function MarginalBars({
  items,
  labelFn,
  highlightKey,
}: {
  items: StatsMarginal[];
  labelFn: (k: number) => string;
  highlightKey: number | null;
}) {
  const max = Math.max(1, ...items.map((i) => i.total));
  return (
    <div className="space-y-2">
      {items.map((it) => {
        const pct = (it.total / max) * 100;
        const highlight = highlightKey === it.key && it.total > 0;
        return (
          <div key={it.key} className="flex items-center gap-3">
            <div className="w-20 text-sm text-textMuted dark:text-nightMuted">
              {labelFn(it.key)}
            </div>
            <div className="flex-1 h-6 rounded-full bg-mid/40 dark:bg-nightBorder/60 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  highlight ? "bg-accent" : "bg-accent/60"
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="w-24 text-right text-sm tabular-nums">
              <span className="font-medium">{it.total}</span>
              <span className="text-textMuted dark:text-nightMuted ml-2">
                {fmtPct(it.qualify_rate)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HourBars({
  items,
  highlightKey,
}: {
  items: StatsMarginal[];
  highlightKey: number | null;
}) {
  const max = Math.max(1, ...items.map((i) => i.total));
  return (
    <div>
      <div className="flex items-end gap-1 h-32">
        {items.map((it) => {
          const pct = (it.total / max) * 100;
          const highlight = highlightKey === it.key && it.total > 0;
          return (
            <div
              key={it.key}
              className="flex-1 flex flex-col justify-end"
              title={`${fmtHour(it.key)} — ${it.total} actions · ${fmtPct(it.qualify_rate)} qualify`}
            >
              <div
                className={cn(
                  "w-full rounded-t-sm transition-all",
                  highlight ? "bg-accent" : "bg-accent/50"
                )}
                style={{ height: `${pct}%`, minHeight: it.total > 0 ? 2 : 0 }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 mt-2">
        {items.map((it) => (
          <div
            key={it.key}
            className="flex-1 text-center text-[10px] text-textMuted dark:text-nightMuted tabular-nums"
          >
            {it.key % 3 === 0 ? it.key : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

function Heatmap({
  grid,
  max,
  avgRate,
}: {
  grid: (StatsBucket | null)[][];
  max: number;
  avgRate: number;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        {/* Header heures */}
        <div className="flex items-center gap-1 mb-1 pl-12">
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={h}
              className="flex-1 min-w-[18px] text-center text-[10px] text-textMuted dark:text-nightMuted tabular-nums"
            >
              {h % 3 === 0 ? h : ""}
            </div>
          ))}
        </div>
        {grid.map((row, di) => {
          const dow = di + 1;
          return (
            <div key={dow} className="flex items-center gap-1 mb-1">
              <div className="w-12 text-xs text-textMuted dark:text-nightMuted">
                {DOW_LABEL[dow]}
              </div>
              {row.map((cell, hi) => {
                if (!cell || cell.total === 0) {
                  return (
                    <div
                      key={hi}
                      className="flex-1 min-w-[18px] aspect-square rounded-sm bg-mid/30 dark:bg-nightBorder/40"
                    />
                  );
                }
                const intensity = Math.min(1, cell.total / max);
                const rate = cell.qualify / cell.total;
                const isHot = rate > avgRate;
                const opacity = 0.15 + intensity * 0.85;
                return (
                  <div
                    key={hi}
                    className={cn(
                      "flex-1 min-w-[18px] aspect-square rounded-sm",
                      isHot ? "bg-accent" : "bg-warmDark dark:bg-cream"
                    )}
                    style={{ opacity }}
                    title={`${DOW_FULL[dow]} ${fmtHour(hi)} — ${cell.total} actions (${cell.qualify} qualify, ${cell.reject} reject, ${cell.snooze} snooze) · ${fmtPct(rate)}`}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

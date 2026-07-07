"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  Globe2,
  GlobeLock,
  Phone,
  ChevronRight,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/shell/EmptyState";
import { Users } from "lucide-react";
import { PipelinePill } from "./PipelinePill";
import { PIPELINE_ORDER, PIPELINE_LABEL } from "@/lib/pipeline";
import { cn } from "@/lib/cn";

type Row = {
  _id: string;
  name: string;
  category: string | null;
  city: string | null;
  trade: string | null;
  lifecycle: string;
  has_website: boolean;
  phone: string | null;
  score: number;
  pipeline_status: string | null;
  relance_count?: number;
  relance_paused?: boolean;
};

type Facets = { trades: string[]; cities: string[] };

export function CrmList() {
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<Facets>({ trades: [], cities: [] });
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [trade, setTrade] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [pipeline, setPipeline] = useState<string>("");
  const [lifecycle, setLifecycle] = useState<"qualified" | "rejected">(
    "qualified"
  );
  const [includeInbox, setIncludeInbox] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.set("lifecycle", lifecycle);
    if (includeInbox && lifecycle === "qualified") p.set("includeInbox", "1");
    if (q) p.set("q", q);
    if (trade) p.set("trade", trade);
    if (city) p.set("city", city);
    if (pipeline && lifecycle === "qualified") p.set("pipeline", pipeline);
    return p.toString();
  }, [q, trade, city, pipeline, lifecycle, includeInbox]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await fetch(
        `/api/prospects${params ? `?${params}` : ""}`,
        { cache: "no-store" }
      );
      const data = (await r.json()) as {
        items: Row[];
        total: number;
        facets: Facets;
      };
      if (!alive) return;
      setItems(data.items);
      setTotal(data.total);
      setFacets(data.facets);
      setLoading(false);
    }, q ? 200 : 0); // debounce léger sur la recherche
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [params, q, reloadKey]);

  const restore = async (id: string) => {
    await fetch(`/api/prospects/${id}/restore`, { method: "POST" });
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="space-y-5">
      {/* Onglets Qualifiés / Rejetés */}
      <div className="inline-flex rounded-full border border-mid dark:border-nightBorder bg-white dark:bg-nightSurface p-1 gap-0.5">
        {(["qualified", "rejected"] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLifecycle(l)}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-medium transition",
              lifecycle === l
                ? "bg-mid text-warmDark dark:bg-nightBorder dark:text-cream"
                : "text-textMuted dark:text-nightMuted hover:text-warmDark dark:hover:text-cream"
            )}
          >
            {l === "qualified" ? "Retenus" : "Archivés"}
          </button>
        ))}
      </div>

      {/* Filtres */}
      <Card>
        <CardBody className="py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-textMuted dark:text-nightMuted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher par nom…"
                className="w-full rounded-full border border-mid dark:border-nightBorder bg-white dark:bg-nightBorder/30 dark:text-cream placeholder:text-textMuted/60 dark:placeholder:text-nightMuted/60 pl-9 pr-4 py-2 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
              />
            </div>
            {lifecycle === "qualified" && (
              <Select
                value={pipeline}
                onChange={setPipeline}
                placeholder="Statut"
                options={PIPELINE_ORDER.map((s) => ({
                  value: s,
                  label: PIPELINE_LABEL[s],
                }))}
              />
            )}
            <Select
              value={trade}
              onChange={setTrade}
              placeholder="Métier"
              options={facets.trades.map((t) => ({ value: t, label: t }))}
            />
            <Select
              value={city}
              onChange={setCity}
              placeholder="Ville"
              options={facets.cities.map((c) => ({ value: c, label: c }))}
            />
            {lifecycle === "qualified" && (
              <label className="inline-flex items-center gap-2 text-xs text-textMuted dark:text-nightMuted cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeInbox}
                  onChange={(e) => setIncludeInbox(e.target.checked)}
                  className="rounded border-mid dark:border-nightBorder dark:bg-nightBorder/40 text-accent focus:ring-accent/30"
                />
                Inclure non triés
              </label>
            )}
            {(q || trade || city || pipeline) && (
              <button
                onClick={() => {
                  setQ("");
                  setTrade("");
                  setCity("");
                  setPipeline("");
                }}
                className="text-xs text-textMuted dark:text-nightMuted hover:text-warmDark dark:hover:text-cream transition"
              >
                Effacer
              </button>
            )}
            <div className="ml-auto text-xs text-textMuted dark:text-nightMuted flex items-center gap-1">
              <Filter className="h-3 w-3" />
              {total} prospect{total > 1 ? "s" : ""}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Liste */}
      {loading ? (
        <Card>
          <CardBody className="py-10 flex justify-center text-textMuted dark:text-nightMuted">
            <Loader2 className="h-5 w-5 animate-spin" />
          </CardBody>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Users}
          title={
            lifecycle === "qualified"
              ? "Aucun contact retenu"
              : "Aucun contact archivé"
          }
          hint={
            lifecycle === "qualified"
              ? "Marque quelques prospects comme intéressés dans la file d'appels."
              : "Les prospects archivés depuis la file d'appels apparaîtront ici."
          }
        />
      ) : (
        <Card>
          <ul className="divide-y divide-mid dark:divide-nightBorder">
            {items.map((p) => (
              <li key={p._id} className="flex items-stretch">
                <Link
                  href={`/crm/${p._id}`}
                  className={cn(
                    "flex-1 flex items-center gap-4 px-5 py-3.5 hover:bg-cream/60 dark:hover:bg-nightBorder/30 transition group"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate dark:text-cream">{p.name}</span>
                      {p.trade && (
                        <span className="text-xs text-textMuted dark:text-nightMuted">
                          · {p.trade}
                        </span>
                      )}
                      {lifecycle === "qualified" &&
                        p.relance_count != null &&
                        p.relance_count > 0 && (
                          <Pill tone="warn">
                            rappel {p.relance_count}/3
                            {p.relance_paused ? " · pause" : ""}
                          </Pill>
                        )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-textMuted dark:text-nightMuted">
                      {p.city && <span>{p.city}</span>}
                      {p.has_website ? (
                        <span className="inline-flex items-center gap-1">
                          <Globe2 className="h-3 w-3" /> site
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <GlobeLock className="h-3 w-3" /> sans site
                        </span>
                      )}
                      {p.phone && (
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Phone className="h-3 w-3" /> {p.phone}
                        </span>
                      )}
                    </div>
                  </div>

                  {lifecycle === "qualified" &&
                    (p.lifecycle === "qualified" ? (
                      <PipelinePill
                        status={
                          p.pipeline_status as
                            | Parameters<typeof PipelinePill>[0]["status"]
                        }
                      />
                    ) : (
                      <Pill tone="neutral">
                        {p.lifecycle === "snoozed" ? "snoozé" : "non trié"}
                      </Pill>
                    ))}
                  <ChevronRight className="h-4 w-4 text-textMuted/60 dark:text-nightMuted/60 group-hover:text-accent transition" />
                </Link>

                {lifecycle === "rejected" && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      restore(p._id);
                    }}
                    className="px-4 text-xs text-accent2 hover:bg-accent2/10 border-l border-mid dark:border-nightBorder transition inline-flex items-center gap-1.5"
                    title="Restaurer dans la file de tri"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restaurer
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "rounded-full border border-mid dark:border-nightBorder bg-white dark:bg-nightBorder/30 dark:text-cream px-3 py-2 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none",
        !value && "text-textMuted dark:text-nightMuted"
      )}
    >
      <option value="" className="dark:bg-nightSurface dark:text-nightMuted">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value} className="text-warmDark dark:bg-nightSurface dark:text-cream">
          {o.label}
        </option>
      ))}
    </select>
  );
}

"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "./ThemeToggle";

export function TopBar() {
  const [mongoOk, setMongoOk] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (alive) setMongoOk(Boolean(d?.mongo));
      })
      .catch(() => alive && setMongoOk(false));
    return () => {
      alive = false;
    };
  }, []);

  const dotClass =
    mongoOk === null
      ? "bg-mid"
      : mongoOk
        ? "bg-accent2"
        : "bg-reject";
  const dotLabel =
    mongoOk === null
      ? "Connexion…"
      : mongoOk
        ? "Mongo connecté"
        : "Mongo injoignable";

  return (
    <header className="h-14 bg-warmDark text-cream border-b border-black/20 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-baseline gap-3">
        <span className="font-serif italic text-2xl leading-none">
          Prospector
        </span>
        <span className="text-[10px] tracking-[0.35em] text-mid/80">
          GODINO
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div
          className="flex items-center gap-2 text-xs text-mid/80"
          title={dotLabel}
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full transition-colors",
              dotClass
            )}
            aria-hidden
          />
          <span className="hidden sm:inline">{dotLabel}</span>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}

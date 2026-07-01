"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "./ThemeToggle";

export function TopBar() {
  const router = useRouter();
  const [mongoOk, setMongoOk] = useState<boolean | null>(null);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

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
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs text-mid/60 hover:text-mid transition-colors px-2 py-1 rounded-lg hover:bg-white/10"
          title="Se déconnecter"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Déconnexion</span>
        </button>
      </div>
    </header>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";
const KEY = "prospector-theme";

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem(KEY) as Theme | null) ?? "light";
    setTheme(stored);
    apply(stored);
    setMounted(true);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    apply(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* noop */
    }
  };

  if (!mounted) {
    // Évite le mismatch SSR vs script anti-flash
    return <div className="h-7 w-7" aria-hidden />;
  }

  return (
    <button
      onClick={toggle}
      aria-label={`Basculer en mode ${theme === "dark" ? "clair" : "nuit"}`}
      title={`Mode ${theme === "dark" ? "clair" : "nuit"}`}
      className="h-7 w-7 rounded-full flex items-center justify-center text-mid hover:bg-white/10 transition"
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" strokeWidth={2} />
      ) : (
        <Moon className="h-4 w-4" strokeWidth={2} />
      )}
    </button>
  );
}

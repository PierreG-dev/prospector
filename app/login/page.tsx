"use client";

import { Suspense, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, rememberMe }),
      });
      if (res.ok) {
        const raw = params.get("from") ?? "/dashboard";
        const from =
          raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")
            ? raw
            : "/dashboard";
        router.replace(from);
      } else {
        const { error: msg } = await res.json();
        setError(msg ?? "Erreur");
        setPassword("");
        inputRef.current?.focus();
      }
    } catch {
      setError("Impossible de joindre le serveur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-nightSurface flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex flex-col items-center gap-1">
            <span className="font-serif italic text-4xl text-warmDark dark:text-cream leading-none">
              Prospector
            </span>
            <span className="text-[10px] tracking-[0.35em] text-textMuted dark:text-nightMuted">
              GODINO
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-nightSurface border border-mid dark:border-nightBorder rounded-2xl shadow-warm p-8">
          <h1 className="text-lg font-semibold text-warmDark dark:text-cream mb-6">
            Connexion
          </h1>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-warmDark dark:text-mid"
              >
                Mot de passe
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  id="password"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 px-4 pr-11 rounded-xl border border-mid dark:border-nightBorder bg-cream dark:bg-warmDark text-warmDark dark:text-cream placeholder-textMuted text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted hover:text-warmDark dark:hover:text-cream transition-colors p-0.5"
                  tabIndex={-1}
                  aria-label={showPwd ? "Masquer" : "Afficher"}
                >
                  {showPwd ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-mid accent-accent cursor-pointer"
              />
              <span className="text-sm text-textMuted dark:text-nightMuted">
                Rester connecté (30 jours)
              </span>
            </label>

            {/* Error */}
            {error && (
              <p className="text-sm text-reject bg-reject/8 border border-reject/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-full bg-accent text-white font-medium text-sm hover:bg-accent/90 hover:scale-[1.02] transition-all duration-200 ease-warm shadow-warm-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? (
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              <span>{loading ? "Connexion…" : "Se connecter"}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

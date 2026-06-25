"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  Layers,
  Users,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

type NavItem = { href: string; label: string; icon: LucideIcon };

const items: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/tri", label: "Tri", icon: Layers },
  { href: "/crm", label: "CRM", icon: Users },
  { href: "/settings", label: "Réglages", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 bg-cream border-r border-mid p-3 dark:bg-warmDark dark:border-nightBorder">
      <nav className="flex flex-col gap-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm transition-colors",
                active
                  ? "bg-mid text-accent font-medium dark:bg-nightSurface"
                  : "text-warmDark hover:bg-mid/50 dark:text-cream dark:hover:bg-nightSurface/60"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  active
                    ? "text-accent"
                    : "text-textMuted dark:text-nightMuted"
                )}
                strokeWidth={2}
              />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

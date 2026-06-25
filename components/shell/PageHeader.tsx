import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageHeader({
  title,
  accent,
  subtitle,
  right,
  className,
}: {
  title: string;
  accent?: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between mb-6", className)}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {accent ? (
            <>
              {title.replace(accent, "").trimEnd()}{" "}
              <span className="signature-italic">{accent}</span>
            </>
          ) : (
            title
          )}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-textMuted">{subtitle}</p>
        )}
      </div>
      {right}
    </div>
  );
}

"use client";

import { Globe2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

export function OgPreview({
  og,
  websiteUrl,
}: {
  og: { title: string | null; description: string | null; image: string | null } | null;
  websiteUrl: string | null;
}) {
  const [imgError, setImgError] = useState(false);

  if (!og || (!og.title && !og.description && !og.image)) {
    return (
      <div className="rounded-xl border border-dashed border-mid dark:border-nightBorder bg-cream/40 dark:bg-nightBorder/20 px-4 py-3 flex items-center gap-3 text-textMuted text-sm">
        <Globe2 className="h-4 w-4" strokeWidth={1.75} />
        <span>Aperçu du site indisponible</span>
      </div>
    );
  }

  const showImage = og.image && !imgError;

  return (
    <a
      href={websiteUrl ?? "#"}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "block rounded-xl border border-mid dark:border-nightBorder bg-white dark:bg-nightBorder/30 overflow-hidden",
        "hover:border-accent/60 hover:shadow-warm-sm transition-all"
      )}
    >
      <div className="flex">
        {showImage && (
          <div className="w-32 h-24 shrink-0 bg-mid/40 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={og.image!}
              alt=""
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          </div>
        )}
        <div className="p-3 flex-1 min-w-0">
          {og.title && (
            <p className="text-sm font-medium truncate" title={og.title}>
              {og.title}
            </p>
          )}
          {og.description && (
            <p className="mt-1 text-xs text-textMuted line-clamp-2">
              {og.description}
            </p>
          )}
        </div>
      </div>
    </a>
  );
}

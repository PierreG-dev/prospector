import type { LucideIcon } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";

export function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardBody className="py-16 flex flex-col items-center text-center">
        <div className="h-14 w-14 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-4">
          <Icon className="h-7 w-7" strokeWidth={1.75} />
        </div>
        <p className="text-base font-medium">{title}</p>
        {hint && (
          <p className="mt-2 text-sm text-textMuted dark:text-nightMuted max-w-md">{hint}</p>
        )}
      </CardBody>
    </Card>
  );
}

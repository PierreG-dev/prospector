import { Pill } from "@/components/ui/Pill";
import { PIPELINE_LABEL, PIPELINE_TONE } from "@/lib/pipeline";
import type { PipelineStatus } from "@/lib/types";

export function PipelinePill({ status }: { status: PipelineStatus | null }) {
  if (!status) {
    return <Pill tone="neutral">—</Pill>;
  }
  return <Pill tone={PIPELINE_TONE[status]}>{PIPELINE_LABEL[status]}</Pill>;
}

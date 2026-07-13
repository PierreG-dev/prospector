import { PageHeader } from "@/components/shell/PageHeader";
import { StatsClient } from "@/components/stats/StatsClient";

export const dynamic = "force-dynamic";

export default function StatsPage() {
  return (
    <>
      <PageHeader
        title="Stats sessions"
        accent="sessions"
        subtitle="Quels jours et créneaux horaires sont les plus fructueux"
      />
      <StatsClient />
    </>
  );
}

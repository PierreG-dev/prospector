import { PageHeader } from "@/components/shell/PageHeader";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard rappels"
        accent="rappels"
        subtitle="En retard · aujourd'hui · cette semaine · relances épuisées · sans suite"
      />
      <DashboardClient />
    </>
  );
}

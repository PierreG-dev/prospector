import { PageHeader } from "@/components/shell/PageHeader";
import { CampaignsClient } from "@/components/campaigns/CampaignsClient";

export const dynamic = "force-dynamic";

export default function CampaignsPage() {
  return (
    <>
      <PageHeader
        title="Campagnes"
        accent="Campagnes"
        subtitle="Imports Apify · renommer, dater, suspendre l'apparition en file de tri"
      />
      <CampaignsClient />
    </>
  );
}

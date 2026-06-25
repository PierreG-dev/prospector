import { PageHeader } from "@/components/shell/PageHeader";
import { CrmList } from "@/components/crm/CrmList";

export const dynamic = "force-dynamic";

export default function CrmPage() {
  return (
    <>
      <PageHeader
        title="Pipeline qualifiés"
        accent="qualifiés"
        subtitle="À contacter → Contacté → RDV pris → Client / Perdu"
      />
      <CrmList />
    </>
  );
}

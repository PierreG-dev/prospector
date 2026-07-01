import { PageHeader } from "@/components/shell/PageHeader";
import { CrmFiche } from "@/components/crm/CrmFiche";

export const dynamic = "force-dynamic";

export default async function CrmFichePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <PageHeader title="Fiche prospect" accent="prospect" />
      <CrmFiche id={id} />
    </>
  );
}

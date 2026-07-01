import { PageHeader } from "@/components/shell/PageHeader";
import { ImportForm } from "@/components/import/ImportForm";

export default function ImportPage() {
  return (
    <>
      <PageHeader
        title="Nouvel import"
        accent="import"
        subtitle="JSON dataset Google Maps · dédup multi-clés · jamais de restock"
      />
      <ImportForm />
    </>
  );
}

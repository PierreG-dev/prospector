import { PageHeader } from "@/components/shell/PageHeader";
import { ImportForm } from "@/components/import/ImportForm";
import { ManualAddForm } from "@/components/import/ManualAddForm";

export default function ImportPage() {
  return (
    <>
      <PageHeader
        title="Nouvel import"
        accent="import"
        subtitle="JSON dataset Google Maps · dédup multi-clés · jamais de restock"
      />
      <ImportForm />
      <div className="mt-6">
        <ManualAddForm />
      </div>
    </>
  );
}

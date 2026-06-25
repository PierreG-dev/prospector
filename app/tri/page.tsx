import { PageHeader } from "@/components/shell/PageHeader";
import { TriClient } from "@/components/tri/TriClient";

export const dynamic = "force-dynamic";

export default function TriPage() {
  return (
    <>
      <PageHeader
        title="File de tri"
        accent="tri"
        subtitle="Clavier-first · undo · tirage pondéré par l'heure d'appel optimale"
      />
      <TriClient />
    </>
  );
}

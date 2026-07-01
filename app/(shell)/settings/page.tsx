import { PageHeader } from "@/components/shell/PageHeader";
import { SettingsClient } from "@/components/settings/SettingsClient";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Réglages"
        accent="Réglages"
        subtitle="Cadence des relances · auto-bascule perdu · état des secrets"
      />
      <SettingsClient />
    </>
  );
}

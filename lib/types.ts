export type Lifecycle =
  | "inbox"
  | "triaging"
  | "rejected"
  | "snoozed"
  | "qualified";

export type PipelineStatus =
  | "a_contacter"
  | "contacte"
  | "rdv_pris"
  | "client"
  | "perdu";

export type ReminderKind = "simple" | "relance" | "sequence_step";

export type SourceType = "google_maps" | "directory" | "website" | "other";

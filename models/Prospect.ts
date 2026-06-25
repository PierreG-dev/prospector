import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const NoteSchema = new Schema(
  {
    body: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const StatusHistorySchema = new Schema(
  {
    from: { type: String, default: null },
    to: { type: String, required: true },
    note: { type: String, default: null },
    created_at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const RunRefSchema = new Schema(
  {
    run_id: { type: Schema.Types.ObjectId, ref: "ImportRun", required: true },
    seen_at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const OgSchema = new Schema(
  {
    title: { type: String, default: null },
    description: { type: String, default: null },
    image: { type: String, default: null },
    fetched_at: { type: Date, default: null },
  },
  { _id: false }
);

const KeysSchema = new Schema(
  {
    place_id: { type: String, default: null, index: true, sparse: true },
    gmaps_url_norm: { type: String, default: null, index: true, sparse: true },
    domain: { type: String, default: null, index: true, sparse: true },
    phone_e164: { type: String, default: null, index: true, sparse: true },
    namegeo: { type: String, default: null, index: true, sparse: true },
  },
  { _id: false }
);

const ProspectSchema = new Schema(
  {
    // Identité (tout optionnel sauf name)
    name: { type: String, required: true },
    owner_name: { type: String, default: null },
    category: { type: String, default: null },
    categories: { type: [String], default: [] },
    address: { type: String, default: null },
    city: { type: String, default: null },
    postal_code: { type: String, default: null },
    country_code: { type: String, default: null },
    state: { type: String, default: null },
    phone: { type: String, default: null },
    email: { type: String, default: null },
    website_url: { type: String, default: null },
    gmaps_url: { type: String, default: null },
    gmaps_rating: { type: Number, default: null },
    gmaps_reviews: { type: Number, default: null },
    og: { type: OgSchema, default: () => ({}) },

    // Dédup
    keys: { type: KeysSchema, default: () => ({}) },

    // Signaux métier
    has_website: { type: Boolean, default: false },
    score: { type: Number, default: 0 },
    trade: { type: String, default: null, index: true }, // bucket métier détecté par regex

    // Cycle de vie
    lifecycle: {
      type: String,
      enum: ["inbox", "triaging", "rejected", "snoozed", "qualified"],
      default: "inbox",
      index: true,
    },
    pipeline_status: {
      type: String,
      enum: ["a_contacter", "contacte", "rdv_pris", "client", "perdu", null],
      default: null,
    },
    snooze_until: { type: Date, default: null },

    // Relance (Lot 6+)
    relance_count: { type: Number, default: 0 },
    relance_next_at: { type: Date, default: null },
    last_status_at: { type: Date, default: null },
    relance_paused: { type: Boolean, default: false },

    // Embarqué
    notes: { type: [NoteSchema], default: [] },
    status_history: { type: [StatusHistorySchema], default: [] },
    runs: { type: [RunRefSchema], default: [] },

    // Méta
    times_seen: { type: Number, default: 1 },
    last_seen_at: { type: Date, default: Date.now },
    raw: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true, collection: "prospects" }
);

// Index utiles pour la file de tri (par lifecycle + bucket métier — voir lib/queue/pick.ts)
ProspectSchema.index({ lifecycle: 1, trade: 1 });
ProspectSchema.index({ pipeline_status: 1 });
ProspectSchema.index({ snooze_until: 1 });

export type ProspectDoc = InferSchemaType<typeof ProspectSchema>;

export const Prospect: Model<ProspectDoc> =
  (mongoose.models.Prospect as Model<ProspectDoc>) ??
  mongoose.model<ProspectDoc>("Prospect", ProspectSchema);

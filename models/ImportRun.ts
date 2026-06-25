import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const ImportRunSchema = new Schema(
  {
    label: { type: String, required: true },
    source_type: {
      type: String,
      enum: ["google_maps", "directory", "website", "other"],
      default: "google_maps",
    },
    apify_actor: { type: String, default: null },
    apify_run_id: { type: String, default: null },
    imported_at: { type: Date, default: Date.now, index: true },
    raw_count: { type: Number, default: 0 },
    new_count: { type: Number, default: 0 },
    dup_count: { type: Number, default: 0 },
    filtered_count: { type: Number, default: 0 },
    source_file: { type: String, default: null },
  },
  { timestamps: true, collection: "import_runs" }
);

export type ImportRunDoc = InferSchemaType<typeof ImportRunSchema>;

export const ImportRun: Model<ImportRunDoc> =
  (mongoose.models.ImportRun as Model<ImportRunDoc>) ??
  mongoose.model<ImportRunDoc>("ImportRun", ImportRunSchema);

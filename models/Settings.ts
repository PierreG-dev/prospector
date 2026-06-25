import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Document singleton (un seul document avec _id="singleton").
 * Lecture rapide, écriture via upsert.
 */
const SettingsSchema = new Schema(
  {
    _id: { type: String, default: "singleton" },
    /** Délais [J→R1, R1→R2, R2→R3] en jours. Défauts [3,7,14]. */
    relance_delays: {
      type: [Number],
      default: [3, 7, 14],
      validate: (v: number[]) => v.length === 3 && v.every((n) => n >= 0),
    },
    /** Si true (V2-ready), un prospect en `contacte` épuisé bascule auto en `perdu`. Défaut false. */
    auto_perdu: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "settings", _id: false }
);

export type SettingsDoc = InferSchemaType<typeof SettingsSchema>;

export const Settings: Model<SettingsDoc> =
  (mongoose.models.Settings as Model<SettingsDoc>) ??
  mongoose.model<SettingsDoc>("Settings", SettingsSchema);

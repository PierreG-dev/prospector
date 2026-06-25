import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const ReminderSchema = new Schema(
  {
    prospect_id: {
      type: Schema.Types.ObjectId,
      ref: "Prospect",
      required: true,
      index: true,
    },
    due_at: { type: Date, required: true },
    label: { type: String, default: null },
    kind: {
      type: String,
      enum: ["simple", "relance", "sequence_step"],
      default: "simple",
    },
    relance_index: { type: Number, default: null }, // 1, 2 ou 3 si kind='relance'
    priority: { type: Number, default: 0 }, // Pushover -1..2
    done: { type: Boolean, default: false },
    done_at: { type: Date, default: null },
    notified_at: { type: Date, default: null }, // anti-doublon push
    push_receipt: { type: String, default: null }, // pour priorité 2
  },
  { timestamps: true, collection: "reminders" }
);

ReminderSchema.index({ done: 1, due_at: 1 });

export type ReminderDoc = InferSchemaType<typeof ReminderSchema>;

export const Reminder: Model<ReminderDoc> =
  (mongoose.models.Reminder as Model<ReminderDoc>) ??
  mongoose.model<ReminderDoc>("Reminder", ReminderSchema);

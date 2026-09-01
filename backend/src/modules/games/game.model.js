import mongoose from "mongoose";

const playerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    wpm: { type: Number, default: null },
    accuracy: { type: Number, default: null },
    finishedAt: { type: Date, default: null },
    rank: { type: Number, default: null },
  },
  { _id: false }
);

const gameMatchSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["typing_race"], default: "typing_race", required: true },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    players: { type: [playerSchema], default: [] },
    textPrompt: { type: String, required: true },
    status: { type: String, enum: ["pending", "active", "completed"], default: "pending", required: true, index: true },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

gameMatchSchema.index({ conversationId: 1, status: 1 });

export const GameMatch = mongoose.model("GameMatch", gameMatchSchema);
export default GameMatch;

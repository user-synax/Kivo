import mongoose from "mongoose";

// Audit log for every admin moderation action. One admin credential = no need
// for a separate admin-identity field; IP + timestamp provide accountability.
const adminActionLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        "ban_user",
        "unban_user",
        "force_logout",
        "delete_group",
        "delete_space",
      ],
    },
    targetType: {
      type: String,
      required: true,
      enum: ["user", "group", "space"],
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    targetName: { type: String, default: null },
    reason: { type: String, default: null, maxlength: 500 },
    ip: { type: String, default: null },
    performedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

adminActionLogSchema.index({ targetType: 1, targetId: 1 });

export const AdminActionLog = mongoose.model(
  "AdminActionLog",
  adminActionLogSchema
);
export default AdminActionLog;

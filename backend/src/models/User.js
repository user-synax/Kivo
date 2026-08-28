import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const ROLES = ["user", "admin"];

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    // Never returned by default queries (select: false) and never logged.
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ROLES,
      default: "user",
    },
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function (candidatePlain) {
  return bcrypt.compare(candidatePlain, this.passwordHash);
};

userSchema.statics.hashPassword = function (plain) {
  return bcrypt.hash(plain, 12);
};

export const Role = Object.freeze({ USER: "user", ADMIN: "admin" });
export const User = mongoose.model("User", userSchema);
export default User;

import mongoose from "mongoose";
import env from "./env.js";

export async function connectDb() {
  mongoose.connection.on("connected", () => {
    console.log("[db] mongoose connected");
  });
  mongoose.connection.on("error", (err) => {
    console.error("[db] mongoose error:", err.message);
  });
  await mongoose.connect(env.mongoUri);
}

export default mongoose;

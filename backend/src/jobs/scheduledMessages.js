import { deliverScheduled } from "../modules/messages/messages.service.js";

export function startScheduledJob() {
  const run = async () => {
    try {
      const n = await deliverScheduled();
      if (n > 0) console.log(`[scheduled] delivered ${n} message(s)`);
    } catch (e) {
      console.error("[scheduled] deliver failed", e?.message || e);
    }
  };
  // Run every 30 seconds to keep delivery latency low without hammering the DB
  const timer = setInterval(() => {
    run().catch((e) => console.error("[scheduled] deliver failed", e?.message || e));
  }, 30 * 1000);
  if (typeof timer.unref === "function") timer.unref();
}

"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/pwa";

export function PwaRegister() {
  useEffect(() => {
    registerServiceWorker();
  }, []);
  return null;
}

export default PwaRegister;

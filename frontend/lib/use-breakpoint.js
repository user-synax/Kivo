"use client";

import { useEffect, useState } from "react";

const QUERY = "(min-width: 768px)";

export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

export default useIsDesktop;

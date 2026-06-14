import { useState, useEffect } from "react";

export type Breakpoint = "mobile" | "tablet" | "desktop";

function getBreakpoint(): Breakpoint {
  if (typeof window === "undefined") return "mobile";
  if (window.matchMedia("(min-width: 1200px)").matches) return "desktop";
  if (window.matchMedia("(min-width: 768px)").matches) return "tablet";
  return "mobile";
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(getBreakpoint);

  useEffect(() => {
    const mq768 = window.matchMedia("(min-width: 768px)");
    const mq1200 = window.matchMedia("(min-width: 1200px)");
    const handler = () => setBp(getBreakpoint());
    mq768.addEventListener("change", handler);
    mq1200.addEventListener("change", handler);
    return () => {
      mq768.removeEventListener("change", handler);
      mq1200.removeEventListener("change", handler);
    };
  }, []);

  return bp;
}

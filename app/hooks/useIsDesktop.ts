"use client";

import { useEffect, useState } from "react";

// Starts false (mobile) so the very first client render matches whatever
// the server rendered - the real value is read right after mount, same
// "assume the safe default, correct it in an effect" shape the theme toggle
// already uses in app/page.tsx.
export function useIsDesktop(breakpoint = 960): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${breakpoint}px)`);
    setIsDesktop(query.matches);
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [breakpoint]);

  return isDesktop;
}

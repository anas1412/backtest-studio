import { useCallback, useEffect, useState } from "react";

export function useMediaQuery(query: string) {
  const [match, setMatch] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const q = matchMedia(query);
    const on = () => setMatch(q.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, [query]);
  return match;
}

// A number remembered in localStorage; storage may be unavailable, so fall back quietly.
export function useLocalNumber(key: string, initial: number) {
  const [value, setValue] = useState(() => {
    try { return Number(localStorage.getItem(key)) || initial; } catch { return initial; }
  });
  const set = useCallback((v: number) => {
    setValue(v);
    try { localStorage.setItem(key, String(v)); } catch { /* not persisted */ }
  }, [key]);
  return [value, set] as const;
}

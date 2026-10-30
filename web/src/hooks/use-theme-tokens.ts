import { useEffect, useState } from "react";

// Reads EasyUI token values for canvas charts, which can't use CSS classes,
// and re-reads them when the dark class on <html> flips.
function read() {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    dark: document.documentElement.classList.contains("dark"),
    text: v("--text-muted"),
    border: v("--border-subtle") || v("--border"),
    surface: v("--surface"),
  };
}

export function useThemeTokens() {
  const [tokens, setTokens] = useState(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setTokens(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return tokens;
}

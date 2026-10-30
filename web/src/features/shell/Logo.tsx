// App mark: three candles, the last one green. Same drawing as public/favicon.svg.
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="8" className="fill-text-primary" />
      <path d="M9 7v18M16 5v22M23 9v14" className="stroke-text-muted" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="6.5" y="12" width="5" height="9" rx="1.2" className="fill-background" />
      <rect x="13.5" y="8" width="5" height="10" rx="1.2" className="fill-background" />
      <rect x="20.5" y="13" width="5" height="6" rx="1.2" fill="#34D399" />
    </svg>
  );
}

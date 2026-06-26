/** Shared ChemFox logo mark — conical flask (lab glassware), not the old pencil glyph. */
export function ChemFoxIcon({
  size = 17,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M10 2v6.528a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .898 1.45h12.764a1 1 0 0 0 .898-1.45L14.21 9.424a2 2 0 0 1-.211-.896V2" />
      <path d="M8.5 2h7" />
      <path d="M7 16h10" />
    </svg>
  );
}

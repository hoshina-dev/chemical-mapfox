/**
 * Duotone line-art SVG icon set for the landing page. Each icon draws with
 * `currentColor` for the stroke and a translucent fill, so a single `color`
 * (the brand green) reads as a refined two-tone mark. No external assets.
 */

interface IconProps {
  size?: number;
  className?: string;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

const TINT = "rgba(47,158,68,0.14)";

export function DropletIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path
        d="M12 2.7c3.4 4 6 6.9 6 10.1a6 6 0 0 1-12 0c0-3.2 2.6-6.1 6-10.1Z"
        fill={TINT}
      />
      <path d="M9 13.5a3 3 0 0 0 3 3" />
    </svg>
  );
}

export function LeafIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path
        d="M4 20c-1-9 4-15 16-15 0 12-6 17-15 16Z"
        fill={TINT}
      />
      <path d="M4 20C8 14 12 11 18 9" />
    </svg>
  );
}

export function LayersIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" fill={TINT} />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 16 9 5 9-5" />
    </svg>
  );
}

export function FactoryIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path
        d="M3 21V10l6 4V10l6 4V6l3-2v17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"
        fill={TINT}
      />
      <path d="M7 21v-3M12 21v-3M17 21v-3" />
    </svg>
  );
}

export function PillIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="2.6" y="8.6" width="18.8" height="6.8" rx="3.4" fill={TINT} />
      <path d="M12 8.6v6.8" />
      <path d="M7 8.6v6.8" />
    </svg>
  );
}

export function FlaskIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path
        d="M9.5 3v6.2L5 18.2A1.4 1.4 0 0 0 6.2 20h11.6a1.4 1.4 0 0 0 1.2-1.8L14.5 9.2V3"
        fill={TINT}
      />
      <path d="M8 3h8M7.4 14h9.2" />
    </svg>
  );
}

/** Map a sample id/name to the most fitting category icon. */
export function SampleIcon({
  sampleId,
  size = 22,
  className,
}: {
  sampleId: string;
  size?: number;
  className?: string;
}) {
  const key = sampleId.toLowerCase();
  if (key.includes("water")) return <DropletIcon size={size} className={className} />;
  if (key.includes("food") || key.includes("feed"))
    return <LeafIcon size={size} className={className} />;
  if (key.includes("soil") || key.includes("sediment"))
    return <LayersIcon size={size} className={className} />;
  if (key.includes("production") || key.includes("environment"))
    return <FactoryIcon size={size} className={className} />;
  if (key.includes("pharma")) return <PillIcon size={size} className={className} />;
  return <FlaskIcon size={size} className={className} />;
}

export function RequestIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="4" y="3" width="16" height="18" rx="2" fill={TINT} />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

export function SampleVialIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M9 2h6" />
      <path d="M10 2v6l-2 3v9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-9l-2-3V2" fill={TINT} />
      <path d="M8.4 14h7.2" />
    </svg>
  );
}

export function MicroscopeIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M6 18h10a4 4 0 0 0 0-8" fill={TINT} />
      <path d="M3 22h18" />
      <path d="m9 9 3-3" />
      <rect x="7.5" y="3" width="4" height="7" rx="1" transform="rotate(45 9.5 6.5)" />
    </svg>
  );
}

export function ReportIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" fill={TINT} />
      <path d="M14 2v6h6" />
      <path d="m9 15 2 2 4-4" />
    </svg>
  );
}

export function ArrowRightIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function MailIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" fill={TINT} />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

export function PhoneIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path
        d="M5 3h3.6l1.5 4-2 1.4a13 13 0 0 0 5.5 5.5l1.4-2 4 1.5V19a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2Z"
        fill={TINT}
      />
    </svg>
  );
}

export function PinIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 21s7-5.6 7-11a7 7 0 0 0-14 0c0 5.4 7 11 7 11Z" fill={TINT} />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  );
}

export function ClockIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="9" fill={TINT} />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

"use client";

import classes from "./landing.module.css";

/**
 * Stepper accent rendered above each section kicker. The mark acts as a
 * "you-are-here" progress indicator: dots before `active` read as completed
 * (filled), the dot at `active` is the current step (filled + pulsing) and
 * later dots are hollow. Each section passes a different `active` index, so the
 * activated dot advances as the visitor moves down the page. Motion is disabled
 * under `prefers-reduced-motion`.
 */
export function HeadingMark({
  className,
  active,
  total = 5,
}: {
  className?: string;
  active: number;
  total?: number;
}) {
  const start = 6;
  const gap = 18;
  const cy = 7;
  const xs = Array.from({ length: total }, (_, i) => start + i * gap);
  const width = start * 2 + (total - 1) * gap;
  const clamped = Math.max(0, Math.min(active, total - 1));

  return (
    <svg
      width={width}
      height={14}
      viewBox={`0 0 ${width} 14`}
      fill="none"
      className={className}
      aria-hidden
    >
      <line x1={xs[0]} y1={cy} x2={xs[total - 1]} y2={cy} stroke="#dee2e6" strokeWidth="1.5" />
      {clamped > 0 && (
        <line x1={xs[0]} y1={cy} x2={xs[clamped]} y2={cy} stroke="#2f9e44" strokeWidth="1.5" />
      )}
      {xs.map((x, i) => {
        const cls =
          i < clamped
            ? classes.markDotDone
            : i === clamped
              ? classes.markDotCurrent
              : classes.markDotTodo;
        return (
          <circle key={x} cx={x} cy={cy} r={i === clamped ? 4 : 3.4} className={cls} />
        );
      })}
    </svg>
  );
}

interface Stage {
  /** Lifecycle accent colour (matches the product status board). */
  color: string;
  label: string;
  caption: string;
  /** Real ticket state shown as a pill under the node. */
  status: string;
  glyph: React.ReactNode;
}

/**
 * The five real ticket-lifecycle stages. Kept in a single brand green for a
 * consistent look. Glyphs are centred line-art drawn around each node's local
 * origin, stroked with `currentColor`.
 */
const STAGE_COLOR = "#2f9e44";

const STAGES: Stage[] = [
  {
    color: STAGE_COLOR,
    label: "Request",
    caption: "Submit intake form",
    status: "REQUESTED",
    glyph: (
      <>
        <rect x="-6" y="-8" width="12" height="16" rx="2" />
        <path d="M-3 -4h6M-3 0h6M-3 4h3" />
      </>
    ),
  },
  {
    color: STAGE_COLOR,
    label: "Sample received",
    caption: "Lab checks it in",
    status: "PENDING",
    glyph: (
      <>
        <path d="M0 -9v7" />
        <path d="M-3.2 -4.6 0 -1.4 3.2 -4.6" />
        <path d="M-7 3h14v5a1 1 0 0 1-1 1H-6a1 1 0 0 1-1-1Z" />
      </>
    ),
  },
  {
    color: STAGE_COLOR,
    label: "In progress",
    caption: "Collaborative analysis",
    status: "EXPERIMENTING",
    glyph: (
      <>
        <path d="M-3 -8v5L-6.5 6a1.4 1.4 0 0 0 1.3 2h8.4a1.4 1.4 0 0 0 1.3-2L3 -3v-5" />
        <path d="M-4.5 -8h9M-5 2.5h10" />
      </>
    ),
  },
  {
    color: STAGE_COLOR,
    label: "Finalizing",
    caption: "Results reviewed",
    status: "FINALIZING",
    glyph: (
      <>
        <rect x="-6" y="-7" width="12" height="16" rx="2" />
        <path d="M-2.5 -10h5a1 1 0 0 1 1 1v1.4a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V-9a1 1 0 0 1 1-1Z" />
        <path d="m-3 2.5 2 2 4-4.2" />
      </>
    ),
  },
  {
    color: STAGE_COLOR,
    label: "Certified report",
    caption: "Signed PDF ready",
    status: "COMPLETED",
    glyph: (
      <>
        <path d="M-6 -8h8l4 4v12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V-7a1 1 0 0 1 1-1Z" />
        <path d="M2 -8v4h4" />
        <path d="m-3 3.5 2 2 4-4" />
      </>
    ),
  },
];

const NODE_R = 30;
const RING_C = 2 * Math.PI * NODE_R; // ≈ 188.5
const STEP_DELAY = 0.7; // seconds between each stage activating

/**
 * Animated request → results lifecycle pipeline. A glowing comet travels an
 * instrument-style track while a gradient connector fills behind it; as the
 * flow reaches each node its progress ring draws around the circle and emits a
 * pulse, in sequence, then loops. Each node is colour-coded to its real ticket
 * state. Self-contained SVG, no images. Motion is disabled under
 * `prefers-reduced-motion` via CSS.
 */
export function WorkflowDiagram() {
  const cy = 78;
  const x0 = 80;
  const x1 = 880;
  const gap = (x1 - x0) / (STAGES.length - 1);
  const ticks = Array.from({ length: (x1 - x0) / 20 + 1 }, (_, i) => x0 + i * 20);

  return (
    <svg
      viewBox="0 0 960 180"
      className={classes.flow}
      role="img"
      aria-label="Experiment lifecycle: request, sample received, in progress, finalizing, certified report."
    >
      <defs>
        <linearGradient id="chemfoxFlow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2f9e44" />
          <stop offset="100%" stopColor="#51cf66" />
        </linearGradient>
        <filter id="chemfoxNodeShadow" x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#1c2128" floodOpacity="0.12" />
        </filter>
        <filter id="chemfoxComet" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* instrument tick marks */}
      {ticks.map((tx, i) => (
        <line
          key={tx}
          x1={tx}
          y1={cy - (i % 5 === 0 ? 6 : 3)}
          x2={tx}
          y2={cy + (i % 5 === 0 ? 6 : 3)}
          stroke="#e9ecef"
          strokeWidth="1"
        />
      ))}

      {/* base + filling connector */}
      <line x1={x0} y1={cy} x2={x1} y2={cy} stroke="#dee2e6" strokeWidth="2.5" />
      <line
        x1={x0}
        y1={cy}
        x2={x1}
        y2={cy}
        stroke="url(#chemfoxFlow)"
        strokeWidth="3"
        strokeLinecap="round"
        className={classes.flowFill}
      />

      {/* traveling comet */}
      <circle
        cx={x0}
        cy={cy}
        r="5.5"
        fill="#ffffff"
        stroke="#2f9e44"
        strokeWidth="2"
        filter="url(#chemfoxComet)"
        className={classes.flowComet}
      />

      {STAGES.map((stage, i) => {
        const delay = `${i * STEP_DELAY}s`;
        return (
          <g
            key={stage.label}
            transform={`translate(${x0 + i * gap}, ${cy})`}
            style={{ color: stage.color }}
          >
            {/* coloured halo */}
            <circle r={NODE_R + 7} fill="currentColor" opacity="0.08" />
            {/* expanding ping */}
            <circle
              r={NODE_R}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={classes.flowPing}
              style={{ animationDelay: delay }}
            />
            {/* base disc */}
            <circle
              r={NODE_R}
              fill="#fff"
              stroke="#e9ecef"
              strokeWidth="2"
              filter="url(#chemfoxNodeShadow)"
            />
            {/* progress ring that draws on activation */}
            <circle
              r={NODE_R}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              transform="rotate(-90)"
              strokeDasharray={RING_C}
              className={classes.flowProg}
              style={{ animationDelay: delay }}
            />
            {/* glyph */}
            <g
              transform="scale(1.05)"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {stage.glyph}
            </g>
            {/* index badge */}
            <g transform={`translate(${NODE_R - 6}, ${-NODE_R + 6})`}>
              <circle r="9" fill="currentColor" />
              <text className={classes.flowIndex} textAnchor="middle" y="3.2">
                {i + 1}
              </text>
            </g>

            <text x="0" y={NODE_R + 26} textAnchor="middle" className={classes.flowLabel}>
              {stage.label}
            </text>
            <text x="0" y={NODE_R + 42} textAnchor="middle" className={classes.flowCaption}>
              {stage.caption}
            </text>
            {/* status pill */}
            <g transform={`translate(0, ${NODE_R + 52})`}>
              <rect
                x={-(stage.status.length * 5.4 + 16) / 2}
                y="0"
                width={stage.status.length * 5.4 + 16}
                height="16"
                rx="8"
                fill="currentColor"
                opacity="0.14"
              />
              <text x="0" y="11.5" textAnchor="middle" className={classes.flowStatus}>
                {stage.status}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

"use client";

import { useRef } from "react";

import classes from "./landing.module.css";

/**
 * Animated, interactive lab artwork for the hero — a hex-grid backdrop with
 * concentric orbits, a rotating benzene ring, a bubbling conical flask, an
 * animated chromatogram trace and drifting particles. Pure inline SVG + CSS
 * (no stock images). Pointer movement applies a layered parallax; all motion
 * is disabled under `prefers-reduced-motion`.
 */
export function LabHeroArt() {
  const ref = useRef<HTMLDivElement>(null);

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty("--px", px.toFixed(3));
    el.style.setProperty("--py", py.toFixed(3));
  }

  function handlePointerLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--px", "0");
    el.style.setProperty("--py", "0");
  }

  return (
    <div
      ref={ref}
      className={classes.art}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      aria-hidden
    >
      <svg viewBox="0 0 480 480" className={classes.artSvg} role="presentation" focusable="false">
        <defs>
          <linearGradient id="chemfoxLiquid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#69db7c" />
            <stop offset="100%" stopColor="#2f9e44" />
          </linearGradient>
          <radialGradient id="chemfoxGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#b2f2bb" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#b2f2bb" stopOpacity="0" />
          </radialGradient>
          <pattern id="chemfoxHex" width="30" height="26" patternUnits="userSpaceOnUse" patternTransform="scale(1)">
            <path
              d="M15 1 L28 8.5 L28 18.5 L15 26 L2 18.5 L2 8.5 Z"
              fill="none"
              stroke="#2f9e44"
              strokeWidth="0.9"
            />
          </pattern>
          <radialGradient id="chemfoxHexFade" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="70%" stopColor="#fff" stopOpacity="1" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="chemfoxHexMask">
            <rect width="480" height="480" fill="url(#chemfoxHexFade)" />
          </mask>
          <clipPath id="chemfoxFlaskClip">
            <path d="M212 74 V176 L160 356 A18 18 0 0 0 176 384 H304 A18 18 0 0 0 320 356 L268 176 V74 Z" />
          </clipPath>
        </defs>

        {/* ambient glow */}
        <circle cx="240" cy="236" r="200" fill="url(#chemfoxGlow)" />

        {/* hex-grid backdrop, faded out at the edges */}
        <g mask="url(#chemfoxHexMask)" opacity="0.22">
          <rect x="40" y="40" width="400" height="400" fill="url(#chemfoxHex)" />
        </g>

        {/* concentric orbits */}
        <g className={classes.layerBack}>
          <circle cx="240" cy="210" r="186" fill="none" stroke="#dee2e6" strokeWidth="1.25" />
          <circle cx="240" cy="210" r="150" fill="none" stroke="#dee2e6" strokeWidth="1.5" strokeDasharray="5 11" className={classes.ringRev} />

          {/* orbiting atoms (anchor circle keeps the bbox centred on the orbit) */}
          <g className={classes.orbit}>
            <circle cx="240" cy="210" r="150" fill="none" />
            <g className={classes.node}>
              <circle cx="240" cy="60" r="13" fill="#fff" stroke="#2f9e44" strokeWidth="3" />
              <circle cx="240" cy="60" r="4" fill="#2f9e44" />
            </g>
            <g className={`${classes.node} ${classes.node2}`}>
              <circle cx="390" cy="210" r="10" fill="#fff" stroke="#51cf66" strokeWidth="3" />
              <circle cx="390" cy="210" r="3.5" fill="#51cf66" />
            </g>
            <g className={`${classes.node} ${classes.node3}`}>
              <circle cx="90" cy="210" r="10" fill="#fff" stroke="#51cf66" strokeWidth="3" />
              <circle cx="90" cy="210" r="3.5" fill="#51cf66" />
            </g>
          </g>
        </g>

        {/* rotating benzene ring (top-left accent) */}
        <g className={classes.benzene}>
          <polygon
            points="118,90 142,104 142,132 118,146 94,132 94,104"
            fill="#fff"
            stroke="#2f9e44"
            strokeWidth="2.5"
          />
          <polygon
            points="118,98 135,108 135,128 118,138 101,128 101,108"
            fill="none"
            stroke="#51cf66"
            strokeWidth="1.6"
          />
          <circle cx="118" cy="90" r="4.5" fill="#2f9e44" />
          <circle cx="142" cy="132" r="4.5" fill="#51cf66" />
          <circle cx="94" cy="132" r="4.5" fill="#51cf66" />
        </g>

        {/* flask + chromatogram (parallax mid layer) */}
        <g className={classes.layerMid}>
          {/* liquid */}
          <g clipPath="url(#chemfoxFlaskClip)">
            <rect x="150" y="250" width="180" height="150" fill="url(#chemfoxLiquid)" />
            <path className={classes.wave} d="M150 252 q 30 -14 60 0 t 60 0 t 60 0 t 60 0 v 40 H150 Z" fill="#69db7c" opacity="0.6" />
            <circle className={classes.bubble} cx="206" cy="378" r="6" fill="#ebfbee" />
            <circle className={`${classes.bubble} ${classes.bubble2}`} cx="240" cy="378" r="9" fill="#d3f9d8" />
            <circle className={`${classes.bubble} ${classes.bubble3}`} cx="272" cy="378" r="5" fill="#ebfbee" />
            <circle className={`${classes.bubble} ${classes.bubble4}`} cx="222" cy="378" r="4" fill="#ebfbee" />
            <circle className={`${classes.bubble} ${classes.bubble5}`} cx="256" cy="378" r="7" fill="#d3f9d8" />
          </g>

          {/* glass outline */}
          <path
            d="M212 74 V176 L160 356 A18 18 0 0 0 176 384 H304 A18 18 0 0 0 320 356 L268 176 V74 Z"
            fill="none"
            stroke="#212529"
            strokeWidth="6"
            strokeLinejoin="round"
          />
          <rect x="204" y="62" width="72" height="13" rx="6.5" fill="#212529" />
          <line x1="196" y1="300" x2="216" y2="300" stroke="#212529" strokeWidth="3" opacity="0.5" />
          <line x1="186" y1="330" x2="216" y2="330" stroke="#212529" strokeWidth="3" opacity="0.5" />

          {/* chromatogram trace under the flask */}
          <g transform="translate(0 6)">
            <line x1="150" y1="430" x2="330" y2="430" stroke="#dee2e6" strokeWidth="1.5" />
            <path
              className={classes.chromato}
              d="M150 430 L176 430 L188 404 L200 430 L224 430 L236 386 L248 430 L276 430 L288 412 L300 430 L330 430"
              fill="none"
              stroke="#2f9e44"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </g>

        {/* drifting particles (front parallax layer) */}
        <g className={classes.layerFront}>
          <circle className={`${classes.spark} ${classes.spark1}`} cx="350" cy="120" r="5" fill="#2f9e44" />
          <circle className={`${classes.spark} ${classes.spark2}`} cx="120" cy="300" r="4" fill="#51cf66" />
          <circle className={`${classes.spark} ${classes.spark3}`} cx="376" cy="312" r="3.5" fill="#2f9e44" />
          <circle className={`${classes.spark} ${classes.spark4}`} cx="338" cy="68" r="3" fill="#51cf66" />
        </g>
      </svg>
    </div>
  );
}

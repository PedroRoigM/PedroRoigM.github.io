/**
 * PacejkaCurve — SVG visualization of the Pacejka '94 magic formula.
 *
 * Renders a normalized lateral grip vs slip angle plot. The curve is sampled
 * with 96 points and a smooth path. A vertical guide + marker dot track the
 * live slip angle from the parent's state.
 *
 * The curve's peak (D) rescales with effective vertical load from downforce,
 * so the chart visibly grows when the user drops ride height or pushes
 * velocity up — that's the "redraw on slider change" behaviour.
 *
 * Axes:
 *   X — slip angle (deg), 0 → 15
 *   Y — lateral friction coefficient μ, 0 → 2.5
 *
 * Animations: GSAP tweens the path's `d` attribute whenever D changes. A
 * stroke-dasharray wipe runs once when the curve first paints.
 */
import { useEffect, useMemo, useRef } from 'react';
import { gsap } from 'gsap';

export interface PacejkaCurveProps {
  /** Current slip angle from slider (deg). Drives the marker. */
  slipAngle: number;
  /** Pacejka peak coefficient (D). Rescaled from base D0 by parent's load factor. */
  peakGrip: number;
  /** Locale for tick labels. */
  locale: 'es' | 'en';
  /** Optional className wrapper. */
  className?: string;
}

const VB_W = 200;
const VB_H = 120;
const PAD = { l: 18, r: 6, t: 8, b: 14 };
const PLOT_W = VB_W - PAD.l - PAD.r;
const PLOT_H = VB_H - PAD.t - PAD.b;
const X_MAX = 15; // slip angle range (deg)
const Y_MAX = 2.5; // μ axis ceiling

/** Pacejka '94 magic formula. Returns lateral μ (normalized by normal load). */
function pacejka(slipDeg: number, B = 10, C = 1.9, D = 2.2, E = -0.5): number {
  const lambda = (slipDeg * Math.PI) / 180;
  return D * Math.sin(C * Math.atan(B * lambda - E * (B * lambda - Math.atan(B * lambda))));
}

/** Map data coords → viewBox coords. */
function sx(slipDeg: number): number {
  return PAD.l + (Math.max(0, Math.min(X_MAX, slipDeg)) / X_MAX) * PLOT_W;
}
function sy(mu: number): number {
  return PAD.t + PLOT_H - (Math.max(0, Math.min(Y_MAX, mu)) / Y_MAX) * PLOT_H;
}

export default function PacejkaCurve({ slipAngle, peakGrip, locale, className }: PacejkaCurveProps) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const markerRef = useRef<SVGCircleElement | null>(null);
  const markerLineRef = useRef<SVGLineElement | null>(null);
  const markerTextRef = useRef<SVGTextElement | null>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  // Build the full curve path — 96 samples, smooth Catmull-Rom-ish via simple
  // cubic segments. Sampled at peakGrip so a peak change redraws the shape.
  const fullPathD = useMemo(() => {
    // Fixed base params for the curve's *signature*; peak only rescales D.
    const B = 10;
    const C = 1.9;
    const E = -0.5;
    const N = 96;
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= N; i++) {
      const slip = (i / N) * X_MAX;
      const mu = pacejka(slip, B, C, peakGrip, E);
      pts.push([sx(slip), sy(Math.max(0, Math.min(Y_MAX, mu)))]);
    }
    let d = `M ${pts[0]![0]} ${pts[0]![1]}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i]![0]} ${pts[i]![1]}`;
    }
    return d;
  }, [peakGrip]);

  // Animate path d when peakGrip changes. CSS transitions don't work for `d`
  // in most browsers, so GSAP morphs a numeric counter that we re-sample.
  useEffect(() => {
    if (!pathRef.current) return;
    const target = { v: parseFloat(pathRef.current.dataset.peak ?? String(peakGrip)) || peakGrip };
    const from = target.v;
    const to = peakGrip;
    if (Math.abs(from - to) < 1e-4) return;

    tweenRef.current?.kill();
    tweenRef.current = gsap.to(target, {
      v: to,
      duration: 0.45,
      ease: 'power2.out',
      onUpdate: () => {
        if (!pathRef.current) return;
        const D = target.v;
        const B = 10;
        const C = 1.9;
        const E = -0.5;
        const N = 96;
        let d = '';
        for (let i = 0; i <= N; i++) {
          const slip = (i / N) * X_MAX;
          const muRaw = pacejka(slip, B, C, D, E);
          const mu = Math.max(0, Math.min(Y_MAX, muRaw));
          const x = sx(slip);
          const y = sy(mu);
          d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
        }
        pathRef.current.setAttribute('d', d);
        pathRef.current.dataset.peak = String(D);
      },
    });

    return () => {
      tweenRef.current?.kill();
    };
  }, [peakGrip]);

  // Sync marker position to live slipAngle (no animation — must feel direct).
  // Marker μ must use the same peakGrip as the curve so the dot lands on it.
  useEffect(() => {
    if (!markerRef.current || !markerLineRef.current || !markerTextRef.current) return;
    const mu = Math.max(0, Math.min(Y_MAX, pacejka(slipAngle, 10, 1.9, peakGrip, -0.5)));
    const x = sx(slipAngle);
    const y = sy(mu);
    markerRef.current.setAttribute('cx', String(x));
    markerRef.current.setAttribute('cy', String(y));
    markerLineRef.current.setAttribute('x1', String(x));
    markerLineRef.current.setAttribute('x2', String(x));
    markerLineRef.current.setAttribute('y1', String(PAD.t));
    markerLineRef.current.setAttribute('y2', String(y));
    markerTextRef.current.setAttribute('x', String(x + 3));
    markerTextRef.current.setAttribute('y', String(PAD.t + 6));
    markerTextRef.current.textContent = `μ ${mu.toFixed(2)}`;
  }, [slipAngle, peakGrip]);

  // X-axis ticks: 0, 5, 10, 15 deg
  const xTicks = [0, 5, 10, 15];
  // Y-axis ticks: 0, 0.5, 1.0, 1.5, 2.0, 2.5
  const yTicks = [0, 0.5, 1.0, 1.5, 2.0, 2.5];

  const slipLabel = locale === 'es' ? 'ángulo slip (°)' : 'slip angle (°)';
  const muLabel = 'μ';

  return (
    <svg
      className={className}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Pacejka lateral grip curve"
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      {/* Background grid */}
      <g className="pacejka-grid">
        {yTicks.map((t) => (
          <line
            key={`yh-${t}`}
            x1={PAD.l}
            x2={PAD.l + PLOT_W}
            y1={sy(t)}
            y2={sy(t)}
            stroke="var(--rule)"
            strokeWidth={0.3}
            strokeDasharray={t === 0 ? '0' : '0.6 1.4'}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {xTicks.map((t) => (
          <line
            key={`xv-${t}`}
            x1={sx(t)}
            x2={sx(t)}
            y1={PAD.t}
            y2={PAD.t + PLOT_H}
            stroke="var(--rule)"
            strokeWidth={0.3}
            strokeDasharray="0.6 1.4"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>

      {/* Axes */}
      <g className="pacejka-axes">
        <line
          x1={PAD.l}
          x2={PAD.l + PLOT_W}
          y1={PAD.t + PLOT_H}
          y2={PAD.t + PLOT_H}
          stroke="var(--rule-strong)"
          strokeWidth={0.6}
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={PAD.l}
          x2={PAD.l}
          y1={PAD.t}
          y2={PAD.t + PLOT_H}
          stroke="var(--rule-strong)"
          strokeWidth={0.6}
          vectorEffect="non-scaling-stroke"
        />
      </g>

      {/* Axis labels (ticks) */}
      <g className="pacejka-ticks">
        {xTicks.map((t) => (
          <text
            key={`xt-${t}`}
            x={sx(t)}
            y={PAD.t + PLOT_H + 5}
            textAnchor="middle"
            fontSize="3.6"
            fontFamily="var(--font-display)"
            fill="var(--text-dim)"
          >
            {t}
          </text>
        ))}
        {yTicks.map((t) => (
          <text
            key={`yt-${t}`}
            x={PAD.l - 2.5}
            y={sy(t) + 1.4}
            textAnchor="end"
            fontSize="3.4"
            fontFamily="var(--font-display)"
            fill="var(--text-dim)"
          >
            {t.toFixed(1)}
          </text>
        ))}
        <text
          x={PAD.l + PLOT_W / 2}
          y={VB_H - 0.6}
          textAnchor="middle"
          fontSize="3.8"
          fontFamily="var(--font-display)"
          fill="var(--text-dim)"
          style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}
        >
          {slipLabel}
        </text>
        <text
          x={3.2}
          y={PAD.t + PLOT_H / 2}
          textAnchor="middle"
          fontSize="3.6"
          fontFamily="var(--font-display)"
          fill="var(--text-dim)"
          transform={`rotate(-90 3.2 ${PAD.t + PLOT_H / 2})`}
          style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}
        >
          {muLabel}
        </text>
      </g>

      {/* The Pacejka curve */}
      <path
        ref={pathRef}
        d={fullPathD}
        fill="none"
        stroke="var(--secondary)"
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        style={{ filter: 'drop-shadow(0 0 4px rgba(33, 158, 188, 0.45))' }}
        data-peak={String(peakGrip)}
      />

      {/* Live marker — vertical drop + dot + readout */}
      <line
        ref={markerLineRef}
        x1={sx(slipAngle)}
        x2={sx(slipAngle)}
        y1={PAD.t}
        y2={sy(pacejka(slipAngle, 10, 1.9, peakGrip, -0.5))}
        stroke="var(--accent)"
        strokeWidth={0.5}
        strokeDasharray="1.2 1.2"
        vectorEffect="non-scaling-stroke"
        opacity={0.85}
      />
      <circle
        ref={markerRef}
        cx={sx(slipAngle)}
        cy={sy(pacejka(slipAngle, 10, 1.9, peakGrip, -0.5))}
        r={2.4}
        fill="var(--accent)"
        stroke="var(--ink)"
        strokeWidth={0.6}
        vectorEffect="non-scaling-stroke"
      />
      <text
        ref={markerTextRef}
        x={sx(slipAngle) + 3}
        y={PAD.t + 6}
        fontSize="3.4"
        fontFamily="var(--font-display)"
        fill="var(--accent)"
        style={{
          fontVariantNumeric: 'tabular-nums',
          fontFeatureSettings: '"tnum" on',
          letterSpacing: '0.04em',
        }}
      >
        μ {pacejka(slipAngle, 10, 1.9, peakGrip, -0.5).toFixed(2)}
      </text>
    </svg>
  );
}
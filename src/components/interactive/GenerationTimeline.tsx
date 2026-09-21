/**
 * GenerationTimeline — Scrubbable SVG chart of neuroevolution learning curve.
 *
 * Renders the 98-generation training trajectory of the best lap (and the
 * population average) as two smooth paths inside an SVG viewBox. The user
 * can scrub horizontally by clicking/dragging on the chart — a thumb
 * follows the cursor and a floating readout shows the current generation,
 * best lap, and average lap.
 *
 * On viewport entry, GSAP wipes in the best-lap curve from left to right
 * using a `stroke-dasharray` trick. The dashed "Best · 66s" reference line
 * appears after the wipe completes.
 *
 * Visual axes:
 *   X — generation 1..98
 *   Y — lap time (s), 60..140 (we render with a small bit of padding so the
 *       extreme values don't kiss the axes)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import data from '../../data/training_curve.json';

export interface GenerationTimelineProps {
  locale: 'es' | 'en';
  /** Optional wrapper className. */
  className?: string;
}

interface CurvePoint {
  gen: number;
  best_lap_s: number;
  avg_lap_s: number;
}

const POINTS = data as CurvePoint[];

// ---------------------------------------------------------------------------
// ViewBox / axis geometry
// ---------------------------------------------------------------------------
const VB_W = 640;
const VB_H = 300;
const PAD = { l: 56, r: 24, t: 16, b: 32 };
const PLOT_W = VB_W - PAD.l - PAD.r;
const PLOT_H = VB_H - PAD.t - PAD.b;

// X range = full set of generations
const X_MIN = 1;
const X_MAX = POINTS.length; // 98

// Y range — pad the data extents so the curve doesn't touch the axes
const Y_MIN = 60;
const Y_MAX = 140;

function sx(gen: number): number {
  return PAD.l + ((gen - X_MIN) / (X_MAX - X_MIN)) * PLOT_W;
}
function sy(lap: number): number {
  return PAD.t + PLOT_H - ((Math.max(Y_MIN, Math.min(Y_MAX, lap)) - Y_MIN) / (Y_MAX - Y_MIN)) * PLOT_H;
}

/** Smooth Catmull-Rom-ish path through the points (centripetal, but simple
 *  monotoic cubic bezier works fine here — we use straight line segments
 *  with a softened visual via stroke-linejoin). */
function buildPath(values: number[], xOf: (i: number) => number, yOf: (v: number) => number): string {
  let d = '';
  for (let i = 0; i < values.length; i++) {
    const x = xOf(i);
    const y = yOf(values[i]!);
    d += i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d;
}

export default function GenerationTimeline({ locale, className }: GenerationTimelineProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const bestPathRef = useRef<SVGPathElement | null>(null);
  const avgPathRef = useRef<SVGPathElement | null>(null);
  const wipeTweenRef = useRef<gsap.core.Tween | null>(null);
  const markerTweenRef = useRef<gsap.core.Tween | null>(null);

  const [scrubIdx, setScrubIdx] = useState<number>(POINTS.length - 1);
  const [hasAnimatedIn, setHasAnimatedIn] = useState<boolean>(false);

  // Precompute paths so the JSX stays declarative.
  const bestValues = useMemo(() => POINTS.map((p) => p.best_lap_s), []);
  const avgValues = useMemo(() => POINTS.map((p) => p.avg_lap_s), []);

  const bestPathD = useMemo(
    () => buildPath(bestValues, (i) => sx(POINTS[i]!.gen), sy),
    [bestValues],
  );
  const avgPathD = useMemo(
    () => buildPath(avgValues, (i) => sx(POINTS[i]!.gen), sy),
    [avgValues],
  );

  // Approximate path length for the wipe-in animation. We use a generous
  // over-estimate (best path length + small fudge) so the dasharray fully
  // hides the curve before the animation starts.
  const pathLength = useMemo(() => {
    let len = 0;
    for (let i = 1; i < POINTS.length; i++) {
      const x0 = sx(POINTS[i - 1]!.gen);
      const y0 = sy(POINTS[i - 1]!.best_lap_s);
      const x1 = sx(POINTS[i]!.gen);
      const y1 = sy(POINTS[i]!.best_lap_s);
      len += Math.hypot(x1 - x0, y1 - y0);
    }
    return len;
  }, []);

  // ---- Viewport reveal --------------------------------------------------
  // Wipe in the best curve once the section enters the viewport.
  useEffect(() => {
    if (hasAnimatedIn || !bestPathRef.current || !svgRef.current) return;

    const path = bestPathRef.current;
    const root = svgRef.current;

    const playWipe = () => {
      // Prepare dash for wipe animation
      path.style.strokeDasharray = `${pathLength + 20}`;
      path.style.strokeDashoffset = `${pathLength + 20}`;
      path.getBoundingClientRect(); // force layout

      wipeTweenRef.current?.kill();
      wipeTweenRef.current = gsap.to(path, {
        strokeDashoffset: 0,
        duration: 1.6,
        ease: 'power2.inOut',
        onComplete: () => {
          // Restore normal dash so hover/responsive updates don't fight us
          path.style.strokeDasharray = '0';
          path.style.strokeDashoffset = '0';
          setHasAnimatedIn(true);
        },
      });

      // Avg curve fades in slightly delayed
      if (avgPathRef.current) {
        gsap.fromTo(
          avgPathRef.current,
          { opacity: 0 },
          { opacity: 0.45, duration: 1.0, delay: 0.6, ease: 'power2.out' },
        );
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          playWipe();
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(root);
    // Fallback in case the section is already in view at mount time and IO
    // didn't fire (e.g., reduced-motion + no transition).
    const rect = root.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      playWipe();
      io.disconnect();
    }

    return () => {
      io.disconnect();
      wipeTweenRef.current?.kill();
    };
  }, [hasAnimatedIn, pathLength]);

  // ---- Scrubbing ---------------------------------------------------------
  const handlePointer = useCallback(
    (clientX: number) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      // Convert client x to viewBox x
      const ratio = (clientX - rect.left) / rect.width;
      const vbX = ratio * VB_W;
      const plotX = Math.max(0, Math.min(PLOT_W, vbX - PAD.l));
      const t = plotX / PLOT_W;
      const idx = Math.round(t * (POINTS.length - 1));
      setScrubIdx(idx);
    },
    [],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      // Capture the pointer so drag continues even if the cursor leaves the SVG
      e.currentTarget.setPointerCapture(e.pointerId);
      handlePointer(e.clientX);
    },
    [handlePointer],
  );
  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.buttons === 0 && e.pointerType !== 'touch') return;
      handlePointer(e.clientX);
    },
    [handlePointer],
  );
  const onPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  // ---- Pulse the scrub thumb on mount (after reveal) --------------------
  useEffect(() => {
    if (!hasAnimatedIn || !svgRef.current) return;
    const thumb = svgRef.current.querySelector<SVGCircleElement>('.timeline-thumb');
    if (!thumb) return;
    markerTweenRef.current?.kill();
    markerTweenRef.current = gsap.fromTo(
      thumb,
      { scale: 0.85 },
      { scale: 1, duration: 0.4, ease: 'back.out(2)', overwrite: 'auto' },
    );
    return () => {
      markerTweenRef.current?.kill();
    };
  }, [hasAnimatedIn]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const current = POINTS[scrubIdx]!;
  const thumbX = sx(current.gen);
  const thumbY = sy(current.best_lap_s);

  // Tooltip position — clamp to viewport so it doesn't overflow
  const tooltipW = 200;
  const tooltipH = 56;
  const tooltipX = Math.max(
    PAD.l,
    Math.min(VB_W - PAD.r - tooltipW, thumbX - tooltipW / 2),
  );
  const tooltipY = thumbY - tooltipH - 14;

  const labels = {
    generation: locale === 'es' ? 'Generación' : 'Generation',
    lap: locale === 'es' ? 'Vuelta (s)' : 'Lap (s)',
    best: locale === 'es' ? 'Mejor' : 'Best',
    avg: locale === 'es' ? 'Media' : 'Avg',
    bestLine: locale === 'es' ? 'Mejor' : 'Best',
  };

  // X ticks: 1, 25, 50, 75, 98
  const xTicks = [1, 25, 50, 75, 98];
  // Y ticks: 60, 80, 100, 120, 140
  const yTicks = [60, 80, 100, 120, 140];

  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={locale === 'es' ? 'Curva de aprendizaje de neuroevolución' : 'Neuroevolution learning curve'}
      style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', cursor: 'crosshair' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* ---- Grid --------------------------------------------------------- */}
      <g aria-hidden="true">
        {yTicks.map((t) => (
          <line
            key={`yh-${t}`}
            x1={PAD.l}
            x2={PAD.l + PLOT_W}
            y1={sy(t)}
            y2={sy(t)}
            stroke="var(--rule)"
            strokeWidth={0.5}
            strokeDasharray={t === Y_MAX ? '0' : '2 4'}
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
            strokeWidth={0.5}
            strokeDasharray="2 4"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>

      {/* ---- Reference line at Y=66 (best) ------------------------------- */}
      <g aria-hidden="true">
        <line
          x1={PAD.l}
          x2={PAD.l + PLOT_W}
          y1={sy(66)}
          y2={sy(66)}
          stroke="var(--accent)"
          strokeWidth={0.8}
          strokeDasharray="4 4"
          opacity={hasAnimatedIn ? 0.5 : 0}
          vectorEffect="non-scaling-stroke"
          style={{ transition: 'opacity 0.6s var(--motion-ease-out)' }}
        />
        <text
          x={PAD.l + PLOT_W - 6}
          y={sy(66) - 4}
          textAnchor="end"
          fontSize="9"
          fontFamily="var(--font-display)"
          fill="var(--accent)"
          letterSpacing="0.08em"
          style={{ textTransform: 'uppercase', opacity: hasAnimatedIn ? 0.85 : 0, transition: 'opacity 0.6s var(--motion-ease-out)' }}
        >
          {labels.bestLine} · 66s
        </text>
      </g>

      {/* ---- Axes --------------------------------------------------------- */}
      <line
        x1={PAD.l}
        x2={PAD.l + PLOT_W}
        y1={PAD.t + PLOT_H}
        y2={PAD.t + PLOT_H}
        stroke="var(--rule-strong)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={PAD.l}
        x2={PAD.l}
        y1={PAD.t}
        y2={PAD.t + PLOT_H}
        stroke="var(--rule-strong)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />

      {/* ---- Tick labels --------------------------------------------------- */}
      <g aria-hidden="true">
        {xTicks.map((t) => (
          <text
            key={`xt-${t}`}
            x={sx(t)}
            y={PAD.t + PLOT_H + 16}
            textAnchor="middle"
            fontSize="10"
            fontFamily="var(--font-display)"
            fill="var(--text-dim)"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {t}
          </text>
        ))}
        {yTicks.map((t) => (
          <text
            key={`yt-${t}`}
            x={PAD.l - 8}
            y={sy(t) + 3.5}
            textAnchor="end"
            fontSize="10"
            fontFamily="var(--font-display)"
            fill="var(--text-dim)"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {t}
          </text>
        ))}
        <text
          x={PAD.l + PLOT_W / 2}
          y={VB_H - 6}
          textAnchor="middle"
          fontSize="10"
          fontFamily="var(--font-display)"
          fill="var(--text-dim)"
          letterSpacing="0.08em"
          style={{ textTransform: 'uppercase' }}
        >
          {labels.generation}
        </text>
        <text
          x={14}
          y={PAD.t + PLOT_H / 2}
          textAnchor="middle"
          fontSize="10"
          fontFamily="var(--font-display)"
          fill="var(--text-dim)"
          letterSpacing="0.08em"
          transform={`rotate(-90 14 ${PAD.t + PLOT_H / 2})`}
          style={{ textTransform: 'uppercase' }}
        >
          {labels.lap}
        </text>
      </g>

      {/* ---- Average curve (lighter, behind) ---------------------------- */}
      <path
        ref={avgPathRef}
        d={avgPathD}
        fill="none"
        stroke="var(--secondary)"
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0}
        vectorEffect="non-scaling-stroke"
      />

      {/* ---- Best curve (main) ------------------------------------------ */}
      <path
        ref={bestPathRef}
        d={bestPathD}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2.2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        style={{ filter: 'drop-shadow(0 0 6px rgba(255, 183, 3, 0.4))' }}
      />

      {/* ---- Scrub guide line (vertical) -------------------------------- */}
      <line
        x1={thumbX}
        x2={thumbX}
        y1={PAD.t}
        y2={PAD.t + PLOT_H}
        stroke="var(--accent)"
        strokeWidth={0.6}
        strokeDasharray="3 3"
        opacity={0.5}
        vectorEffect="non-scaling-stroke"
        aria-hidden="true"
      />

      {/* ---- Scrub thumb ------------------------------------------------- */}
      <g aria-hidden="true">
        <circle
          className="timeline-thumb"
          cx={thumbX}
          cy={thumbY}
          r={6}
          fill="var(--accent)"
          stroke="var(--ink)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          style={{
            transformBox: 'fill-box',
            transformOrigin: 'center',
            filter: 'drop-shadow(0 0 6px rgba(255, 183, 3, 0.6))',
          }}
        />
      </g>

      {/* ---- Floating tooltip ------------------------------------------- */}
      <g
        aria-hidden="true"
        style={{
          opacity: hasAnimatedIn ? 1 : 0,
          transition: 'opacity 0.4s var(--motion-ease-out)',
        }}
      >
        <rect
          x={tooltipX}
          y={tooltipY}
          width={tooltipW}
          height={tooltipH}
          rx={4}
          fill="var(--primary-2)"
          stroke="var(--rule-strong)"
          strokeWidth={1}
        />
        {/* Connector dot to thumb */}
        <line
          x1={thumbX}
          x2={thumbX}
          y1={tooltipY + tooltipH}
          y2={thumbY - 6}
          stroke="var(--rule-strong)"
          strokeWidth={0.6}
          strokeDasharray="2 2"
        />
        <text
          x={tooltipX + 12}
          y={tooltipY + 18}
          fontSize="9"
          fontFamily="var(--font-display)"
          fill="var(--text-dim)"
          letterSpacing="0.08em"
          style={{ textTransform: 'uppercase' }}
        >
          {labels.generation} {current.gen}
        </text>
        <text
          x={tooltipX + 12}
          y={tooltipY + 36}
          fontSize="14"
          fontFamily="var(--font-display)"
          fill="var(--accent)"
          fontWeight={600}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {current.best_lap_s.toFixed(1)}s
        </text>
        <text
          x={tooltipX + 12}
          y={tooltipY + 50}
          fontSize="10"
          fontFamily="var(--font-display)"
          fill="var(--text-dim)"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {labels.best} {current.best_lap_s.toFixed(2)}s · {labels.avg} {current.avg_lap_s.toFixed(2)}s
        </text>
      </g>
    </svg>
  );
}
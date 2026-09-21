/**
 * LearningChart — Reusable scrubbable SVG chart for neuroevolution
 * metrics over 98 generations.
 *
 * Generalises the original GenerationTimeline: same axis geometry, same
 * wipe-in animation, same scrub interaction — but configurable for any
 * metric the training_curve.json carries (best_lap_s, survival_s,
 * laps_completed, avg_lap_s, ...).
 *
 * The "best lap time" headline chart (124→66) keeps its accent-persimmon
 * palette. Other metrics use a saffron / bone variant so the three charts
 * read distinctly when stacked side-by-side.
 *
 * Features:
 * - Larger ViewBox (680x300) for more visual impact
 * - GSAP wipe-in reveal with clipPath
 * - Gradient area fill under the curve
 * - Best value marker
 * - Hover tooltip with generation + value
 * - Respects prefers-reduced-motion
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import data from '../../data/training_curve.json';

export type MetricKey = 'best_lap_s' | 'avg_lap_s' | 'survival_s' | 'laps_completed';

interface GenerationPoint {
  gen: number;
  best_lap_s: number;
  avg_lap_s: number;
  survival_s: number;
  laps_completed: number;
  compound: string;
}

const POINTS = data as GenerationPoint[];

export interface MetricSpec {
  /** Localised title shown above the chart */
  title: string;
  /** Caption below the chart */
  caption: string;
  /** Short axis label (e.g. "Vuelta (s)") */
  yAxisLabel: string;
  /** Unit suffix */
  unit: string;
  /** Key into training_curve.json record */
  key: MetricKey;
  /** Optional secondary metric (e.g. avg curve behind best) */
  secondaryKey?: MetricKey;
  /** Y-axis lower bound */
  yMin: number;
  /** Y-axis upper bound */
  yMax: number;
  /** Pretty ticks for the Y axis */
  yTicks: number[];
  /** Color variant — 'persimmon' (highlight), 'saffron' (secondary),
   *  'racing' (primary green). Defaults to persimmon. */
  variant?: 'persimmon' | 'saffron' | 'racing';
  /** Direction: 'lower-better' (lap time, crashes), 'higher-better'
   *  (survival, laps). Affects the visual "descent/ascent" feel only. */
  betterDirection?: 'lower' | 'higher';
  /** Decimal places when formatting values */
  decimals?: number;
}

export interface LearningChartProps {
  locale: 'es' | 'en';
  spec: MetricSpec;
  /** Optional axis label horizontal text */
  xAxisLabel?: string;
}

// ---------------------------------------------------------------------------
// ViewBox / axis geometry — LARGER for more visual impact
// ---------------------------------------------------------------------------
const VB_W = 680;
const VB_H = 300;
const PAD = { l: 60, r: 28, t: 16, b: 36 };
const PLOT_W = VB_W - PAD.l - PAD.r;
const PLOT_H = VB_H - PAD.t - PAD.b;

// Static so all charts share the same X axis (generations 1..98)
const N = POINTS.length;
const X_MIN = 1;
const X_MAX = N;

function sx(gen: number): number {
  return PAD.l + ((gen - X_MIN) / (X_MAX - X_MIN)) * PLOT_W;
}
function sy(value: number, yMin: number, yMax: number): number {
  const v = Math.max(yMin, Math.min(yMax, value));
  return PAD.t + PLOT_H - ((v - yMin) / (yMax - yMin)) * PLOT_H;
}

function buildPath(
  values: number[],
  yMin: number,
  yMax: number,
): string {
  let d = '';
  for (let i = 0; i < values.length; i++) {
    const x = sx(X_MIN + i);
    const y = sy(values[i]!, yMin, yMax);
    d += i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d;
}

// Resolved colours per variant — keep all values via var(--*) so the design
// system stays consistent and dark-mode swaps land for free.
const VARIANT_COLORS = {
  persimmon: { main: 'var(--accent)', soft: 'var(--accent-2)', halo: 'rgba(255, 91, 58, 0.45)' },
  saffron: { main: 'var(--secondary)', soft: 'var(--secondary-2)', halo: 'rgba(168, 216, 0, 0.45)' },
  racing: { main: 'var(--asphalt)', soft: 'var(--asphalt)', halo: 'rgba(125, 151, 184, 0.55)' },
};

export default function LearningChart({
  locale,
  spec,
  xAxisLabel,
}: LearningChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const mainPathRef = useRef<SVGPathElement | null>(null);
  const secondaryPathRef = useRef<SVGPathElement | null>(null);
  const wipeTweenRef = useRef<gsap.core.Tween | null>(null);
  const areaPathRef = useRef<SVGPathElement | null>(null);

  const [scrubIdx, setScrubIdx] = useState<number>(N - 1);
  const [hasAnimatedIn, setHasAnimatedIn] = useState<boolean>(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; gen: number; value: number } | null>(null);

  const decimals = spec.decimals ?? 1;

  const values = useMemo(
    () => POINTS.map((p) => p[spec.key]),
    [spec.key]
  );
  const secondaryValues = useMemo(() => {
    if (!spec.secondaryKey) return null;
    return POINTS.map((p) => p[spec.secondaryKey!]);
  }, [spec.secondaryKey]);

  const pathD = useMemo(
    () => buildPath(values, spec.yMin, spec.yMax),
    [values, spec.yMin, spec.yMax]
  );
  const secondaryPathD = useMemo(() => {
    if (!secondaryValues) return null;
    return buildPath(secondaryValues, spec.yMin, spec.yMax);
  }, [secondaryValues, spec.yMin, spec.yMax]);

  // Build area fill path (from curve to bottom of plot)
  const areaPathD = useMemo(() => {
    const firstX = sx(X_MIN);
    const lastX = sx(X_MAX);
    const bottomY = sy(spec.yMin, spec.yMin, spec.yMax);
    return `${pathD} L ${lastX.toFixed(2)} ${bottomY.toFixed(2)} L ${firstX.toFixed(2)} ${bottomY.toFixed(2)} Z`;
  }, [pathD, spec.yMin, spec.yMax, X_MIN, X_MAX]);

  // Find best value for marker
  const { bestGen, bestValue } = useMemo(() => {
    let best = values[0]!;
    let bestIdx = 0;
    for (let i = 1; i < values.length; i++) {
      const v = values[i]!;
      const isBetter = spec.betterDirection === 'higher' ? v > best : v < best;
      if (isBetter) {
        best = v;
        bestIdx = i;
      }
    }
    return { bestGen: bestIdx + 1, bestValue: best };
  }, [values, spec.betterDirection]);

  const variant = spec.variant ?? 'persimmon';
  const palette = VARIANT_COLORS[variant];

  // ---- Wipe-in on viewport entry (respects prefers-reduced-motion) --------
  useEffect(() => {
    if (!mainPathRef.current || !svgRef.current) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setHasAnimatedIn(true);
      return;
    }

    const path = mainPathRef.current;
    const root = svgRef.current;
    const wipeRect = root.querySelector<SVGRectElement>('.wipe-rect');

    const playWipe = () => {
      // Set up strokeDashoffset animation for the path
      const totalLen = path.getTotalLength();
      path.style.strokeDasharray = `${totalLen}`;
      path.style.strokeDashoffset = `${totalLen}`;
      path.getBoundingClientRect();

      // Kill existing tweens
      wipeTweenRef.current?.kill();

      // Wipe reveal via clipPath rect expanding
      if (wipeRect) {
        wipeRect.setAttribute('width', '0');
        wipeRect.getBoundingClientRect();

        wipeTweenRef.current = gsap.to(wipeRect, {
          attr: { width: PLOT_W },
          duration: 1.8,
          ease: 'power3.inOut',
          delay: 0.1,
        });
      }

      // Path draws in sync with wipe
      gsap.to(path, {
        strokeDashoffset: 0,
        duration: 2.2,
        ease: 'power3.inOut',
        delay: 0.05,
        onComplete: () => {
          path.style.strokeDasharray = '0';
          path.style.strokeDashoffset = '0';
          setHasAnimatedIn(true);
        },
      });

      // Area fill fades in slightly behind
      if (areaPathRef.current) {
        gsap.fromTo(
          areaPathRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 1.2, delay: 0.4, ease: 'power2.out' }
        );
      }

      // Secondary curve fades in
      if (secondaryPathRef.current) {
        gsap.fromTo(
          secondaryPathRef.current,
          { opacity: 0 },
          { opacity: 0.4, duration: 1.0, delay: 0.6, ease: 'power2.out' }
        );
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          playWipe();
          io.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    io.observe(root);

    const rect = root.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      playWipe();
      io.disconnect();
    }

    return () => {
      io.disconnect();
      wipeTweenRef.current?.kill();
    };
  }, []);

  // ---- Scrub interaction -------------------------------------------------
  const handlePointer = useCallback((clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    const vbX = ratio * VB_W;
    const plotX = Math.max(0, Math.min(PLOT_W, vbX - PAD.l));
    const t = plotX / PLOT_W;
    const idx = Math.round(t * (N - 1));
    setScrubIdx(idx);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      handlePointer(e.clientX);
    },
    [handlePointer]
  );
  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.buttons === 0 && e.pointerType !== 'touch') return;
      handlePointer(e.clientX);
    },
    [handlePointer]
  );
  const onPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  // ---- Hover tooltip interaction ----------------------------------------
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGRectElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const ratio = (mouseX - PAD.l) / PLOT_W;
    const gen = Math.round(X_MIN + ratio * (X_MAX - X_MIN));
    const clampedGen = Math.max(X_MIN, Math.min(X_MAX, gen));
    const idx = clampedGen - 1;
    const point = POINTS[idx];
    if (point) {
      const value = point[spec.key];
      setTooltip({
        x: sx(clampedGen),
        y: sy(value, spec.yMin, spec.yMax),
        gen: clampedGen,
        value,
      });
    }
  }, [spec.key, spec.yMin, spec.yMax]);

  // ---- Labels ------------------------------------------------------------
  const labels = {
    gen: locale === 'es' ? 'Generación' : 'Generation',
    best: locale === 'es' ? 'Mejor' : 'Best',
    avg: locale === 'es' ? 'Media' : 'Avg',
  };

  const current = POINTS[scrubIdx]!;
  const thumbX = sx(current.gen);
  const thumbY = sy(values[scrubIdx]!, spec.yMin, spec.yMax);

  const xTicks = [1, 25, 50, 75, 98];
  const yTicks = spec.yTicks;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={spec.title}
      style={{
        width: '100%',
        height: 'auto',
        display: 'block',
        touchAction: 'none',
        cursor: 'crosshair',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* ---- Defs: gradients and clipPath -------------------------------- */}
      <defs>
        {/* Gradient for area fill under the curve */}
        <linearGradient id={`area-gradient-${variant}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.main} stopOpacity="0.35" />
          <stop offset="100%" stopColor={palette.main} stopOpacity="0.02" />
        </linearGradient>

        {/* Glow filter for the main line */}
        <filter id={`glow-${variant}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* ClipPath for wipe reveal animation */}
        <clipPath id={`wipe-clip-${variant}`}>
          <rect
            className="wipe-rect"
            x={PAD.l}
            y={PAD.t}
            width={0}
            height={PLOT_H}
          />
        </clipPath>
      </defs>

      {/* ---- Grid --------------------------------------------------------- */}
      <g aria-hidden="true">
        {yTicks.map((t) => (
          <line
            key={`yh-${t}`}
            x1={PAD.l}
            x2={PAD.l + PLOT_W}
            y1={sy(t, spec.yMin, spec.yMax)}
            y2={sy(t, spec.yMin, spec.yMax)}
            stroke="var(--rule)"
            strokeWidth={0.5}
            strokeDasharray={t === spec.yMax ? '0' : '2 4'}
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
            y={sy(t, spec.yMin, spec.yMax) + 3.5}
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
          fontSize="9"
          fontFamily="var(--font-display)"
          fill="var(--text-dim)"
          letterSpacing="0.08em"
          style={{ textTransform: 'uppercase' }}
        >
          {xAxisLabel ?? labels.gen}
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
          {spec.yAxisLabel}
        </text>
      </g>

      {/* ---- Wipe-clipped content group ----------------------------------- */}
      <g clipPath={`url(#wipe-clip-${variant})`}>
        {/* Secondary curve (behind) */}
        {secondaryPathD && (
          <path
            ref={secondaryPathRef}
            d={secondaryPathD}
            fill="none"
            stroke="var(--text-dim)"
            strokeWidth={1.2}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={0}
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* Area fill under the main curve */}
        <path
          ref={areaPathRef}
          d={areaPathD}
          fill={`url(#area-gradient-${variant})`}
          opacity={0}
          vectorEffect="non-scaling-stroke"
        />

        {/* Main curve */}
        <path
          ref={mainPathRef}
          d={pathD}
          fill="none"
          stroke={palette.main}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ filter: `drop-shadow(0 0 6px ${palette.halo})` }}
        />
      </g>

      {/* ---- Best value marker (outside clip, always visible) ------------ */}
      <g className="best-marker" aria-hidden="true">
        <circle
          cx={sx(bestGen)}
          cy={sy(bestValue, spec.yMin, spec.yMax)}
          r={5}
          fill={palette.main}
          stroke="var(--ink)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          style={{ filter: `drop-shadow(0 0 4px ${palette.halo})` }}
        />
        <circle
          cx={sx(bestGen)}
          cy={sy(bestValue, spec.yMin, spec.yMax)}
          r={9}
          fill="none"
          stroke={palette.main}
          strokeWidth={1}
          strokeDasharray="2 2"
          opacity={0.5}
          vectorEffect="non-scaling-stroke"
        />
        <rect
          x={sx(bestGen) - 32}
          y={sy(bestValue, spec.yMin, spec.yMax) - 26}
          width={64}
          height={18}
          rx={3}
          fill="var(--ink)"
          stroke="var(--asphalt)"
          strokeWidth={0.5}
          opacity={0.9}
        />
        <text
          x={sx(bestGen)}
          y={sy(bestValue, spec.yMin, spec.yMax) - 13}
          textAnchor="middle"
          fontSize="9"
          fontFamily="var(--font-display)"
          fill={palette.main}
          fontWeight={600}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {labels.best}: {bestValue.toFixed(decimals)}{spec.unit}
        </text>
      </g>

      {/* ---- Scrub guide line ---------------------------------------------- */}
      <line
        x1={thumbX}
        x2={thumbX}
        y1={PAD.t}
        y2={PAD.t + PLOT_H}
        stroke={palette.main}
        strokeWidth={0.8}
        strokeDasharray="4 4"
        opacity={0.6}
        vectorEffect="non-scaling-stroke"
        aria-hidden="true"
      />

      {/* ---- Thumb --------------------------------------------------------- */}
      <circle
        cx={thumbX}
        cy={thumbY}
        r={6}
        fill={palette.main}
        stroke="var(--ink)"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        style={{
          transformBox: 'fill-box',
          transformOrigin: 'center',
          filter: `drop-shadow(0 0 6px ${palette.halo})`,
        }}
        aria-hidden="true"
      />

      {/* ---- Floating readout ---------------------------------------------- */}
      <g
        aria-hidden="true"
        style={{
          opacity: hasAnimatedIn ? 1 : 0,
          transition: 'opacity 0.35s var(--motion-ease-out)',
        }}
      >
        <text
          x={PAD.l + 8}
          y={PAD.t + 14}
          fontSize="9"
          fontFamily="var(--font-display)"
          fill="var(--text-dim)"
          letterSpacing="0.08em"
          style={{ textTransform: 'uppercase' }}
        >
          {labels.gen} {current.gen}
        </text>
        <text
          x={PAD.l + PLOT_W - 8}
          y={PAD.t + 14}
          fontSize="12"
          fontFamily="var(--font-display)"
          fill={palette.main}
          fontWeight={700}
          textAnchor="end"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {values[scrubIdx]!.toFixed(decimals)}{spec.unit}
        </text>
      </g>

      {/* ---- Hover interaction layer (transparent) ------------------------ */}
      <rect
        x={PAD.l}
        y={PAD.t}
        width={PLOT_W}
        height={PLOT_H}
        fill="transparent"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
        aria-hidden="true"
      />

      {/* ---- Tooltip on hover -------------------------------------------- */}
      {tooltip && (
        <g aria-hidden="true">
          <rect
            x={tooltip.x - 40}
            y={tooltip.y - 34}
            width={80}
            height={24}
            rx={4}
            fill="var(--ink)"
            stroke="var(--asphalt)"
            strokeWidth={0.5}
            opacity={0.95}
          />
          <text
            x={tooltip.x}
            y={tooltip.y - 18}
            textAnchor="middle"
            fontSize="10"
            fontFamily="var(--font-display)"
            fill={palette.main}
            fontWeight={600}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            G{tooltip.gen}: {tooltip.value.toFixed(decimals)}{spec.unit}
          </text>
        </g>
      )}
    </svg>
  );
}

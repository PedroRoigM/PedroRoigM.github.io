/**
 * TrainingCircuit — Section 02 interactive centerpiece.
 *
 * DUAL TRACK layout with two parallel boundaries (inner + outer), representing
 * the real limits of the circuit. The animated dot (the car) moves BETWEEN the
 * two lines, oscillating perpendicular to the path (left/right symmetry sway).
 *
 * Each of the 11 sensor rays genuinely reaches the nearest wall boundary —
 * the ray casts from the dot position in its direction and stops at the first
 * hit on either the inner or outer track stroke. Perpendicular rays therefore
 * look short (near wall) and forward rays look long (open road), but now
 * they actually touch the circuit edge.
 *
 * Auto-generated checkpoints pulse at fixed t values along the path.
 * A scrub slider pauses the auto-animation and lets the user position the
 * dot manually.
 * Honours `prefers-reduced-motion`: dot stays at scrub=0 with full rays;
 * the slider still works for manual scrubbing.
 *
 * The path data is the same shape used by CircuitCard, sourced from
 * `src/data/circuits/circuits.json` (barcelona) — but it's never labelled
 * by name. The whole section calls it a generic "training circuit".
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import circuitsRaw from '../../data/circuits/circuits.json';
import type { Circuit } from '../../data/circuits';

interface Props {
  locale: 'es' | 'en';
}

// Single source-of-truth for the rendered circuit
const RAW = circuitsRaw as unknown as Record<string, { length_m: number; path_d: string }>;
const TRAINING_CIRCUIT: Circuit = {
  id: 'training',
  nameEs: 'Circuito de entrenamiento',
  nameEn: 'Training circuit',
  countryEs: '',
  countryEn: '',
  lengthKm: Math.round(RAW.barcelona.length_m / 10) / 100, // 4.656 → 4.66
  turns: 16,
  yearActive: 2024,
  pathD: RAW.barcelona.path_d,
  totalCheckpoints: 12,
};

// ViewBox — wider than tall for landscape play, scaled to be the
// visual anchor of the section
const VB_W = 720;
const VB_H = 432;
const PAD = { l: 28, r: 28, t: 28, b: 28 };
const PLOT_W = VB_W - PAD.l - PAD.r;
const PLOT_H = VB_H - PAD.t - PAD.b;

// Build the path on the centered viewBox. circuits.json paths are in a
// 400×240 viewBox; we scale them up to fill 720×432 with margins.
const SRC_W = 400;
const SRC_H = 240;

function scaleX(x: number): number {
  return PAD.l + (x / SRC_W) * PLOT_W;
}
function scaleY(y: number): number {
  return PAD.t + (y / SRC_H) * PLOT_H;
}

/** Re-emit the source path scaled into the outer viewBox. The source uses
 * M / L commands only — pure scaling of x and y handles the transform. */
function transformPath(sourceD: string): string {
  let out = '';
  // Tokenise by whitespace then numbers/commands. SVG minified: "M x y L x y"
  const tokens = sourceD.match(/[MLZ]|-?\d+\.?\d*/g) ?? [];
  for (let i = 0; i < tokens.length; ) {
    const t = tokens[i]!;
    if (t === 'M' || t === 'L' || t === 'Z') {
      out += ` ${t}`;
      i++;
    } else {
      const x = parseFloat(t);
      const y = parseFloat(tokens[i + 1]!);
      out += ` ${scaleX(x).toFixed(2)} ${scaleY(y).toFixed(2)}`;
      i += 2;
    }
  }
  return out.trim();
}

// ---------------------------------------------------------------------------
// Dual-track offset helpers
// ---------------------------------------------------------------------------

/** Perpendicular offset for each boundary in viewBox units.
 * INNER_OFFSET moves points toward the inside of the track (right of tangent).
 * OUTER_OFFSET moves points toward the outside of the track (left of tangent).
 * The car oscillates between -oscAmplitude and +oscAmplitude around the centerline. */
const INNER_OFFSET = 18; // px in viewBox (toward inside of bend)
const OUTER_OFFSET = 18; // px in viewBox (toward outside of bend)
const OSC_AMPLITUDE = INNER_OFFSET * 0.65; // max oscillation from center

/**
 * Offset a path by `offset` viewBox units perpendicular to its tangent.
 *
 * Algorithm:
 * 1. Tokenise the path (M/L/Z only — our source uses only these).
 * 2. Collect all coordinate pairs in order.
 * 3. For each point, compute the tangent direction:
 *    - For points 0..N-2: tangent = normalize(next_point - current_point)
 *    - For the last point: tangent = normalize(current_point - prev_point)
 *    (so the final segment points back toward the second-to-last point)
 * 4. Normal is perpendicular: (-tangent.y, tangent.x).
 * 5. New point = current + offset * normal.
 * 6. Rebuild path with M and L commands. Z is passed through as-is.
 */
function offsetPath(sourceD: string, offset: number): string {
  const tokens = sourceD.match(/[MLZ]|-?\d+\.?\d*/g) ?? [];
  if (tokens.length === 0) return sourceD;

  // Collect all [x, y] coordinate pairs and their command positions
  type Pt = { x: number; y: number };
  const pts: Pt[] = [];
  const cmdMap: number[] = []; // maps index in pts[] to token index

  for (let i = 0; i < tokens.length; ) {
    const t = tokens[i]!;
    if (t === 'M' || t === 'L') {
      const x = parseFloat(tokens[i + 1]!);
      const y = parseFloat(tokens[i + 2]!);
      pts.push({ x, y });
      cmdMap.push(i);
      i += 3;
    } else if (t === 'Z') {
      // Z has no coordinates — skip
      i++;
    } else {
      // Bare number — skip (shouldn't happen with our path format)
      i++;
    }
  }

  if (pts.length < 2) return sourceD;

  const newPts: Pt[] = new Array(pts.length);

  for (let i = 0; i < pts.length; i++) {
    let tx: number, ty: number;

    if (i < pts.length - 1) {
      // Tangent toward the next point (forward difference)
      const dx = pts[i + 1]!.x - pts[i]!.x;
      const dy = pts[i + 1]!.y - pts[i]!.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      tx = len > 0 ? dx / len : 0;
      ty = len > 0 ? dy / len : 0;
    } else {
      // Last point: tangent points back toward the previous point
      const dx = pts[i]!.x - pts[i - 1]!.x;
      const dy = pts[i]!.y - pts[i - 1]!.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      tx = len > 0 ? dx / len : 0;
      ty = len > 0 ? dy / len : 0;
    }

    // Normal = rotate tangent 90° (counter-clockwise for left-of-tangent)
    const nx = -ty;
    const ny = tx;

    newPts[i] = {
      x: pts[i]!.x + offset * nx,
      y: pts[i]!.y + offset * ny,
    };
  }

  // Rebuild path string: tokens still have the original structure,
  // we just swap coordinate values.
  const result = tokens.map((t, i) => {
    if (t === 'M' || t === 'L') {
      const x = parseFloat(tokens[i + 1]!);
      const y = parseFloat(tokens[i + 2]!);
      // Find this coordinate pair in our pts array to get the new position
      // Use numeric comparison since floats are exact from toFixed
      const ptIdx = pts.findIndex(
        (p) => Math.abs(p.x - x) < 0.01 && Math.abs(p.y - y) < 0.01
      );
      if (ptIdx >= 0) {
        return `${t} ${newPts[ptIdx]!.x.toFixed(2)} ${newPts[ptIdx]!.y.toFixed(2)}`;
      }
      return `${t} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    return t;
  });

  return result.join(' ');
}

// ---------------------------------------------------------------------------
// Auto-animation parameters
// ---------------------------------------------------------------------------

/** One full lap in milliseconds — the "training loop" feel. */
const AUTO_LAP_DURATION_MS = 13_000;

/** After the user touches the slider, auto-animation pauses for this long. */
const USER_OVERRIDE_TIMEOUT_MS = 3_000;

// ---------------------------------------------------------------------------
// 11 sensor rays — spec says "11 rayos sensor" in the headline copy, so
// we hard-wire 11 rays from the dot's position, fanned 180° across the
// forward hemisphere relative to the path tangent.
// ---------------------------------------------------------------------------
const N_RAYS = 11;
const RAY_SPREAD_DEG = 180; // forward hemisphere
const RAY_MAX_LENGTH = 110; // max cast distance in viewBox units
const RAY_CAST_STEP = 2; // step size for ray marching (viewBox px)

/** Sample distance for the path tangent (in length units). 0.5 keeps the
 * derivative local enough for tight curves. */
const TANGENT_DELTA = 0.5;

/** Length of the small trail behind the dot, in user units. */
const TAIL_LENGTH = 18;

// Checkpoints — 12 evenly distributed dots along the path, rendered as
// pulsing markers. T values hand-picked from 0..1.
const CHECKPOINT_T = Array.from({ length: 12 }, (_, i) => (i + 0.5) / 12);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** `getPointAtLength` clamps to [0, length], which gives a wrong tangent
 * at the start/end junction of a closed path. This wraps manually so the
 * tangent stays continuous around the lap. */
function getPointAtLengthWrapped(
  path: SVGPathElement,
  totalLength: number,
  distance: number
): { x: number; y: number } {
  let d = distance;
  if (d < 0) d += totalLength;
  else if (d >= totalLength) d -= totalLength;
  const pt = path.getPointAtLength(d);
  return { x: pt.x, y: pt.y };
}

/** `isPointInStroke` accepts either a DOMPoint or a DOMPointInit. Some
 * TS lib versions are stricter than the browser, so we cast. */
function isInsideStroke(path: SVGPathElement, x: number, y: number): boolean {
  return (path.isPointInStroke as (x: number, y: number) => boolean)(x, y);
}

interface Ray {
  /** Endpoint in the car-group's local coords (origin at the dot). */
  x2: number;
  y2: number;
  /** Actual pixel length after wall cutting — useful for debugging. */
  actualLength: number;
}

/**
 * Cast a ray from (ox, oy) in direction (dirX, dirY) until it hits
 * either `innerPath` or `outerPath`. Returns the hit position relative
 * to the origin (so x2,y2 are in the car's local frame).
 *
 * The ray steps by `step` viewBox units. If no boundary is hit within
 * `maxLen`, returns the endpoint at maxLen.
 */
function castRayToBoundary(
  ox: number,
  oy: number,
  dirX: number,
  dirY: number,
  innerPath: SVGPathElement,
  outerPath: SVGPathElement,
  maxLen: number,
  step: number
): { x2: number; y2: number; actualLength: number } {
  for (let dist = step; dist <= maxLen; dist += step) {
    const sx = ox + dirX * dist;
    const sy = oy + dirY * dist;

    if (
      isInsideStroke(innerPath, sx, sy) ||
      isInsideStroke(outerPath, sx, sy)
    ) {
      return {
        x2: dirX * dist,
        y2: dirY * dist,
        actualLength: dist,
      };
    }
  }

  // No hit — cap at maxLen
  return {
    x2: dirX * maxLen,
    y2: dirY * maxLen,
    actualLength: maxLen,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TrainingCircuit({ locale }: Props) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const innerPathRef = useRef<SVGPathElement | null>(null);
  const outerPathRef = useRef<SVGPathElement | null>(null);
  const carGroupRef = useRef<SVGGElement | null>(null);
  const tailRef = useRef<SVGLineElement | null>(null);

  // The "scrub" along the path, 0..1. Updated every frame by the
  // animation loop (auto-mode) or by the slider (override).
  const [scrub, setScrub] = useState<number>(0);
  const [pathLength, setPathLength] = useState<number>(0);
  const [rays, setRays] = useState<Ray[]>(() =>
    Array.from({ length: N_RAYS }, () => ({ x2: 0, y2: 0, actualLength: RAY_MAX_LENGTH }))
  );

  // Pulse animation flag for checkpoints — flip every ~1.1 s
  const [pulseOn, setPulseOn] = useState<boolean>(true);
  useEffect(() => {
    const interval = window.setInterval(() => setPulseOn((v) => !v), 1100);
    return () => window.clearInterval(interval);
  }, []);

  // -------------------------------------------------------------------
  // Animation loop — refs so updates don't trigger re-renders.
  // -------------------------------------------------------------------
  const scrubRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const lastUserInputTimeRef = useRef<number>(0);
  const prefersReducedMotionRef = useRef<boolean>(false);

  // Watch prefers-reduced-motion and update the ref when the OS setting flips.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotionRef.current = mq.matches;
    const handler = (e: MediaQueryListEvent) => {
      prefersReducedMotionRef.current = e.matches;
    };
    // New API; fall back to deprecated `addListener` for older Safari.
    if (mq.addEventListener) {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    mq.addListener(handler);
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      mq.removeListener(handler);
    };
  }, []);

  // Measure path length and place the dot at the start of the track
  // before the first animation frame, so there's no flash at (0,0).
  useEffect(() => {
    const p = pathRef.current;
    if (!p) return;
    const len = p.getTotalLength();
    setPathLength(len);

    // Seed the car at t=0 with the correct tangent so the very first
    // rendered frame already has the right pose.
    const pt = p.getPointAtLength(0);
    const p0 = getPointAtLengthWrapped(p, len, -TANGENT_DELTA);
    const p1 = getPointAtLengthWrapped(p, len, TANGENT_DELTA);
    const tangentAngle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    if (carGroupRef.current) {
      carGroupRef.current.setAttribute(
        'transform',
        `translate(${pt.x.toFixed(2)} ${pt.y.toFixed(2)})`
      );
    }
    if (tailRef.current) {
      const tx = -Math.cos(tangentAngle) * TAIL_LENGTH;
      const ty = -Math.sin(tangentAngle) * TAIL_LENGTH;
      tailRef.current.setAttribute('x2', tx.toFixed(2));
      tailRef.current.setAttribute('y2', ty.toFixed(2));
    }
  }, []);

  // Pre-compute checkpoint positions
  const checkpoints = useMemo(() => {
    if (pathLength === 0) return [];
    const p = pathRef.current;
    if (!p) return [];
    return CHECKPOINT_T.map((t) => {
      const pt = p.getPointAtLength(t * pathLength);
      return { x: pt.x, y: pt.y };
    });
  }, [pathLength]);

  // Pre-compute transformed path strings (inner/outer boundaries)
  const { innerD, outerD } = useMemo(() => {
    const base = transformPath(TRAINING_CIRCUIT.pathD);
    return {
      innerD: offsetPath(base, -INNER_OFFSET),
      outerD: offsetPath(base, OUTER_OFFSET),
    };
  }, []);

  /**
   * Compute the 11 rays (and update car position + tail) for a given scrub
   * value. Tangent is computed from `getPointAtLength(t - δ)` and
   * `getPointAtLength(t + δ)` so the rays always face forward.
   *
   * The dot position oscillates perpendicular to the path using a sinusoidal
   * phase derived from scrub (completing one full oscillation per quarter-lap).
   *
   * Each ray is cast from the dot position in its direction until it hits
   * either the inner or outer boundary path (using isPointInStroke). This
   * gives genuine wall-contact rather than the cosine approximation.
   */
  const updateVisuals = (scrubVal: number): void => {
    const p = pathRef.current;
    const innerP = innerPathRef.current;
    const outerP = outerPathRef.current;
    if (!p || !innerP || !outerP || pathLength === 0) return;

    const target = scrubVal * pathLength;

    // Tangent (path direction at the dot)
    const p0 = getPointAtLengthWrapped(p, pathLength, target - TANGENT_DELTA);
    const p1 = getPointAtLengthWrapped(p, pathLength, target + TANGENT_DELTA);
    const tangentAngle = Math.atan2(p1.y - p0.y, p1.x - p0.x);

    // Normal = perpendicular to tangent (left-of-tangent direction)
    // Used to offset the dot between inner and outer tracks
    const normalAngle = tangentAngle - Math.PI / 2;

    // Oscillation: sinusoidal sway between inner and outer boundaries
    // One full oscillation per quarter-lap (×4 per lap)
    const oscPhase = (scrubVal * Math.PI * 4) % (Math.PI * 2);
    const dotOffset = Math.sin(oscPhase) * OSC_AMPLITUDE;

    // Base position on path
    const pt = p.getPointAtLength(target);

    // Final dot position: base + perpendicular offset
    const dotX = pt.x + Math.cos(normalAngle) * dotOffset;
    const dotY = pt.y + Math.sin(normalAngle) * dotOffset;

    const half = RAY_SPREAD_DEG / 2;
    const newRays: Ray[] = new Array(N_RAYS);

    for (let i = 0; i < N_RAYS; i++) {
      // Spread evenly across -half..+half (degrees) around the forward direction.
      const spreadDeg = -half + (i * RAY_SPREAD_DEG) / (N_RAYS - 1);
      const rayAngle = tangentAngle + (spreadDeg * Math.PI) / 180;
      const dirX = Math.cos(rayAngle);
      const dirY = Math.sin(rayAngle);

      // Cast ray from dot position (NOT from the path-center dot)
      // The dot is already offset from the path center, so rays originate there
      const hit = castRayToBoundary(
        dotX,
        dotY,
        dirX,
        dirY,
        innerP,
        outerP,
        RAY_MAX_LENGTH,
        RAY_CAST_STEP
      );

      newRays[i] = hit;
    }

    setRays(newRays);

    // Move the car group to the oscillation-offset position
    if (carGroupRef.current) {
      carGroupRef.current.setAttribute(
        'transform',
        `translate(${dotX.toFixed(2)} ${dotY.toFixed(2)})`
      );
    }

    // Update tail to point backward along the tangent.
    if (tailRef.current) {
      const tx = -Math.cos(tangentAngle) * TAIL_LENGTH;
      const ty = -Math.sin(tangentAngle) * TAIL_LENGTH;
      tailRef.current.setAttribute('x2', tx.toFixed(2));
      tailRef.current.setAttribute('y2', ty.toFixed(2));
    }
  };

  // Main rAF loop. Drives the dot around the track and recomputes rays
  // every frame. Pauses for 3 s after each slider interaction. Honours
  // prefers-reduced-motion.
  useEffect(() => {
    if (pathLength === 0) return;

    let stopped = false;

    const animate = (now: number) => {
      if (stopped) return;

      // Δt in milliseconds — this is what keeps the dot in sync with
      // wall-clock time even when the tab is throttled in the background.
      const dt =
        lastFrameTimeRef.current === 0 ? 0 : now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;

      const timeSinceUserInput = now - lastUserInputTimeRef.current;
      const shouldAutoPlay =
        !prefersReducedMotionRef.current &&
        timeSinceUserInput > USER_OVERRIDE_TIMEOUT_MS;

      if (shouldAutoPlay) {
        const advance = dt / AUTO_LAP_DURATION_MS;
        let newScrub = scrubRef.current + advance;
        if (newScrub >= 1) newScrub -= 1;
        scrubRef.current = newScrub;
        setScrub(newScrub);
      }

      updateVisuals(scrubRef.current);

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      stopped = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
    // updateVisuals is intentionally excluded — it reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathLength]);

  // Slider → overrides auto-animation for 3 s, then auto resumes.
  const handleSliderChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newScrub = Number(e.target.value) / 100;
    scrubRef.current = newScrub;
    setScrub(newScrub);
    lastUserInputTimeRef.current = performance.now();
  };

  const labels = {
    caption:
      locale === 'es'
        ? 'Once rayos sensor detectan bordes y línea de meta desde la posición del coche.'
        : 'Eleven sensor rays detect edges and finish line from the car position.',
    scrub: locale === 'es' ? 'Posición' : 'Position',
    checkpointsLabel:
      locale === 'es' ? 'Checkpoints auto-generados' : 'Auto-generated checkpoints',
    raysLabel: locale === 'es' ? 'Rayos sensor' : 'Sensor rays',
    pathLength: locale === 'es' ? 'Longitud' : 'Length',
    compoundTire: locale === 'es' ? 'Compuesto' : 'Compound',
    lengthValue: TRAINING_CIRCUIT.lengthKm.toFixed(2),
    lengthUnit: 'km',
    compound: 'Soft',
  };

  const showCar = pathLength > 0;

  return (
    <div className="training-circuit">
      <svg
        className="training-circuit__svg"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={
          locale === 'es'
            ? 'Circuito de entrenamiento simplificado'
            : 'Simplified training circuit'
        }
      >
        <defs>
          <linearGradient id="training-path-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--secondary)" stopOpacity="0.45" />
            <stop offset="50%" stopColor="var(--secondary)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--secondary)" stopOpacity="0.45" />
          </linearGradient>
          <radialGradient id="training-car-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
          {/* Soft glow applied to the rays group. */}
          <filter id="ray-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Subtle background grid — telemetry grid, not distracting */}
        <g aria-hidden="true" opacity="0.4">
          {Array.from({ length: 11 }, (_, i) => (
            <line
              key={`vx-${i}`}
              x1={PAD.l + (i / 10) * PLOT_W}
              x2={PAD.l + (i / 10) * PLOT_W}
              y1={PAD.t}
              y2={PAD.t + PLOT_H}
              stroke="var(--rule)"
              strokeWidth={0.5}
              strokeDasharray="1 6"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {Array.from({ length: 7 }, (_, i) => (
            <line
              key={`hy-${i}`}
              y1={PAD.t + (i / 6) * PLOT_H}
              y2={PAD.t + (i / 6) * PLOT_H}
              x1={PAD.l}
              x2={PAD.l + PLOT_W}
              stroke="var(--rule)"
              strokeWidth={0.5}
              strokeDasharray="1 6"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>

        {/* Track surface fill — filled band between inner and outer boundaries */}
        <path
          d={outerD}
          fill="var(--ink)"
          opacity={0.18}
          stroke="none"
          aria-hidden="true"
        />

        {/* Outer boundary path (outside of the track) */}
        <path
          d={outerD}
          fill="none"
          stroke="var(--asphalt)"
          strokeWidth={1.2}
          strokeOpacity={0.55}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        />

        {/* Inner boundary path (inside of the track) */}
        <path
          ref={innerPathRef}
          d={innerD}
          fill="none"
          stroke="var(--asphalt)"
          strokeWidth={1.2}
          strokeOpacity={0.55}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        />

        {/* Centerline path — faint reference line */}
        <path
          ref={pathRef}
          d={transformPath(TRAINING_CIRCUIT.pathD)}
          fill="none"
          stroke="url(#training-path-grad)"
          strokeWidth={1}
          strokeOpacity={0.35}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        />

        {/* Auto-generated checkpoints along the path — smaller than before */}
        {checkpoints.map((c, i) => (
          <g key={`cp-${i}`}>
            <circle
              cx={c.x}
              cy={c.y}
              r={pulseOn ? 3.5 : 2.5}
              fill="var(--accent)"
              opacity={pulseOn ? 0.9 : 0.5}
              style={{
                transition:
                  'r 0.6s var(--motion-ease-out), opacity 0.6s var(--motion-ease-out)',
              }}
            />
            <circle
              cx={c.x}
              cy={c.y}
              r={pulseOn ? 7 : 5}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={0.7}
              opacity={pulseOn ? 0.4 : 0.15}
              style={{
                transition:
                  'r 0.6s var(--motion-ease-out), opacity 0.6s var(--motion-ease-out)',
              }}
            />
          </g>
        ))}

        {/* Invisible outer path ref — needed for ray casting against the outer boundary.
            We keep it in the DOM but invisible, just like the inner path. */}
        <path
          ref={outerPathRef}
          d={outerD}
          fill="none"
          stroke="#000"
          strokeOpacity={0}
          strokeWidth={1}
          pointerEvents="none"
          aria-hidden="true"
        />

        {/* The car + sensor rays share a moving group so they translate
            together. We write the `transform` attribute directly each
            frame (via `carGroupRef`) to avoid a React render. */}
        <g ref={carGroupRef} opacity={showCar ? 1 : 0}>
          {/* Halo */}
          <circle
            cx={0}
            cy={0}
            r={22}
            fill="url(#training-car-halo)"
            aria-hidden="true"
          />

          {/* 11 sensor rays — cast from the dot position to the nearest boundary.
              Perpendicular rays hit close walls (short); forward rays travel far
              (long), genuinely reaching the track edge. */}
          <g filter="url(#ray-glow)">
            {rays.map((r, i) => (
              <line
                key={`ray-${i}`}
                x1={0}
                y1={0}
                x2={r.x2}
                y2={r.y2}
                stroke="var(--secondary)"
                strokeWidth={3.2}
                strokeDasharray="5 5"
                strokeLinecap="round"
                opacity={0.9}
                vectorEffect="non-scaling-stroke"
                aria-hidden="true"
              />
            ))}
          </g>

          {/* Speed tail — short line behind the dot, opposite the tangent. */}
          <line
            ref={tailRef}
            x1={0}
            y1={0}
            x2={0}
            y2={0}
            stroke="var(--accent)"
            strokeWidth={1.6}
            opacity={0.45}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            aria-hidden="true"
          />

          {/* Outer halo ring */}
          <circle
            cx={0}
            cy={0}
            r={8}
            fill="var(--accent)"
            opacity={0.18}
            aria-hidden="true"
          />

          {/* The dot itself */}
          <circle
            cx={0}
            cy={0}
            r={4.5}
            fill="var(--accent)"
            stroke="var(--ink)"
            strokeWidth={1.5}
          />
        </g>
      </svg>

      {/* HUD overlay below the SVG */}
      <div className="training-circuit__hud" aria-hidden="true">
        <div className="training-circuit__stat">
          <span className="training-circuit__stat-value">
            {TRAINING_CIRCUIT.totalCheckpoints}
          </span>
          <span className="training-circuit__stat-label">
            {labels.checkpointsLabel}
          </span>
        </div>
        <div className="training-circuit__stat">
          <span className="training-circuit__stat-value">{N_RAYS}</span>
          <span className="training-circuit__stat-label">{labels.raysLabel}</span>
        </div>
        <div className="training-circuit__stat">
          <span className="training-circuit__stat-value">{labels.lengthValue}</span>
          <span className="training-circuit__stat-label">
            {labels.pathLength} ({labels.lengthUnit})
          </span>
        </div>
        <div className="training-circuit__stat">
          <span className="training-circuit__stat-value">{labels.compound}</span>
          <span className="training-circuit__stat-label">{labels.compoundTire}</span>
        </div>
      </div>

      {/* Manual scrub slider — pauses auto-anim for 3s on each input. */}
      <div className="training-circuit__scrub">
        <label className="training-circuit__scrub-label" htmlFor="training-circuit-scrub">
          <span>{labels.scrub}</span>
          <span className="training-circuit__scrub-pos">
            {(scrub * 100).toFixed(0)}%
          </span>
        </label>
        <input
          id="training-circuit-scrub"
          type="range"
          min={0}
          max={100}
          step={0.25}
          value={scrub * 100}
          onChange={handleSliderChange}
          className="training-circuit__scrub-range"
          aria-label={labels.scrub}
        />
        <div className="training-circuit__scrub-axis" aria-hidden="true">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>

      <p className="training-circuit__caption">{labels.caption}</p>
    </div>
  );
}

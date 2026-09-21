/**
 * TelemetryScatter — Interactive scatter plot for Section 04.
 *
 * Visualises the relationship between strategy choice (starting tyre × pit
 * stops) and race outcome (final position, reward) across ~600 simulated
 * race-agent starts sampled from the 9,108-row CSV.
 *
 *   X axis — starting tyre compound (Soft / Medium / Hard)
 *   Y axis — pit stops made (0 – 5)
 *   Dot color — final_position: top 3 (accent), rest (text-dim)
 *   Dot size — total_reward, normalised
 *   Hover tooltip — strategy, fastest lap, reward, position
 *
 * Filter — a small radio group toggles between "all" / barcelona / bahrain /
 * monza. The dataset carries a `circuit` per record so filtering is in-memory.
 *
 * Implementation notes:
 *   - Recharts for SVG pathing + cross-browser tooltips.
 *   - We pre-compute the colour ramp + size ramp with useMemo so re-renders
 *     on filter change stay under 16 ms.
 *   - GSAP powers the entry stagger when the section becomes visible.
 *   - Respects prefers-reduced-motion (skip animation, show all dots at once).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  Cell,
} from 'recharts';
import { gsap } from 'gsap';

interface TelemetryRow {
  race_id: number;
  agent_type: 'strategy_model' | 'static';
  starting_tyre: 'Soft' | 'Medium' | 'Hard';
  final_position: number;
  laps_completed: number;
  finished: boolean;
  pitstops_made: number;
  fastest_lap_s: number;
  circuit: 'barcelona' | 'bahrain' | 'monza';
  strategy_name: string;
  total_reward: number;
  avg_lap_time_s: number;
  final_wear_pct: number;
}

export interface TelemetryScatterProps {
  locale: 'es' | 'en';
  /** Inline JSON imported at build time. */
  data: TelemetryRow[];
}

const COMPOUNDS: Array<TelemetryRow['starting_tyre']> = ['Soft', 'Medium', 'Hard'];
const CIRCUITS: Array<'all' | TelemetryRow['circuit']> = ['all', 'barcelona', 'bahrain', 'monza'];

// Display labels are bilingual so the chart axes stay readable regardless of locale.
const COMPOUND_LABEL: Record<TelemetryScatterProps['locale'], Record<TelemetryRow['starting_tyre'], string>> = {
  es: { Soft: 'Blando', Medium: 'Medio', Hard: 'Duro' },
  en: { Soft: 'Soft', Medium: 'Medium', Hard: 'Hard' },
};

const CIRCUIT_LABEL: Record<TelemetryScatterProps['locale'], Record<'all' | TelemetryRow['circuit'], string>> = {
  es: { all: 'Todos', barcelona: 'Barcelona', bahrain: 'Bahrain', monza: 'Monza' },
  en: { all: 'All', barcelona: 'Barcelona', bahrain: 'Bahrain', monza: 'Monza' },
};

const COPY = {
  es: {
    title: 'Estrategia vs Resultado',
    subtitle: 'Cada punto = una salida (race, agente). Tamaño = recompensa total.',
    xAxis: 'Neumático inicial',
    yAxis: 'Paradas en boxes',
    filterLabel: 'Circuito',
    legend: {
      podium: 'Top 3',
      back: 'Resto',
      model: 'Modelo',
      static: 'Estático',
    },
    tooltip: {
      strategy: 'Estrategia',
      fastestLap: 'Mejor vuelta',
      reward: 'Recompensa',
      position: 'Posición final',
      circuit: 'Circuito',
    },
    countLabel: 'Salidas',
    emptyMessage: 'Sin datos para este circuito.',
  },
  en: {
    title: 'Strategy vs Outcome',
    subtitle: 'Each dot = one (race, agent) start. Size = total reward.',
    xAxis: 'Starting tyre',
    yAxis: 'Pit stops',
    filterLabel: 'Circuit',
    legend: {
      podium: 'Top 3',
      back: 'Rest',
      model: 'Model',
      static: 'Static',
    },
    tooltip: {
      strategy: 'Strategy',
      fastestLap: 'Fastest lap',
      reward: 'Reward',
      position: 'Final position',
      circuit: 'Circuit',
    },
    countLabel: 'starts',
    emptyMessage: 'No data for this circuit.',
  },
} as const;

// Colour palette pulled from src/styles/tokens.css.
const COLORS = {
  podium: '#ffb703',       // --accent
  rest: '#94a3b8',          // --text-dim
  podiumStroke: '#ffd166',  // --accent-2 (glow)
  restStroke: '#cbd5e1',
  gridLine: 'rgba(142, 202, 230, 0.10)',  // --light @ 10%
  axisLine: '#1a2332',      // --rule
  axisLabel: '#94a3b8',     // --text-dim
} as const;

/**
 * Custom Tooltip — renders a small mono-style card that fits the F1 telemetry
 * aesthetic. We control the markup rather than relying on Recharts' default.
 */
// Permissive type: accept either locale's tooltip shape. The keys are identical
// across locales; only the string values differ.
type TooltipCopy = {
  strategy: string;
  fastestLap: string;
  reward: string;
  position: string;
  circuit: string;
};

function ScatterTooltip({
  active,
  payload,
  copy,
}: {
  active?: boolean;
  payload?: Array<{ payload: TelemetryRow }>;
  copy: TooltipCopy;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]!.payload;
  return (
    <div
      style={{
        background: 'rgba(13, 20, 29, 0.96)',
        border: '1px solid var(--rule-strong)',
        borderRadius: '8px',
        padding: '10px 14px',
        fontFamily: 'var(--font-display)',
        fontSize: '12px',
        color: 'var(--color-fg)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        minWidth: '180px',
      }}
    >
      <div
        style={{
          color: 'var(--color-highlight)',
          marginBottom: '4px',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        {row.strategy_name}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '2px 12px', color: 'var(--color-fg-muted)' }}>
        <span>{copy.circuit}:</span>
        <span style={{ color: 'var(--color-fg)' }}>{row.circuit}</span>
        <span>{copy.fastestLap}:</span>
        <span style={{ color: 'var(--color-fg)' }}>{row.fastest_lap_s.toFixed(2)}s</span>
        <span>{copy.reward}:</span>
        <span style={{ color: 'var(--color-fg)' }}>{Math.round(row.total_reward / 1000)}k</span>
        <span>{copy.position}:</span>
        <span style={{ color: 'var(--color-fg)' }}>P{row.final_position}</span>
      </div>
    </div>
  );
}

export default function TelemetryScatter({ locale, data }: TelemetryScatterProps) {
  const copy = COPY[locale];
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dotsRef = useRef<SVGGElement | null>(null);

  const [circuit, setCircuit] = useState<'all' | TelemetryRow['circuit']>('all');

  // Filter the dataset. Memoised so Recharts only re-renders on circuit change.
  const filtered = useMemo(() => {
    if (circuit === 'all') return data;
    return data.filter((r) => r.circuit === circuit);
  }, [data, circuit]);

  // Min/max reward for the Z axis. Compute once on mount since data is static.
  const [zMin, zMax] = useMemo(() => {
    if (data.length === 0) return [1_500_000, 3_500_000];
    let min = Infinity;
    let max = -Infinity;
    for (const r of data) {
      if (r.total_reward < min) min = r.total_reward;
      if (r.total_reward > max) max = r.total_reward;
    }
    return [min, max];
  }, [data]);

  // Map each row to (xIndex, yIndex, color, size). X is a categorical compound
  // axis (Soft=0, Medium=1, Hard=2). Y is the integer pit count, clamped to
  // [0, 5] for plotting. The dot area is normalised reward.
  const plotPoints = useMemo(() => {
    return filtered.map((row) => ({
      row,
      x: COMPOUNDS.indexOf(row.starting_tyre),
      y: Math.max(0, Math.min(5, row.pitstops_made)),
      // Recharts handles radius directly; we map reward to a 4–14 px radius.
      z: 4 + ((row.total_reward - zMin) / Math.max(1, zMax - zMin)) * 10,
      color: row.final_position <= 3 ? COLORS.podium : COLORS.rest,
    }));
  }, [filtered, zMin, zMax]);

  // GSAP stagger reveal once the component mounts (the Astro parent uses
  // client:visible, so by the time this runs the section is already on screen).
  useEffect(() => {
    if (!rootRef.current) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      rootRef.current.classList.add('is-visible');
      return;
    }
    const el = rootRef.current;
    gsap.fromTo(
      el.querySelectorAll<HTMLElement>('.telemetry-scatter__fade'),
      { opacity: 0, y: 12 },
      {
        opacity: 1,
        y: 0,
        duration: 0.7,
        stagger: 0.08,
        ease: 'power2.out',
        delay: 0.1,
      }
    );
    const id = window.requestAnimationFrame(() => el.classList.add('is-visible'));
    return () => window.cancelAnimationFrame(id);
  }, []);

  // Re-animate the dots when the filter changes — a small "settle" so the
  // user feels the filter is doing something, not just re-rendering.
  useEffect(() => {
    if (!dotsRef.current) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;
    const dots = Array.from(dotsRef.current.querySelectorAll<SVGCircleElement>('circle.scatter-dot'));
    if (dots.length === 0) return;
    gsap.fromTo(
      dots,
      { opacity: 0, scale: 0.4, transformOrigin: '50% 50%' },
      {
        opacity: 1,
        scale: 1,
        duration: 0.45,
        stagger: { amount: 0.4, from: 'random' },
        ease: 'power2.out',
      }
    );
  }, [circuit]);

  return (
    <div ref={rootRef} className="telemetry-scatter">
      <header className="telemetry-scatter__header">
        <div className="telemetry-scatter__heading">
          <h3 className="telemetry-scatter__title">{copy.title}</h3>
          <p className="telemetry-scatter__subtitle">{copy.subtitle}</p>
        </div>
        <fieldset
          className="telemetry-scatter__filter"
          aria-label={copy.filterLabel}
        >
          <legend className="telemetry-scatter__filter-label">{copy.filterLabel}</legend>
          <div className="telemetry-scatter__filter-row">
            {CIRCUITS.map((c) => (
              <label key={c} className="telemetry-scatter__chip">
                <input
                  type="radio"
                  name="circuit-filter"
                  value={c}
                  checked={circuit === c}
                  onChange={() => setCircuit(c)}
                  className="visually-hidden"
                />
                <span className="telemetry-scatter__chip-text">
                  {CIRCUIT_LABEL[locale][c]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </header>

      <div
        className="telemetry-scatter__chart telemetry-scatter__fade"
        aria-hidden={filtered.length === 0}
      >
        {filtered.length === 0 ? (
          <div className="telemetry-scatter__empty">{copy.emptyMessage}</div>
        ) : (
          <ResponsiveContainer width="100%" height={380}>
            <ScatterChart margin={{ top: 16, right: 32, bottom: 32, left: 8 }}>
              <CartesianGrid stroke={COLORS.gridLine} strokeDasharray="2 4" />
              <XAxis
                type="number"
                dataKey="x"
                name={copy.xAxis}
                domain={[-0.5, 2.5]}
                ticks={[0, 1, 2]}
                tickFormatter={(v: number) => COMPOUND_LABEL[locale][COMPOUNDS[v]!]}
                stroke={COLORS.axisLine}
                tick={{ fill: COLORS.axisLabel, fontFamily: 'var(--font-display)', fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: COLORS.axisLine }}
                label={{
                  value: copy.xAxis,
                  position: 'insideBottom',
                  offset: -16,
                  fill: COLORS.axisLabel,
                  fontFamily: 'var(--font-display)',
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  style: { textTransform: 'uppercase' },
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={copy.yAxis}
                domain={[0, 5]}
                ticks={[0, 1, 2, 3, 4, 5]}
                stroke={COLORS.axisLine}
                tick={{ fill: COLORS.axisLabel, fontFamily: 'var(--font-display)', fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: COLORS.axisLine }}
                label={{
                  value: copy.yAxis,
                  angle: -90,
                  position: 'insideLeft',
                  offset: 12,
                  fill: COLORS.axisLabel,
                  fontFamily: 'var(--font-display)',
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  style: { textTransform: 'uppercase' },
                }}
              />
              <ZAxis type="number" dataKey="z" range={[4, 14]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3', stroke: 'rgba(33, 158, 188, 0.4)' }}
                content={<ScatterTooltip copy={copy.tooltip} />}
              />
              <Scatter
                data={plotPoints}
                isAnimationActive={false}
                shape={({ cx, cy, payload }: { cx?: number; cy?: number; payload?: { color: string; z: number } }) => (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={payload?.z ?? 6}
                    fill={payload?.color ?? COLORS.rest}
                    fillOpacity={0.72}
                    stroke={payload?.color ?? COLORS.rest}
                    strokeOpacity={0.9}
                    strokeWidth={1}
                    className="scatter-dot"
                  />
                )}
              >
                {plotPoints.map((p, i) => (
                  <Cell key={i} fill={p.color} />
                ))}
              </Scatter>
              <g ref={dotsRef} />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>

      <footer className="telemetry-scatter__legend telemetry-scatter__fade">
        <div className="telemetry-scatter__legend-row">
          <span className="telemetry-scatter__legend-item">
            <span className="telemetry-scatter__legend-swatch" style={{ background: COLORS.podium }} />
            {copy.legend.podium}
          </span>
          <span className="telemetry-scatter__legend-item">
            <span className="telemetry-scatter__legend-swatch" style={{ background: COLORS.rest }} />
            {copy.legend.back}
          </span>
          <span className="telemetry-scatter__legend-item telemetry-scatter__legend-count">
            <strong>{filtered.length}</strong>
            <span style={{ color: 'var(--color-fg-muted)' }}> {copy.countLabel}</span>
          </span>
        </div>
      </footer>

      {/* Component-scoped styles, same pattern as RideHeightSlider.tsx */}
      <style>{`
        .telemetry-scatter {
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
          opacity: 0;
          transform: translateY(12px);
        }
        .telemetry-scatter.is-visible {
          opacity: 1;
          transform: translateY(0);
        }
        .telemetry-scatter__fade {
          opacity: 0;
        }
        .is-visible .telemetry-scatter__fade {
          opacity: 1;
        }
        .telemetry-scatter__header {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-end;
          justify-content: space-between;
          gap: var(--space-4);
          row-gap: var(--space-3);
        }
        .telemetry-scatter__heading {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }
        .telemetry-scatter__title {
          font-family: var(--font-display);
          font-size: var(--text-lg);
          font-weight: 600;
          letter-spacing: var(--tracking-snug);
          color: var(--color-fg);
          margin: 0;
          line-height: 1.2;
        }
        .telemetry-scatter__subtitle {
          font-family: var(--font-body);
          font-size: var(--text-sm);
          color: var(--color-fg-muted);
          margin: 0;
        }
        .telemetry-scatter__filter {
          border: 0;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }
        .telemetry-scatter__filter-label {
          font-family: var(--font-display);
          font-size: var(--text-xs);
          text-transform: uppercase;
          letter-spacing: var(--tracking-widest);
          color: var(--color-fg-muted);
          padding: 0;
        }
        .telemetry-scatter__filter-row {
          display: inline-flex;
          flex-wrap: wrap;
          gap: 4px;
          padding: 4px;
          background: var(--ink);
          border: 1px solid var(--rule);
          border-radius: var(--radius-md);
        }
        .telemetry-scatter__chip {
          position: relative;
          cursor: pointer;
          user-select: none;
        }
        .telemetry-scatter__chip input {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }
        .telemetry-scatter__chip-text {
          display: inline-flex;
          align-items: center;
          padding: 6px 12px;
          border-radius: var(--radius-sm);
          font-family: var(--font-display);
          font-size: var(--text-xs);
          text-transform: uppercase;
          letter-spacing: var(--tracking-widest);
          color: var(--color-fg-muted);
          background: transparent;
          transition:
            background var(--motion-duration-short) var(--motion-ease-out),
            color var(--motion-duration-short) var(--motion-ease-out);
        }
        .telemetry-scatter__chip:hover .telemetry-scatter__chip-text {
          color: var(--color-fg);
        }
        .telemetry-scatter__chip input:checked + .telemetry-scatter__chip-text {
          background: var(--secondary);
          color: var(--ink);
        }
        .telemetry-scatter__chip input:focus-visible + .telemetry-scatter__chip-text {
          outline: 2px solid var(--color-highlight);
          outline-offset: 2px;
        }
        .telemetry-scatter__chart {
          position: relative;
          width: 100%;
          min-height: 380px;
          background: var(--ink);
          border-radius: var(--radius-md);
          padding: var(--space-3);
        }
        .telemetry-scatter__empty {
          height: 360px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-fg-muted);
          font-family: var(--font-display);
          font-size: var(--text-sm);
        }
        .telemetry-scatter__legend {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-4);
          flex-wrap: wrap;
          border-top: 1px solid var(--rule);
          padding-top: var(--space-3);
        }
        .telemetry-scatter__legend-row {
          display: flex;
          align-items: center;
          gap: var(--space-5);
          flex-wrap: wrap;
        }
        .telemetry-scatter__legend-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-display);
          font-size: var(--text-xs);
          text-transform: uppercase;
          letter-spacing: var(--tracking-widest);
          color: var(--color-fg-muted);
        }
        .telemetry-scatter__legend-swatch {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          display: inline-block;
        }
        .telemetry-scatter__legend-count strong {
          color: var(--color-fg);
          font-weight: 600;
        }
        .scatter-dot {
          transition: filter var(--motion-duration-short) var(--motion-ease-out);
        }
        .scatter-dot:hover {
          filter: drop-shadow(0 0 6px rgba(255, 183, 3, 0.55));
        }
        .visually-hidden {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        @media (prefers-reduced-motion: reduce) {
          .telemetry-scatter,
          .telemetry-scatter__fade {
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}

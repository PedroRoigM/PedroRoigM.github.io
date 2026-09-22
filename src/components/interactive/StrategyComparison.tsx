/**
 * StrategyComparison — Section 04 model vs baseline comparison.
 *
 * Replaces the previous scatter plot (which the user found too noisy to
 * derive insight from). Renders three KPI cards (model vs baseline) plus
 * a horizontal stacked-bar comparison of finishing position buckets.
 *
 * All data is aggregated at build time from `agents_data_sample.json`
 * (600 sampled race starts; 180 model + 420 static). Counts and ratios
 * reflect the actual sample.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';

interface Row {
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

interface Props {
  locale: 'es' | 'en';
  data: Row[];
}

interface Aggregate {
  n: number;
  finished_pct: number;
  avg_reward: number;
  avg_fastest_lap_s: number;
  avg_position: number;
  p1_3: number;
  p4_7: number;
  p8_plus: number;
}

function aggregate(rows: Row[]): Aggregate {
  const n = rows.length;
  if (n === 0) {
    return {
      n: 0,
      finished_pct: 0,
      avg_reward: 0,
      avg_fastest_lap_s: 0,
      avg_position: 0,
      p1_3: 0,
      p4_7: 0,
      p8_plus: 0,
    };
  }
  const finished = rows.filter((r) => r.finished).length;
  return {
    n,
    finished_pct: (finished / n) * 100,
    avg_reward: rows.reduce((s, r) => s + r.total_reward, 0) / n,
    avg_fastest_lap_s: rows.reduce((s, r) => s + r.fastest_lap_s, 0) / n,
    avg_position: rows.reduce((s, r) => s + r.final_position, 0) / n,
    p1_3: (rows.filter((r) => r.final_position <= 3).length / n) * 100,
    p4_7: (rows.filter((r) => r.final_position >= 4 && r.final_position <= 7).length / n) * 100,
    p8_plus: (rows.filter((r) => r.final_position >= 8).length / n) * 100,
  };
}

const COPY = {
  es: {
    title: 'Modelo vs Baseline',
    subtitle:
      'Comparación entre el agente aprendido y estrategias estáticas (sin policy aprendida).',
    kpi1: {
      label: 'Finalización',
      caption: '% de carreras acabadas',
    },
    kpi2: {
      label: 'Recompensa media',
      caption: 'por carrera (×10³ pts)',
    },
    kpi3: {
      label: 'Vuelta rápida media',
      caption: 'en segundos',
    },
    distribution: 'Distribución de posiciones finales',
    distributionHint: 'Top 3 · Midfield · Resto',
    buckets: {
      p1_3: 'Top 3',
      p4_7: 'P4 – 7',
      p8: 'P8+',
    },
    legend: {
      model: 'Modelo',
      baseline: 'Baseline',
    },
  },
  en: {
    title: 'Model vs Baseline',
    subtitle:
      'Comparison between the learned agent and static strategies (no learned policy).',
    kpi1: {
      label: 'Completion',
      caption: '% of races finished',
    },
    kpi2: {
      label: 'Avg reward',
      caption: 'per race (×10³ pts)',
    },
    kpi3: {
      label: 'Avg fastest lap',
      caption: 'in seconds',
    },
    distribution: 'Distribution of final positions',
    distributionHint: 'Top 3 · Midfield · Rest',
    buckets: {
      p1_3: 'Top 3',
      p4_7: 'P4 – 7',
      p8: 'P8+',
    },
    legend: {
      model: 'Model',
      baseline: 'Baseline',
    },
  },
} as const;

// ---------------------------------------------------------------------------

export default function StrategyComparison({ locale, data }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const barsRef = useRef<SVGGElement | null>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  const copy = COPY[locale];

  // Build aggregates once; cheap.
  const model = useMemo(
    () => aggregate(data.filter((r) => r.agent_type === 'strategy_model')),
    [data]
  );
  const baseline = useMemo(
    () => aggregate(data.filter((r) => r.agent_type === 'static')),
    [data]
  );

  // Reveal animation on viewport entry
  useEffect(() => {
    if (hasAnimated || !rootRef.current) return;
    const el = rootRef.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      el.classList.add('is-visible');
      setHasAnimated(true);
      return;
    }
    gsap.fromTo(
      el.querySelectorAll<HTMLElement>('.strat-comp__fade'),
      { opacity: 0, y: 12 },
      {
        opacity: 1,
        y: 0,
        duration: 0.7,
        stagger: 0.08,
        ease: 'power2.out',
        delay: 0.1,
        onComplete: () => setHasAnimated(true),
      }
    );
    el.classList.add('is-visible');
    return () => {
      gsap.killTweensOf('.strat-comp__fade');
    };
  }, [hasAnimated]);

  // Bars animation: after KPI cards finish, sweep bars up from the baseline.
  // Vertical bars grow from bottom to top (scaleY 0→1 anchored at the
  // bottom edge), which is the natural UX for a vertical-bar chart —
  // the previous `scaleX` with `left center` origin made them sweep in
  // horizontally, which reads wrong for this geometry.
  useEffect(() => {
    if (!hasAnimated || !barsRef.current) return;
    const bars = Array.from(
      barsRef.current.querySelectorAll<SVGRectElement>('.strat-bar')
    );
    if (!bars.length) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    gsap.fromTo(
      bars,
      { scaleY: 0, transformOrigin: 'center bottom' },
      {
        scaleY: 1,
        duration: 0.85,
        stagger: 0.08,
        ease: 'power3.out',
      }
    );
  }, [hasAnimated]);

  // Format helpers
  const rewardK = (v: number) => Math.round(v / 1000).toLocaleString('en-US');
  const lapFmt = (v: number) => v.toFixed(2);

  return (
    <div ref={rootRef} className="strat-comp">
      <header className="strat-comp__header strat-comp__fade">
        <div className="strat-comp__heading">
          <h3 className="strat-comp__title">{copy.title}</h3>
          <p className="strat-comp__subtitle">{copy.subtitle}</p>
        </div>
      </header>

      {/* 3 KPI cards */}
      <div className="strat-comp__kpis" role="list">
        <KpiCard
          copy={copy.kpi1}
          metricType="completion"
          model={model.finished_pct}
          baseline={baseline.finished_pct}
          unit="%"
          decimals={1}
          className="strat-comp__fade"
          locale={locale}
        />
        <KpiCard
          copy={copy.kpi2}
          metricType="reward"
          model={rewardK(model.avg_reward)}
          baseline={rewardK(baseline.avg_reward)}
          unit="k"
          decimals={0}
          className="strat-comp__fade"
          locale={locale}
        />
        <KpiCard
          copy={copy.kpi3}
          metricType="lap"
          model={lapFmt(model.avg_fastest_lap_s)}
          baseline={lapFmt(baseline.avg_fastest_lap_s)}
          unit="s"
          decimals={2}
          className="strat-comp__fade"
          locale={locale}
        />
      </div>

      {/* Distribution chart */}
      <div className="strat-comp__chart strat-comp__fade">
        <div className="strat-comp__chart-header">
          <h4 className="strat-comp__chart-title">{copy.distribution}</h4>
          <div className="strat-comp__legend">
            <span className="strat-comp__legend-item">
              <span
                className="strat-comp__legend-swatch"
                style={{ background: 'var(--accent)' }}
              />
              {copy.legend.model} <strong>({model.n})</strong>
            </span>
            <span className="strat-comp__legend-item">
              <span
                className="strat-comp__legend-swatch"
                style={{ background: 'var(--text-dim)' }}
              />
              {copy.legend.baseline} <strong>({baseline.n})</strong>
            </span>
          </div>
        </div>

        <DistributionChart
          locale={locale}
          copy={copy}
          model={model}
          baseline={baseline}
          barsRef={barsRef}
        />

        <div className="strat-comp__hint" aria-hidden="true">
          {copy.distributionHint}
        </div>
      </div>

      {/* Component-scoped styles. Same pattern as the other interactive
          components — co-located to keep the file portable. */}
      <style>{`
        .strat-comp {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }
        .strat-comp__header {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-end;
          justify-content: space-between;
          gap: var(--space-4);
        }
        .strat-comp__heading {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          max-width: 64ch;
        }
        .strat-comp__title {
          font-family: var(--font-display);
          font-size: var(--text-lg);
          font-weight: 600;
          letter-spacing: var(--tracking-snug);
          color: var(--color-fg);
          margin: 0;
          line-height: 1.2;
        }
        .strat-comp__subtitle {
          font-family: var(--font-body);
          font-size: var(--text-sm);
          color: var(--color-fg-muted);
          margin: 0;
          line-height: 1.5;
        }
        .strat-comp__kpis {
          display: grid;
          grid-template-columns: 1fr;
          gap: var(--space-4);
        }
        @media (min-width: 640px) {
          .strat-comp__kpis {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        .strat-kpi-card {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          padding: var(--space-5);
          background: var(--ink);
          border: 1px solid var(--rule);
          border-radius: var(--radius-md);
        }
        .strat-kpi-card__label {
          font-family: var(--font-display);
          font-size: var(--text-xs);
          text-transform: uppercase;
          letter-spacing: var(--tracking-widest);
          color: var(--color-fg-muted);
          line-height: 1.2;
        }
        .strat-kpi-card__rows {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-4);
          align-items: end;
        }
        .strat-kpi-card__row {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }
        .strat-kpi-card__row-label {
          font-family: var(--font-display);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: var(--tracking-widest);
          color: var(--text-dim);
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .strat-kpi-card__swatch {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }
        .strat-kpi-card__value {
          font-family: var(--font-display);
          font-variant-numeric: tabular-nums;
          font-weight: 600;
          font-size: clamp(1.6rem, 3vw, 2rem);
          letter-spacing: var(--tracking-snug);
          line-height: 1;
          display: flex;
          align-items: baseline;
          gap: 4px;
        }
        .strat-kpi-card__value--model { color: var(--accent); }
        .strat-kpi-card__value--baseline { color: var(--text-dim); }
        .strat-kpi-card__unit {
          font-size: 0.55em;
          color: var(--text-dim);
          font-weight: 500;
        }
        .strat-kpi-card__delta {
          font-family: var(--font-display);
          font-size: var(--text-xs);
          letter-spacing: var(--tracking-widest);
          text-transform: uppercase;
          color: var(--secondary);
          font-weight: 600;
        }
        .strat-kpi-card__bar {
          position: relative;
          width: 100%;
          height: 6px;
          background: rgba(31, 34, 48, 0.5);
          border-radius: var(--radius-sm);
          overflow: hidden;
        }
        .strat-kpi-card__bar-fill {
          position: absolute;
          inset: 0;
          transform-origin: left center;
          transform: scaleX(0);
          border-radius: inherit;
          background: var(--accent);
        }
        .strat-kpi-card__bar-fill--baseline {
          background: var(--text-dim);
        }
        .strat-kpi-card__bar.is-visible .strat-kpi-card__bar-fill {
          animation: strat-bar-grow 1s var(--motion-ease-out) forwards;
        }
        @keyframes strat-bar-grow {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        .strat-kpi-card__caption {
          font-family: var(--font-body);
          font-size: var(--text-xs);
          color: var(--text-dim);
          line-height: 1.4;
        }

        .strat-comp__chart {
          background: var(--ink);
          border: 1px solid var(--rule);
          border-radius: var(--radius-md);
          padding: var(--space-5);
        }
        .strat-comp__chart-header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: var(--space-3);
          margin-bottom: var(--space-4);
        }
        .strat-comp__chart-title {
          font-family: var(--font-display);
          font-size: var(--text-sm);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: var(--tracking-widest);
          color: var(--color-fg);
          margin: 0;
          line-height: 1.2;
        }
        .strat-comp__legend {
          display: inline-flex;
          align-items: center;
          gap: var(--space-4);
          flex-wrap: wrap;
          font-family: var(--font-display);
          font-size: var(--text-xs);
          color: var(--color-fg-muted);
          letter-spacing: var(--tracking-widest);
          text-transform: uppercase;
        }
        .strat-comp__legend-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .strat-comp__legend-item strong {
          color: var(--color-fg);
          font-weight: 600;
          margin-left: 4px;
        }
        .strat-comp__legend-swatch {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          display: inline-block;
        }
        .strat-comp__hint {
          font-family: var(--font-display);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: var(--tracking-widest);
          color: var(--text-dim);
          margin-top: var(--space-3);
          text-align: right;
        }
        .strat-distribution {
          width: 100%;
          height: auto;
        }
        .strat-bar-label,
        .strat-bar-value {
          font-family: var(--font-display);
          font-variant-numeric: tabular-nums;
        }
        @media (prefers-reduced-motion: reduce) {
          .strat-comp__fade,
          .strat-kpi-card__bar-fill {
            opacity: 1 !important;
            transform: none !important;
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

interface KpiCardProps {
  copy: { label: string; caption: string };
  /** Reserved for future per-metric styling; currently every card uses the
   * same layout. Kept here so we can branch easily later (e.g. lap-time
   * uses inverse-color, where lower = better). */
  metricType: 'completion' | 'reward' | 'lap';
  model: number | string;
  baseline: number | string;
  unit: string;
  decimals: number;
  className?: string;
  locale: 'es' | 'en';
}

function KpiCard({
  copy,
  metricType,
  model,
  baseline,
  unit,
  decimals,
  className,
  locale,
}: KpiCardProps) {
  // Future-proof: keep metricType in the signature even though v1 doesn't
  // branch on it (every card looks the same). When lap time goes inverse
  // we'll flip the persimmon/dim swatches here based on metricType.
  void metricType;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (hasAnimated || !rootRef.current) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      rootRef.current.querySelectorAll<HTMLElement>('.strat-kpi-card__bar').forEach((el) =>
        el.classList.add('is-visible')
      );
      setHasAnimated(true);
      return;
    }
    const bars = rootRef.current.querySelectorAll<HTMLElement>('.strat-kpi-card__bar');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            bars.forEach((el) => el.classList.add('is-visible'));
            observer.disconnect();
          }
        });
      },
      { threshold: 0.3 }
    );
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [hasAnimated]);

  // Format numeric values
  const fmt = (v: number | string) => {
    if (typeof v === 'string') return v;
    return decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString('en-US');
  };

  // Bar widths — both relative to 100% (model bars wider)
  const modelNum = typeof model === 'number' ? model : parseFloat(model);
  const baseNum = typeof baseline === 'number' ? baseline : parseFloat(baseline);
  const max = Math.max(modelNum, baseNum, 1);
  const modelPct = (modelNum / max) * 100;
  const baselinePct = (baseNum / max) * 100;

  return (
    <article ref={rootRef} className={`strat-kpi-card ${className ?? ''}`}>
      <div className="strat-kpi-card__label">{copy.label}</div>

      <div className="strat-kpi-card__rows">
        <div className="strat-kpi-card__row">
          <span className="strat-kpi-card__row-label">
            <span className="strat-kpi-card__swatch" style={{ background: 'var(--accent)' }} />
            {locale === 'es' ? 'Modelo' : 'Model'}
          </span>
          <div className="strat-kpi-card__value strat-kpi-card__value--model">
            {fmt(model)}
            <span className="strat-kpi-card__unit">{unit}</span>
          </div>
          <div className="strat-kpi-card__bar">
            <div
              className="strat-kpi-card__bar-fill"
              style={{ width: `${modelPct}%` }}
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="strat-kpi-card__row">
          <span className="strat-kpi-card__row-label">
            <span
              className="strat-kpi-card__swatch"
              style={{ background: 'var(--text-dim)' }}
            />
            {locale === 'es' ? 'Baseline' : 'Baseline'}
          </span>
          <div className="strat-kpi-card__value strat-kpi-card__value--baseline">
            {fmt(baseline)}
            <span className="strat-kpi-card__unit">{unit}</span>
          </div>
          <div className="strat-kpi-card__bar">
            <div
              className="strat-kpi-card__bar-fill strat-kpi-card__bar-fill--baseline"
              style={{ width: `${baselinePct}%` }}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      <div className="strat-kpi-card__caption">{copy.caption}</div>
    </article>
  );
}

// ---------------------------------------------------------------------------

interface DistributionChartProps {
  locale: 'es' | 'en';
  copy: typeof COPY.en | typeof COPY.es;
  model: Aggregate;
  baseline: Aggregate;
  barsRef: React.RefObject<SVGGElement | null>;
}

const VB_W = 720;
const VB_H = 180;
const PAD = { l: 56, r: 24, t: 16, b: 32 };
const PLOT_W = VB_W - PAD.l - PAD.r;
const PLOT_H = VB_H - PAD.t - PAD.b;

function DistributionChart({ locale, copy, model, baseline, barsRef }: DistributionChartProps) {
  // Build grouped bars: 3 buckets × 2 series. We use [0,1] on the X axis
  // with 3 groups, each containing 2 side-by-side bars.
  const buckets = [
    { key: 'p1_3', label: copy.buckets.p1_3, m: model.p1_3, b: baseline.p1_3 },
    { key: 'p4_7', label: copy.buckets.p4_7, m: model.p4_7, b: baseline.p4_7 },
    { key: 'p8', label: copy.buckets.p8, m: model.p8_plus, b: baseline.p8_plus },
  ];

  const groupCount = buckets.length;
  const groupW = PLOT_W / groupCount;
  const barGap = 4;
  const barW = (groupW - barGap) / 2;

  // Y axis 0..100 (% of starts)
  const yTicks = [0, 25, 50, 75, 100];
  const sy = (v: number) => PAD.t + PLOT_H - (v / 100) * PLOT_H;
  const sxGroup = (i: number) => PAD.l + i * groupW + groupW / 2;

  return (
    <svg
      className="strat-distribution"
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={copy.distribution}
      style={{ width: '100%', display: 'block' }}
    >
      {/* Y grid lines */}
      <g aria-hidden="true">
        {yTicks.map((t) => (
          <line
            key={`y-${t}`}
            x1={PAD.l}
            x2={PAD.l + PLOT_W}
            y1={sy(t)}
            y2={sy(t)}
            stroke="var(--rule)"
            strokeWidth={0.5}
            strokeDasharray={t === 0 ? '0' : '2 4'}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>

      {/* Y tick labels */}
      <g aria-hidden="true">
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
            {t}%
          </text>
        ))}
        <text
          x={14}
          y={PAD.t + PLOT_H / 2}
          textAnchor="middle"
          fontSize="9"
          fontFamily="var(--font-display)"
          fill="var(--text-dim)"
          letterSpacing="0.08em"
          transform={`rotate(-90 14 ${PAD.t + PLOT_H / 2})`}
          style={{ textTransform: 'uppercase' }}
        >
          {locale === 'es' ? '% DE SALIDAS' : '% OF STARTS'}
        </text>
      </g>

      {/* X axis */}
      <line
        x1={PAD.l}
        x2={PAD.l + PLOT_W}
        y1={PAD.t + PLOT_H}
        y2={PAD.t + PLOT_H}
        stroke="var(--rule-strong)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />

      {/* Groups */}
      <g ref={barsRef}>
        {buckets.map((bucket, i) => {
          const gx = sxGroup(i);
          const mx = gx - barW - barGap / 2;
          const bx = gx + barGap / 2;

          return (
            <g key={bucket.key}>
              {/* Model bar */}
              <rect
                className="strat-bar"
                x={mx}
                y={sy(bucket.m)}
                width={barW}
                height={Math.max(0, PLOT_H + PAD.t - sy(bucket.m))}
                fill="var(--accent)"
                rx={3}
                vectorEffect="non-scaling-stroke"
              />
              <text
                className="strat-bar-value"
                x={mx + barW / 2}
                y={sy(bucket.m) - 6}
                textAnchor="middle"
                fontSize="11"
                fontFamily="var(--font-display)"
                fill="var(--accent)"
                fontWeight={600}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {bucket.m.toFixed(1)}%
              </text>

              {/* Baseline bar */}
              <rect
                className="strat-bar"
                x={bx}
                y={sy(bucket.b)}
                width={barW}
                height={Math.max(0, PLOT_H + PAD.t - sy(bucket.b))}
                fill="var(--text-dim)"
                rx={3}
                vectorEffect="non-scaling-stroke"
              />
              <text
                className="strat-bar-value"
                x={bx + barW / 2}
                y={sy(bucket.b) - 6}
                textAnchor="middle"
                fontSize="11"
                fontFamily="var(--font-display)"
                fill="var(--text-dim)"
                fontWeight={600}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {bucket.b.toFixed(1)}%
              </text>

              {/* Group label */}
              <text
                className="strat-bar-label"
                x={gx}
                y={PAD.t + PLOT_H + 18}
                textAnchor="middle"
                fontSize="10"
                fontFamily="var(--font-display)"
                fill="var(--color-fg-muted)"
                letterSpacing="0.08em"
                style={{ textTransform: 'uppercase' }}
              >
                {bucket.label}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

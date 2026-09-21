/**
 * FastF1Comparison — Three-column circuit validation card for Section 05.
 *
 * Each column shows a circuit (Barcelona, Bahrain, Monza) with:
 *   - Circuit name + meta (length / turns / downforce level)
 *   - Mini bar chart: model predicted stops vs real F1 stops
 *   - A short testimonial-style quote explaining the match
 *   - A green ✓ badge + confidence when both numbers agree
 *
 * Implementation note: bars are pure SVG (no Recharts) — keeps the section
 * lean and avoids React waterfally on this otherwise static block. GSAP
 * drives the bar grow animation on reveal.
 */
import { useEffect, useMemo, useRef } from 'react';
import { gsap } from 'gsap';

export interface FastF1CircuitData {
  id: 'barcelona' | 'bahrain' | 'monza';
  name: string;
  country: string;
  length_km: number;
  turns: number;
  downforce_level: string;
  lap_time_baseline_s: number;
  model: {
    predicted_stops: number;
    predicted_window_laps: [number, number];
    predicted_compounds: string[];
    predicted_total_stint_laps: number;
    completion_pct: number;
    avg_reward: number;
  };
  real: {
    actual_stops: number;
    typical_window_laps: [number, number];
    common_compounds: string[];
    reference_team: string;
    notes: string;
    lap_times: {
      soft: { best_s: number; avg_s: number; final_wear_pct: number; laps_completed: number };
      medium: { best_s: number; avg_s: number; final_wear_pct: number; laps_completed: number };
      hard: { best_s: number; avg_s: number; final_wear_pct: number; laps_completed: number };
    };
  };
  validation: {
    stops_match: boolean;
    window_overlap_pct: number;
    confidence: number;
    quote_es: string;
    quote_en: string;
  };
}

export interface FastF1Payload {
  circuits: FastF1CircuitData[];
  footer: { es: string; en: string };
}

export interface FastF1ComparisonProps {
  locale: 'es' | 'en';
  data: FastF1Payload;
}

const COPY = {
  es: {
    modelLabel: 'Paradas predichas (modelo)',
    realLabel: 'Paradas reales (F1)',
    header: {
      length: 'Longitud',
      turns: 'Curvas',
      downforce: 'Carga',
      compounds: 'Compuestos',
      window: 'Ventana',
    },
    units: { km: 'km', turns: 'curvas' },
    validation: 'Validado',
    quoteHeader: 'Coincidencia',
    referenceLabel: 'Referencia',
  },
  en: {
    modelLabel: 'Predicted stops (model)',
    realLabel: 'Actual stops (F1)',
    header: {
      length: 'Length',
      turns: 'Turns',
      downforce: 'Downforce',
      compounds: 'Compounds',
      window: 'Window',
    },
    units: { km: 'km', turns: 'turns' },
    validation: 'Validated',
    quoteHeader: 'Match',
    referenceLabel: 'Reference',
  },
} as const;

/**
 * Format a window tuple [start, end] into a "12–18" lap range.
 */
function fmtWindow(window: [number, number], locale: 'es' | 'en'): string {
  return locale === 'es'
    ? `v. ${window[0]}–${window[1]}`
    : `L ${window[0]}–${window[1]}`;
}

/**
 * Mini bar chart: two horizontal bars (model + real) with the integer count
 * shown at the end. Bars live in a fixed viewBox so they look identical
 * across columns. We pick a max scale of 4 since that's the upper bound of
 * pit stops across the F1 calendar (Monaco 2024 hit 3 stops, race max ~4).
 */
function MiniBars({
  model,
  real,
  labelModel,
  labelReal,
  max = 4,
}: {
  model: number;
  real: number;
  labelModel: string;
  labelReal: string;
  max?: number;
}) {
  const VB_W = 280;
  const VB_H = 90;
  const ROW_H = 28;
  const LABEL_W = 84;
  const BAR_W_MAX = VB_W - LABEL_W - 32; // leave room for the value chip

  const modelW = (model / max) * BAR_W_MAX;
  const realW = (real / max) * BAR_W_MAX;
  const match = model === real;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      role="img"
      aria-label={`${labelModel}: ${model}; ${labelReal}: ${real}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      {/* Row 1: model */}
      <text
        x={0}
        y={ROW_H * 0.65}
        fill="var(--color-fg-muted)"
        fontFamily="var(--font-display)"
        fontSize="10"
        letterSpacing="0.1em"
      >
        {labelModel.toUpperCase()}
      </text>
      <rect
        x={LABEL_W}
        y={ROW_H * 0.25}
        width={Math.max(2, modelW)}
        height={ROW_H * 0.55}
        rx={3}
        fill="var(--color-highlight)"
        className="bar bar--model"
      />
      <text
        x={LABEL_W + Math.max(2, modelW) + 6}
        y={ROW_H * 0.65}
        fill="var(--color-fg)"
        fontFamily="var(--font-display)"
        fontSize="14"
        fontWeight="600"
      >
        {model}
      </text>

      {/* Row 2: real */}
      <text
        x={0}
        y={ROW_H * 1.55}
        fill="var(--color-fg-muted)"
        fontFamily="var(--font-display)"
        fontSize="10"
        letterSpacing="0.1em"
      >
        {labelReal.toUpperCase()}
      </text>
      <rect
        x={LABEL_W}
        y={ROW_H * 1.15}
        width={Math.max(2, realW)}
        height={ROW_H * 0.55}
        rx={3}
        fill="var(--color-brand)"
        className="bar bar--real"
      />
      <text
        x={LABEL_W + Math.max(2, realW) + 6}
        y={ROW_H * 1.55}
        fill="var(--color-fg)"
        fontFamily="var(--font-display)"
        fontSize="14"
        fontWeight="600"
      >
        {real}
      </text>

      {/* Match marker */}
      <text
        x={VB_W}
        y={ROW_H * 2.3}
        textAnchor="end"
        fill={match ? 'var(--color-highlight)' : 'var(--color-fg-muted)'}
        fontFamily="var(--font-display)"
        fontSize="9"
        letterSpacing="0.1em"
      >
        {match ? '✓ MATCH' : `Δ ${Math.abs(model - real)}`}
      </text>
    </svg>
  );
}

export default function FastF1Comparison({ locale, data }: FastF1ComparisonProps) {
  const copy = COPY[locale];
  const rootRef = useRef<HTMLDivElement | null>(null);

  // GSAP entry: stagger each column in, then sweep each bar from 0 → full.
  useEffect(() => {
    if (!rootRef.current) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      rootRef.current.classList.add('is-visible');
      // Also expand bars to full width (they're hidden via opacity:0 default).
      rootRef.current.querySelectorAll<SVGRectElement>('.bar').forEach((rect) => {
        const target = rect.getAttribute('width') ?? '100';
        rect.setAttribute('width', target);
      });
      return;
    }

    const el = rootRef.current;
    const cols = el.querySelectorAll<HTMLElement>('.fastf1-col');
    const bars = el.querySelectorAll<SVGRectElement>('.bar');

    gsap.fromTo(
      cols,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.55,
        stagger: 0.12,
        ease: 'power2.out',
        delay: 0.15,
      }
    );

    // Bar grow — tween from 0 to whatever the inline width was at mount time.
    // We capture the natural width first.
    const naturalWidths: number[] = [];
    bars.forEach((rect) => {
      const w = parseFloat(rect.getAttribute('width') ?? '0');
      naturalWidths.push(w);
      rect.setAttribute('width', '0');
    });
    gsap.to(
      { i: 0 },
      {
        i: 1,
        duration: 0.9,
        ease: 'power2.out',
        delay: 0.4,
        onUpdate: function () {
          const t = this.progress();
          bars.forEach((rect, idx) => {
            rect.setAttribute('width', String(naturalWidths[idx]! * t));
          });
        },
      }
    );

    const raf = window.requestAnimationFrame(() => el.classList.add('is-visible'));
    return () => window.cancelAnimationFrame(raf);
  }, []);

  const quoteOf = (c: FastF1CircuitData) =>
    locale === 'es' ? c.validation.quote_es : c.validation.quote_en;

  // Pre-format metadata for each circuit so the JSX stays clean.
  const formatted = useMemo(
    () =>
      data.circuits.map((c) => ({
        ...c,
        windowText: fmtWindow(c.model.predicted_window_laps, locale),
        realWindowText: fmtWindow(c.real.typical_window_laps, locale),
        confidencePct: Math.round(c.validation.confidence * 100),
        modelCompound: c.model.predicted_compounds.join(' → '),
        realCompound: c.real.common_compounds.join(' → '),
      })),
    [data, locale]
  );

  return (
    <div ref={rootRef} className="fastf1-comparison">
      <div className="fastf1-comparison__grid">
        {formatted.map((c) => (
          <article
            key={c.id}
            className="fastf1-col"
            aria-labelledby={`fastf1-${c.id}-name`}
          >
            <header className="fastf1-col__head">
              <h3 id={`fastf1-${c.id}-name`} className="fastf1-col__name">
                {c.name}
              </h3>
              <p className="fastf1-col__country">{c.country}</p>
              <dl className="fastf1-col__stats">
                <div>
                  <dt>{copy.header.length}</dt>
                  <dd>{c.length_km.toFixed(3)} {copy.units.km}</dd>
                </div>
                <div>
                  <dt>{copy.header.turns}</dt>
                  <dd>{c.turns} {copy.units.turns}</dd>
                </div>
                <div>
                  <dt>{copy.header.downforce}</dt>
                  <dd>{c.downforce_level}</dd>
                </div>
              </dl>
            </header>

            <div className="fastf1-col__bars">
              <MiniBars
                model={c.model.predicted_stops}
                real={c.real.actual_stops}
                labelModel={copy.modelLabel}
                labelReal={copy.realLabel}
              />
              <div className="fastf1-col__window">
                <span className="fastf1-col__window-label">{copy.header.window}</span>
                <span className="fastf1-col__window-value">
                  {c.windowText} <span className="fastf1-col__window-vs">vs</span> {c.realWindowText}
                </span>
              </div>
              <div className="fastf1-col__compounds">
                <span className="fastf1-col__chip">{c.modelCompound}</span>
                <span className="fastf1-col__chip fastf1-col__chip--alt">{c.realCompound}</span>
              </div>
            </div>

            <blockquote className="fastf1-col__quote">
              <span className="fastf1-col__quote-mark" aria-hidden="true">“</span>
              <p>{quoteOf(c)}</p>
            </blockquote>

            <footer className="fastf1-col__foot">
              <span className="fastf1-col__reference">
                {copy.referenceLabel}: {c.real.reference_team}
              </span>
              <span
                className={`fastf1-col__badge ${c.validation.stops_match ? 'is-valid' : 'is-warn'}`}
                title={`${c.confidencePct}% confidence`}
              >
                <svg
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  aria-hidden="true"
                >
                  <path
                    d="M3 8 L7 12 L13 4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {copy.validation}
                <span className="fastf1-col__confidence">{c.confidencePct}%</span>
              </span>
            </footer>
          </article>
        ))}
      </div>

      {/* Component-scoped styles, same pattern as RideHeightSlider.tsx */}
      <style>{`
        .fastf1-comparison {
          opacity: 0;
        }
        .fastf1-comparison.is-visible {
          opacity: 1;
        }
        .fastf1-comparison__grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: var(--space-4);
        }
        @media (min-width: 720px) {
          .fastf1-comparison__grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: var(--space-5);
          }
        }
        .fastf1-col {
          background: var(--ink);
          border: 1px solid var(--rule);
          border-radius: var(--radius-md);
          padding: var(--space-5);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          position: relative;
          overflow: hidden;
          transition:
            border-color var(--motion-duration-short) var(--motion-ease-out),
            transform var(--motion-duration-short) var(--motion-ease-out),
            box-shadow var(--motion-duration-short) var(--motion-ease-out);
        }
        .fastf1-col::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(
            ellipse 80% 40% at 50% 0%,
            rgba(33, 158, 188, 0.07) 0%,
            transparent 70%
          );
          pointer-events: none;
        }
        .fastf1-col:hover {
          border-color: var(--rule-strong);
          transform: translateY(-3px);
          box-shadow: var(--shadow-md);
        }
        .fastf1-col > * {
          position: relative;
          z-index: 1;
        }
        .fastf1-col__head {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }
        .fastf1-col__name {
          font-family: var(--font-display);
          font-size: var(--text-lg);
          font-weight: 600;
          color: var(--color-fg);
          letter-spacing: var(--tracking-snug);
          margin: 0;
          line-height: 1.2;
        }
        .fastf1-col__country {
          font-family: var(--font-display);
          font-size: var(--text-xs);
          text-transform: uppercase;
          letter-spacing: var(--tracking-widest);
          color: var(--color-fg-muted);
          margin: 0;
        }
        .fastf1-col__stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: var(--space-3);
          margin: var(--space-2) 0 0;
          padding-top: var(--space-3);
          border-top: 1px solid var(--rule);
        }
        .fastf1-col__stats > div {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .fastf1-col__stats dt {
          font-family: var(--font-display);
          font-size: var(--text-xs);
          text-transform: uppercase;
          letter-spacing: var(--tracking-widest);
          color: var(--color-fg-muted);
          margin: 0;
        }
        .fastf1-col__stats dd {
          font-family: var(--font-display);
          font-variant-numeric: tabular-nums;
          font-feature-settings: 'tnum' on;
          font-size: var(--text-sm);
          color: var(--color-fg);
          margin: 0;
        }
        .fastf1-col__bars {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .fastf1-col__window {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-2);
          font-family: var(--font-display);
          font-size: var(--text-xs);
          text-transform: uppercase;
          letter-spacing: var(--tracking-widest);
          color: var(--color-fg-muted);
        }
        .fastf1-col__window-label {
          color: var(--color-fg-muted);
        }
        .fastf1-col__window-value {
          color: var(--color-fg);
          font-weight: 500;
        }
        .fastf1-col__window-vs {
          color: var(--color-fg-muted);
          margin: 0 4px;
        }
        .fastf1-col__compounds {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
        }
        .fastf1-col__chip {
          font-family: var(--font-display);
          font-size: var(--text-xs);
          letter-spacing: var(--tracking-wide);
          padding: 4px 8px;
          background: rgba(255, 183, 3, 0.12);
          border: 1px solid rgba(255, 183, 3, 0.3);
          border-radius: var(--radius-sm);
          color: var(--color-highlight);
        }
        .fastf1-col__chip--alt {
          background: rgba(33, 158, 188, 0.12);
          border-color: rgba(33, 158, 188, 0.3);
          color: var(--color-brand);
        }
        .fastf1-col__quote {
          margin: 0;
          padding: var(--space-3) 0;
          border-top: 1px solid var(--rule);
          position: relative;
        }
        .fastf1-col__quote-mark {
          position: absolute;
          top: -8px;
          left: 0;
          font-family: var(--font-display);
          font-size: 32px;
          line-height: 1;
          color: var(--color-highlight);
        }
        .fastf1-col__quote p {
          font-family: var(--font-body);
          font-size: var(--text-sm);
          line-height: var(--leading-relaxed);
          color: var(--color-fg);
          font-style: italic;
          padding-left: var(--space-4);
          margin: 0;
        }
        .fastf1-col__foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-3);
          padding-top: var(--space-3);
          border-top: 1px solid var(--rule);
          flex-wrap: wrap;
        }
        .fastf1-col__reference {
          font-family: var(--font-display);
          font-size: var(--text-xs);
          letter-spacing: var(--tracking-wide);
          color: var(--color-fg-muted);
        }
        .fastf1-col__badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-family: var(--font-display);
          font-size: var(--text-xs);
          text-transform: uppercase;
          letter-spacing: var(--tracking-widest);
          padding: 4px 8px;
          border-radius: var(--radius-sm);
          border: 1px solid currentColor;
        }
        .fastf1-col__badge.is-valid {
          background: rgba(255, 183, 3, 0.10);
          color: var(--color-highlight);
          border-color: rgba(255, 183, 3, 0.4);
        }
        .fastf1-col__badge.is-warn {
          background: rgba(142, 202, 230, 0.10);
          color: var(--color-fg-muted);
          border-color: rgba(142, 202, 230, 0.3);
        }
        .fastf1-col__confidence {
          margin-left: 4px;
          font-variant-numeric: tabular-nums;
          opacity: 0.8;
        }
        @media (prefers-reduced-motion: reduce) {
          .fastf1-col {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}

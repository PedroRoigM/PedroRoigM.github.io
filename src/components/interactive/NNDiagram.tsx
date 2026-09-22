/**
 * NNDiagram — Controller architecture diagram for the neuroevolution agent.
 *
 * Pure SVG visualization of the actor network defined in
 * `models/model_with_memory.py`:
 *
 *   Backbone : 47 → fc1(128, tanh) → fc2(128, tanh) → fc3(64, tanh)
 *   Skip     : 47 → skip_proj(64, tanh)             (curved bezier below)
 *   Merge    : h = fc3(fc2(fc1(x))) + skip_proj(x)
 *   Heads    : throttle 64→16→1 (sigmoid)
 *              brake    64→16→1 (sigmoid)
 *              steering 64→16→1 (tanh)
 *
 * Visual encoding:
 *   - Small layers (≤ ~12 visible nodes) render as a column of dots.
 *   - Dense layers (47/128/128/64) render as a single rounded bar whose
 *     internal horizontal strokes hint at the layer's column of neurons.
 *   - Connection lines are drawn behind the nodes at low opacity; the
 *     "heads → outputs" fan-out uses amber strokes (these lead to the
 *     output nodes which are the network's outputs).
 *   - The skip projection is a curved bezier from the input column to the
 *     merge column, drawn below the backbone so it visually "skips" the
 *     intermediate layers.
 *
 * Hover interactions:
 *   - Hovering any layer's column/bars/dots highlights its incoming
 *     connections (subtle opacity boost) and tints the layer border amber.
 *   - Hovering the input column or the merge column also brightens the
 *     skip bezier (since both endpoints of the skip projection).
 */
import { useCallback, useMemo, useRef, useState } from 'react';

export interface NNDiagramProps {
  locale: 'es' | 'en';
  className?: string;
}

interface LayerDef {
  id: string;
  label: string;
  subtitle?: string;
  /** Number of neurons in this layer. */
  count: number;
  /** Visual style. */
  kind: 'bar' | 'dots';
  /** Number of dots to actually draw when kind === 'dots'. */
  dots?: number;
}

const VB_W = 800;
// VB_H tightened from 520 → 410: the previous value left a huge empty
// band below the layer labels (y=358) and the stats footer (y=508).
// 410 keeps the skip band on top (y=0–80) and tightens the bottom
// margin to ~40px between the labels and the stats row.
const VB_H = 410;
const PAD_X = 70;
// Plot vertical extent — shorter than the original 280 so the skip arc
// has its own clean band above the columns.
const COL_H = 240;
const PLOT_TOP = 80;
const PLOT_BOTTOM = PLOT_TOP + COL_H; // 320

// X positions of each column in the diagram. Pulled inward so the right
// edge has enough room for the two-line "action / activation" labels.
const COL_X = {
  input: PAD_X,
  fc1: PAD_X + 150,
  fc2: PAD_X + 270,
  // fc3 + merge share a single column — the bar IS the merged state h.
  // The skip projection curves into this column from below.
  fc3: PAD_X + 380,
  merge: PAD_X + 380,
  heads: PAD_X + 510,
  output: PAD_X + 620,
};

const LAYERS: LayerDef[] = [
  { id: 'input', label: '47 inputs', count: 47, kind: 'dots', dots: 12, subtitle: 'rays + speed + pos' },
  { id: 'fc1', label: 'fc1', subtitle: '128 · tanh', count: 128, kind: 'bar' },
  { id: 'fc2', label: 'fc2', subtitle: '128 · tanh', count: 128, kind: 'bar' },
  { id: 'fc3', label: 'h', subtitle: 'fc3 + skip · 64', count: 64, kind: 'bar' },
  // merge is rendered through fc3 — no separate entry to avoid double label
  { id: 'heads', label: 'heads', subtitle: '64 → 16 → 1', count: 16, kind: 'dots', dots: 5 },
  { id: 'output', label: 'outputs', subtitle: '3 actions', count: 3, kind: 'dots', dots: 3 },
];

const OUTPUT_DETAILS = [
  { name: 'throttle', activation: 'σ' },
  { name: 'brake', activation: 'σ' },
  { name: 'steering', activation: 'tanh' },
];

const PARAM_ESTIMATE = '~25K';

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** Generate `count` vertical positions evenly distributed around centerY. */
function dotPositions(count: number, centerY: number, span: number = 280): number[] {
  const positions: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    positions.push(centerY - span / 2 + t * span);
  }
  return positions;
}

export default function NNDiagram({ locale, className }: NNDiagramProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Stable connection line layout — one entry per (from, to) pair of layers.
  // We render ~8 representative connections per pair (full graph would be
  // 128*128 = 16384 lines for fc1→fc2 alone).
  const connections = useMemo(() => {
    type Pair = [string, string];
    const pairs: Pair[] = [
      ['input', 'fc1'],
      ['fc1', 'fc2'],
      ['fc2', 'fc3'],
      ['fc3', 'heads'],
      ['heads', 'output'],
    ];
    return pairs.map(([from, to]) => {
      const fromDef = LAYERS.find((l) => l.id === from)!;
      const toDef = LAYERS.find((l) => l.id === to)!;
      const fromCount = fromDef.kind === 'dots' ? fromDef.dots! : 8;
      const toCount = toDef.kind === 'dots' ? toDef.dots! : 8;
      const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

      // Special case: heads→output mesh — each head (gray dot) sends a line
      // to each output (orange dot), so N_heads × N_outputs lines total.
      // This visualises that every head feeds into every output, which is
      // what the actor network actually does (heads = independent linear
      // regressors over the same merged state h).
      if (to === 'output') {
        const headYs = dotPositions(fromDef.dots!, (PLOT_TOP + PLOT_BOTTOM) / 2, COL_H);
        const outYs = dotPositions(OUTPUT_DETAILS.length, (PLOT_TOP + PLOT_BOTTOM) / 2, COL_H);
        for (const headY of headYs) {
          for (const outY of outYs) {
            lines.push({
              x1: COL_X.heads + 8,
              y1: headY,
              x2: COL_X.output - 8,
              y2: outY,
            });
          }
        }
        return { from, to, lines };
      }

      const fromYs = dotPositions(fromCount, (PLOT_TOP + PLOT_BOTTOM) / 2, COL_H);
      const toYs = dotPositions(toCount, (PLOT_TOP + PLOT_BOTTOM) / 2, COL_H);
      const step = Math.max(1, Math.floor(fromCount / toCount));
      for (let i = 0; i < toCount; i++) {
        const fromIdx = Math.min(fromYs.length - 1, i * step);
        lines.push({
          x1: COL_X[from as keyof typeof COL_X] + (fromDef.kind === 'bar' ? 16 : 6),
          y1: fromYs[fromIdx]!,
          x2: COL_X[to as keyof typeof COL_X] - (toDef.kind === 'bar' ? 16 : 8),
          y2: toYs[i]!,
        });
      }
      return { from, to, lines };
    });
  }, []);

  const skipBezier = useMemo(() => {
    // Curved bezier routed ABOVE the network (in its own band y=0–80)
    // with a gentle radius. Endpoints anchor at the top of the input /
    // merge columns (y=80 = PLOT_TOP). Control points pull the curve UP
    // to y=58 — only ~22px of arc depth, intentionally shallow so it
    // reads as a small skip-header rather than a big semicircle.
    const x0 = COL_X.input + 6;
    const y0 = PLOT_TOP;
    const x1 = COL_X.merge;
    const y1 = PLOT_TOP;
    const cx1 = x0 + 60;
    const cy1 = PLOT_TOP - 22;
    const cx2 = x1 - 60;
    const cy2 = PLOT_TOP - 22;
    return `M ${x0} ${y0} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x1} ${y1}`;
  }, []);

  const setHover = useCallback((id: string | null) => setHovered(id), []);

  // ---- Connection opacity helper ---------------------------------------
  const connOpacity = (from: string, to: string, base: number): number => {
    if (!hovered) return base;
    if (hovered === from || hovered === to) return Math.min(1, base + 0.5);
    // Hovering merge: also light up the fc3→merge pair (skip is handled below)
    if (hovered === 'merge' && from === 'fc3') return Math.min(1, base + 0.4);
    return base * 0.3;
  };

  // ---- Render helpers ---------------------------------------------------
  const renderBar = (layer: LayerDef, x: number) => {
    const barW = 32;
    const barH = COL_H;
    const y = (PLOT_TOP + PLOT_BOTTOM) / 2 - barH / 2;
    const isHighlighted = hovered === layer.id;
    return (
      <g
        key={layer.id}
        onPointerEnter={() => setHover(layer.id)}
        onPointerLeave={() => setHover(null)}
        style={{ cursor: 'default' }}
      >
        <rect
          x={x - barW / 2}
          y={y}
          width={barW}
          height={barH}
          rx={4}
          fill="var(--primary-2)"
          stroke={isHighlighted ? 'var(--secondary)' : 'var(--rule-strong)'}
          strokeWidth={isHighlighted ? 1.5 : 1}
          vectorEffect="non-scaling-stroke"
          style={{ transition: 'stroke 0.2s var(--motion-ease-out), stroke-width 0.2s var(--motion-ease-out)' }}
        />
        {/* Internal "neurons" — horizontal strokes hinting at the column */}
        {Array.from({ length: Math.min(12, Math.max(1, layer.count / 8 | 0)) }).map((_, i) => {
          const total = Math.min(12, Math.max(1, layer.count / 8 | 0));
          const t = total === 1 ? 0.5 : i / (total - 1);
          const ny = y + 8 + t * (barH - 16);
          return (
            <line
              key={`${layer.id}-n-${i}`}
              x1={x - barW / 2 + 4}
              x2={x + barW / 2 - 4}
              y1={ny}
              y2={ny}
              stroke="var(--secondary)"
              strokeWidth={0.6}
              opacity={0.5}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </g>
    );
  };

  const renderDots = (layer: LayerDef, x: number) => {
    const count = layer.dots ?? layer.count;
    const ys = dotPositions(count, (PLOT_TOP + PLOT_BOTTOM) / 2, COL_H);
    const isHighlighted = hovered === layer.id;
    return (
      <g
        key={layer.id}
        onPointerEnter={() => setHover(layer.id)}
        onPointerLeave={() => setHover(null)}
        style={{ cursor: 'default' }}
      >
        {ys.map((y, i) => (
          <circle
            key={`${layer.id}-d-${i}`}
            cx={x}
            cy={y}
            r={layer.id === 'output' ? 8 : 5}
            fill={
              layer.id === 'output'
                ? 'var(--accent)'
                : layer.id === 'input'
                  ? 'var(--secondary)'
                  : 'var(--primary-2)'
            }
            stroke={isHighlighted ? 'var(--accent)' : 'var(--rule-strong)'}
            strokeWidth={isHighlighted ? 2 : 1}
            vectorEffect="non-scaling-stroke"
            style={{ transition: 'stroke 0.2s var(--motion-ease-out), stroke-width 0.2s var(--motion-ease-out)' }}
          />
        ))}
      </g>
    );
  };

  const renderLayer = (layer: LayerDef) => {
    const x = COL_X[layer.id as keyof typeof COL_X];
    switch (layer.kind) {
      case 'bar':
        return renderBar(layer, x);
      case 'dots':
        return renderDots(layer, x);
    }
  };

  const renderLabel = (layer: LayerDef, x: number) => {
    const y = PLOT_BOTTOM + 24;
    const isHighlighted = hovered === layer.id;
    return (
      <g key={`${layer.id}-label`} pointerEvents="none">
        <text
          x={x}
          y={y}
          textAnchor="middle"
          fontSize="11"
          fontFamily="var(--font-display)"
          fill={isHighlighted ? 'var(--accent)' : 'var(--text)'}
          fontWeight={600}
          letterSpacing="0.02em"
        >
          {layer.label}
        </text>
        {layer.subtitle && (
          <text
            x={x}
            y={y + 14}
            textAnchor="middle"
            fontSize="9"
            fontFamily="var(--font-display)"
            fill="var(--text-dim)"
            letterSpacing="0.08em"
            style={{ textTransform: 'uppercase' }}
          >
            {layer.subtitle}
          </text>
        )}
      </g>
    );
  };

  // ---- Output labels (right of the output column) ----------------------
  // Two-line format: action name on top, activation symbol below. Each
  // output node maps to one action (throttle / brake / steering).
  const renderOutputLabels = () => {
    const ys = dotPositions(OUTPUT_DETAILS.length, (PLOT_TOP + PLOT_BOTTOM) / 2, COL_H);
    return OUTPUT_DETAILS.map((o, i) => (
      <g key={`out-${o.name}`}>
        <line
          x1={COL_X.output + 12}
          x2={COL_X.output + 22}
          y1={ys[i]!}
          y2={ys[i]!}
          stroke="var(--rule-strong)"
          strokeWidth={0.6}
          vectorEffect="non-scaling-stroke"
        />
        <text
          x={COL_X.output + 28}
          y={ys[i]! - 1}
          fontSize="11"
          fontFamily="var(--font-display)"
          fill="var(--text)"
          letterSpacing="0.02em"
        >
          {o.name}
        </text>
        <text
          x={COL_X.output + 28}
          y={ys[i]! + 12}
          fontSize="9"
          fontFamily="var(--font-display)"
          fill="var(--text-dim)"
          letterSpacing="0.08em"
        >
          {o.activation}
        </text>
      </g>
    ));
  };

  // ---- Param stats footer ----------------------------------------------
  const statsText = locale === 'es'
    ? `${PARAM_ESTIMATE} parámetros · 47 inputs · 3 outputs`
    : `${PARAM_ESTIMATE} parameters · 47 inputs · 3 outputs`;

  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={locale === 'es' ? 'Arquitectura del controlador neuronal' : 'Neural controller architecture'}
      style={{ width: '100%', height: 'auto', display: 'block' }}
      onPointerLeave={() => setHover(null)}
    >
      {/* ---- Connection lines (drawn first, behind nodes) ---------------- */}
      <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
        {connections.map(({ from, to, lines }) => (
          <g key={`${from}-${to}`} style={{ pointerEvents: 'none' }}>
            {lines.map((ln, i) => (
              <line
                key={`${from}-${to}-${i}`}
                x1={ln.x1}
                y1={ln.y1}
                x2={ln.x2}
                y2={ln.y2}
                stroke={
                  to === 'output'
                    ? 'var(--accent)'
                    : from === 'input' || to === 'fc1'
                      ? 'var(--secondary)'
                      : 'var(--rule-strong)'
                }
                strokeWidth={0.6}
                opacity={connOpacity(from, to, to === 'output' ? 0.45 : 0.25)}
                vectorEffect="non-scaling-stroke"
                style={{ transition: 'opacity 0.3s var(--motion-ease-out)' }}
              />
            ))}
          </g>
        ))}

        {/* Skip connection — curved bezier below the backbone */}
        <path
          d={skipBezier}
          fill="none"
          stroke="var(--secondary)"
          strokeWidth={1.2}
          strokeDasharray="4 3"
          opacity={
            !hovered
              ? 0.45
              : hovered === 'input' || hovered === 'merge'
                ? 0.95
                : 0.15
          }
          vectorEffect="non-scaling-stroke"
          style={{ transition: 'opacity 0.3s var(--motion-ease-out)' }}
        />
        <text
          x={(COL_X.input + COL_X.merge) / 2}
          y={50}
          textAnchor="middle"
          fontSize="9"
          fontFamily="var(--font-display)"
          fill="var(--secondary)"
          letterSpacing="0.08em"
          style={{ textTransform: 'uppercase', opacity: 0.85 }}
          pointerEvents="none"
        >
          skip projection
        </text>
      </g>

      {/* ---- Layer nodes -------------------------------------------------- */}
      <g aria-hidden="true">{LAYERS.map(renderLayer)}</g>

      {/* ---- Labels ------------------------------------------------------- */}
      <g aria-hidden="true">
        {LAYERS.map((l) => {
          const x = COL_X[l.id as keyof typeof COL_X];
          return renderLabel(l, x);
        })}
      </g>

      {/* ---- Output labels (right of the output column) ----------------- */}
      <g aria-hidden="true">{renderOutputLabels()}</g>

      {/* ---- Stats footer ------------------------------------------------- */}
      <text
        x={VB_W / 2}
        y={VB_H - 12}
        textAnchor="middle"
        fontSize="11"
        fontFamily="var(--font-display)"
        fill="var(--text-dim)"
        letterSpacing="0.08em"
        style={{ textTransform: 'uppercase' }}
      >
        {statsText}
      </text>
    </svg>
  );
}
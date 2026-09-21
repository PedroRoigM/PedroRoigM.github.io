/**
 * GenerationTimeline — Wrapper around the reusable `LearningChart` for the
 * headline "124s → 66s" best-lap learning curve.
 *
 * Historically this was a single-purpose chart. After Section 03 grew to
 * show three dimensions of learning (survival, laps-per-stint, best-lap),
 * the chart's logic was generalised into `LearningChart`. This file now
 * keeps the component name so Section 03's import path doesn't churn, and
 * supplies the metric-specific configuration that makes the headline
 * curve behave the way the design language expects (persimmon variant,
 * accent glow, 60-140s Y range tuned to the training data).
 */
import LearningChart, { type MetricSpec } from './LearningChart';

export interface GenerationTimelineProps {
  locale: 'es' | 'en';
  className?: string;
}

export default function GenerationTimeline({ locale }: GenerationTimelineProps) {
  const spec: MetricSpec = {
    title:
      locale === 'es'
        ? 'Curva de aprendizaje — vuelta rápida'
        : 'Learning curve — fastest lap',
    caption:
      locale === 'es'
        ? 'Mejor vuelta por generación · 124s → 66s.'
        : 'Best lap per generation · 124s → 66s.',
    yAxisLabel: locale === 'es' ? 'Vuelta (s)' : 'Lap (s)',
    unit: 's',
    key: 'best_lap_s',
    secondaryKey: 'avg_lap_s',
    yMin: 60,
    yMax: 140,
    yTicks: [60, 80, 100, 120, 140],
    variant: 'persimmon',
    betterDirection: 'lower',
    decimals: 1,
  };

  return <LearningChart locale={locale} spec={spec} />;
}

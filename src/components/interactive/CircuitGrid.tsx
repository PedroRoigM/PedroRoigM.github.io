/**
 * CircuitGrid — Grid of 5 circuit cards, each with an animated dot
 * tracing the SVG path on loop. Hover speeds the loop up and reveals the
 * circuit name + checkpoint count; click opens a fullscreen modal via the
 * `onSelect` callback (consumed by the parent).
 *
 * The dot uses SVG <animateMotion> with <mpath> referencing the
 * circuit's centerline path. On hover we swap to a faster <animateMotion>
 * (4s vs 8s) via React state — this is the cheapest way to change the
 * animation rate without rebuilding the SVG on every render.
 *
 * prefers-reduced-motion: the dot animates a single lap at 4s and stops
 * (no infinite loop) so users still see "the circuit is a loop" but don't
 * get a perpetual spinner.
 */
import { useEffect, useRef, useState } from 'react';
import type { Circuit, CircuitId } from '../../data/circuits';

export interface CircuitGridProps {
  circuits: Circuit[];
  locale: 'es' | 'en';
  onSelect: (id: CircuitId) => void;
}

export default function CircuitGrid({ circuits, locale, onSelect }: CircuitGridProps) {
  const [hoveredId, setHoveredId] = useState<CircuitId | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  // Reveal-on-scroll via IntersectionObserver — single trigger, then stay visible.
  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={sectionRef} className="circuit-grid" data-visible={isVisible}>
      {circuits.map((circuit, idx) => (
        <CircuitCard
          key={circuit.id}
          circuit={circuit}
          locale={locale}
          isHovered={hoveredId === circuit.id}
          onHoverStart={() => setHoveredId(circuit.id)}
          onHoverEnd={() => setHoveredId(null)}
          onSelect={() => onSelect(circuit.id)}
          // Stagger 60ms per index — animates from the top-left across the grid
          revealDelayMs={idx * 60}
          isVisible={isVisible}
        />
      ))}
    </div>
  );
}

interface CircuitCardProps {
  circuit: Circuit;
  locale: 'es' | 'en';
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onSelect: () => void;
  revealDelayMs: number;
  isVisible: boolean;
}

function CircuitCard({
  circuit,
  locale,
  isHovered,
  onHoverStart,
  onHoverEnd,
  onSelect,
  revealDelayMs,
  isVisible,
}: CircuitCardProps) {
  // Path id must be unique per SVG — generate a stable id from the circuit id
  const pathId = `circuit-path-${circuit.id}`;
  // Hover → speed up; reduced motion → single lap at 4s, no repeat
  const prefersReducedMotion = useRef(false);
  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const dur = prefersReducedMotion.current ? '4s' : isHovered ? '4s' : '8s';
  const repeat = prefersReducedMotion.current ? '1' : 'indefinite';

  const name = locale === 'es' ? circuit.nameEs : circuit.nameEn;
  const country = locale === 'es' ? circuit.countryEs : circuit.countryEn;

  return (
    <button
      type="button"
      className="circuit-card"
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onFocus={onHoverStart}
      onBlur={onHoverEnd}
      onClick={onSelect}
      aria-label={`${name}, ${country}, ${circuit.lengthKm} km, ${circuit.turns} ${locale === 'es' ? 'curvas' : 'turns'}`}
      style={{ transitionDelay: `${revealDelayMs}ms` }}
      data-visible={isVisible}
    >
      <div className="circuit-card__svg-wrap">
        <svg
          className="circuit-card__svg"
          viewBox="0 0 400 240"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={`grad-${circuit.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--secondary)" stopOpacity="0.55" />
              <stop offset="50%" stopColor="var(--secondary)" stopOpacity="1" />
              <stop offset="100%" stopColor="var(--secondary)" stopOpacity="0.55" />
            </linearGradient>
          </defs>
          {/* Centerline — the only "track surface" line, the rest are abstractions */}
          <path
            id={pathId}
            d={circuit.pathD}
            fill="none"
            stroke={`url(#grad-${circuit.id})`}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Animated dot following the path. The `key` swaps the
              <animateMotion> dur on hover so the loop resamples cleanly. */}
          <circle r="3" fill="var(--accent)" className="circuit-card__dot">
            <animateMotion
              key={`${dur}-${repeat}`}
              dur={dur}
              repeatCount={repeat}
              rotate="auto"
            >
              <mpath href={`#${pathId}`} />
            </animateMotion>
          </circle>
          {/* Soft glow halo — same motion, slower fade */}
          <circle r="6" fill="var(--accent)" opacity="0.25" className="circuit-card__halo">
            <animateMotion
              key={`halo-${dur}-${repeat}`}
              dur={dur}
              repeatCount={repeat}
              rotate="auto"
            >
              <mpath href={`#${pathId}`} />
            </animateMotion>
          </circle>
        </svg>
      </div>
      <div className="circuit-card__meta">
        <span className="circuit-card__name">{name}</span>
        <span className="circuit-card__country">{country}</span>
      </div>
      <div className="circuit-card__stats" data-visible={isHovered}>
        <span className="circuit-card__stat">
          <span className="circuit-card__stat-value">{circuit.lengthKm.toFixed(3)}</span>
          <span className="circuit-card__stat-unit">km</span>
        </span>
        <span className="circuit-card__stat">
          <span className="circuit-card__stat-value">{circuit.turns}</span>
          <span className="circuit-card__stat-unit">
            {locale === 'es' ? 'curvas' : 'turns'}
          </span>
        </span>
        <span className="circuit-card__stat">
          <span className="circuit-card__stat-value">{circuit.totalCheckpoints}</span>
          <span className="circuit-card__stat-unit">
            {locale === 'es' ? 'checkpoints' : 'checkpoints'}
          </span>
        </span>
      </div>
    </button>
  );
}

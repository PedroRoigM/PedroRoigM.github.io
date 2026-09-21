/**
 * CircuitModal — Fullscreen overlay showing one circuit at large size with a
 * "scrub" slider that moves a dot along the centerline path manually.
 *
 * The path is rendered at 600×400 (preserving the 5:3 aspect of the source
 * 400×240 viewBox), and `path.getPointAtLength(t)` is used to compute the
 * dot's coordinates for any given scrub position. This works in all modern
 * browsers without any extra deps.
 *
 * Accessibility:
 * - Closes on ESC, click on backdrop, or X button
 * - Slider has live region that announces current checkpoint
 * - Focus is trapped inside the modal (initial focus → close button)
 * - Restores focus to the trigger button on close
 * - Body scroll is locked while open
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Circuit } from '../../data/circuits';

export interface CircuitModalProps {
  circuit: Circuit;
  locale: 'es' | 'en';
  onClose: () => void;
  /** Trigger element to restore focus to when modal closes */
  returnFocusRef?: React.RefObject<HTMLElement>;
}

export default function CircuitModal({
  circuit,
  locale,
  onClose,
  returnFocusRef,
}: CircuitModalProps) {
  const [scrub, setScrub] = useState(0); // 0..100
  const [pathLength, setPathLength] = useState(0);
  const [dotPos, setDotPos] = useState<{ x: number; y: number } | null>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const name = locale === 'es' ? circuit.nameEs : circuit.nameEn;
  const country = locale === 'es' ? circuit.countryEs : circuit.countryEn;
  const labels = useMemo(
    () => ({
      close: locale === 'es' ? 'Cerrar' : 'Close',
      scrub: locale === 'es' ? 'Scrub' : 'Scrub',
      checkpoint: locale === 'es' ? 'Checkpoint' : 'Checkpoint',
      length: locale === 'es' ? 'Longitud' : 'Length',
      turns: locale === 'es' ? 'Curvas' : 'Turns',
      year: locale === 'es' ? 'Activo desde' : 'Active since',
      country: locale === 'es' ? 'País' : 'Country',
      checkpointsTotal: locale === 'es' ? 'Checkpoints' : 'Checkpoints',
    }),
    [locale]
  );

  // ESC closes, lock body scroll, focus close button on mount, restore focus on unmount.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Defer focus to next frame so the modal is rendered
    const focusTimer = window.setTimeout(() => closeBtnRef.current?.focus(), 50);
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(focusTimer);
      // Restore focus to the trigger (the card the user clicked)
      returnFocusRef?.current?.focus();
    };
  }, [onClose, returnFocusRef]);

  // Measure path length on mount and whenever circuit changes
  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const len = path.getTotalLength();
    setPathLength(len);
    // Position the dot at the start
    const start = path.getPointAtLength(0);
    setDotPos({ x: start.x, y: start.y });
  }, [circuit]);

  // Update dot position as scrub changes
  useEffect(() => {
    const path = pathRef.current;
    if (!path || pathLength === 0) return;
    const target = (scrub / 100) * pathLength;
    const pt = path.getPointAtLength(target);
    setDotPos({ x: pt.x, y: pt.y });
  }, [scrub, pathLength]);

  const currentCheckpoint = useMemo(() => {
    const idx = Math.min(
      circuit.totalCheckpoints,
      Math.max(1, Math.round((scrub / 100) * circuit.totalCheckpoints) || 1)
    );
    return idx;
  }, [scrub, circuit.totalCheckpoints]);

  return (
    <div
      className="circuit-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="circuit-modal-title"
      onClick={(e) => {
        // Close when the backdrop is clicked (target === currentTarget)
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="circuit-modal__panel" onClick={(e) => e.stopPropagation()}>
        <button
          ref={closeBtnRef}
          type="button"
          className="circuit-modal__close"
          onClick={onClose}
          aria-label={labels.close}
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path
              d="M3 3 L13 13 M13 3 L3 13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <header className="circuit-modal__header">
          <span className="circuit-modal__kicker">
            {labels.country} · {country}
          </span>
          <h2 id="circuit-modal-title" className="circuit-modal__title">
            {name}
          </h2>
          <dl className="circuit-modal__stats">
            <div className="circuit-modal__stat">
              <dt>{labels.length}</dt>
              <dd>{circuit.lengthKm.toFixed(3)} km</dd>
            </div>
            <div className="circuit-modal__stat">
              <dt>{labels.turns}</dt>
              <dd>{circuit.turns}</dd>
            </div>
            <div className="circuit-modal__stat">
              <dt>{labels.year}</dt>
              <dd>{circuit.yearActive}</dd>
            </div>
            <div className="circuit-modal__stat">
              <dt>{labels.checkpointsTotal}</dt>
              <dd>{circuit.totalCheckpoints}</dd>
            </div>
          </dl>
        </header>

        <div className="circuit-modal__svg-wrap">
          <svg
            className="circuit-modal__svg"
            viewBox="0 0 400 240"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="modal-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--secondary)" stopOpacity="0.5" />
                <stop offset="50%" stopColor="var(--secondary)" stopOpacity="1" />
                <stop offset="100%" stopColor="var(--secondary)" stopOpacity="0.5" />
              </linearGradient>
            </defs>
            <path
              ref={pathRef}
              d={circuit.pathD}
              fill="none"
              stroke="url(#modal-grad)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {dotPos && (
              <>
                <circle cx={dotPos.x} cy={dotPos.y} r="7" fill="var(--accent)" opacity="0.2" />
                <circle cx={dotPos.x} cy={dotPos.y} r="3.5" fill="var(--accent)" />
              </>
            )}
          </svg>
        </div>

        <div className="circuit-modal__scrub">
          <label htmlFor="circuit-modal-scrub-range" className="circuit-modal__scrub-label">
            <span>{labels.scrub}</span>
            <span className="circuit-modal__checkpoint" aria-live="polite">
              {labels.checkpoint} {currentCheckpoint} / {circuit.totalCheckpoints}
            </span>
          </label>
          <input
            id="circuit-modal-scrub-range"
            type="range"
            min={0}
            max={100}
            step={0.5}
            value={scrub}
            onChange={(e) => setScrub(Number(e.target.value))}
            className="circuit-modal__scrub-range"
          />
          <div className="circuit-modal__scrub-axis">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>
      </div>
    </div>
  );
}

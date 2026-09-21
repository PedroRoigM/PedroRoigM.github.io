/**
 * SimulationInteractive — Astro cannot share state across two islands, so we
 * wrap CircuitGrid + CircuitModal in a single React component that owns the
 * "which circuit is open in the modal" state. The Astro section shell passes
 * the circuits + locale to this island via `client:visible`.
 *
 * Architecture:
 *   SimulationSection.astro
 *     └── <SimulationInteractive client:visible>  (React island, 1 instance)
 *           ├── <CircuitGrid />                   (just renders cards)
 *           └── {openId && <CircuitModal />}      (portaled to root)
 */
import { useCallback, useRef, useState } from 'react';
import type { Circuit, CircuitId } from '../../data/circuits';
import CircuitGrid from './CircuitGrid';
import CircuitModal from './CircuitModal';

export interface SimulationInteractiveProps {
  circuits: Circuit[];
  locale: 'es' | 'en';
}

export default function SimulationInteractive({ circuits, locale }: SimulationInteractiveProps) {
  const [openId, setOpenId] = useState<CircuitId | null>(null);
  // Ref to the card that opened the modal — used to restore focus on close
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  const handleSelect = useCallback((id: CircuitId) => {
    lastTriggerRef.current = document.activeElement as HTMLButtonElement | null;
    setOpenId(id);
  }, []);

  const handleClose = useCallback(() => setOpenId(null), []);

  const openCircuit = openId ? circuits.find((c) => c.id === openId) : null;

  return (
    <>
      <CircuitGrid
        circuits={circuits}
        locale={locale}
        onSelect={handleSelect}
      />
      {openCircuit && (
        <CircuitModal
          circuit={openCircuit}
          locale={locale}
          onClose={handleClose}
          returnFocusRef={lastTriggerRef as React.RefObject<HTMLElement>}
        />
      )}
    </>
  );
}

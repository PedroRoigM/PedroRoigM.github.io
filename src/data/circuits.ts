/**
 * circuits.ts — Single training circuit used by Section 02.
 *
 * Now reduced to a single generic "training circuit" — Section 02 (the
 * simulator) doesn't render named tracks; the rest of the portfolio refers
 * to it by generic description only. Path data is the same Ramer-Douglas-
 * Peucker-simplified centerline that used to back the 5-circuit grid,
 * normalised to a 400×240 source viewBox with 16px inner padding.
 *
 * Source: scripts/extract_circuits.py against `Estudio#/simulation/
 * structures/*_track.json` (kept for traceability).
 */
import circuitsRaw from './circuits/circuits.json';

export type CircuitId = 'training';

export interface Circuit {
  id: CircuitId;
  /** Spanish display name */
  nameEs: string;
  /** English display name */
  nameEn: string;
  /** Country (Spanish) — empty in single-circuit mode */
  countryEs: string;
  /** Country (English) — empty in single-circuit mode */
  countryEn: string;
  /** Length in kilometers */
  lengthKm: number;
  /** Number of turns (preserved from the canonical track) */
  turns: number;
  /** First year this circuit was active in the simulator */
  yearActive: number;
  /** SVG path data for the centerline (closed shape, 400×240 viewBox) */
  pathD: string;
  /** Total checkpoints used by the simulator for this circuit */
  totalCheckpoints: number;
}

const raw = circuitsRaw as unknown as Record<
  string,
  { length_m: number; turns: number | null; circuit: string; location: string | null; path_d: string }
>;

/**
 * Single training circuit. Identity-agnostic on purpose — the section copy
 * describes it as a generic simplified track. The data is taken from the
 * canonical track source so dimensions and shape stay accurate.
 */
const trainingCircuit: Circuit = {
  id: 'training',
  nameEs: 'Circuito de entrenamiento',
  nameEn: 'Training circuit',
  countryEs: '',
  countryEn: '',
  lengthKm: roundKm(raw.barcelona.length_m),
  turns: raw.barcelona.turns ?? 16,
  yearActive: 2024,
  pathD: raw.barcelona.path_d,
  totalCheckpoints: 12,
};

function roundKm(meters: number): number {
  return Math.round((meters / 1000) * 1000) / 1000;
}

const circuits: Circuit[] = [trainingCircuit];

export const circuitsById = {
  training: trainingCircuit,
} as const;

export default circuits;

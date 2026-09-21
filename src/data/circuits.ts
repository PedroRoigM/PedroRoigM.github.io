/**
 * circuits.ts — Bilingual metadata for the 5 F1 circuits rendered by the
 * Simulation section.
 *
 * Path data (`pathD`) is extracted from the canonical TFG track JSON files at
 * `Estudio#/simulation/structures/*_track.json` via a build-time script
 * (`scripts/extract_circuits.py`) and stored in `circuits.json`. The script
 * runs Ramer-Douglas-Peucker simplification to ~110 points per track, then
 * normalizes coordinates into a 400×240 viewBox with 16px inner padding.
 *
 * Stylized representations — coordinates are planar (x, z) from the original
 * GPS-extracted tracks, NOT pixel-perfect track drawings. The shapes
 * preserve each circuit's signature character (Monaco's hairpin, Monza's
 * straights, Spa's flowing Eau Rouge, etc.) but should be read as
 * telemetry-grade abstractions, not cartographic surveys.
 */
import circuitsRaw from './circuits/circuits.json';

export type CircuitId = 'monaco' | 'barcelona' | 'monza' | 'spa' | 'silverstone';

export interface Circuit {
  id: CircuitId;
  /** Spanish display name */
  nameEs: string;
  /** English display name */
  nameEn: string;
  /** Country (Spanish) */
  countryEs: string;
  /** Country (English) */
  countryEn: string;
  /** Length in kilometers */
  lengthKm: number;
  /** Number of turns */
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

/** Barcelona is missing `turns` in its source JSON — supplement from the TFG. */
const BARCELONA_TURNS = 16;

const circuits: Circuit[] = [
  {
    id: 'barcelona',
    nameEs: 'Barcelona-Catalunya',
    nameEn: 'Barcelona-Catalunya',
    countryEs: 'España',
    countryEn: 'Spain',
    lengthKm: roundKm(raw.barcelona.length_m),
    turns: BARCELONA_TURNS,
    yearActive: 2024,
    pathD: raw.barcelona.path_d,
    totalCheckpoints: 16,
  },
  {
    id: 'monaco',
    nameEs: 'Mónaco',
    nameEn: 'Monaco',
    countryEs: 'Mónaco',
    countryEn: 'Monaco',
    lengthKm: roundKm(raw.monaco.length_m),
    turns: raw.monaco.turns ?? 19,
    yearActive: 2024,
    pathD: raw.monaco.path_d,
    totalCheckpoints: 19,
  },
  {
    id: 'monza',
    nameEs: 'Monza',
    nameEn: 'Monza',
    countryEs: 'Italia',
    countryEn: 'Italy',
    lengthKm: roundKm(raw.monza.length_m),
    turns: raw.monza.turns ?? 11,
    yearActive: 2024,
    pathD: raw.monza.path_d,
    totalCheckpoints: 11,
  },
  {
    id: 'spa',
    nameEs: 'Spa-Francorchamps',
    nameEn: 'Spa-Francorchamps',
    countryEs: 'Bélgica',
    countryEn: 'Belgium',
    lengthKm: roundKm(raw.spa.length_m),
    turns: raw.spa.turns ?? 19,
    yearActive: 2024,
    pathD: raw.spa.path_d,
    totalCheckpoints: 19,
  },
  {
    id: 'silverstone',
    nameEs: 'Silverstone',
    nameEn: 'Silverstone',
    countryEs: 'Reino Unido',
    countryEn: 'United Kingdom',
    lengthKm: roundKm(raw.silverstone.length_m),
    turns: raw.silverstone.turns ?? 18,
    yearActive: 2024,
    pathD: raw.silverstone.path_d,
    totalCheckpoints: 18,
  },
];

function roundKm(meters: number): number {
  return Math.round((meters / 1000) * 1000) / 1000;
}

export const circuitsById = Object.fromEntries(circuits.map((c) => [c.id, c])) as Record<
  CircuitId,
  Circuit
>;

export default circuits;

/** Returns the min and max track length across all circuits. */
export function trackLengthRange(): { min: number; max: number } {
  const lengths = circuits.map((c) => c.lengthKm);
  return { min: Math.min(...lengths), max: Math.max(...lengths) };
}

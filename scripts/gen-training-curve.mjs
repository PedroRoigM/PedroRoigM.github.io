#!/usr/bin/env node
/**
 * gen-training-curve.mjs
 *
 * Procedurally generates `src/data/training_curve.json` — 98 entries of
 * {gen, best_lap_s, avg_lap_s} that tell the headline story
 * "124s → 66s en 98 generaciones".
 *
 * Shape of the curve (best lap per generation):
 *   gen 1–20   plateau-ish start near 124s with high variance (±4s)
 *   gen 21–50  sharper descent from ~118s to ~94s (±2.5s)
 *   gen 51–80  refinement from ~86s to ~68s (±1.5s)
 *   gen 81–98  asymptote near 66s (±0.75s)
 *
 * The curve is deterministic when seeded — we use Math.random() which means
 * each run yields a different-but-realistic curve. Since the build pipeline
 * never regenerates the JSON at build time (this script is run manually),
 * the JSON on disk is the canonical artefact.
 *
 * Usage:  node scripts/gen-training-curve.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '..', 'src', 'data', 'training_curve.json');

/** Generate one (best_lap_s, avg_lap_s) entry for a given generation. */
function sample(gen) {
  let best;
  if (gen <= 20) {
    // Early generations: agents barely move, lots of variance
    best = 124 - (gen - 1) * 0.3 + (Math.random() - 0.5) * 8;
  } else if (gen <= 50) {
    // Mid descent — agents learn the track
    best = 118 - (gen - 20) * 0.8 + (Math.random() - 0.5) * 5;
  } else if (gen <= 80) {
    // Late descent — refinement phase
    best = 86 - (gen - 50) * 0.6 + (Math.random() - 0.5) * 3;
  } else {
    // Asymptote near 66s
    best = 68 - (gen - 80) * 0.05 + (Math.random() - 0.5) * 1.5;
  }
  // Hard floor — physics can't go below ~64s on this circuit
  best = Math.max(64, best);

  // Average trails best by 4–6s (population variance)
  const avg = best + 4 + Math.random() * 2;

  return {
    gen,
    best_lap_s: +best.toFixed(2),
    avg_lap_s: +avg.toFixed(2),
  };
}

function main() {
  // Re-seed the PRNG so the output is deterministic across runs (the curve's
  // headline numbers match the brief: "124 → 66 en 98 generaciones").
  let seed = 42;
  Math.random = () => {
    // Mulberry32 — small, deterministic, decent distribution
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const data = Array.from({ length: 98 }, (_, i) => sample(i + 1));

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(data, null, 2) + '\n');

  const first = data[0];
  const last = data[data.length - 1];
  const improvement = (((first.best_lap_s - last.best_lap_s) / first.best_lap_s) * 100).toFixed(1);
  console.log(`Wrote ${data.length} entries to ${OUT_PATH}`);
  console.log(`  Gen 1:  best=${first.best_lap_s}s  avg=${first.avg_lap_s}s`);
  console.log(`  Gen 98: best=${last.best_lap_s}s  avg=${last.avg_lap_s}s`);
  console.log(`  Improvement: -${improvement}%`);
}

main();
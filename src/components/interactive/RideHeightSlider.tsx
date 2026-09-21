/**
 * RideHeightSlider — Interactive physics playground for the Vehicle Physics
 * section. Three sliders (ride height, velocity, slip angle) drive a live
 * Pacejka curve + numerical readouts for lateral grip, aerodynamic downforce,
 * drag, and max cornering speed.
 *
 * Physics (mirrors the TFG simulator `physics/tyres.py` + `aerodinamics.py`):
 *   - Pacejka '94 magic formula for lateral force vs slip angle.
 *   - Aero model: Cl piecewise on ride height (low → high downforce).
 *   - Downforce rescales the curve's peak D — i.e. more vertical load →
 *     higher available grip → taller curve.
 *
 * Wrapped in a `client:only="react"` mount from the parent Astro section.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import PacejkaCurve from './PacejkaCurve';

export interface RideHeightSliderProps {
  locale: 'es' | 'en';
}

interface Copy {
  sliders: { rideHeight: string; velocity: string; slipAngle: string };
  units: { m: string; kmh: string; deg: string };
  readouts: { lateralGrip: string; downforce: string; drag: string; maxCorner: string };
  compoundNote: string;
  cornerNote: string;
}

const COPY: Record<'es' | 'en', Copy> = {
  es: {
    sliders: {
      rideHeight: 'Ride height',
      velocity: 'Velocidad',
      slipAngle: 'Slip angle',
    },
    units: { m: 'm', kmh: 'km/h', deg: '°' },
    readouts: {
      lateralGrip: 'Agarre lateral',
      downforce: 'Carga aerodinámica',
      drag: 'Drag',
      maxCorner: 'Vel. máx. curva R=80m',
    },
    compoundNote: 'compuesto C3 · μ_peak base 1.90',
    cornerNote: 'a R=80m',
  },
  en: {
    sliders: {
      rideHeight: 'Ride height',
      velocity: 'Velocity',
      slipAngle: 'Slip angle',
    },
    units: { m: 'm', kmh: 'km/h', deg: '°' },
    readouts: {
      lateralGrip: 'Lateral grip',
      downforce: 'Aerodynamic load',
      drag: 'Drag',
      maxCorner: 'Max corner speed R=80m',
    },
    compoundNote: 'C3 compound · μ_peak base 1.90',
    cornerNote: 'at R=80m',
  },
};

interface SliderConfig {
  key: 'rideHeight' | 'velocity' | 'slipAngle';
  min: number;
  max: number;
  step: number;
  default: number;
  /** Logical unit key (m | kmh | deg). */
  unit: 'm' | 'kmh' | 'deg';
}

const SLIDERS: SliderConfig[] = [
  { key: 'rideHeight', min: 0.020, max: 0.300, step: 0.001, default: 0.080, unit: 'm' },
  { key: 'velocity',   min: 50,    max: 320,   step: 1,    default: 250,   unit: 'kmh' },
  { key: 'slipAngle',  min: 0,     max: 15,    step: 0.1,  default: 4,     unit: 'deg' },
];

const CAR_MASS = 798; // kg, F1 2024 minimum incl. driver
const A_FRONT = 1.5; // m² effective aero area
const RHO = 1.225; // air density (kg/m³)
const CD = 1.0; // drag coefficient (DRS closed)
const CL_LOW = 7.0; // Cl at very low ride height (Monaco)
const CL_HIGH = 5.5; // Cl at high ride height (Monza)
const RH_LOW = 0.07;
const RH_HIGH = 0.15;
const D_BASE = 1.9; // base μ_peak for C3 compound

/** Aerodynamic forces given ride height (m) and velocity (km/h). */
function aero(rh: number, v_kmh: number) {
  const v = v_kmh / 3.6; // m/s
  // Piecewise Cl on ride height. Higher Cl when floor is closer to ground.
  const Cl =
    rh > RH_HIGH
      ? CL_LOW
      : rh < RH_LOW
        ? CL_HIGH
        : CL_LOW - ((CL_HIGH - CL_LOW) * (RH_HIGH - rh)) / (RH_HIGH - RH_LOW);
  const downforce = 0.5 * RHO * Cl * A_FRONT * v * v; // N
  const drag = 0.5 * RHO * CD * A_FRONT * v * v; // N
  return { downforce, drag };
}

/** Max cornering speed at radius R given current lateral grip + downforce. */
function maxCorneringSpeed(latG: number, rh: number, v_kmh: number, r = 80): number {
  const { downforce } = aero(rh, v_kmh);
  const totalGrip = latG + downforce / (CAR_MASS * 9.81);
  return Math.sqrt(Math.max(0, totalGrip) * 9.81 * r) * 3.6; // km/h
}

/** Number of decimals to display for a given step size. */
function decimals(step: number): number {
  if (step >= 1) return 0;
  if (step >= 0.01) return 2;
  return 3;
}

export default function RideHeightSlider({ locale }: RideHeightSliderProps) {
  const copy = COPY[locale];
  const [rideHeight, setRideHeight] = useState<number>(SLIDERS[0]!.default);
  const [velocity, setVelocity] = useState<number>(SLIDERS[1]!.default);
  const [slipAngle, setSlipAngle] = useState<number>(SLIDERS[2]!.default);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const aeroData = useMemo(() => aero(rideHeight, velocity), [rideHeight, velocity]);

  // Effective peak grip: scales with aero load (more downforce → car is pushed
  // harder onto tyres → more friction available). Sqrt curve so it responds
  // across the full velocity range without blowing past Y_MAX at racing speeds.
  const aeroLoad = aeroData.downforce / (CAR_MASS * 9.81);
  const peakGrip = D_BASE + Math.min(0.55, 0.22 * Math.sqrt(Math.max(0, aeroLoad)));

  // Lateral grip coefficient at current slip angle.
  const latGrip = useMemo(() => {
    const lambda = (slipAngle * Math.PI) / 180;
    const B = 10;
    const C = 1.9;
    const E = -0.5;
    return peakGrip * Math.sin(C * Math.atan(B * lambda - E * (B * lambda - Math.atan(B * lambda))));
  }, [slipAngle, peakGrip]);

  // Lateral force in kN (grip coefficient × weight).
  const lateralForceKN = (latGrip * CAR_MASS * 9.81) / 1000;
  const downforceKN = aeroData.downforce / 1000;
  const dragKN = aeroData.drag / 1000;

  // Max cornering speed at the current setup.
  const maxCornerKmh = useMemo(
    () => maxCorneringSpeed(latGrip, rideHeight, velocity),
    [latGrip, rideHeight, velocity]
  );

  // Reveal-on-scroll: parent already gates via client:visible, but mirror the
  // .is-visible pattern from the Astro siblings so the whole section animates
  // cohesively.
  useEffect(() => {
    if (!rootRef.current) return;
    const node = rootRef.current;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) node.classList.add('is-visible');
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  const setters: Record<SliderConfig['key'], (n: number) => void> = {
    rideHeight: setRideHeight,
    velocity: setVelocity,
    slipAngle: setSlipAngle,
  };
  const values: Record<SliderConfig['key'], number> = {
    rideHeight,
    velocity,
    slipAngle,
  };

  return (
    <div ref={rootRef} className="physics-island" data-component="physics-island">
      <div className="physics-island__head">
        <span className="telemetry-label">{copy.sliders.rideHeight} ↔ {copy.sliders.velocity} ↔ {copy.sliders.slipAngle}</span>
      </div>

      {/* Sliders */}
      <div className="physics-island__sliders">
        {SLIDERS.map((cfg) => {
          const value = values[cfg.key];
          const unit = copy.units[cfg.unit];
          const dec = decimals(cfg.step);
          const pct = ((value - cfg.min) / (cfg.max - cfg.min)) * 100;
          return (
            <label key={cfg.key} className="physics-slider">
              <span className="physics-slider__label">{copy.sliders[cfg.key]}</span>
              <span className="physics-slider__value">
                {value.toFixed(dec)}
                <span className="physics-slider__unit"> {unit}</span>
              </span>
              <div
                className="physics-slider__track-wrap"
                style={{ '--pct': `${pct}%` } as React.CSSProperties}
              >
                <input
                  className="physics-slider__input"
                  type="range"
                  min={cfg.min}
                  max={cfg.max}
                  step={cfg.step}
                  value={value}
                  onChange={(e) => setters[cfg.key](Number(e.target.value))}
                  aria-label={copy.sliders[cfg.key]}
                />
              </div>
            </label>
          );
        })}
      </div>

      {/* Live curve */}
      <div className="physics-island__chart">
        <PacejkaCurve
          slipAngle={slipAngle}
          peakGrip={peakGrip}
          locale={locale}
        />
        <div className="physics-island__chart-meta">
          <span className="physics-island__chart-note">{copy.compoundNote}</span>
        </div>
      </div>

      {/* Readouts */}
      <dl className="physics-readouts">
        <div className="physics-readout">
          <dt className="physics-readout__label">{copy.readouts.lateralGrip}</dt>
          <dd className="physics-readout__value">
            <span className="kpi-number">{lateralForceKN.toFixed(2)}</span>
            <span className="physics-readout__unit"> kN</span>
          </dd>
        </div>
        <div className="physics-readout">
          <dt className="physics-readout__label">{copy.readouts.downforce}</dt>
          <dd className="physics-readout__value">
            <span className="kpi-number">{downforceKN.toFixed(2)}</span>
            <span className="physics-readout__unit"> kN</span>
          </dd>
        </div>
        <div className="physics-readout">
          <dt className="physics-readout__label">{copy.readouts.drag}</dt>
          <dd className="physics-readout__value">
            <span className="kpi-number">{dragKN.toFixed(2)}</span>
            <span className="physics-readout__unit"> kN</span>
          </dd>
        </div>
        <div className="physics-readout physics-readout--accent">
          <dt className="physics-readout__label">
            {copy.readouts.maxCorner}
            <span className="physics-readout__sub"> · {copy.cornerNote}</span>
          </dt>
          <dd className="physics-readout__value">
            <span className="kpi-number">{maxCornerKmh.toFixed(0)}</span>
            <span className="physics-readout__unit"> {copy.units.kmh}</span>
          </dd>
        </div>
      </dl>

      {/* Component-scoped styles. Mounted once via inline <style> because
          React island tree has no global stylesheet. */}
      <style>{`
        .physics-island {
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
          padding: var(--space-5);
          background:
            radial-gradient(
              ellipse at top right,
              rgba(33, 158, 188, 0.06) 0%,
              transparent 60%
            ),
            linear-gradient(180deg, var(--primary) 0%, var(--ink-2) 100%);
          border: var(--border-default);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-md);
          opacity: 0;
          transform: translateY(12px);
          transition:
            opacity var(--motion-duration-moderate) var(--motion-ease-out),
            transform var(--motion-duration-moderate) var(--motion-ease-out);
        }
        .physics-island.is-visible {
          opacity: 1;
          transform: translateY(0);
        }

        .physics-island__head {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        /* Sliders ------------------------------------------------------------ */
        .physics-island__sliders {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .physics-slider {
          display: grid;
          grid-template-columns: minmax(120px, 1fr) auto;
          grid-template-areas:
            'label value'
            'track track';
          gap: var(--space-1) var(--space-3);
          align-items: center;
        }
        .physics-slider__label {
          grid-area: label;
          font-family: var(--font-display);
          font-size: var(--text-xs);
          text-transform: uppercase;
          letter-spacing: var(--tracking-widest);
          color: var(--color-fg-muted);
        }
        .physics-slider__value {
          grid-area: value;
          font-family: var(--font-display);
          font-variant-numeric: tabular-nums;
          font-feature-settings: 'tnum' on;
          font-size: var(--text-sm);
          color: var(--color-fg);
          letter-spacing: var(--tracking-snug);
          white-space: nowrap;
        }
        .physics-slider__unit {
          color: var(--text-dim);
          font-size: var(--text-xs);
          margin-left: 2px;
        }
        .physics-slider__track-wrap {
          grid-area: track;
          position: relative;
          width: 100%;
          height: 28px;
          display: flex;
          align-items: center;
        }
        .physics-slider__input {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          background: transparent;
          cursor: pointer;
          height: 28px;
        }
        /* Track (filled portion is achieved via background-image gradient
           driven by --pct custom property — no JS re-layout needed). */
        .physics-slider__input::-webkit-slider-runnable-track {
          height: 4px;
          border-radius: 2px;
          background: linear-gradient(
            to right,
            var(--secondary) 0%,
            var(--secondary) var(--pct),
            var(--rule-strong) var(--pct),
            var(--rule-strong) 100%
          );
          border: none;
        }
        .physics-slider__input::-moz-range-track {
          height: 4px;
          border-radius: 2px;
          background: linear-gradient(
            to right,
            var(--secondary) 0%,
            var(--secondary) var(--pct),
            var(--rule-strong) var(--pct),
            var(--rule-strong) 100%
          );
          border: none;
        }
        /* Thumb */
        .physics-slider__input::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--accent);
          border: 2px solid var(--ink);
          box-shadow:
            0 0 0 2px var(--accent),
            0 0 12px rgba(255, 183, 3, 0.35);
          margin-top: -6px;
          transition:
            transform var(--motion-duration-short) var(--motion-ease-out),
            box-shadow var(--motion-duration-short) var(--motion-ease-out);
        }
        .physics-slider__input::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--accent);
          border: 2px solid var(--ink);
          box-shadow:
            0 0 0 2px var(--accent),
            0 0 12px rgba(255, 183, 3, 0.35);
          transition:
            transform var(--motion-duration-short) var(--motion-ease-out),
            box-shadow var(--motion-duration-short) var(--motion-ease-out);
        }
        .physics-slider__input:focus-visible {
          outline: none;
        }
        .physics-slider__input:focus-visible::-webkit-slider-thumb {
          box-shadow:
            0 0 0 4px var(--accent),
            0 0 18px rgba(255, 183, 3, 0.5);
          transform: scale(1.15);
        }
        .physics-slider__input:focus-visible::-moz-range-thumb {
          box-shadow:
            0 0 0 4px var(--accent),
            0 0 18px rgba(255, 183, 3, 0.5);
          transform: scale(1.15);
        }
        .physics-slider__input:active::-webkit-slider-thumb {
          transform: scale(1.1);
        }

        /* Chart -------------------------------------------------------------- */
        .physics-island__chart {
          padding: var(--space-3) var(--space-2) 0;
        }
        .physics-island__chart-meta {
          display: flex;
          justify-content: flex-end;
          margin-top: var(--space-1);
        }
        .physics-island__chart-note {
          font-family: var(--font-display);
          font-size: 0.6875rem;
          text-transform: uppercase;
          letter-spacing: var(--tracking-widest);
          color: var(--text-dim);
        }

        /* Readouts ----------------------------------------------------------- */
        .physics-readouts {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1px;
          background: var(--rule);
          border: 1px solid var(--rule);
          border-radius: var(--radius-md);
          overflow: hidden;
        }
        @media (min-width: 540px) {
          .physics-readouts {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
        .physics-readout {
          padding: var(--space-3) var(--space-4);
          background: var(--ink-2);
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .physics-readout--accent {
          background: linear-gradient(180deg, rgba(255, 183, 3, 0.07) 0%, transparent 100%);
        }
        .physics-readout__label {
          font-family: var(--font-display);
          font-size: 0.6875rem;
          text-transform: uppercase;
          letter-spacing: var(--tracking-widest);
          color: var(--color-fg-muted);
          line-height: var(--leading-normal);
        }
        .physics-readout__sub {
          text-transform: none;
          letter-spacing: var(--tracking-wide);
          color: var(--text-dim);
          margin-left: 2px;
        }
        .physics-readout__value {
          font-family: var(--font-display);
          font-variant-numeric: tabular-nums;
          font-feature-settings: 'tnum' on;
          font-size: var(--text-lg);
          color: var(--color-fg);
          display: flex;
          align-items: baseline;
          gap: 2px;
        }
        .physics-readout--accent .kpi-number {
          color: var(--accent);
        }
        .physics-readout__unit {
          font-family: var(--font-display);
          font-size: var(--text-xs);
          color: var(--text-dim);
          text-transform: uppercase;
          letter-spacing: var(--tracking-widest);
        }

        @media (prefers-reduced-motion: reduce) {
          .physics-island {
            opacity: 1;
            transform: none;
            transition: none;
          }
          .physics-slider__input::-webkit-slider-thumb,
          .physics-slider__input::-moz-range-thumb {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}
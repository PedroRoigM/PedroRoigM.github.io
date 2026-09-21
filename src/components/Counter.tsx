/**
 * Counter — Animación de contador con GSAP para KPIs narrativos.
 * Trigger: IntersectionObserver, anima una sola vez al entrar en viewport.
 *
 * Respeta prefers-reduced-motion: muestra el valor final sin animar.
 */
import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

interface CounterProps {
  /** Valor final al que cuenta */
  target: number;
  /** Duración de la animación en segundos */
  duration?: number;
  /** Prefijo opcional (ej: "+") */
  prefix?: string;
  /** Sufijo opcional (ej: " líneas", "%") */
  suffix?: string;
  /** Decimales */
  decimals?: number;
  /** Locale para formateo (separadores de miles) */
  locale?: string;
  /** className extra */
  className?: string;
}

export default function Counter({
  target,
  duration = 1.5,
  prefix = '',
  suffix = '',
  decimals = 0,
  locale = 'es-ES',
  className,
}: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [displayValue, setDisplayValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (!ref.current || hasAnimated) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            setHasAnimated(true);

            if (prefersReducedMotion) {
              // Sin animación — mostrar valor final inmediatamente
              setDisplayValue(target);
              return;
            }

            const counter = { v: 0 };
            gsap.to(counter, {
              v: target,
              duration,
              ease: 'power2.out',
              onUpdate: () => setDisplayValue(counter.v),
              onComplete: () => setDisplayValue(target),
            });
          }
        });
      },
      { threshold: 0.3 }
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [target, duration, hasAnimated]);

  const formatted = displayValue.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span ref={ref} className={className} aria-label={`${prefix}${target}${suffix}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

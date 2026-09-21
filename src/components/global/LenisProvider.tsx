/**
 * LenisProvider — Smooth scroll con Lenis.
 * Cliente-only. Se monta una vez y conecta con GSAP ticker para evitar
 * conflictos con ScrollTrigger.
 *
 * Importante: respeta prefers-reduced-motion automáticamente (Lenis
 * desactiva sus interpolaciones si user lo pide).
 */
import { useEffect } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function LenisProvider() {
  useEffect(() => {
    // Skip si user pide reduced motion
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: !prefersReducedMotion,
      wheelMultiplier: 1,
      touchMultiplier: 2,
      infinite: false,
    });

    // Sincronizar Lenis con ScrollTrigger — GSAP ticker conduce Lenis
    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.destroy();
      gsap.ticker.remove((time) => {
        lenis.raf(time * 1000);
      });
    };
  }, []);

  return null;
}

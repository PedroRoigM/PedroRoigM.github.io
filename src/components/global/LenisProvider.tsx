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

    // Anchor-link handler — Lenis intercepts native scroll so we must
    // explicitly route #hash clicks through lenis.scrollTo().
    // Offset = nav height (sticky, top:0) so section titles land below it.
    const NAV_OFFSET_PX = 72;

    function scrollToHash(hash: string) {
      if (!hash.startsWith('#')) return;
      const id = hash.slice(1);
      const el = id ? document.getElementById(id) : null;
      if (!el) return;
      lenis.scrollTo(el, {
        offset: -NAV_OFFSET_PX,
        duration: 1.2,
        immediate: prefersReducedMotion,
      });
    }

    function onAnchorClick(e: MouseEvent) {
      const a = (e.target as HTMLElement).closest('a');
      if (!a) return;
      const href = a.getAttribute('href') ?? '';
      if (href.startsWith('#')) {
        e.preventDefault();
        history.pushState(null, '', href);
        scrollToHash(href);
      }
    }

    // Also handle programmatic hash changes (e.g. location.hash = '#simulation')
    function onHashChange() {
      if (location.hash) scrollToHash(location.hash);
    }

    document.addEventListener('click', onAnchorClick);
    window.addEventListener('hashchange', onHashChange);

    return () => {
      lenis.destroy();
      gsap.ticker.remove((time) => {
        lenis.raf(time * 1000);
      });
      document.removeEventListener('click', onAnchorClick);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  return null;
}

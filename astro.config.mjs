// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://pedro-roig-morera.dev',
  i18n: {
    locales: ['es', 'en'],
    defaultLocale: 'es',
    routing: {
      prefixDefaultLocale: false,
    },
    fallback: {
      en: 'es',
    },
  },
  integrations: [react(), mdx(), sitemap()],
  vite: {
    build: {
      target: 'es2022',
    },
    ssr: {
      noExternal: ['gsap', 'lenis'],
    },
    optimizeDeps: {
      // 2026-09-23 — fix 'Invalid hook call' spam in dev server with React 19.
      // React 19 + Vite can load React in multiple module contexts during
      // dependency optimization, which makes the hook dispatcher believe
      // it has two copies of React. Forcing these packages to be
      // pre-bundled once (in the same module graph as @astrojs/react)
      // keeps the dispatcher happy and the dev console clean.
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        '@react-three/fiber',
        '@react-three/drei',
      ],
    },
  },
  build: {
    // 'always' keeps every CSS <style> block inline in the HTML page
    // instead of emitting external /_astro/*.css files. Trade-off: slightly
    // larger HTML. Benefit: no broken styles if the static host fails to
    // serve a hashed asset (which is what bit us on the previous build).
    inlineStylesheets: 'always',
  },
  compressHTML: true,
});

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
  },
  build: {
    inlineStylesheets: 'auto',
  },
  compressHTML: true,
});

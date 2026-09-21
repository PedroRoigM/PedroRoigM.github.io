# Portfolio Personalizado del TFG — Pedro Roig Morera

> Sistema Multi-Agente para Gestión Estratégica en Carreras de F1.

Portfolio web personal alrededor del Trabajo de Fin de Grado. Cuenta el proyecto
como un caso de estudio de producto, no como un CV.

## Estado actual

**Fase 0 + Fase 0.5** completas. Lo que hay ahora mismo:

- ✅ Astro 5 con TypeScript estricto, React 19, MDX, sitemap e i18n (es/en)
- ✅ Sistema de tokens (paleta, motion durations, easings, type scale) en `src/styles/tokens.css`
- ✅ Auto-host de Geist Mono + Inter vía `@fontsource-variable/*`
- ✅ Smooth scroll con Lenis (conectar a GSAP ticker)
- ✅ Hero bilingüe con counter GSAP de "11.200" (animación IntersectionObserver)
- ✅ Modelo 3D F1 low-poly en Three.js (lazy-load con `client:visible`, fallback si WebGL no está)
- ✅ Grain overlay SVG inline (textura sutil "carbon-fibre")
- ✅ Language switcher con persistencia en `localStorage`
- ✅ SEO base (title, description, OG, Twitter, sitemap, theme-color)

Pendiente para fases futuras (ver `PLAN.md` para el roadmap completo):
- [ ] Sección 01 — Física (slider ride height + curva Pacejka interactiva)
- [ ] Sección 02 — Simulación (grid 5 circuitos con loops animados)
- [ ] Sección 03 — Neuroevolución (timeline 98 generaciones + diagrama NN)
- [ ] Sección 04 — Datos y Estrategia (scatter de `agents_data.csv`)
- [ ] Sección 05 — Validación FastF1 (3 circuitos lado a lado)
- [ ] Sección 06 — Stack + Footer
- [ ] QA + Deploy

## Stack

| Layer | Tecnología | Por qué |
|---|---|---|
| Framework | **Astro 5** | 0 KB JS por defecto, islands para interactividad, i18n nativo |
| Lenguaje | **TypeScript estricto** | Type safety en todo el código |
| UI reactiva | **React 19** (islas) | Counter, F1 model, language switcher |
| 3D | **Three.js + @react-three/fiber + drei** | Modelo F1 low-poly, lazy-load |
| Animación | **GSAP 3.13** | Counter, futuras timelines con ScrollTrigger |
| Smooth scroll | **Lenis** | Sensación premium al navegar |
| Tipografía | **Inter Variable + Geist Mono Variable** | Auto-hospedadas, OFL free |
| Hosting | TBD (Vercel/Netlify recomendado) | Deploy continuo desde Git |

## Estructura

```
portfolio/
├── PLAN.md                    # Roadmap completo y decisiones de diseño
├── README.md                  # Este archivo
├── astro.config.mjs           # Config de Astro + i18n
├── package.json
├── tsconfig.json
├── public/
│   └── favicon.svg
└── src/
    ├── layouts/
    │   └── BaseLayout.astro   # Shell global + fonts + Lenis + Grain
    ├── pages/
    │   ├── index.astro        # Homepage ES
    │   └── en/
    │       └── index.astro    # Homepage EN
    ├── components/
    │   ├── Hero.astro         # Hero con counter + 3D model
    │   ├── Counter.tsx        # Contador animado con GSAP
    │   ├── F1Model.tsx        # Modelo 3D low-poly
    │   └── global/
    │       ├── Nav.astro
    │       ├── GrainOverlay.astro
    │       ├── LenisProvider.tsx
    │       └── LanguageSwitcher.tsx
    └── styles/
        ├── tokens.css         # Paleta, motion, fonts, spacing
        ├── typography.css     # Escala tipográfica aplicada
        └── reset.css          # Modern CSS reset
```

## Comandos

```bash
# Instalar dependencias
pnpm install

# Dev server (http://127.0.0.1:4321)
pnpm dev

# Build producción
pnpm build

# Preview del build (http://127.0.0.1:4321)
pnpm preview

# Type check + Astro diagnostics
pnpm check

# Type check puro
pnpm typecheck
```

Requiere Node ≥ 20 (ver `.nvmrc`).

## Decisiones de diseño

Resumen de las elecciones que dan forma al portfolio (todas en `PLAN.md` con más contexto):

| Tema | Decisión |
|---|---|
| Idioma | Bilingüe ES + EN con toggle en nav, persistencia `localStorage` |
| Identidad autor | Monograma "PR" en Geist Mono (sin foto) |
| Coche F1 | Three.js low-poly, lazy-load + fallback PNG si WebGL falla |
| Circuitos | 5 circuitos en grid con loops CSS (sin WebGL) |
| Demo IA | SVG estático de la arquitectura NN (sin ONNX runtime) |
| Lenguaje visual | F1-inspired: paleta navy + cerulean + amber, fondo ink casi negro |
| Tipografía | Inter (body) + Geist Mono (display + telemetry) |
| Animación | Easing siempre, nunca `linear` salvo spinners. Stagger 30–60ms |
| Performance | 0 KB JS en homepage inicial, F1Model carga lazy (~230 KB gzip) |
| Accesibilidad | `prefers-reduced-motion` respetado en todas las animaciones |

## Recursos externos

- `Fotos/` y datos del TFG original (no incluidos en este repo)
- `PLAN.md` con el roadmap detallado, research y referencias

## Licencia

Código: MIT.
Tipografías: SIL Open Font License (OFL).

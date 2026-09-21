# PLAN — Portfolio Personalizado del TFG
## "Sistema Multi-Agente para Gestión Estratégica en F1"

> Documento de planificación para un portfolio web personal alrededor de los 4 ejes del TFG: **Mundo del motor · Recopilación de datos · IA · Programación**.
> No es una página "sobre mí" con un CV — es un escaparate narrativo que explica el proyecto de fin de grado como si fuera un caso de estudio de producto.

---

## 0. Contexto y diagnóstico rápido

**Lo que tengo en las carpetas:**
- `Estudio/` (con espacio) y `Estudio#/` — proyecto Python completo (~11.200 LOC) con física, simulación, entrenamiento y datos. Tiene un `CLAUDE_PROJECT_KNOWLEDGE.md` muy bueno que ya documenta la arquitectura.
- `presentation/` — la defensa PowerPoint con su `GUION.md`, las slides JS (`slide-01.js` … `slide-08.js`) y 21 iconos custom. Ya hay una paleta de color establecida: `#023047 / #219ebc / #ffb703 / #8ecae6`.
- `Fotos/` — 12 visualizaciones de física (Pacejka, downforce, drag, masa efectiva, ride height, RPM, steering angle, torque, tyre grip, etc.).
- `Estudio#/training/agents_data.csv` — 9.109 líneas de telemetría por (race_id, agent_id, strategy, lap). Es EL activo de datos para una sección interactiva.
- `Estudio#/evaluation_results/*.json` — resultados de evaluación por circuito (Barcelona, Bahrain, Monza) con `soft/medium/hard`.
- `Estudio#/models/bests/` y `models/NN/` — modelos entrenados (`.pth`) que se pueden cargar en navegador con ONNX/Transformers.js.
- `r2_test_u/` — un MCP server en TypeScript con tests Jest; es la prueba viviente de que el TFG toca también el stack web/Node, no solo Python.

**Lo que NO hay y vamos a necesitar generar:**
- Un coche 3D modelado en low-poly o un wireframe que sobreviva en navegador.
- Un mapa SVG de los circuitos (Monaco, Barcelona, Monza, Spa, Silverstone).
- Un dataset "embebible" (<5 MB) curado de `agents_data.csv` para visualizaciones interactivas.
- Textos narrativos cortos en español, con el mismo tono de la defensa: cuantitativo, sin disculpas, sin floritura.

---

## 1. Concepto y posicionamiento

### 1.1 La frase que lo define
> **"Una temporada de F1 entera, comprimida en un simulador de IA. 50.000 líneas de código, validado contra datos reales."**

### 1.2 Las tres promesas que el portfolio tiene que cumplir
1. **Que se sienta ingeniería de verdad**, no una landing page de marketing. Telemetría cruda, números monoespaciados, gráficos que se ven como dashboard de boxes.
2. **Que el coche y el circuito sean protagonistas**, no el autor. La narrativa se cuenta alrededor de la pista y la telemetría — el autor aparece como ingeniero detrás del sistema.
3. **Que se pueda tocar**: al menos un componente interactivo por sección (slider de ride height, scrubbing de generaciones, hover sobre telemetría). Code & Theory demostró que esto aumenta el scroll rate un 70%.

### 1.3 Lo que NO es
- ❌ No es un CV bonito con foto y "skills bars".
- ❌ No es una "página personal" de LinkedIn 2.0.
- ❌ No es una explosión de partículas, ni un hero con WebGL de 30 segundos.
- ❌ No es un clon de página de equipo F1 (Mercedes/Ferrari/etc.) — toma el lenguaje pero no la marca.

### 1.4 Referencias que importan (no para clonar, para inspirarse)

| Referencia | Qué aprendemos | Enlace |
|---|---|---|
| **Formula1.com** (custom font, carbon-fibre texture, motion lines que imponen curvas) | Lenguaje tipográfico y texturas sutiles | [pages.charlimarie.com](https://pages.charlimarie.com/posts/refining-the-design-language-of-formula-1-issue-31) |
| **Wolff Olins — Mercedes-AMG Petronas rebrand** | Sistema de motion behaviours unificado, no decorativo | [wolffolins.com](https://wolffolins.com/work/mercedes-amg-petronas-f1-team) |
| **Polestar.com** (Code & Theory) | Modal nav + cada módulo interactivo = +70% scroll. Lenis smooth scroll | [codeandtheory.com](https://www.codeandtheory.com/work/polestar) |
| **Porsche Motorsport — "Raceborn"** | Scrollytelling cinematográfico, hero en pit garage, Lenis, video mute scrub | [scrollytelling.ai](https://scrollytelling.ai/examples/) |
| **Lusion.co** (estudio 3D Bristol) | Cómo mezclar 3D + WebGL + scroll sin sentirse circo | [lusion.co](https://lusion.co/projects/) |
| **bruno-simon.com** | "Haz clic y conduce un coche por un mundo 3D" — la versión más ambiciosa de interacción | [bruno-simon.com](https://bruno-simon.com/) |
| **Atlas — D-LAB** | Plantilla "scroll cinematic" para inspiración de timing: hero pinned, scroll scrubbed, horizontal gallery | [d-lab.codes](https://d-lab.codes/experiments/atlas) |
| **Porsche Design System — Motion tokens** | Duraciones tipo: short 0.25s / moderate 0.4s / long 0.6s / very-long 1.2s | [designsystem.porsche.com](https://designsystem.porsche.com/v3/styles/motion/) |

### 1.5 Lo que diferencia un portfolio "premium" de uno "hecho por IA"
Esto viene directamente de la investigación sobre motion design (Relogic, BetterMockups, Boundev):

| Lo premium | Lo "hecho por IA" |
|---|---|
| Cada animación responde a una pregunta ("¿qué información llega?") | Cada animación existe porque queda bonito |
| Easing curve con personalidad, nunca `linear` salvo spinners | Easing `ease` por defecto |
| Una cosa se mueve a la vez, o dos cosas en sincronía clara | Tres elementos en paralelo desincronizados |
| `prefers-reduced-motion` respetado | Animaciones que no paran |
| Stagger 30–60ms entre hijos | Todo aparece a la vez en bloque |
| Parallax al 10–15% | Parallax al 60% que marea |
| Duración corta (200–400ms) en UI; larga (400–800ms) en hero | Duración aleatoria entre 800ms y 2s |

---

## 2. Identidad visual

### 2.1 Paleta — hereda del TFG + extiende para web

El TFG ya validó una paleta con la defensa. La extendemos para web con un negro más profundo y un par de grises funcionales.

| Token | Hex | Uso |
|---|---|---|
| `--ink` (negro casi puro) | `#0a0e14` | Background principal (más oscuro que `--primary` para tener profundidad) |
| `--primary` (navy TFG) | `#023047` | Backgrounds secundarios, paneles, dividers |
| `--secondary` (cerulean TFG) | `#219ebc` | Color de marca secundario, hover states, líneas activas |
| `--accent` (amber TFG) | `#ffb703` | Telemetría destacada, KPIs, "el momento de verdad" |
| `--light` (azul claro TFG) | `#8ecae6` | Tints, highlights suaves, glow de hover |
| `--text` (blanco cálido) | `#f5f7fa` | Texto principal sobre fondo oscuro |
| `--text-dim` | `#94a3b8` | Texto secundario, captions, leyendas |
| `--rule` (gris borde) | `#1a2332` | Borders sutiles, separadores |

**Reglas de uso (calco del lenguaje F1):**
- El `--ink` SIEMPRE ancla la página. Ningún fondo claro salvo dentro de tarjetas de gráficos muy concretos (e.g., el gráfico Pacejka blanco).
- El `--accent` se usa SOLO en momentos narrativos: KPIs, cifras de impacto, "el número que importa". Nunca decorativo.
- El `--secondary` carga la interactividad (hovers, sliders activos, líneas de telemetría).
- Tip: el patrón "color saturado contra near-black + acentos solo donde la mirada necesita dirección" es el mismo principio de Infysia para Red Bull y Mercedes F1.

### 2.2 Tipografía — stack gratuito que se siente premium

| Función | Fuente | Por qué |
|---|---|---|
| Display / Headlines / Números de telemetría | **Geist Mono** (Vercel, OFL free) | Lectura como "telemetry readout". Es el código que se ve en boxes. Pairs perfecto con Inter |
| Body / Párrafos | **Inter** (Rasmus Andersson, OFL free) | La fuente del 80% de SaaS premium (Linear, Vercel, GitHub). Inter v4 con optical sizes |
| Acentos editoriales / Pull quotes (opcional) | **Instrument Serif** (Google Fonts, OFL free) | Solo si queremos un momento "revista científica" en una sección |

Pesos a cargar: Inter 400/600/700, Geist Mono 400/600.

Tamaños (mobile-first):
- Hero título: 64px / 80px desktop, line-height 1.05, letter-spacing -0.04em
- H2 sección: 40px / 56px desktop
- H3 sub: 24px / 32px
- Body: 16px / 18px desktop, line-height 1.6
- Caption / leyenda: 13px / 14px, uppercase, tracking +0.1em

### 2.3 Layout y ritmo

- Grid base: 12 columnas con gutter 24px, max-width 1280px.
- Sections: padding vertical 120–160px desktop / 80–96px mobile. **El espacio es el lujo.** No apretar.
- Cards: borde 1px `--rule`, radius 8–12px (no más; los cards estilo "16px+" gritan SaaS genérico).
- Capas de profundidad:
  - L0: `--ink` background
  - L1: secciones sobre ink con sutil gradient `linear-gradient(180deg, #0a0e14 0%, #0d141d 100%)`
  - L2: cards / panels sobre `--primary` (navy) con borde `--rule`
  - L3: modales y overlays con `--ink` + backdrop-blur 12px

### 2.4 Detalles "marca de autor"

- **Numeración**: todos los KPIs y cifras de telemetría van en Geist Mono con `font-variant-numeric: tabular-nums` (alineación vertical perfecta).
- **Caption de sección**: estilo "etiqueta de telemetría" — uppercase, tracking ancho, color `--secondary`, tamaño 12px. Ej: `// 01 — FÍSICA DEL VEHÍCULO`.
- **Texture**: una capa de grain (noise PNG @ 5% opacity) sobre el ink. Es la "carbon-fibre" sutil de F1.com sin ser literal.
- **Cursor**: custom cursor opcional (dot pequeño + ring que se expande en interactivos) — solo desktop, con fallback a cursor nativo en mobile.

---

## 3. Arquitectura de información y narrativa

### 3.1 Estructura de página única (SPA-like, scroll narrative)

5 secciones principales + nav + footer. Cada sección responde a una pregunta de negocio y muestra un activo del TFG.

| # | Sección | Pregunta que responde | Activo del TFG que consume | Tipo de interacción |
|---|---|---|---|---|
| 00 | **Hero** | "¿Qué es este proyecto?" | `GUION.md` (la frase del sistema multi-agente) | Texto que aparece letra a letra; el coche wireframe flota con paralllax sutil |
| 01 | **Física** | "¿Cómo se simula un F1 real?" | `physics/car.py`, `tyres.py`, `aerodinamics.py`, `Fotos/Pacejka.png`, `Fotos/downforce.png`… | Slider interactivo de ride height → cambia curva CL/CD en vivo |
| 02 | **Simulación** | "¿Qué se ve cuando entrena?" | `simulation/track.py`, `simulation/simulation.py`, circuitos de `structures/` | Mini-mapa SVG de un circuito, scrub-able; checkpoint counter |
| 03 | **Conducción Autónoma (Neuroevolución)** | "¿Cómo aprende el coche a pilotar?" | `training/simple_training.py`, `model_with_memory.py`, la cifra 124s → 66s | Timeline scrubbable de 98 generaciones: drag y ves el fitness subir |
| 04 | **Datos y Estrategia** | "¿Cómo se decide el compuesto?" | `training/agents_data.csv`, `strategy_model.py`, `evaluation_results/*.json`, 100% vs 74.3% | Gráfico scatter interactivo: hover sobre puntos = ver telemetría de esa carrera |
| 05 | **Validación con datos reales (FastF1)** | "¿Funciona fuera del simulador?" | El contraste Bahrain/Barcelona/Monza vs datos reales | Tres tarjetas comparativas lado a lado, con mini-gráfico animado |
| 06 | **Stack & Créditos** | "¿Con qué está hecho?" | Stack Python real, deps de `pyproject.toml`, `r2_test_u/` TypeScript | Hover sobre cada tech → tooltip con "por qué lo elegí" |
| 07 | **Footer / Contacto** | "¿Cómo me encuentro?" | Email, GitHub, LinkedIn | — |

### 3.2 Flujo narrativo por sección

**00 — Hero**
- Fondo `--ink` con grain.
- Headline en Geist Mono: "Sistema Multi-Agente para Gestión Estratégica en F1".
- Subhead en Inter: "Física + neuroevolución + datos reales. 11.200 líneas. Validado contra FastF1."
- Cifra animada: el número "11.200" se cuenta de 0 a 11.200 en 1.5s (GSAP counter).
- Wireframe de un F1 en SVG (sin renderizar, solo trazo) flotando en el lado derecho, con paralllax al 12% cuando scrolleas.

**01 — Física**
- Layout: split 50/50. Izquierda: explicación en prosa. Derecha: visualizador interactivo.
- Visualizador: 3 sliders (ride height, velocidad, ángulo de slip). Mientras los mueves, una curva tipo Pacejka se redibuja en SVG y un pequeño vector muestra fuerzas lateral/longitudinal.
- Debajo: grid de 4 mini-cards (Pacejka / Downforce / Drag / Masa efectiva) con cada `Fotos/*.png` ya disponible. Hover → la card se eleva 4px con sombra suave.

**02 — Simulación**
- Layout: grid 2x3 (desktop) o stack vertical (mobile) con los 5 circuitos como mini-mapas SVG.
- Cada mini-mapa: trazado del circuito con un dot rojo que recorre la pista en loop (animación CSS pura, 8s por circuito). Hover → la velocidad del loop se duplica, aparece el nombre del circuito y el número de checkpoints.
- Encima del grid: panel de stats (`5 circuitos · 11 rayos sensor · 50 Hz dt · 4.7–7.0 km por circuito`).
- Click en un mini-mapa → modal con vista expandida y micro-interacción de scrubbing.

**03 — Neuroevolución (la sección "estrella")**
- Layout: hero interno + timeline horizontal scroll-triggered.
- **El dato**: `124s → 66s en 98 generaciones`. Esto se muestra como un counter de progreso que se anima cuando esta sección entra en viewport.
- Timeline de generaciones en el eje X (98 puntos), fitness en el eje Y. El usuario puede hacer scrub del timeline y ver el lap time bajar.
- Mini-explicación: 3 bullets sobre por qué neuroevolución y no PPO (los que ya tienes en `GUION.md`).
- Al final: el modelo NN visualizado — 47 inputs → 3 outputs (throttle, brake, steering), con los pesos principales highlighted cuando hover.

**04 — Datos y Estrategia**
- Layout: dashboard-style. Header con KPIs (4 números grandes), luego un scatter plot.
- KPIs: `100% finalización`, `74.3% baseline`, `9.109 registros de telemetría`, `3 circuitos validados`.
- Scatter: cada punto = una carrera simulada. Eje X = compound (Soft/Medium/Hard). Eje Y = número de pit stops. Color = position final. Hover → muestra tooltip con strategy_name, fastest_lap_s, total_reward.
- Filtrable por circuito (dropdown de Barcelona/Bahrain/Monza).

**05 — Validación FastF1**
- Layout: tres columnas lado a lado.
- Cada columna: nombre del circuito arriba, gráfico comparativo al centro (simulado vs real — el eje Y es "número de paradas", barras agrupadas), cita breve abajo.
- Las cifras de validación que tienes en el TFG (Bahrain/Barcelona/Monza paradas reales dentro de ventanas predichas) son el cierre emocional.

**06 — Stack**
- Layout: grid de techs, estilo "logo wall" minimalista.
- Python · PyTorch · Gymnasium · NumPy · Shapely · SciPy · matplotlib · FastF1
- TypeScript · Node.js · Jest · MCP
- GSAP · Three.js · Astro (esto último como meta — el stack del propio portfolio).
- Hover sobre cada uno: tooltip con "por qué lo elegí" en una línea.

**07 — Footer**
- Fondo `--primary` (navy), texto `--text`.
- Tres columnas: nombre + tagline / contacto (email, GitHub, LinkedIn) / mini-nav.
- Crédito en Geist Mono pequeño: "Diseñado y construido con Astro · GSAP · Three.js. Sin frameworks innecesarios."

### 3.3 Nav global

- Fijo en top, fondo `--ink` con backdrop-blur al hacer scroll.
- 5 enlaces a las secciones (Física, Simulación, IA, Datos, Validación) + el nombre del autor a la izquierda.
- Mobile: hamburger que abre un panel full-screen estilo Polestar (modal, no drawer).
- Indicador de sección activa mientras scrolleas (subrayado `--secondary` que se mueve entre items).

---

## 4. Estrategia de animación

### 4.1 Principios (no negociables)

1. **Cada animación responde a una pregunta.** Si no puedo decir qué información llega con ese movimiento, lo quito.
2. **Easing siempre.** Ningún `linear` excepto spinners. Curvas:
   - Entrada UI: `cubic-bezier(0.16, 1, 0.3, 1)` (suave deceleración — "land")
   - Salida UI: `cubic-bezier(0.7, 0, 0.84, 0)`
   - Scroll-scrubbed: `cubic-bezier(0.65, 0, 0.35, 1)` (linear-ish pero con personalidad)
3. **Solo `transform` y `opacity`.** Nunca `width`, `height`, `top`, `margin` (causan layout thrashing → 12fps en lugar de 60fps).
4. **`prefers-reduced-motion: reduce` desactivado todo lo que no sea feedback de UI esencial.** El portfolio sigue funcionando, solo sin narrativa cinemática.
5. **Stagger 30–60ms entre hijos** cuando varios elementos entran a la vez. Nunca un bloque sincronizado.

### 4.2 Mapa de animaciones por sección

| Sección | Animación | Librería | Duración / scrub |
|---|---|---|---|
| Hero | Counter de "11.200" + reveal de headline letra a letra | GSAP timeline + custom JS | 1.5s, ease-out |
| Hero | Parallax sutil del wireframe F1 | CSS `transform: translateY(scroll * 0.12)` | Continuous, scrub |
| Hero | Gradient de fondo animado (de `#023047` a `#0a0e14`) | CSS keyframes muy lentos | 12s loop |
| Sección transition | Fade-in del fondo al pasar de sección | GSAP ScrollTrigger | 0.6s, ease-out |
| Física | Reveal del visualizador al entrar viewport | IntersectionObserver | 0.8s, ease-out, stagger 50ms |
| Física | Redibujo de curva Pacejka al cambiar slider | GSAP morph SVG path | 0.4s, ease-out |
| Simulación | Dot rojo recorriendo circuito mientras scroll | GSAP ScrollTrigger scrub: true | Continuous |
| Simulación | Counter de checkpoints | GSAP ScrollTrigger scrub: true | Continuous |
| IA | Counter "124 → 66" | GSAP ScrollTrigger | Scrub |
| IA | Reveal de timeline + scrubbable | GSAP Draggable + ScrollTrigger | Interactive |
| Datos | Reveal stagger de los 4 KPIs | IntersectionObserver | 0.8s, ease-out, stagger 80ms |
| Datos | Hover en puntos del scatter = tooltip aparece | Framer Motion o CSS transition | 0.2s, ease-out |
| Validación | Barras crecen desde 0 al entrar | GSAP ScrollTrigger | 0.8s, ease-out |
| Global | Cursor custom (solo desktop) | CSS + JS | Continuous |
| Global | Nav cambia opacidad al hacer scroll | CSS + JS scroll listener | 0.3s |
| Global | Indicador de sección activa en nav | GSAP quickTo | 0.3s |

### 4.3 Lo que NO vamos a hacer
- ❌ Hero WebGL 3D de 5 segundos con partículas y bloom.
- ❌ Mouse-follow parallax exagerado.
- ❌ Texto que se "escribe solo" cada vez que vuelves a una sección (mareante).
- ❌ Animaciones en el scroll de vuelta hacia arriba (degradar el scrub).
- ❌ Hover effects que cambian layout (causan CLS).

---

## 5. Stack técnico

### 5.1 Decisión marco: Astro + islas

| Criterio | Astro 5 | Next.js 15 (App Router) |
|---|---|---|
| KB JS por defecto (página estática) | **0 KB** | 80–120 KB (runtime React) |
| Lighthouse performance típico | **98–100** | 85–96 |
| LCP mediana (contenido estático) | **1.2s** | 2.1s |
| Soporte para islas interactivas (Three.js, Recharts, etc.) | ✅ Sí (React/Vue/Svelte islands) | ✅ Sí (es React) |
| SEO out-of-the-box | **Excelente** | Necesita configuración |
| Coste de mantenimiento | Bajo | Medio |

**Veredicto**: Astro. Es un portfolio — el contenido manda, el rendimiento es la primera impresión, y queremos exactamente 0 KB en el HTML inicial. Para los bits interactivos (Three.js, scatter plot, sliders), usamos React islands (`client:visible`) que solo se hidratan cuando entran en viewport.

### 5.2 Stack definitivo

```
Frontend core:
  - Astro 5 (SSG, content collections con i18n)
  - TypeScript estricto
  - MDX para secciones narrativas (opcional)

i18n:
  - Astro i18n nativo (`/es/...` y `/en/...`)
  - Content collections con campo `locale`
  - Language switcher en nav, persistencia en localStorage
  - Default locale: detectar `navigator.language`, fallback `es`

Estilos:
  - Vanilla CSS con custom properties (NO Tailwind — el portfolio se siente más cuidado con CSS escrito a mano)
  - @layer para organizar

Animación:
  - GSAP 3.13 + ScrollTrigger + Draggable (gratis desde 2025)
  - Lenis (smooth scroll)
  - CSS animations para micro-interactions (hover, focus, transitions)
  - IntersectionObserver nativo para reveals simples

Visualización de datos:
  - Recharts o Visx (isla React) para el scatter de telemetría
  - SVG nativo para los circuit maps (más liviano que Canvas)

3D / WebGL:
  - Three.js + react-three-fiber + drei (carga lazy, isla client:visible)
  - Modelo F1 low-poly GLTF Draco-compressed (~80KB target)
  - Mobile fallback: poster PNG del modelo renderizado
  - LOD: medium-poly en desktop, low-poly en mobile

Tipografía:
  - Geist Mono + Inter via @fontsource (auto-hospedaje, sin request externo)
  - font-display: swap

Hosting / Deploy:
  - Vercel o Netlify (deploy continuo desde Git)
  - Dominio personalizado recomendado

Performance budget:
  - JS inicial en homepage (sin Three.js): < 30 KB
  - JS con Three.js cargado (lazy): < 200 KB total
  - LCP: < 1.5s en 4G simulado
  - Lighthouse Performance: > 90 (Three.js hace bajar el techo)
  - Total weight: < 1.5 MB primera carga
```

### 5.3 Estructura de carpetas

```
portfolio/
├── public/
│   ├── fonts/                 # Geist Mono + Inter auto-hospedados
│   ├── img/                   # PNGs de Fotos/, capturas de circuitos, iconos
│   └── favicon.svg
├── src/
│   ├── content/               # Content collections (MDX) por sección
│   │   ├── 00-hero.md
│   │   ├── 01-physics.md
│   │   ├── 02-simulation.md
│   │   ├── 03-neuroevolution.md
│   │   ├── 04-strategy-data.md
│   │   └── 05-fastf1-validation.md
│   ├── components/
│   │   ├── global/
│   │   │   ├── Nav.astro
│   │   │   ├── Footer.astro
│   │   │   ├── Cursor.tsx     # React island
│   │   │   └── GrainOverlay.astro
│   │   ├── sections/
│   │   │   ├── Hero.astro
│   │   │   ├── PhysicsSection.astro
│   │   │   ├── SimulationSection.astro
│   │   │   ├── NeuroevolutionSection.astro
│   │   │   ├── StrategyDataSection.astro
│   │   │   ├── FastF1Section.astro
│   │   │   └── StackSection.astro
│   │   └── interactive/       # React islands
│   │       ├── RideHeightSlider.tsx
│   │       ├── CircuitScrubber.tsx
│   │       ├── GenerationTimeline.tsx
│   │       ├── TelemetryScatter.tsx
│   │       └── PacejkaCurve.tsx
│   ├── data/
│   │   ├── agents_data_sample.json  # <500KB muestreado de agents_data.csv
│   │   ├── circuits/                # SVG paths simplificados
│   │   └── evaluation_results.json
│   ├── styles/
│   │   ├── tokens.css          # Custom properties (colors, durations, easings)
│   │   ├── typography.css
│   │   └── reset.css
│   └── pages/
│       └── index.astro         # Una sola página
├── astro.config.mjs
├── package.json
├── tsconfig.json
└── PLAN.md  (← este documento)
```

### 5.4 Dependencias

```json
{
  "dependencies": {
    "astro": "^5.0.0",
    "@astrojs/react": "^4.0.0",
    "@astrojs/mdx": "^4.0.0",
    "@astrojs/sitemap": "^3.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "gsap": "^3.13.0",
    "lenis": "^1.1.0",
    "@fontsource-variable/inter": "^5.0.0",
    "@fontsource-variable/geist-mono": "^5.0.0",
    "recharts": "^2.13.0",
    "three": "^0.169.0",
    "@react-three/fiber": "^9.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/three": "^0.169.0",
    "typescript": "^5.6.0"
  }
}
```

---

## 6. Plan de ejecución por fases

Cada fase termina con un entregable verificable. Si una fase falla verificación, NO se pasa a la siguiente.

### Fase 0 — Setup & Sistema de diseño (½ día)
**Objetivo**: arrancar Astro, tipografías cargadas, paleta aplicada.

**Tareas**:
1. `pnpm create astro@latest portfolio -- --template minimal --typescript strict`
2. Añadir `@astrojs/react`, `@astrojs/mdx`, `@astrojs/sitemap`, `@astrojs/i18n`
3. Auto-hospedar Geist Mono + Inter vía `@fontsource-variable/*`
4. Crear `src/styles/tokens.css` con la paleta, duraciones (0.25s/0.4s/0.6s/1.2s estilo Porsche), easings
5. Crear `src/styles/typography.css` con la escala (hero/h2/h3/body/caption)
6. Crear `src/components/global/GrainOverlay.astro` (SVG noise inline)
7. Configurar i18n de Astro con `defaultLocale: 'es'`, `locales: ['es', 'en']`

**Verificación**:
- `pnpm dev` arranca sin warnings.
- Lighthouse local en homepage placeholder: Performance > 95.
- `pnpm build` termina con tamaño inicial < 50 KB.

### Fase 1 — Layout shell + Hero (1 día)
**Objetivo**: el shell del sitio funciona, el hero está vivo.

**Tareas**:
1. `Nav.astro` con estado activo, mobile menu modal, language switcher (ES/EN)
2. `Footer.astro` minimal
3. `pages/index.astro` + `pages/en/index.astro` con `<Hero />` + secciones placeholder
4. `LanguageSwitcher.tsx` (isla) con persistencia en localStorage
5. `Hero.astro` con:
   - Headline Geist Mono (texto real del GUION.md, ambos idiomas)
   - Counter animado "11.200" (GSAP)
   - Isla `F1Model.tsx` con Three.js + GLTF low-poly (lazy load en `client:visible`)
   - Fallback mobile: poster PNG del modelo
   - Parallax sutil en scroll (CSS custom prop + IntersectionObserver)
6. Smooth scroll con Lenis

**Verificación**:
- Lighthouse mobile > 90, desktop > 95
- Counter termina en 11200 con 60fps estables
- Tab de prefers-reduced-motion funciona
- Three.js solo carga después de FCP
- Mobile (CPU throttled): el fallback PNG se muestra sin jank
- Toggle ES/EN cambia todo el contenido visible

### Fase 2 — Sección Física (1 día)
**Objetivo**: el primer módulo interactivo funciona.

**Tareas**:
1. `PhysicsSection.astro` con grid 50/50
2. Isla React `RideHeightSlider.tsx` con 3 inputs (ride_height, velocity, slip_angle)
3. Isla `PacejkaCurve.tsx` que redibuja SVG path al cambiar inputs
4. Grid de 4 mini-cards con las imágenes de `Fotos/`
5. Reveal-on-scroll con IntersectionObserver + stagger

**Verificación**:
- Mover slider redibuja curva en < 16ms (60fps)
- Cards aparecen con stagger 50ms cuando entran
- Mobile: el slider funciona con touch

### Fase 3 — Sección Simulación (1 día)
**Objetivo**: los 5 circuitos cobran vida en un grid interactivo.

**Tareas**:
1. Simplificar los 5 circuitos a SVG path (Barcelona, Monza, Monaco, Spa, Silverstone) → `data/circuits/*.svg`
2. Isla `CircuitGrid.tsx` con grid 2x3 (desktop) / stack (mobile):
   - Cada celda: SVG del circuito + dot rojo que recorre el path en loop CSS (8s, linear)
   - Hover → velocidad del loop se duplica, fade-in del nombre + checkpoints
   - Click → modal fullscreen con vista expandida + scrub manual
3. Header con stats (5 circuitos, 11 rayos, 50 Hz, km totales)

**Verificación**:
- Los 5 circuitos renderizan sin pixelado
- Hover no causa layout shift
- Modal se abre/cierra con animación < 400ms
- Mobile: stack vertical sin scroll horizontal

### Fase 4 — Sección Neuroevolución (1.5 días)
**Objetivo**: la "estrella" del portfolio, la sección que demuestra la potencia del proyecto.

**Tareas**:
1. Generar `data/training_curve.json` desde los logs de entrenamiento (~98 puntos {gen, best_lap_s})
2. Isla `GenerationTimeline.tsx`:
   - Eje X: 98 generaciones, Eje Y: lap time
   - Path SVG del fitness curve
   - Counter animado "124 → 66" al entrar en viewport
3. Diagrama de la NN (47 inputs → 3 outputs) en SVG estático
4. Texto con las 3 razones de neuroevolución (sacado literal del GUION.md)
5. Reveal de la sección con ScrollTrigger pinned

**Verificación**:
- El counter llega exactamente a 66s al final del scrub
- Hover sobre puntos muestra tooltip con generación + fitness
- La sección cuenta una historia sin tener que leer todo

### Fase 5 — Sección Datos y Estrategia (1.5 días)
**Objetivo**: la prueba de que el portfolio toca datos de verdad.

**Tareas**:
1. Procesar `agents_data.csv` → muestrear a ~5000 filas → guardar en `data/agents_data_sample.json` (< 500KB)
2. Isla `TelemetryScatter.tsx` con Recharts:
   - X: compound (Soft/Medium/Hard)
   - Y: pit stops
   - Color: final_position
   - Size: total_reward
   - Dropdown de filtro por circuito
3. Header con 4 KPIs (100%, 74.3%, 9.109, 3) — animación stagger
4. Tooltip al hover con strategy_name, fastest_lap, total_reward

**Verificación**:
- Datos cargan en < 1s
- Filtrado por circuito funciona
- Tooltip aparece en < 100ms al hover

### Fase 6 — Sección Validación FastF1 (½ día)
**Objetivo**: el cierre emocional — "esto funciona en el mundo real".

**Tareas**:
1. Tres columnas lado a lado (Bahrain, Barcelona, Monza)
2. Mini-gráfico de barras por circuito: simulated vs real pit windows
3. Cita breve de cada circuito
4. Reveal stagger al entrar

**Verificación**:
- Las tres columnas se ven bien en mobile (stack vertical)
- Las cifras coinciden con el TFG

### Fase 7 — Sección Stack + Footer (½ día)
**Objetivo**: la guinda del pastel.

**Tareas**:
1. Grid de techs con logos (SVG inline de cada uno, o texto estilizado)
2. Hover → tooltip con justificación en una línea
3. Footer con contacto + mini-nav + crédito

### Fase 8 — Polish & QA (1 día)
**Objetivo**: el portfolio está listo para mostrar.

**Tareas**:
1. Test `prefers-reduced-motion` end-to-end
2. Test mobile (iPhone SE, iPad, Pixel)
3. Lighthouse completo: Performance > 95, Accessibility > 95, SEO > 95, Best Practices > 95
4. Comprimir todas las imágenes a WebP/AVIF
5. Verificar que `agents_data_sample.json` se sirve con cache headers correctos
6. Validar HTML con W3C validator
7. Probar en Safari (las animaciones GSAP a veces se comportan distinto)

**Verificación final (checklist exhaustivo)**:
- [ ] LCP < 1.5s en 4G simulado
- [ ] CLS = 0
- [ ] JS inicial < 50 KB
- [ ] Total primera carga < 1 MB
- [ ] Todos los hover states funcionan en touch
- [ ] Cursor custom se desactiva en mobile
- [ ] `prefers-reduced-motion` desactiva scrub pero mantiene UI funcional
- [ ] Console sin warnings/errors
- [ ] Imágenes todas con `alt`
- [ ] Contraste WCAG AA en todos los textos

### Fase 9 — Deploy (½ día)
**Objetivo**: en producción.

**Tareas**:
1. Subir repo a GitHub
2. Conectar Vercel/Netlify
3. Configurar dominio personalizado (opcional)
4. Verificar que el deploy funciona con HTTPS, sitemap.xml, robots.txt
5. Compartir en LinkedIn + portfolio sites

---

## 7. Inventario de contenido del TFG (qué se usa, dónde)

| Asset del TFG | Sección destino | Procesamiento necesario |
|---|---|---|
| `Estudio/CLAUDE_PROJECT_KNOWLEDGE.md` | Referencia para todos los textos técnicos | Ninguno — leer y destilar |
| `presentation/GUION.md` | Textos narrativos de secciones 01–05 | Resumir cada bloque a 80–120 palabras |
| `presentation/slides/slide-01.js` | Tema de color | Ya tenemos la paleta |
| `presentation/icons/*` | Iconografía del portfolio (reutilizar los 21 iconos) | Limpiar / reescribir si hace falta |
| `Fotos/Pacejka.png` | Sección Física, mini-card | Comprimir a WebP |
| `Fotos/aceleracion.png` | Sección Física, mini-card | Comprimir a WebP |
| `Fotos/downforce.png` | Sección Física, mini-card | Comprimir a WebP |
| `Fotos/drag.png` | Sección Física, mini-card | Comprimir a WebP |
| `Fotos/masa_efectiva.png` | Sección Física, mini-card | Comprimir a WebP |
| `Fotos/ride_height.png` | Sección Física, slider interactivo | Comprimir a WebP |
| `Fotos/rpm.png` | Sección Física, mini-card | Comprimir a WebP |
| `Fotos/steering_angle.png` | Sección Física, mini-card | Comprimir a WebP |
| `Fotos/torque.png` | Sección Física, mini-card | Comprimir a WebP |
| `Fotos/tyre_grip.png` | Sección Física, mini-card | Comprimir a WebP |
| `simulation/structures/*.py` | Sección Simulación, circuito SVG | Extraer coordenadas, simplificar a <200 puntos |
| `simulation/all_circuits_comparison.png` | Sección Simulación, header | Comprimir a WebP |
| `training/agents_data.csv` | Sección Datos, scatter | Muestrear a ~5000 filas, exportar JSON |
| `training/strategies.json` | Sección Datos, filtros | Incluir tal cual |
| `evaluation_results/results_20260411_193618.json` | Sección Validación | Extraer lap_times por circuito, formato ligero |
| `models/model_with_memory.py` | Sección IA, diagrama NN | Crear SVG estático de 47 → 128 → 128 → 64 → 16 → 1 (heads) |
| `models/strategy_predictor_augmented.pth` | (opcional) Demo en navegador | Convertir a ONNX, cargar con Transformers.js (es un nice-to-have, no imprescindible) |

---

## 8. Riesgos y decisiones abiertas

### 8.1 Riesgos técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Three.js en mobile degrada la experiencia | Media | Alto | Lazy load con `client:visible`; fallback PNG; testear en iPhone SE + Android gama media desde Fase 1 |
| Three.js bundle > 200KB | Media | Medio | Modelo GLTF Draco-compressed; tree-shake con `import { ... } from 'three'` |
| Lenis + ScrollTrigger + Three.js incompatibilidades en iOS Safari | Media | Alto | Testing temprano (Fase 1 ya tiene Three.js); `gsap.ticker.lagSmoothing(0)` + verificar en iOS |
| i18n añade complejidad de routing en Astro | Baja | Medio | Astro i18n nativo está estable desde v4; documentar fallback de locale |
| Mantener ES + EN sincronizados (textos se desactualizan) | Alta | Bajo | Content collections con un solo source-of-truth; helper de "missing translation" warnings en build |
| El scatter plot con 5000 puntos se ve lento | Media | Medio | Muestrear más agresivamente; agregar filtro por circuito desde el inicio |
| Las imágenes de Fotos/ son pesadas (78KB-783KB) | Alta | Bajo | Comprimir todo a WebP con `cwebp -q 80` antes de subir |
| GLTF low-poly se ve "feo" | Baja | Alto | Iterar el modelo 3D en Fase 0.5 con feedback temprano; mantener versión "buena" y versión "low" |

### 8.2 Decisiones tomadas (21-09-2026)

| # | Decisión | Elección | Notas |
|---|---|---|---|
| 1 | Idioma | **Bilingüe ES + EN con toggle** | Content collections con `lang: 'es' | 'en'`. Toggle persiste en `localStorage`. Default: detectar `navigator.language`. |
| 2 | Identidad autor | **"PR" en Geist Mono** | Sin foto. Iniciales como monograma en el nav, 16px en desktop, monocromo `--text`. |
| 3 | Coche F1 | **Three.js low-poly** | Modelo creado en Blender, exportado GLTF Draco-compressed (~80KB). Carga lazy al entrar en viewport del hero. Fallback mobile: poster estático PNG del mismo modelo. |
| 4 | Circuitos | **Los 5 circuitos en mini-mapas rotando** | Cambio de layout: en lugar de un circuito pinned con scrub, usamos un carousel/grid de los 5 circuitos. Cada uno con su microanimación. Hover activa el recorrido del dot por su trazado. |
| 5 | Demo IA | **SVG estático de la NN** | Sin ONNX runtime. Diagrama visual de la arquitectura 47→128→128→64→3. |

**Pendientes para confirmar antes de Fase 0**:
- Dominio: ¿`pedroroig.github.io` (gratis, rápido) o comprar dominio custom?

### 8.3 Coste / tiempo estimado (revisado post-decisiones)

| Fase | Tiempo | Acumulado | Notas |
|---|---|---|---|
| Fase 0 — Setup | 0.5 días | 0.5 | +i18n |
| Fase 0.5 — Modelo 3D F1 | 0.5 días | 1 | Modelar en Blender, exportar GLTF Draco, diseñar fallback PNG |
| Fase 1 — Layout + Hero + i18n | 1 día | 2 | +Language switcher, +isla Three.js |
| Fase 2 — Física | 1 día | 3 | Sin cambios |
| Fase 3 — Simulación (5 circuitos) | 1.5 días | 4.5 | +1 circuito más que el plan original |
| Fase 4 — Neuroevolución | 1.5 días | 6 | Sin cambios |
| Fase 5 — Datos | 1.5 días | 7.5 | Sin cambios |
| Fase 6 — Validación | 0.5 días | 8 | Sin cambios |
| Fase 7 — Stack + Footer | 0.5 días | 8.5 | Sin cambios |
| Fase 8 — Copy ES | 0.5 días | 9 | Solo ES si tiempo justo |
| Fase 9 — Copy EN + i18n polish | 1 día | 10 | Traducción de las 6 secciones |
| Fase 10 — Polish & QA | 1 día | 11 | +test del toggle, +test del fallback mobile Three.js |
| Fase 11 — Deploy | 0.5 días | 11.5 | Sin cambios |

**Total estimado: ~11.5 días hábiles = ~2.5 semanas working part-time, 1.5 sprints si dedicación completa.**

**Nota**: la decisión de bilingüe añade ~1.5 días completos vs. monolingüe. Si necesitas recortar, el atajo más seguro es dejar el EN para una iteración posterior.

---

## 9. Referencias citadas en este plan

### Diseño y motion
- [The F1 design language — charlimarie.com](https://pages.charlimarie.com/posts/refining-the-design-language-of-formula-1-issue-31)
- [Mercedes-AMG Petronas rebrand — Wolff Olins](https://wolffolins.com/work/mercedes-amg-petronas-f1-team)
- [F1 team color codes — Infysia](https://www.infysia.com/design/f1-team-color-codes/)
- [Polestar case study — Code & Theory](https://www.codeandtheory.com/work/polestar)
- [Polestar case study — John Kavanagh](https://johnkavanagh.co.uk/case-studies/polestar-cars/)
- [Scrollytelling examples 2026 — scrollytelling.ai](https://scrollytelling.ai/examples/)
- [Atlas cinematic scroll — D-LAB](https://d-lab.codes/experiments/atlas)
- [Lusion studio](https://lusion.co/projects/)
- [Lusion breakdown — Codrops](https://tympanus.net/codrops/2026/04/13/lusion-where-digital-craft-meets-ambitious-experimentation/)
- [bruno-simon.com](https://bruno-simon.com/)
- [3D scroll portfolio — Codrops](https://tympanus.net/codrops/2026/04/28/more-than-a-portfolio-building-a-scroll-driven-3d-world-with-something-to-say/)
- [Three.js configurator — discourse.threejs.org](https://discourse.threejs.org/t/performance-focused-real-time-3d-car-configurator-in-three-js/87892)
- [Porsche Design System — Motion](https://designsystem.porsche.com/v3/styles/motion/)

### Principios de motion
- [Motion design fundamentals — Figma](https://help.figma.com/hc/en-us/articles/41238219562007-Motion-design-fundamentals-Easing)
- [12 Motion Design Principles — Relogic](https://relogic.dev/blog/motion-design-principles)
- [Motion design principles — Boundev](https://www.boundev.ai/blog/motion-design-principles-guide)
- [Motion design principles — Toptal](https://www.toptal.com/designers/ux/motion-design-principles)
- [12 motion principles for video — Cursa](https://cursa.app/en/article/animating-for-impact-12-motion-design-principles-to-make-any-video-animation-feel-professional)
- [Easing curves shape — artofstyleframe](https://artofstyleframe.com/blog/easing-curves-motion-design-guide/)

### Stack decisión
- [GSAP vs Framer Motion 2026 — annnimate.com](https://annnimate.com/compare/gsap-vs-framer-motion)
- [GSAP vs Motion — annnimate.com](https://annnimate.com/compare/gsap-vs-motion)
- [GSAP vs Framer Motion — hontran.dev](https://www.hontran.dev/blog/gsap-vs-framer-motion)
- [Animation libraries & Core Web Vitals — Mintec](https://mintec.co/blog/animaciones-web-rendimiento-core-web-vitals/)
- [Scroll-driven CSS — Mintec](https://mintec.co/blog/scroll-driven-view-transitions-css-2026/)
- [Astro vs Next.js 2026 — Verlua](https://www.verlua.com/blog/nextjs-vs-astro)
- [Astro vs Next.js — Cosmic JS](https://www.cosmicjs.com/blog/nextjs-vs-astro-choosing-the-right-framework-for-your-project)
- [Astro vs Next.js for SEO — Toronto SEO](https://torontoseo.com/compare/astro-vs-nextjs-for-seo-2026/)
- [Astro for marketing sites — Lucky Media](https://www.luckymedia.dev/blog/astro-vs-nextjs-for-marketing-sites)

### Tipografía
- [Font pairings — A1.gallery](https://www.a1.gallery/font-pairings)
- [JetBrains Mono + Inter — Type Barn](https://typebarn.com/pairing/jetbrains-mono-and-inter)
- [Geist Mono + Inter — FontAlternatives](https://fontalternatives.com/pairings/geist-mono-and-inter/)
- [Web Typography Guide 2026 — Click Web Studio](https://clickwebstudio.com/blog/web-typography-guide-2026)
- [Real pairings from brands — Plinth Studio](https://plinthstudio.dev/blog/best-fonts-startup-websites)

### Data viz portfolio
- [Data viz portfolios recruiters trust — popout.page](https://www.popout.page/blog/data-visualization-portfolio-examples-2026-recruiter-trust)
- [Interactive portfolio layouts — examples-of.com](https://examples-of.com/career-professional-development/portfolio-layouts/digital-portfolio-layouts/interactive-digital-portfolio-layout-examples/)
- [9 interactive data viz — DataLabsAgency](https://www.datalabsagency.com/2026/03/29/9-incredible-examples-of-interactive-data-visualization/)
- [Visual Cinnamon portfolio](https://www.visualcinnamon.com/portfolio/)

---

## 10. Próximo paso

Las decisiones clave ya están tomadas (sección 8.2). Queda una sola abierta (dominio), que se puede resolver al final.

### Lo que puedo hacer ahora mismo

Si me das luz verde, arranco **Fase 0 + Fase 0.5** en una sola sesión (~1 hora):

1. Crear el proyecto Astro en `/Users/pedroroig/Desktop/Universidad/Cuarto/Q1/TFG/portfolio/` con TypeScript estricto, React, MDX, sitemap e i18n.
2. Cargar las fuentes Geist Mono + Inter auto-hospedadas.
3. Crear el sistema de tokens (paleta, duraciones, easings) en `tokens.css`.
4. Generar un modelo F1 low-poly en Three.js (placeholder — geometría simple con alerón y ruedas, listo para iterar).
5. Setup de Lenis smooth scroll.
6. Una homepage placeholder con el contador "11.200" funcionando y el modelo 3D cargado lazy.

**Resultado**: un repo andando en tu carpeta con la base técnica resuelta. No se ve bonito todavía, pero ya puedes abrirlo en local y validar que el stack compila y que el modelo 3D aparece.

### Lo que necesito de ti

- **Confirmación de "sí, arranca Fase 0 + 0.5 ahora"**.
- (Opcional) Si quieres revisar la dirección visual con un primer mockup antes de codear, puedo generar una página estática con el hero y la paleta en HTML/CSS plano (sin Three.js, sin animaciones) para validar tono. Eso toma 20 minutos extra y te lo enseño antes de seguir.

---

*Plan generado el 21-09-2026. Última actualización: decisiones de fase tomadas, plan ajustado a bilingüe + Three.js + 5 circuitos.*

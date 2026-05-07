# OpenEnergy — Architecture Reference

## Overview
Single-page marketing website for a renewable energy company (solar parks + BESS). Dark, cinematic aesthetic with a scroll-driven frame-sequence animation as the hero experience.

---

## Tech Stack
| Layer | Tool |
|---|---|
| Bundler | Vite 8.x (dev port 3000, auto-open) |
| Animation | GSAP 3.x + ScrollTrigger plugin |
| Fonts | Google Fonts — Inter (300–900) |
| Language | Vanilla JS (ES modules, `type: "module"`) |
| Styling | Single CSS file, CSS custom properties |
| Build output | `dist/` — assets never inlined (`assetsInlineLimit: 0`) |

No framework, no router, no state library — pure HTML/CSS/JS.

---

## File Structure
```
OpenEnergy/
├── index.html              # Full page markup — all sections live here
├── src/
│   ├── main.js             # All JS logic (single file)
│   └── style.css           # All styles (single file)
├── public/
│   ├── favicon.svg
│   ├── fonts/              # (local font files if any)
│   ├── frames/             # frame_0001.jpg → frame_0240.jpg (240 JPGs, 1920×1080)
│   └── videos/             # MP4 source videos (solar-journey, video-final variants, scene 1)
├── videos/                 # Raw source clips (scene 1.mp4, scene 2.mp4) + frame reference
├── design stack/           # Design reference PDF + 9 page PNGs (not served)
├── vite.config.js
└── package.json
```

---

## Page Sections (top → bottom)

| ID | Section | Notes |
|---|---|---|
| `#preloader` | Loading screen | Fixed overlay, fades out after priority frames load |
| `#navbar` | Fixed nav | Transparent → frosted glass on scroll (`scrolled` class) |
| `#cinematic-section` | Scroll-driven hero | Sticky canvas + 5×100vh scroll spacer |
| `#stats` | Key metrics strip | 4 animated counters (500MW, 2GWh, 40 countries, 98% uptime) |
| `#solutions` | 3-card grid | Solar Parks, Battery Storage (featured), Grid Integration |
| `#technology` | 2×2 tech grid | PV Cells, Liquid-Cooled BESS, AI Dispatch, Remote Monitoring |
| `#about` | Split layout | Text left, animated SVG ring visual right |
| `#contact` | Contact form | Client-side only (no backend), submit shows confirmation |
| `#footer` | Footer | Two-column links + copyright |

---

## Core Mechanism — Scroll-Driven Frame Sequence

The cinematic hero works by scrubbing 240 pre-extracted JPEG frames on a `<canvas>` element in sync with scroll position.

### How it works
1. **Canvas setup** (`resizeCanvas`): Retina-aware sizing via `devicePixelRatio`. Buffer is physical pixels; CSS display stays logical pixels. Redraws current frame on resize.
2. **Frame loading** (`preloadFrames`): Loads frames 1–30 first (priority batch), hides preloader, then loads 31–240 in background. Batches of 10 concurrent requests (`PRELOAD_BATCH = 10`).
3. **Scroll sync** (`setupScrollSync`): `ScrollTrigger.create` with `scrub: true` maps section scroll progress (0→1) to frame index (0→239). A `requestAnimationFrame` loop redraws only when `needsRedraw` is set — never blocks scroll thread.
4. **Cover-fit draw** (`drawFrame`): Equivalent to CSS `object-fit: cover` — scales frame to fill canvas without distortion or letterboxing.
5. **Chapter overlays** (`activateChapter`): 5 overlay panels positioned absolutely over canvas. Each maps to a scroll progress range (chapters at 10–30%, 30–50%, 50–70%, 70–90%, 90–100%). Active panel gets `opacity: 1` via CSS transition.
6. **Hero fade**: The initial hero overlay (`#hero-overlay`) fades out over the first 10% of scroll progress.

### Frame file naming
`/frames/frame_0001.jpg` → `/frames/frame_0240.jpg` (1-indexed, zero-padded to 4 digits)

### Chapter boundaries
```js
{ start: 0.10, end: 0.30 }  // Ch01 — Harnessing the Sun
{ start: 0.30, end: 0.50 }  // Ch02 — Sunlight → Electricity
{ start: 0.50, end: 0.70 }  // Ch03 — Grid Delivery
{ start: 0.70, end: 0.90 }  // Ch04 — Battery Storage
{ start: 0.90, end: 1.00 }  // Ch05 — The Future is Here (CTA)
```

---

## Animations

| System | Implementation |
|---|---|
| Hero entrance | GSAP `gsap.to` — tagline words stagger up from `translateY(40px)`, sub fades in, scroll hint fades last |
| Scroll reveals | `.reveal` class (opacity 0, translateY 30px) → GSAP ScrollTrigger animates to visible at `top 88%` |
| Stats counters | GSAP tween `{ val: 0 }` → target, `once: true` ScrollTrigger, updates `textContent` on each tick |
| About visual | Pure CSS — glow orb pulses (`orbPulse`), 3 rings rotate at different speeds/directions (`ringRotate`) |
| Navbar | CSS transition on `background`/`border-color` when `.scrolled` class toggled by scroll event |

---

## Design System (CSS Variables)

```css
--brand-teal: #0097B2       /* Primary brand */
--brand-green: #7ED957      /* Secondary brand */
--gradient: linear-gradient(135deg, teal → green)
--bg-black: #000000
--bg-deep: #030608          /* Sections alternate between these two */
--bg-card: rgba(255,255,255,0.04)
--font: 'Inter'
--nav-h: 72px
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)
--ease-smooth: cubic-bezier(0.16, 1, 0.3, 1)
```

Gradient text is applied via `.gradient-text` utility class (webkit background-clip trick).

---

## Scroll Snapping
`html` has `scroll-snap-type: y mandatory`. Each major section has `scroll-snap-align: start`. The cinematic section's scroll spacer is 5×`.snap-point` divs (each `100svh`).

---

## Responsive Breakpoints
- `≤900px`: Nav links hidden, grids collapse to 1 column, about visual hidden, stat dividers hidden
- `≤600px`: Hero tagline and overlay headings shrink further via `clamp()`

---

## Assets

| Path | Contents |
|---|---|
| `public/frames/` | 240 JPGs at 1920×1080, extracted from source video |
| `public/videos/` | `solar-journey.mp4`, `video-final.mp4/v2/v3`, `scene 1.mp4` |
| `videos/` | Raw source: `scene 1.mp4`, `scene 2.mp4`, `frame-7.07s.jpg` (reference) |
| `design stack/` | `OpenEnergy (A4) (3).pdf` + 9 page PNGs — original design mockups |

---

## Dev Commands
```bash
npm run dev      # Vite dev server on localhost:3000 (auto-opens browser)
npm run build    # Output to dist/
npm run preview  # Preview production build
```

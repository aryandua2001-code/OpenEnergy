# OpenEnergy — Architecture Reference

## Overview
Single-page marketing website for **OpenEnergy India Pvt. Ltd.** — a Jaipur-based EPC company delivering utility-scale solar parks and grid-scale BESS, with an upcoming cell-to-container BESS manufacturing facility (2 GWh/yr target). Dark, cinematic aesthetic with a scroll-driven frame-sequence hero followed by full EPC company content.

**Live site:** https://openenergy.in  
**Repo:** https://github.com/aryandua2001-code/OpenEnergy

---

## Tech Stack

| Layer | Tool |
|---|---|
| Bundler | Vite 8.x |
| Animation | GSAP 3.x + ScrollTrigger |
| Smooth scroll | Lenis (lerp: 0.12, autoRaf: false, driven by GSAP ticker) |
| Fonts | Google Fonts — Inter (300–900) + JetBrains Mono (400–500) |
| Language | Vanilla JS (ES modules) |
| Styling | Single CSS file (`src/style.css`), CSS custom properties |
| Hosting | Netlify (auto-deploys on push to `main`) |
| Domain | openenergy.in (GoDaddy DNS → Netlify) |

No framework, no router, no state library — pure HTML/CSS/JS.

---

## File Structure

```
OpenEnergy/
├── index.html                  # Full page markup — all sections
├── src/
│   ├── main.js                 # All JS logic (single file)
│   └── style.css               # All styles (single file)
├── public/
│   ├── favicon.svg
│   ├── frames/                 # 240 WebP frames (1920×1080) + 240 JPG originals
│   │   ├── frame_0001.webp → frame_0240.webp   ← served (51% smaller than JPG)
│   │   └── frame_0001.jpg  → frame_0240.jpg    ← originals kept as backup
│   └── videos/                 # gitignored — too large for GitHub
├── design stack/               # Claude-generated design variations (HTML) + PDF + PNGs
├── vite.config.js
└── package.json
```

---

## Page Sections (top → bottom)

| ID | Section | Content |
|---|---|---|
| `#navbar` | Fixed nav | Logo + Solutions / Manufacturing / Process / About / Contact + "Request Proposal" CTA |
| `#cinematic-section` | Scroll-driven hero | Sticky canvas + 5×100svh scroll spacer |
| `#credibility` | Credibility strip | Founded 2026 · Cell→Container · 50MW/100MWh · 2GWh/yr · CEA+CEIG |
| `#why` | Why OpenEnergy | 4 pillars: Vertically integrated / Indian grid / Single-source / Bankable |
| `#solutions` | EPC services | 3 cards with spec tables: Solar EPC / BESS EPC+Manufacturing / Sub-EPC |
| `#manufacturing` | Manufacturing | Jaipur facility specs + cell→container production flow (4 steps) |
| `#process` | EPC process | 6-step grid: Feasibility → DPR → Procurement → Construction → Commissioning → O&M |
| `#technology` | Technology | 4 items: TOPCon PV / Liquid-cooled LFP / AI EMS / SCADA+Drone |
| `#about` | About + Founder | Mission text + Aryan Dua (ex-Tesla) founder card + Head of EPC hiring card |
| `#contact` | RFP intake | Info sidebar + full RFP form (type, capacity, state, COD) + 4-step process strip |
| `#footer` | Footer | 3-col: Capabilities / Company / Contact + "EPC · Manufacturing · Jaipur" |

**Removed from original:** `#preloader` (loading screen removed — site goes straight to landing page), `#stats` (generic counters replaced by `#credibility` strip with real EPC metrics).

---

## Cinematic Hero — Scroll-Driven Frame Sequence

### Architecture
The hero is a `<canvas>` element inside a sticky wrapper. Scrolling through 5×100svh of scroll space (the "scroll spacer") advances through 240 WebP frames, giving a video-like cinematic effect.

### Frame loading
- **Format:** WebP (converted from source JPGs via `cwebp -q 82` — 67MB → 33MB, 51% reduction)
- **Pre-decoding:** `img.decode()` called after each `img.onload` — forces the browser to decompress into raw pixels before the frame is needed, so `drawImage()` is instant (no JIT decode stutter)
- **Lazy by chapter:** loads chapter 0 (frames 0–47) first, then chains chapters 1–4 sequentially in background. Initial load ~7MB instead of 33MB
- **Fallback:** if a frame isn't loaded yet, `drawFrame()` walks outward and draws the nearest available frame — canvas never goes blank on slow connections

### Frame file naming
`/frames/frame_0001.webp` → `/frames/frame_0240.webp` (1-indexed, 4-digit zero-padded)

### Chapter boundaries (scroll progress 0→1)
```js
{ start: 0.10, end: 0.30 }  // Ch01 · Generation — India needs 10GW solar/yr
{ start: 0.30, end: 0.50 }  // Ch02 · Storage — Solar without storage is half a solution
{ start: 0.50, end: 0.70 }  // Ch03 · Manufacturing — Cell to container, end-to-end
{ start: 0.70, end: 0.90 }  // Ch04 · Deployment — 50MW/100MWh, Rajasthan
{ start: 0.90, end: 1.00 }  // Ch05 · CTA — Build your park with us
```

### Scroll engine
- **Lenis** (`lerp: 0.12`, `autoRaf: false`) drives smooth scroll for the full page
- GSAP ticker feeds Lenis: `gsap.ticker.add((time) => lenis.raf(time * 1000))`
- `lenis.on('scroll', ScrollTrigger.update)` keeps GSAP ScrollTrigger in sync

### Chapter-by-chapter navigation
Each scroll gesture plays the entire current chapter (snap point to snap point) and locks. Implementation:

```
Snap points: [0, 0.2, 0.4, 0.6, 0.8, 1.0]  (one per chapter boundary)
```

1. **Wheel listener** (`capture: true`, `passive: false`) fires before Lenis
2. `e.stopImmediatePropagation()` prevents Lenis from accumulating deltaY on hard scrolls
3. `goToChapter(index)` → `lenis.scrollTo(target, { duration: 0.85, easing: power3.out })`
4. `extendLock()` — resets a 400ms quiet timer on every intercepted wheel event; only sets `isAnimating = false` after 400ms of silence (absorbs OS momentum tail from hard scrolls)
5. When at last snap going down → no intercept → Lenis handles normal page scroll

### Canvas rendering
- DPR capped at 2× (`Math.min(devicePixelRatio, 2)`) — prevents 3× retina creating 9× canvas memory (iOS crash fix)
- `ctx.drawImage(img, x, y, w, h)` with cover-fit scaling
- `desynchronized: true` on context for lower-latency draws

---

## Animations

| System | Implementation |
|---|---|
| Hero entrance | GSAP stagger: tagline words (0.12s stagger), sub (0.65s delay), scroll hint (1.3s delay) |
| Hero fade | Opacity 0 over first 10% of cinematic scroll progress |
| Chapter overlays | CSS `opacity: 0→1` transition (0.15s) toggled by scroll progress check in `lenis.on('scroll')` |
| Scroll reveals | `.reveal` class (opacity 0, translateY 30px) → GSAP ScrollTrigger `start: 'top 88%'` |
| About visual | Pure CSS — glow orb pulses, 3 rings rotate at different speeds |
| Navbar | `.scrolled` class toggled at `scrollY > 50` → frosted glass background |

---

## Design System (CSS Variables)

```css
--brand-teal:  #0097B2
--brand-green: #7ED957
--gradient:    linear-gradient(135deg, #0097B2, #7ED957)
--bg-black:    #000000
--bg-deep:     #030608       /* alternating section bg */
--bg-card:     rgba(255,255,255,0.04)
--font:        'Inter', system-ui
--font-mono:   'JetBrains Mono'  /* used for labels, specs, tags */
--nav-h:       72px
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)
--ease-smooth: cubic-bezier(0.16, 1, 0.3, 1)
```

---

## Responsive Breakpoints

| Breakpoint | Changes |
|---|---|
| `≤900px` (tablet) | Nav links hidden, grids → 1 col, section padding reduced, manu/rfp grids stack |
| `≤600px` (mobile) | Single-column everywhere, typography via `clamp()`, manu flow arrows rotate 90°, contact strips stack, nav simplified to logo+CTA only |

`overflow-x: hidden` on `body` only (not `html` — iOS Safari breaks scroll context if set on html).

---

## Contact Form

Client-side only — no backend. Submit button shows "Message Sent ✓" for 3 seconds then resets. Fields: Full name, company, email, phone, inquiry type (Solar EPC / BESS EPC / Hybrid / C&I / Sub-EPC / Supply), capacity, project state (all major solar states), target COD, message.

---

## Assets

| Path | Contents |
|---|---|
| `public/frames/*.webp` | 240 WebP frames at 1920×1080 (33MB total) — served |
| `public/frames/*.jpg` | 240 JPG originals (67MB total) — backup, not served |
| `public/videos/` | MP4 source videos — **gitignored** (too large: up to 186MB per file) |
| `design stack/` | 3 Claude-design HTML variations + PDF + PNGs — committed |

---

## Dev Commands

```bash
npm run dev      # Vite dev server on localhost:3000
npm run build    # Production build → dist/
npm run preview  # Preview production build
```

## Deployment

- **Auto-deploy:** push to `main` → Netlify detects → rebuilds in ~60s → live at openenergy.in
- **Build command:** `npm run build`
- **Publish dir:** `dist/`
- **DNS:** GoDaddy nameservers → Netlify; SSL auto-provisioned via Let's Encrypt

## Git notes

- Videos gitignored (`public/videos/`, `videos/`) — too large for GitHub
- WebP frames ARE committed (33MB total, within GitHub limits)
- `git config http.postBuffer 524288000` required for initial push (large binary files)

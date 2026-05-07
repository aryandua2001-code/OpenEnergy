// ═══════════════════════════════════════════════════════════
//  OpenEnergy — Lenis Scroll + Canvas ImageBitmap Cinematic
//
//  Scroll  : Lenis with lerp: 0.12 — natural premium page-scroll
//            feel, snappier than the original 0.1 so trailing
//            at chapter-end is visibly shorter.
//
//  Render  : Canvas + ImageBitmap — each JPG frame pre-decoded
//            to a GPU-resident ImageBitmap so drawImage is 3×
//            faster than with HTMLImageElement.
// ═══════════════════════════════════════════════════════════

// Prevent browser from restoring scroll position on reload
history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import '/src/style.css';

gsap.registerPlugin(ScrollTrigger);

// ── Config ──────────────────────────────────────────────────
const FRAME_COUNT   = 240;
const FRAME_PATH    = '/frames';
const FRAME_EXT     = 'jpg';
const PRELOAD_BATCH = 20;

// Chapter boundaries (0–1 scroll progress)
const CHAPTERS = [
  { start: 0.10, end: 0.30 },
  { start: 0.30, end: 0.50 },
  { start: 0.50, end: 0.70 },
  { start: 0.70, end: 0.90 },
  { start: 0.90, end: 1.00 },
];

// ── DOM ─────────────────────────────────────────────────────
const navbar = document.getElementById('navbar');
const canvas        = document.getElementById('energy-canvas');
const ctx           = canvas.getContext('2d', { alpha: false, desynchronized: true });
const overlays      = document.querySelectorAll('.overlay-panel');

// ── State ────────────────────────────────────────────────────
// bitmaps[i] = GPU-decoded ImageBitmap — drawImage is ~3× faster
// than drawing an HTMLImageElement because no per-draw decode.
const bitmaps    = new Array(FRAME_COUNT);
let loadedCount  = 0;
let currentFrame = 0;

// ── Canvas — retina-aware resize + cover-fit draw ────────────
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w   = window.innerWidth;
  const h   = window.innerHeight;
  canvas.width        = Math.round(w * dpr);
  canvas.height       = Math.round(h * dpr);
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  drawFrame(currentFrame);
}

function drawFrame(index) {
  const bmp = bitmaps[index];
  if (!bmp) return;
  const dpr = window.devicePixelRatio || 1;
  const cw  = canvas.width  / dpr;
  const ch  = canvas.height / dpr;
  const iw  = bmp.width  || bmp.naturalWidth  || 1920;
  const ih  = bmp.height || bmp.naturalHeight || 1080;
  const s   = Math.max(cw / iw, ch / ih);
  ctx.drawImage(bmp, (cw - iw * s) / 2, (ch - ih * s) / 2, iw * s, ih * s);
}

window.addEventListener('resize', resizeCanvas, { passive: true });

// ── Frame preloading with ImageBitmap ────────────────────────
// Loads silently in the background — no visible loading screen.
// Frames draw to canvas as they arrive; hero text is visible immediately.
function preloadFrames() {
  const priorityEnd     = Math.min(30, FRAME_COUNT);
  const priorityIndices = Array.from({ length: priorityEnd }, (_, i) => i);
  const restIndices     = Array.from({ length: FRAME_COUNT - priorityEnd }, (_, i) => i + priorityEnd);

  async function loadFrame(index) {
    return new Promise((resolve) => {
      const img    = new Image();
      img.decoding = 'async';
      img.onload = async () => {
        try {
          bitmaps[index] = await createImageBitmap(img);
        } catch (_) {
          bitmaps[index] = img;
        }
        loadedCount++;
        // Draw frame 0 as soon as it's ready so canvas isn't blank
        if (index === 0) drawFrame(0);
        resolve();
      };
      img.onerror = () => { loadedCount++; resolve(); };
      img.src = `${FRAME_PATH}/frame_${String(index + 1).padStart(4, '0')}.${FRAME_EXT}`;
    });
  }

  async function loadBatch(indices) {
    for (let i = 0; i < indices.length; i += PRELOAD_BATCH) {
      await Promise.all(indices.slice(i, i + PRELOAD_BATCH).map(loadFrame));
    }
  }

  // Load first 30 frames with priority, then rest in background
  loadBatch(priorityIndices).then(() => loadBatch(restIndices));
}

// ── Scroll → Frame Sync ──────────────────────────────────────
function setupScrollSync() {
  const section     = document.getElementById('cinematic-section');
  const heroOverlay = document.getElementById('hero-overlay');

  // lerp: 0.12 — slightly snappier than the original 0.1 so the
  // trailing tail at the end of each chapter is visibly shorter.
  const lenis = new Lenis({ lerp: 0.12, autoRaf: false });
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.on('scroll', ScrollTrigger.update);

  let scrollProgress = 0;

  lenis.on('scroll', ({ scroll }) => {
    const total    = section.offsetHeight - window.innerHeight;
    const scrolled = scroll - section.offsetTop;
    const progress = Math.max(0, Math.min(1, scrolled / total));
    scrollProgress = progress;

    const fi = Math.min(FRAME_COUNT - 1, Math.floor(progress * FRAME_COUNT));
    if (fi !== currentFrame) { currentFrame = fi; drawFrame(fi); }

    if (heroOverlay) {
      heroOverlay.style.opacity       = progress < 0.10 ? String(1 - progress / 0.10) : '0';
      heroOverlay.style.pointerEvents = progress < 0.10 ? 'auto' : 'none';
    }

    CHAPTERS.forEach((ch, i) => {
      overlays[i].classList.toggle('active', progress >= ch.start && progress < ch.end);
    });
    if (progress >= 0.90) overlays[4].classList.add('active');
  });

  // Chapter snap — when scroll momentum fully stops, snap to the
  // nearest chapter boundary so the canvas always rests on a clean frame.
  const SNAP_POINTS = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
  let isSnapping = false;

  function snapToNearest() {
    if (isSnapping) return;
    const total    = section.offsetHeight - window.innerHeight;
    const scrolled = lenis.scroll - section.offsetTop;
    if (scrolled < -window.innerHeight || scrolled > total + window.innerHeight) return;

    const nearest = SNAP_POINTS.reduce((p, c) =>
      Math.abs(c - scrollProgress) < Math.abs(p - scrollProgress) ? c : p
    );
    const target = section.offsetTop + nearest * total;
    if (Math.abs(lenis.scroll - target) < 8) return;

    isSnapping = true;
    lenis.scrollTo(target, {
      duration: 0.75,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      onComplete: () => setTimeout(() => { isSnapping = false; }, 50),
    });
  }

  if ('onscrollend' in window) {
    window.addEventListener('scrollend', snapToNearest);
  } else {
    let t;
    window.addEventListener('scroll', () => {
      clearTimeout(t); t = setTimeout(snapToNearest, 140);
    }, { passive: true });
  }
}

// ── Navbar ───────────────────────────────────────────────────
function setupNavbar() {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  }, { passive: true });
}

// ── Hero entrance animation ──────────────────────────────────
function animateHero() {
  const words = document.querySelectorAll('.tagline-word');
  const sub   = document.getElementById('hero-sub');
  const hint  = document.getElementById('hero-scroll-hint');
  gsap.to(words, { opacity: 1, y: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out', delay: 0.2 });
  gsap.to(sub,   { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', delay: 0.65 });
  gsap.to(hint,  { opacity: 1,        duration: 1.0, ease: 'power2.out', delay: 1.3 });
}

// ── Scroll Reveal ────────────────────────────────────────────
function setupReveals() {
  const targets = [
    ...document.querySelectorAll('.stat-item'),
    ...document.querySelectorAll('.why-pillar'),
    ...document.querySelectorAll('.solution-card'),
    ...document.querySelectorAll('.process-step'),
    ...document.querySelectorAll('.tech-item'),
    ...document.querySelectorAll('.manu-step'),
    document.querySelector('.manu-text'),
    document.querySelector('.manu-flow-wrap'),
    document.querySelector('.about-text'),
    document.querySelector('.about-visual'),
    document.querySelector('.founder-card'),
    document.querySelector('.hiring-card'),
    document.querySelector('.rfp-grid'),
  ].filter(Boolean);

  targets.forEach(el => el.classList.add('reveal'));
  gsap.utils.toArray('.reveal').forEach((el, i) => {
    gsap.to(el, {
      opacity: 1, y: 0, duration: 0.8, ease: 'power3.out',
      delay: (i % 3) * 0.08,
      scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' },
    });
  });
}

// ── Contact Form ─────────────────────────────────────────────
function setupContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = document.getElementById('contact-submit-btn');
    btn.querySelector('span').textContent = 'Message Sent ✓';
    setTimeout(() => { btn.querySelector('span').textContent = 'Send RFP →'; }, 3000);
  });
}

// ── Master Init ──────────────────────────────────────────────
function startAnimations() {
  animateHero();
  setupNavbar();
  setupScrollSync();
  setupReveals();
  setupContactForm();
  ScrollTrigger.refresh();
}

function init() {
  resizeCanvas();
  preloadFrames();   // silent background load
  startAnimations(); // hero + scroll start immediately
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

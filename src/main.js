// ═══════════════════════════════════════════════════════════
//  OpenEnergy — GSAP ScrollTrigger scrub+snap cinematic
//
//  Scroll   : Native scroll drives ScrollTrigger for the cinematic.
//             Lenis (stopped during cinematic) handles the page
//             sections below for premium smooth scroll.
//
//  Frames   : WebP (53% smaller than JPG) + img.decode() forces
//             the browser to decompress BEFORE the frame is needed,
//             so drawImage() is instant — no JIT decode stutter.
//
//  Snap     : ScrollTrigger snap snaps to chapter boundaries via
//             GSAP's own easing engine — no competing scroll
//             systems, no lerp settling tail.
// ═══════════════════════════════════════════════════════════

// Always start from top on reload
history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import '/src/style.css';

gsap.registerPlugin(ScrollTrigger);

// ── Config ──────────────────────────────────────────────────
const FRAME_COUNT        = 240;
const FRAME_PATH         = '/frames';
const FRAME_EXT          = 'webp';   // WebP: 53% smaller, faster decode
const PRELOAD_BATCH      = 10;
const FRAMES_PER_CHAPTER = 48;       // 240 / 5 chapters

const CHAPTERS = [
  { start: 0.10, end: 0.30 },
  { start: 0.30, end: 0.50 },
  { start: 0.50, end: 0.70 },
  { start: 0.70, end: 0.90 },
  { start: 0.90, end: 1.00 },
];

// ── DOM ─────────────────────────────────────────────────────
const navbar   = document.getElementById('navbar');
const canvas   = document.getElementById('energy-canvas');
const ctx      = canvas.getContext('2d', { alpha: false, desynchronized: true });
const overlays = document.querySelectorAll('.overlay-panel');

// ── State ────────────────────────────────────────────────────
const bitmaps    = new Array(FRAME_COUNT);
let loadedCount  = 0;
let currentFrame = 0;

// ── Canvas — retina-aware, cover-fit ────────────────────────
function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
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
  let img = bitmaps[index];
  // Fallback to nearest available frame so canvas never goes blank
  if (!img) {
    for (let d = 1; d < 48; d++) {
      if (bitmaps[index - d]) { img = bitmaps[index - d]; break; }
      if (bitmaps[index + d]) { img = bitmaps[index + d]; break; }
    }
  }
  if (!img) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw  = canvas.width  / dpr;
  const ch  = canvas.height / dpr;
  const iw  = img.naturalWidth  || 1920;
  const ih  = img.naturalHeight || 1080;
  const s   = Math.max(cw / iw, ch / ih);
  ctx.drawImage(img, (cw - iw * s) / 2, (ch - ih * s) / 2, iw * s, ih * s);
}

window.addEventListener('resize', resizeCanvas, { passive: true });

// ── Frame loading — WebP + img.decode() ──────────────────────
// img.decode() forces the browser to decompress the image into
// raw pixel data BEFORE it's needed. drawImage() then copies
// already-decoded pixels — zero JIT decode stutter on scroll.
async function loadFrame(index) {
  if (bitmaps[index]) return;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = async () => {
      try { await img.decode(); } catch (_) {}  // pre-decode into memory
      bitmaps[index] = img;
      loadedCount++;
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

function preloadChapter(chapterIndex) {
  const start   = chapterIndex * FRAMES_PER_CHAPTER;
  const end     = Math.min(start + FRAMES_PER_CHAPTER, FRAME_COUNT);
  const indices = Array.from({ length: end - start }, (_, i) => i + start);
  return loadBatch(indices);
}

function preloadFrames() {
  // Load chapter 0 first, then chain through 1–4 in background
  preloadChapter(0)
    .then(() => preloadChapter(1))
    .then(() => preloadChapter(2))
    .then(() => preloadChapter(3))
    .then(() => preloadChapter(4));
}

// ── Scroll + Frame Sync ──────────────────────────────────────
function setupScrollSync() {
  const section     = document.getElementById('cinematic-section');
  const heroOverlay = document.getElementById('hero-overlay');

  // Lenis for smooth scroll across the full page including cinematic.
  // ScrollTrigger reads Lenis's smooth position via the scroll event.
  const lenis = new Lenis({ lerp: 0.08, autoRaf: false });
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.on('scroll', ScrollTrigger.update);

  // ── Hero fade ─────────────────────────────────────────────
  if (heroOverlay) {
    ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: '+=8%',
      scrub: true,
      onUpdate: ({ progress }) => {
        heroOverlay.style.opacity       = String(1 - progress);
        heroOverlay.style.pointerEvents = progress > 0.5 ? 'none' : 'auto';
      },
    });
  }

  // ── Cinematic frame sequence + chapter snap ───────────────
  // scrub: 0.5  → frames lag the scroll position by 0.5 s,
  //              creating the intentional cinematic trailing feel.
  // snap        → when scroll momentum stops, GSAP eases to the
  //              nearest chapter boundary with power3.out — no
  //              Lenis lerp, no competing scroll system.
  ScrollTrigger.create({
    trigger: section,
    start:   'top top',
    end:     'bottom bottom',
    scrub:   0.5,
    snap: {
      snapTo:   [0, 0.2, 0.4, 0.6, 0.8, 1.0],
      duration: { min: 0.3, max: 0.7 },
      ease:     'power3.out',
      delay:    0.05,
      inertia:  false,
    },
    onUpdate(self) {
      const fi = Math.min(FRAME_COUNT - 1, Math.floor(self.progress * FRAME_COUNT));
      if (fi !== currentFrame) { currentFrame = fi; drawFrame(fi); }

      CHAPTERS.forEach((ch, i) => {
        overlays[i].classList.toggle('active', self.progress >= ch.start && self.progress < ch.end);
      });
      if (self.progress >= 0.90) overlays[4].classList.add('active');
    },
    onLeave()     { ScrollTrigger.refresh(); },
  });
}

// ── Navbar ───────────────────────────────────────────────────
function setupNavbar() {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  }, { passive: true });
}

// ── Hero entrance ────────────────────────────────────────────
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
  preloadFrames();
  startAnimations();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

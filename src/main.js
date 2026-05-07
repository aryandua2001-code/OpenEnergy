// ═══════════════════════════════════════════════════════════
//  OpenEnergy — Lenis + Chapter Navigation Cinematic
//  Frames: WebP (51% smaller) + img.decode() pre-decoding
// ═══════════════════════════════════════════════════════════

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
const FRAME_EXT          = 'webp';
const PRELOAD_BATCH      = 10;
const FRAMES_PER_CHAPTER = 48;

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

// ── Canvas ───────────────────────────────────────────────────
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
  let bmp = bitmaps[index];
  if (!bmp) {
    for (let d = 1; d < 48; d++) {
      if (bitmaps[index - d]) { bmp = bitmaps[index - d]; break; }
      if (bitmaps[index + d]) { bmp = bitmaps[index + d]; break; }
    }
  }
  if (!bmp) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw  = canvas.width  / dpr;
  const ch  = canvas.height / dpr;
  const iw  = bmp.naturalWidth  || 1920;
  const ih  = bmp.naturalHeight || 1080;
  const s   = Math.max(cw / iw, ch / ih);
  ctx.drawImage(bmp, (cw - iw * s) / 2, (ch - ih * s) / 2, iw * s, ih * s);
}

window.addEventListener('resize', resizeCanvas, { passive: true });

// ── Frame loading — WebP + img.decode() ──────────────────────
async function loadFrame(index) {
  if (bitmaps[index]) return;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = async () => {
      try { await img.decode(); } catch (_) {}
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
  preloadChapter(0)
    .then(() => preloadChapter(1))
    .then(() => preloadChapter(2))
    .then(() => preloadChapter(3))
    .then(() => preloadChapter(4));
}

// ── Scroll → Frame Sync ──────────────────────────────────────
function setupScrollSync() {
  const section     = document.getElementById('cinematic-section');
  const heroOverlay = document.getElementById('hero-overlay');

  const lenis = new Lenis({ lerp: 0.12, autoRaf: false });
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.on('scroll', ScrollTrigger.update);

  function renderProgress(rawProgress) {
    const progress = Math.max(0, Math.min(1, rawProgress));

    // Math.round avoids a one-frame visual stall at chapter boundaries
    // caused by fractional progress hovering just below the final frame.
    const fi = Math.min(FRAME_COUNT - 1, Math.round(progress * (FRAME_COUNT - 1)));
    if (fi !== currentFrame) { currentFrame = fi; drawFrame(fi); }

    if (heroOverlay) {
      heroOverlay.style.opacity       = progress < 0.10 ? String(1 - progress / 0.10) : '0';
      heroOverlay.style.pointerEvents = progress < 0.10 ? 'auto' : 'none';
    }

    CHAPTERS.forEach((ch, i) => {
      overlays[i].classList.toggle('active', progress >= ch.start && progress < ch.end);
    });
    if (progress >= 0.90) overlays[4].classList.add('active');
  }

  lenis.on('scroll', ({ scroll }) => {
    const total    = section.offsetHeight - window.innerHeight;
    const scrolled = scroll - section.offsetTop;
    const progress = Math.max(0, Math.min(1, scrolled / total));
    renderProgress(progress);
  });

  // ── Chapter-by-chapter navigation ───────────────────────────
  const SNAP_POINTS = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
  let currentSnap = 0;
  let isAnimating = false;
  let releaseTimer = null;
  let lastInputAt = 0;
  let unlockEarliestAt = 0;
  let activeTween = null;

  function markChapterInput() {
    lastInputAt = performance.now();
  }

  function scheduleUnlock() {
    clearTimeout(releaseTimer);

    const check = () => {
      const now = performance.now();
      const inputQuietFor = now - lastInputAt;
      const canUnlock = now >= unlockEarliestAt && inputQuietFor >= 140;

      if (canUnlock) {
        isAnimating = false;
        return;
      }

      const waitForInput = Math.max(0, 140 - inputQuietFor);
      const waitForMin = Math.max(0, unlockEarliestAt - now);
      releaseTimer = setTimeout(check, Math.max(16, Math.min(120, waitForInput, waitForMin)));
    };

    releaseTimer = setTimeout(check, 16);
  }

  function goToChapter(index) {
    if (isAnimating) return;
    isAnimating = true;
    unlockEarliestAt = Number.POSITIVE_INFINITY;
    clearTimeout(releaseTimer);
    if (activeTween) activeTween.kill();

    const total  = section.offsetHeight - window.innerHeight;
    const target = section.offsetTop + SNAP_POINTS[index] * total;
    const startProgress  = SNAP_POINTS[currentSnap];
    const targetProgress = SNAP_POINTS[index];
    const state = { progress: startProgress };

    // Make sure the destination chapter is decoding while the animation starts.
    preloadChapter(Math.max(0, index - 1));
    preloadChapter(index);
    if (index + 1 <= 4) preloadChapter(index + 1);

    // Visual playback is deliberately constant-speed. The previous scrollTo()
    // ease slowed toward zero velocity at the end, which looked like a hitch
    // even when the browser was performing correctly.
    activeTween = gsap.to(state, {
      progress: targetProgress,
      duration: 0.72,
      ease: 'none',
      onUpdate: () => renderProgress(state.progress),
      onComplete: () => {
        renderProgress(targetProgress);
        lenis.scrollTo(target, { immediate: true });
        currentSnap = index;
        unlockEarliestAt = performance.now() + 120;
        scheduleUnlock();
        if (index + 2 <= 4) preloadChapter(index + 2);
      },
    });
  }

  // Capture phase fires before Lenis — stopImmediatePropagation
  // prevents Lenis accumulating deltaY on fast/hard scrolls.
  window.addEventListener('wheel', (e) => {
    const total    = section.offsetHeight - window.innerHeight;
    const scrolled = lenis.scroll - section.offsetTop;
    if (scrolled < -60 || scrolled > total + 60) return;

    const down = e.deltaY > 0;

    if (down && currentSnap < SNAP_POINTS.length - 1) {
      e.preventDefault();
      e.stopImmediatePropagation();
      markChapterInput();
      if (!isAnimating) goToChapter(currentSnap + 1);
      else scheduleUnlock();
    } else if (!down && currentSnap > 0) {
      e.preventDefault();
      e.stopImmediatePropagation();
      markChapterInput();
      if (!isAnimating) goToChapter(currentSnap - 1);
      else scheduleUnlock();
    }
  }, { passive: false, capture: true });

  // Touch support
  let touchStartY = 0;
  window.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    const total    = section.offsetHeight - window.innerHeight;
    const scrolled = lenis.scroll - section.offsetTop;
    if (scrolled < -60 || scrolled > total + 60) return;

    const delta = touchStartY - e.touches[0].clientY;
    if (Math.abs(delta) < 8) return;

    const down = delta > 0;
    const shouldLock =
      isAnimating ||
      (down && currentSnap < SNAP_POINTS.length - 1) ||
      (!down && currentSnap > 0);

    if (shouldLock) {
      e.preventDefault();
      e.stopImmediatePropagation();
      markChapterInput();
      if (isAnimating) scheduleUnlock();
    }
  }, { passive: false, capture: true });

  window.addEventListener('touchend', (e) => {
    const total    = section.offsetHeight - window.innerHeight;
    const scrolled = lenis.scroll - section.offsetTop;
    if (scrolled < -60 || scrolled > total + 60) return;

    const delta = touchStartY - e.changedTouches[0].clientY;
    if (Math.abs(delta) < 25) return;

    if (delta > 0 && currentSnap < SNAP_POINTS.length - 1) {
      markChapterInput();
      if (!isAnimating) goToChapter(currentSnap + 1);
    } else if (delta < 0 && currentSnap > 0) {
      markChapterInput();
      if (!isAnimating) goToChapter(currentSnap - 1);
    }
  }, { passive: true });
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
  preloadFrames();
  startAnimations();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

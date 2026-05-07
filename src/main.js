// ═══════════════════════════════════════════════════════════
//  OpenEnergy — Scroll-Driven Cinematic Homepage
//  Frame-sequence canvas approach for butter-smooth scrubbing
//  Source: 4K (3840×2160) → frames at 1920×1080 @ max quality
//  Retina-aware canvas via devicePixelRatio scaling
// ═══════════════════════════════════════════════════════════

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import '/src/style.css';

gsap.registerPlugin(ScrollTrigger);

// ── Config ──────────────────────────────────────────────────
const FRAME_COUNT   = 240;       // total extracted frames
const FRAME_PATH    = '/frames'; // public/frames/
const FRAME_EXT     = 'jpg';
const PRELOAD_BATCH = 10;        // images to preload simultaneously

// Chapter boundaries (0–1 normalized scroll progress)
// Chapter boundaries perfectly aligned with 5 snap points (20% progress per snap)
const CHAPTERS = [
  { start: 0.10, end: 0.30 },
  { start: 0.30, end: 0.50 },
  { start: 0.50, end: 0.70 },
  { start: 0.70, end: 0.90 },
  { start: 0.90, end: 1.00 },
];

// ── DOM ─────────────────────────────────────────────────────
const preloader     = document.getElementById('preloader');
const preloaderFill = document.getElementById('preloader-fill');
const preloaderText = document.getElementById('preloader-text');
const navbar        = document.getElementById('navbar');
const canvas        = document.getElementById('energy-canvas');
const ctx           = canvas.getContext('2d', { alpha: false, desynchronized: true });

const overlays      = document.querySelectorAll('.overlay-panel');

// ── State ────────────────────────────────────────────────────
const images     = new Array(FRAME_COUNT);
let loadedCount  = 0;
let currentFrame = 0;

// ── Canvas — Retina-aware resize & cover-fit draw ────────────
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;

  // Physical pixel buffer — prevents blur on Retina / HiDPI screens
  canvas.width  = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);

  // Keep CSS display size unchanged
  canvas.style.width  = cssW + 'px';
  canvas.style.height = cssH + 'px';

  // Scale context so draw coordinates stay in CSS pixels
  ctx.scale(dpr, dpr);

  // Best-quality interpolation when upscaling frames
  ctx.imageSmoothingEnabled  = true;
  ctx.imageSmoothingQuality  = 'high';

  drawFrame(currentFrame);
}

/**
 * Draw a single frame to canvas maintaining cover-fit
 * Equivalent to CSS object-fit: cover — no distortion, no black bars.
 */
function drawFrame(index) {
  const img = images[index];
  if (!img || !img.complete || img.naturalWidth === 0) return;

  const dpr = window.devicePixelRatio || 1;
  const cw  = canvas.width  / dpr;   // CSS logical width
  const ch  = canvas.height / dpr;   // CSS logical height
  const iw  = img.naturalWidth;      // 1920
  const ih  = img.naturalHeight;     // 1080

  const scale = Math.max(cw / iw, ch / ih);
  const dw    = iw * scale;
  const dh    = ih * scale;
  const dx    = (cw - dw) / 2;
  const dy    = (ch - dh) / 2;

  ctx.drawImage(img, dx, dy, dw, dh);
}

window.addEventListener('resize', () => {
  // Re-scale context after resize (scale resets on buffer resize)
  resizeCanvas();
}, { passive: true });

// ── Preloader helpers ────────────────────────────────────────
function setPreloader(pct, msg) {
  preloaderFill.style.width = `${pct}%`;
  if (msg) preloaderText.textContent = msg;
}

function hidePreloader() {
  preloader.classList.add('hidden');
  setTimeout(() => { if (preloader.parentNode) preloader.remove(); }, 700);
  startAnimations();
}

// ── Frame Preloading ─────────────────────────────────────────
/**
 * Loads all frames in parallel batches.
 * Critical frames (first 10 + last 10) are loaded first
 * so the scroll section is immediately visible.
 */
function preloadFrames() {
  setPreloader(5, 'Loading cinematic frames...');

  // Priority: first 30 frames first so hero video appears fast
  const priorityEnd = Math.min(30, FRAME_COUNT);
  const priorityIndices = Array.from({ length: priorityEnd }, (_, i) => i);
  const restIndices = Array.from({ length: FRAME_COUNT - priorityEnd }, (_, i) => i + priorityEnd);

  let firstFrameReady = false;

  function loadImage(index) {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';

      img.onload = () => {
        images[index] = img;
        loadedCount++;

        const pct = 5 + (loadedCount / FRAME_COUNT) * 90;
        setPreloader(Math.min(95, pct), `Loading frames... ${loadedCount}/${FRAME_COUNT}`);

        // Show first frame and hide preloader once priority frames done
        if (!firstFrameReady && index === 0) {
          firstFrameReady = true;
          drawFrame(0);
        }

        resolve();
      };

      img.onerror = () => {
        // Skip missing frames gracefully
        images[index] = null;
        loadedCount++;
        resolve();
      };

      img.src = `${FRAME_PATH}/frame_${String(index + 1).padStart(4, '0')}.${FRAME_EXT}`;
    });
  }

  async function loadBatch(indices) {
    for (let i = 0; i < indices.length; i += PRELOAD_BATCH) {
      const batch = indices.slice(i, i + PRELOAD_BATCH);
      await Promise.all(batch.map(loadImage));
    }
  }

  // Load priority frames, show UI, then continue loading the rest
  loadBatch(priorityIndices).then(() => {
    setPreloader(40, 'Almost ready...');
    drawFrame(0);
    // Hide preloader after first critical frames are loaded
    setTimeout(() => {
      setPreloader(100, 'Launching...');
      setTimeout(hidePreloader, 300);
    }, 200);
    // Continue loading remaining frames in background
    loadBatch(restIndices);
  });
}

// ── Scroll → Frame Sync ──────────────────────────────────────
function setupScrollSync() {
  const section     = document.getElementById('cinematic-section');
  const heroOverlay = document.getElementById('hero-overlay');

  // Lenis replaces OS momentum scroll with its own lerped physics,
  // eliminating the decelerating-momentum lag on frame updates.
  // autoRaf: false — GSAP ticker drives the RAF so both stay in sync.
  const lenis = new Lenis({ lerp: 0.1, autoRaf: false });

  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  let scrollProgress = 0;

  lenis.on('scroll', ({ scroll }) => {
    const total    = section.offsetHeight - window.innerHeight;
    const scrolled = scroll - section.offsetTop;
    const progress = Math.max(0, Math.min(1, scrolled / total));
    scrollProgress = progress;

    const frameIndex = Math.min(FRAME_COUNT - 1, Math.floor(progress * FRAME_COUNT));
    if (frameIndex !== currentFrame) {
      currentFrame = frameIndex;
      drawFrame(currentFrame);
    }

    if (heroOverlay) {
      if (progress < 0.10) {
        heroOverlay.style.opacity = String(1 - progress / 0.10);
        heroOverlay.style.pointerEvents = 'auto';
      } else {
        heroOverlay.style.opacity = '0';
        heroOverlay.style.pointerEvents = 'none';
      }
    }

    activateChapter(progress);
  });

  // ── End-of-story hold ───────────────────────────────────────
  // When the user reaches the last chapter, lock scroll and wait
  // for one explicit scroll gesture before revealing the rest of the site.
  const endHint = document.createElement('div');
  endHint.id = 'end-scroll-hint';
  endHint.innerHTML = '<div class="end-hint-arrow"></div><span>Scroll to continue</span>';
  document.body.appendChild(endHint);

  let lockedAtEnd  = false;
  let unlockSignal = null; // AbortController for unlock listeners

  function lockAtEnd() {
    lockedAtEnd = true;
    lenis.stop();
    endHint.classList.add('visible');

    // Abort any previous unlock listeners before attaching new ones
    if (unlockSignal) unlockSignal.abort();
    unlockSignal = new AbortController();
    const { signal } = unlockSignal;

    let touchStartY = 0;

    window.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) < 3) return;
      unlockSignal.abort();
      unlockAndContinue(e.deltaY > 0 ? 'down' : 'up');
    }, { passive: true, signal });

    window.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
    }, { passive: true, signal });

    window.addEventListener('touchend', (e) => {
      const delta = touchStartY - e.changedTouches[0].clientY;
      if (Math.abs(delta) > 20) {
        unlockSignal.abort();
        unlockAndContinue(delta > 0 ? 'down' : 'up');
      }
    }, { passive: true, signal });
  }

  function unlockAndContinue(direction) {
    if (!lockedAtEnd) return;
    lockedAtEnd = false;
    endHint.classList.remove('visible');
    lenis.start();

    const total = section.offsetHeight - window.innerHeight;
    if (direction === 'down') {
      lenis.scrollTo(document.getElementById('stats'), {
        duration: 1.0,
        easing: (t) => 1 - Math.pow(1 - t, 4),
      });
    } else {
      // Scroll back up to chapter 4
      lenis.scrollTo(section.offsetTop + 0.8 * total, {
        duration: 0.9,
        easing: (t) => 1 - Math.pow(1 - t, 4),
      });
    }
  }

  // CTA button inside the last overlay — clicking it while locked unlocks and jumps to contact
  const lastCTA = document.getElementById('hero-cta-btn');
  if (lastCTA) {
    lastCTA.addEventListener('click', (e) => {
      if (!lockedAtEnd) return;
      e.preventDefault();
      if (unlockSignal) unlockSignal.abort();
      lockedAtEnd = false;
      endHint.classList.remove('visible');
      lenis.start();
      setTimeout(() => {
        lenis.scrollTo(document.getElementById('contact'), {
          duration: 1.1,
          easing: (t) => 1 - Math.pow(1 - t, 4),
        });
      }, 80);
    });
  }

  // ── Chapter snap ─────────────────────────────────────────────
  const SNAP_POINTS = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
  let isSnapping = false;

  function snapToNearestChapter() {
    if (isSnapping || lockedAtEnd) return;

    const total    = section.offsetHeight - window.innerHeight;
    const scrolled = lenis.scroll - section.offsetTop;

    // Don't snap when outside the cinematic section
    if (scrolled < -window.innerHeight * 0.5 || scrolled > total + window.innerHeight * 0.5) return;

    const nearest = SNAP_POINTS.reduce((prev, curr) =>
      Math.abs(curr - scrollProgress) < Math.abs(prev - scrollProgress) ? curr : prev
    );

    const targetScroll = section.offsetTop + nearest * total;
    if (Math.abs(lenis.scroll - targetScroll) < 10) {
      // Already sitting at this snap point — lock if it's the last one
      if (nearest === 1.0 && !lockedAtEnd) lockAtEnd();
      return;
    }

    isSnapping = true;
    lenis.scrollTo(targetScroll, {
      duration: 0.9,
      easing: (t) => 1 - Math.pow(1 - t, 4),
      onComplete: () => {
        setTimeout(() => {
          isSnapping = false;
          if (nearest === 1.0) lockAtEnd();
        }, 50);
      },
    });
  }

  // scrollend is supported in all modern browsers (Chrome 114+, FF 109+, Safari 17.4+)
  if ('onscrollend' in window) {
    window.addEventListener('scrollend', snapToNearestChapter);
  } else {
    let snapTimer;
    window.addEventListener('scroll', () => {
      clearTimeout(snapTimer);
      snapTimer = setTimeout(snapToNearestChapter, 120);
    }, { passive: true });
  }
}

// ── Chapter Overlay System ───────────────────────────────────
function activateChapter(progress) {
  overlays.forEach((panel, i) => {
    const ch       = CHAPTERS[i];
    const isActive = progress >= ch.start && progress < ch.end;
    panel.classList.toggle('active', isActive);
  });
  if (progress >= 0.85) overlays[4].classList.add('active');
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

  gsap.to(words, {
    opacity: 1, y: 0,
    duration: 0.9,
    stagger: 0.12,
    ease: 'power3.out',
    delay: 0.2,
  });
  gsap.to(sub, {
    opacity: 1, y: 0,
    duration: 0.9,
    ease: 'power3.out',
    delay: 0.65,
  });
  gsap.to(hint, {
    opacity: 1,
    duration: 1,
    ease: 'power2.out',
    delay: 1.3,
  });
}

// ── Scroll Reveal ────────────────────────────────────────────
function setupReveals() {
  const targets = [
    ...document.querySelectorAll('.stat-item'),
    ...document.querySelectorAll('.solution-card'),
    ...document.querySelectorAll('.tech-item'),
    document.querySelector('.about-text'),
    document.querySelector('.about-visual'),
    document.querySelector('.contact-form'),
  ].filter(Boolean);

  targets.forEach(el => el.classList.add('reveal'));

  gsap.utils.toArray('.reveal').forEach((el, i) => {
    gsap.to(el, {
      opacity: 1, y: 0,
      duration: 0.8,
      ease: 'power3.out',
      delay: (i % 3) * 0.08,
      scrollTrigger: {
        trigger: el,
        start: 'top 88%',
        toggleActions: 'play none none none',
      },
    });
  });
}

// ── Stats Counters ───────────────────────────────────────────
function setupCounters() {
  document.querySelectorAll('.stat-number').forEach(el => {
    const target = parseInt(el.dataset.target, 10);
    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        gsap.to({ val: 0 }, {
          val: target,
          duration: 2,
          ease: 'power2.out',
          onUpdate: function () {
            el.textContent = Math.round(this.targets()[0].val);
          },
        });
      },
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
    setTimeout(() => { btn.querySelector('span').textContent = 'Send Message'; }, 3000);
  });
}

// ── Master Init ──────────────────────────────────────────────
function startAnimations() {
  animateHero();
  setupNavbar();
  setupScrollSync();
  setupReveals();
  setupCounters();
  setupContactForm();
  ScrollTrigger.refresh();
}

function init() {
  resizeCanvas();
  preloadFrames();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

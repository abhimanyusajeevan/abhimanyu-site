/* =====================================================================
   motion.js — Library-light motion polish
   ---------------------------------------------------------------------
   Three behaviors, opt-in via data-attributes only. Designed to NOT
   double-fire against the existing .reveal IntersectionObserver in
   main.js — we only handle elements that opt in by attribute.

     [data-tilt] / [data-tilt="<deg>"]   3D tilt-on-cursor (cards)
     <div class="sticky-story">…</div>   Rail-syncs-to-frame on scroll
     [data-hero-scrub]                   Subtle scroll-driven zoom

   GSAP is OPTIONAL and feature-detected. If GSAP loaded, tilt uses
   gsap.quickTo for buttery smoothing and ScrollTrigger drives hero-
   scrub. If GSAP didn't load (CDN failure, offline), we fall back to
   plain rAF + IntersectionObserver — everything still works.
   ---------------------------------------------------------------------
   prefers-reduced-motion: early return, the rest of the site still
   animates via the existing .reveal IntersectionObserver in main.js
   (which is itself reduced-motion-safe via styles.css).
   ===================================================================== */

(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia &&
                             window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  var hasGSAP = typeof gsap !== 'undefined';
  var hasScrollTrigger = hasGSAP && typeof ScrollTrigger !== 'undefined';
  if (hasScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  // Touch devices skip cursor-driven effects (no hover model)
  var isTouchOnly = window.matchMedia && window.matchMedia('(hover: none)').matches;

  /* ===== 1. Tilt cards =============================================== */
  document.querySelectorAll('[data-tilt]').forEach(function (card) {
    if (isTouchOnly) return;

    var maxTilt = parseFloat(card.dataset.tilt) || 6;
    var lift = parseFloat(card.dataset.tiltLift) || 6; // px translate Z effect
    var rect = null;

    if (hasGSAP) {
      // GSAP path — quickTo gives natural easing without writing rAF loops
      var qX = gsap.quickTo(card, 'rotationY', { duration: 0.55, ease: 'power3.out' });
      var qY = gsap.quickTo(card, 'rotationX', { duration: 0.55, ease: 'power3.out' });
      var qLift = gsap.quickTo(card, 'y', { duration: 0.55, ease: 'power3.out' });
      gsap.set(card, { transformPerspective: 900, transformOrigin: 'center' });

      card.addEventListener('mouseenter', function () {
        rect = card.getBoundingClientRect();
        card.dataset.tiltActive = 'true';
      });
      card.addEventListener('mousemove', function (e) {
        if (!rect) rect = card.getBoundingClientRect();
        var nx = (e.clientX - rect.left) / rect.width - 0.5;   // -0.5..0.5
        var ny = (e.clientY - rect.top) / rect.height - 0.5;
        qX(nx * maxTilt);
        qY(-ny * maxTilt);
        qLift(-lift);
      });
      card.addEventListener('mouseleave', function () {
        qX(0); qY(0); qLift(0);
        card.dataset.tiltActive = 'false';
      });
    } else {
      // Vanilla fallback — manual lerp via rAF
      var raf = null, x = 0, y = 0, tx = 0, ty = 0, tl = 0, lz = 0;

      function step() {
        x += (tx - x) * 0.15;
        y += (ty - y) * 0.15;
        lz += (tl - lz) * 0.15;
        card.style.transform =
          'perspective(900px)' +
          ' translateY(' + lz.toFixed(2) + 'px)' +
          ' rotateX(' + (-y * maxTilt).toFixed(2) + 'deg)' +
          ' rotateY(' + (x * maxTilt).toFixed(2) + 'deg)';
        if (Math.abs(tx - x) > 0.001 || Math.abs(ty - y) > 0.001 || Math.abs(tl - lz) > 0.05) {
          raf = requestAnimationFrame(step);
        } else {
          raf = null;
        }
      }
      card.addEventListener('mouseenter', function () {
        rect = card.getBoundingClientRect();
        card.dataset.tiltActive = 'true';
      });
      card.addEventListener('mousemove', function (e) {
        if (!rect) rect = card.getBoundingClientRect();
        tx = (e.clientX - rect.left) / rect.width - 0.5;
        ty = (e.clientY - rect.top) / rect.height - 0.5;
        tl = -lift;
        if (!raf) raf = requestAnimationFrame(step);
      });
      card.addEventListener('mouseleave', function () {
        tx = 0; ty = 0; tl = 0;
        if (!raf) raf = requestAnimationFrame(step);
        card.dataset.tiltActive = 'false';
      });
    }
  });

  /* ===== 2. Sticky story ============================================= */
  document.querySelectorAll('.sticky-story').forEach(function (story) {
    var rail = story.querySelector('.sticky-rail');
    var frames = story.querySelectorAll('.sticky-frames > [data-frame-id]');
    if (!rail || !frames.length) return;
    var railItems = {};
    rail.querySelectorAll('[data-rail-id]').forEach(function (li) {
      railItems[li.dataset.railId] = li;
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var fid = entry.target.dataset.frameId;
        Object.keys(railItems).forEach(function (rid) {
          railItems[rid].dataset.active = (rid === fid) ? 'true' : 'false';
        });
      });
    }, { threshold: 0.5, rootMargin: '-20% 0px -30% 0px' });

    frames.forEach(function (f) { io.observe(f); });

    // Click rail item → smooth scroll to its frame
    rail.querySelectorAll('[data-rail-id]').forEach(function (li) {
      li.addEventListener('click', function () {
        var fid = li.dataset.railId;
        var target = story.querySelector('[data-frame-id="' + fid + '"]');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  });

  /* ===== 3. Hero scrub — subtle scroll-zoom on tagged hero img/video = */
  document.querySelectorAll('[data-hero-scrub]').forEach(function (el) {
    var trigger = el.closest('section, header') || el;

    if (hasScrollTrigger) {
      gsap.fromTo(el,
        { scale: 1.0 },
        {
          scale: 1.16,
          ease: 'none',
          scrollTrigger: {
            trigger: trigger,
            start: 'top top',
            end: 'bottom top',
            scrub: 1
          }
        }
      );
    } else {
      // Vanilla fallback — passive scroll with rAF
      var ticking = false;
      function update() {
        var rect = trigger.getBoundingClientRect();
        var h = window.innerHeight;
        var raw = (rect.bottom - h) / (rect.bottom - rect.top - h);
        var p = Math.max(0, Math.min(1, 1 - raw));
        var scale = 1 + p * 0.16;
        el.style.transform = 'scale(' + scale.toFixed(3) + ')';
        ticking = false;
      }
      window.addEventListener('scroll', function () {
        if (!ticking) {
          window.requestAnimationFrame(update);
          ticking = true;
        }
      }, { passive: true });
      update();
    }
  });
})();

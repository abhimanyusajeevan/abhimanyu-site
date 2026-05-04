/* =====================================================================
   motion.js — Cinematic motion enhancements
   ---------------------------------------------------------------------
   Layers GSAP-driven motion on top of the basic IntersectionObserver
   reveals already in main.js. Drop-in: load AFTER main.js plus the
   GSAP / ScrollTrigger / Lenis CDN scripts; reads data-attributes on
   markup so you can wire per-element behavior without touching JS.
   ---------------------------------------------------------------------
   Behaviors:
     [data-anim="reveal"]              Section reveal (children stagger)
     [data-anim="reveal-soft"]         Lighter reveal (fade + 12px lift)
     [data-count="<n>"]                Count up to n on scroll-in
       data-count-suffix=""            optional suffix ("M+", "%", "x")
       data-count-prefix=""            optional prefix
       data-count-format="million"     scale to M (e.g. 30M+) or "integer"
     [data-split="words"]              Per-word reveal with mask
     [data-magnetic]                   Cursor magnet on hover
     [data-parallax-img]               Mild parallax on the element
   ===================================================================== */

(function () {
  'use strict';

  // Bail out gracefully if the user prefers reduced motion. The existing
  // CSS / IntersectionObserver still handles basic reveals — we just
  // don't add the cinematic layer on top.
  var prefersReducedMotion = window.matchMedia &&
                             window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  // Hard requirement: GSAP + ScrollTrigger. Lenis is optional.
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    console.warn('[motion] GSAP / ScrollTrigger not loaded — cinematic motion skipped');
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  // ===== Lenis smooth scroll =====
  // Hooked into GSAP's ticker so ScrollTrigger reads Lenis's scroll, not
  // native scroll. Mobile keeps native momentum scroll because hijacked
  // smooth-scroll on touch fights the OS and feels broken.
  var lenis = null;
  if (typeof Lenis === 'function') {
    try {
      lenis = new Lenis({
        duration: 1.05,
        easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
        smoothWheel: true,
        smoothTouch: false,
        wheelMultiplier: 1,
        touchMultiplier: 1.5
      });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    } catch (e) {
      console.warn('[motion] Lenis init failed; falling back to native scroll', e);
      lenis = null;
    }
  }

  // (Section-head + card-grid auto-reveals deliberately removed: the site
  // already has a .reveal-class IntersectionObserver in main.js plus its
  // own count-up system on [data-counter]/[data-target]. Layering GSAP
  // ScrollTrigger reveals on those same elements would either double-
  // animate or steal the initial state. motion.js now only handles
  // behaviors that don't exist anywhere else.)

  // ===== Lighter reveal-soft =====
  document.querySelectorAll('[data-anim="reveal-soft"]').forEach(function (el) {
    gsap.set(el, { y: 18, opacity: 0 });
    gsap.to(el, {
      y: 0, opacity: 1,
      duration: 0.9, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true }
    });
  });

  // ===== Count-up numbers =====
  function formatVal(v, fmt) {
    if (fmt === 'million') {
      // 30000000 -> "30M"
      return Math.round(v / 1e6) + 'M';
    }
    if (fmt === 'thousand') {
      return Math.round(v / 1e3) + 'K';
    }
    return Math.round(v).toLocaleString('en-IN');
  }

  document.querySelectorAll('[data-count]').forEach(function (el) {
    var target = parseFloat(el.getAttribute('data-count'));
    if (isNaN(target)) return;
    var suffix = el.getAttribute('data-count-suffix') || '';
    var prefix = el.getAttribute('data-count-prefix') || '';
    var fmt    = el.getAttribute('data-count-format') || 'integer';
    var dur    = parseFloat(el.getAttribute('data-count-duration')) || 1.8;

    // Reserve text width to prevent layout shift while counting
    el.textContent = prefix + formatVal(target, fmt) + suffix;
    var w = el.getBoundingClientRect().width;
    el.style.minWidth = w.toFixed(1) + 'px';
    el.textContent = prefix + formatVal(0, fmt) + suffix;

    var obj = { v: 0 };
    gsap.to(obj, {
      v: target,
      duration: dur,
      ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      onUpdate: function () {
        el.textContent = prefix + formatVal(obj.v, fmt) + suffix;
      }
    });
  });

  // ===== Split-words reveal =====
  document.querySelectorAll('[data-split="words"]').forEach(function (el) {
    // Walk text nodes only; preserve nested elements (e.g. <span class="accent">)
    function splitTextNode(node) {
      var text = node.nodeValue || '';
      if (!text.trim()) return [];
      var parent = node.parentNode;
      var frag = document.createDocumentFragment();
      var parts = text.split(/(\s+)/);
      var inners = [];
      parts.forEach(function (part) {
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
        } else if (part.length) {
          var wrap = document.createElement('span');
          wrap.className = 'sw';
          wrap.style.display = 'inline-block';
          wrap.style.overflow = 'hidden';
          wrap.style.verticalAlign = 'top';
          var inner = document.createElement('span');
          inner.className = 'sw-i';
          inner.style.display = 'inline-block';
          inner.style.willChange = 'transform';
          inner.textContent = part;
          wrap.appendChild(inner);
          frag.appendChild(wrap);
          inners.push(inner);
        }
      });
      parent.replaceChild(frag, node);
      return inners;
    }

    var allInners = [];
    function walk(node) {
      var children = Array.prototype.slice.call(node.childNodes);
      children.forEach(function (child) {
        if (child.nodeType === 3) {
          allInners = allInners.concat(splitTextNode(child));
        } else if (child.nodeType === 1 && !child.classList.contains('sw')) {
          walk(child);
        }
      });
    }
    walk(el);

    if (!allInners.length) return;
    gsap.set(allInners, { yPercent: 110 });
    gsap.to(allInners, {
      yPercent: 0,
      duration: 1.0,
      ease: 'expo.out',
      stagger: 0.05,
      scrollTrigger: { trigger: el, start: 'top 90%', once: true }
    });
  });

  // ===== Magnetic CTAs =====
  document.querySelectorAll('[data-magnetic]').forEach(function (el) {
    // Skip on touch devices (no hover model)
    if (window.matchMedia('(hover: none)').matches) return;
    var rect = null;
    var strength = parseFloat(el.getAttribute('data-magnetic-strength')) || 0.22;
    var qX = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
    var qY = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });

    el.addEventListener('mouseenter', function () {
      rect = el.getBoundingClientRect();
    });
    el.addEventListener('mousemove', function (e) {
      if (!rect) rect = el.getBoundingClientRect();
      var dx = (e.clientX - rect.left - rect.width / 2) * strength;
      var dy = (e.clientY - rect.top - rect.height / 2) * strength;
      qX(dx); qY(dy);
    });
    el.addEventListener('mouseleave', function () {
      gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.45)' });
    });
  });

  // ===== Parallax images =====
  document.querySelectorAll('[data-parallax-img]').forEach(function (el) {
    var amount = parseFloat(el.getAttribute('data-parallax-img')) || 12;
    gsap.fromTo(el,
      { yPercent: amount * 0.5 },
      {
        yPercent: -amount * 0.5,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true
        }
      }
    );
  });

  // ===== Hero specific: subtle long-haul zoom on the hero video =====
  // Only the home hero — gives the hero footage a slow push-in over
  // the first 1500px of scroll.
  var heroVideo = document.querySelector('.hero .hero-video-bg video');
  if (heroVideo && document.querySelector('.hero')) {
    gsap.to(heroVideo, {
      scale: 1.18,
      ease: 'none',
      scrollTrigger: {
        trigger: '.hero',
        start: 'top top',
        end: 'bottom top',
        scrub: 1
      }
    });
  }

  // (Marquee left untouched — it already has its own CSS keyframe loop;
  //  layering a GSAP transform on top would clobber the scroll-linked
  //  animation. Add a wrapper element if depth is wanted later.)

  // Recalculate ScrollTrigger positions once every reveal animation has
  // had a chance to set its initial state (otherwise the first refresh
  // happens before split-words spans exist and triggers fire too early)
  setTimeout(function () { ScrollTrigger.refresh(); }, 60);

})();

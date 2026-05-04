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

  /* ===== 0. Lenis smooth-scroll =======================================
     Native momentum kept on touch (smoothTouch:false). Hooked into
     ScrollTrigger.update so scroll-driven GSAP timelines stay synced.
     Native window.scrollY still updates correctly, so main.js's
     existing scroll handlers (nav shadow, floater, parallax) all work.
  ====================================================================== */
  var lenis = null;
  if (typeof Lenis === 'function' && !isTouchOnly) {
    try {
      lenis = new Lenis({
        duration: 1.05,
        easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
        smoothWheel: true,
        smoothTouch: false,
        wheelMultiplier: 1,
        touchMultiplier: 1.5
      });
      if (hasScrollTrigger) {
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
        gsap.ticker.lagSmoothing(0);
      } else {
        function raf(t) { lenis.raf(t); requestAnimationFrame(raf); }
        requestAnimationFrame(raf);
      }
      // Make all in-page anchor clicks use Lenis so they feel consistent
      document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[href^="#"]');
        if (!a) return;
        var id = a.getAttribute('href');
        if (id.length < 2) return;
        var target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -80, duration: 1.2 });
      });
    } catch (e) {
      console.warn('[motion] Lenis init failed; falling back to native scroll', e);
      lenis = null;
    }
  }

  /* ===== 0b. Magnetic CTAs ===========================================
     Auto-applies to .btn-primary so we don't have to tag every button,
     plus any element with [data-magnetic]. Skipped on touch.
  ====================================================================== */
  var magneticTargets = document.querySelectorAll('.btn-primary, [data-magnetic]');
  magneticTargets.forEach(function (el) {
    if (isTouchOnly) return;
    if (el.dataset.magneticOff === 'true') return;
    var rect = null;
    var strength = parseFloat(el.dataset.magneticStrength) || 0.18;
    if (hasGSAP) {
      var qX = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
      var qY = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
      el.addEventListener('mouseenter', function () { rect = el.getBoundingClientRect(); });
      el.addEventListener('mousemove', function (e) {
        if (!rect) rect = el.getBoundingClientRect();
        qX((e.clientX - rect.left - rect.width / 2) * strength);
        qY((e.clientY - rect.top - rect.height / 2) * strength);
      });
      el.addEventListener('mouseleave', function () {
        gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)' });
      });
    } else {
      var raf = null, x = 0, y = 0, tx = 0, ty = 0;
      function step() {
        x += (tx - x) * 0.18; y += (ty - y) * 0.18;
        el.style.transform = 'translate(' + x.toFixed(2) + 'px, ' + y.toFixed(2) + 'px)';
        if (Math.abs(tx - x) > 0.05 || Math.abs(ty - y) > 0.05) raf = requestAnimationFrame(step);
        else raf = null;
      }
      el.addEventListener('mouseenter', function () { rect = el.getBoundingClientRect(); });
      el.addEventListener('mousemove', function (e) {
        if (!rect) rect = el.getBoundingClientRect();
        tx = (e.clientX - rect.left - rect.width / 2) * strength;
        ty = (e.clientY - rect.top - rect.height / 2) * strength;
        if (!raf) raf = requestAnimationFrame(step);
      });
      el.addEventListener('mouseleave', function () { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(step); });
    }
  });

  /* ===== 0c. Section-head auto-reveal ================================
     Skipped if the section-head children already use the existing
     .reveal class (so we never double-fire against main.js). Otherwise
     applies a soft staggered reveal via IntersectionObserver.
  ====================================================================== */
  document.querySelectorAll('section .section-head').forEach(function (head) {
    var children = head.querySelectorAll('.eyebrow, h1, h2, h3, p, .btn');
    if (!children.length) return;
    // If ANY child already has .reveal, leave the whole head alone —
    // main.js's IntersectionObserver will animate them.
    var alreadyManaged = Array.prototype.some.call(children, function (c) {
      return c.classList.contains('reveal') ||
             c.classList.contains('reveal-left') ||
             c.classList.contains('reveal-right') ||
             c.classList.contains('reveal-scale');
    });
    if (alreadyManaged) return;

    children.forEach(function (c, i) {
      c.style.opacity = '0';
      c.style.transform = 'translateY(28px)';
      c.style.transition = 'opacity 0.8s cubic-bezier(0.2,0.8,0.2,1), transform 0.8s cubic-bezier(0.2,0.8,0.2,1)';
      c.style.transitionDelay = (i * 0.08) + 's';
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          children.forEach(function (c) { c.style.opacity = '1'; c.style.transform = 'none'; });
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });
    io.observe(head);
  });

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

  /* ===== 2b. Round-rail — horizontal pinned scroll =================
     A section that pins on desktop while the user scrolls vertically;
     six round cards translate horizontally underneath. Mobile bypasses
     pin and uses native scroll-snap (set up in motion.css).
  ====================================================================== */
  document.querySelectorAll('.round-rail-section').forEach(function (section) {
    var track = section.querySelector('[data-round-track]');
    var cards = track ? track.querySelectorAll('[data-round-card]') : [];
    if (!track || !cards.length) return;

    var progressNum = section.querySelector('[data-progress-num]');
    var progressFill = section.querySelector('[data-progress-fill]');
    var total = cards.length;

    function setProgress(pct) {
      var idx = Math.min(total, Math.max(1, Math.ceil(pct * total)));
      if (progressNum) progressNum.textContent = idx;
      if (progressFill) progressFill.style.width = (pct * 100).toFixed(1) + '%';
    }

    // ---- Mobile: native scroll-snap path -----------------------------
    var isMobile = window.matchMedia('(max-width: 860px)').matches;
    if (isMobile) {
      // Mark every card no-anim so its title/text show immediately.
      cards.forEach(function (c) { c.classList.add('no-anim'); });

      // Pick whichever card's center is closest to the viewport center.
      // We listen on BOTH the track (horizontal swipe) and the window
      // (vertical scroll shifts the section under-foot too). Computing
      // from getBoundingClientRect avoids depending on track.scrollLeft,
      // which iOS Safari sometimes throttles or zeroes during snap.
      function updateMobileProgress() {
        var viewCenter = window.innerWidth / 2;
        var bestIdx = 0;
        var bestDist = Infinity;
        for (var i = 0; i < cards.length; i++) {
          var r = cards[i].getBoundingClientRect();
          var c = r.left + r.width / 2;
          var d = Math.abs(c - viewCenter);
          if (d < bestDist) { bestDist = d; bestIdx = i; }
        }
        // Map the active card index 1..total onto a smooth 0..1 fill so
        // the bar moves between cards too.
        var pct = (bestIdx + 0.5) / total;
        setProgress(pct);
        // Also flash the actual round number directly to bypass the
        // ceil() rounding (which can lag the visible card by one).
        if (progressNum) progressNum.textContent = bestIdx + 1;
      }

      var rafId = null;
      function scheduleMobileUpdate() {
        if (rafId) return;
        rafId = requestAnimationFrame(function () {
          rafId = null;
          updateMobileProgress();
        });
      }

      track.addEventListener('scroll',  scheduleMobileUpdate, { passive: true });
      window.addEventListener('scroll', scheduleMobileUpdate, { passive: true });
      window.addEventListener('resize', scheduleMobileUpdate, { passive: true });

      // First paint
      updateMobileProgress();
      return;
    }

    // ---- Desktop: GSAP pin path -------------------------------------
    if (!hasScrollTrigger) {
      // GSAP missing — give every card the activated state so the user
      // still sees the card content (no horizontal pin available).
      cards.forEach(function (c) { c.classList.add('no-anim'); });
      return;
    }

    // Compute the scroll distance: track width minus what's already
    // visible (allow a small tail so the last card breathes at the edge).
    function getScrollDistance() {
      return Math.max(0, track.scrollWidth - section.clientWidth + 60);
    }

    var tween = gsap.to(track, {
      x: function () { return -getScrollDistance(); },
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: function () { return '+=' + getScrollDistance(); },
        pin: '.round-rail-pin',
        scrub: 0.5,
        invalidateOnRefresh: true,
        anticipatePin: 1,
        onEnter: function () { section.classList.add('is-pinning'); },
        onLeave: function () { section.classList.remove('is-pinning'); },
        onEnterBack: function () { section.classList.add('is-pinning'); },
        onLeaveBack: function () { section.classList.remove('is-pinning'); },
        onUpdate: function (self) {
          setProgress(self.progress);
          // Activate the card whose center is closest to the viewport
          // center, accounting for the live transform on the track.
          var trackRect = track.getBoundingClientRect();
          var viewCenter = window.innerWidth / 2;
          var nearest = 0;
          var nearestDist = Infinity;
          for (var i = 0; i < cards.length; i++) {
            var r = cards[i].getBoundingClientRect();
            var c = r.left + r.width / 2;
            var d = Math.abs(c - viewCenter);
            if (d < nearestDist) { nearestDist = d; nearest = i; }
          }
          for (var j = 0; j < cards.length; j++) {
            cards[j].classList.toggle('is-active', j === nearest);
          }
        }
      }
    });

    // Pre-activate the first card so it's not blank during the brief
    // moment before the user starts scrolling.
    cards[0].classList.add('is-active');
    setProgress(0.001);
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

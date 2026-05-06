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
      var qZ = gsap.quickTo(card, 'z', { duration: 0.55, ease: 'power3.out' });
      gsap.set(card, { transformPerspective: 1100, transformOrigin: 'center', transformStyle: 'preserve-3d' });

      card.addEventListener('mouseenter', function () {
        rect = card.getBoundingClientRect();
        card.dataset.tiltActive = 'true';
        qZ(40); // pull the card forward in 3D space
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
        qX(0); qY(0); qLift(0); qZ(0);
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

    // Trigger on the pin element (not the section) so 'top top' means the
    // PIN's top hits the viewport top — otherwise the head pushes the
    // pin halfway down the screen at the moment of pinning and the
    // bottom of the cards gets clipped by the viewport.
    var pinEl = section.querySelector('.round-rail-pin');
    var tween = gsap.to(track, {
      x: function () { return -getScrollDistance(); },
      ease: 'none',
      scrollTrigger: {
        trigger: pinEl,
        start: 'top top',
        end: function () { return '+=' + getScrollDistance(); },
        pin: true,
        scrub: 0.5,
        invalidateOnRefresh: true,
        anticipatePin: 1,
        onEnter: function () { section.classList.add('is-pinning'); },
        onLeave: function () { section.classList.remove('is-pinning'); },
        onEnterBack: function () { section.classList.add('is-pinning'); },
        onLeaveBack: function () { section.classList.remove('is-pinning'); },
        onUpdate: function (self) {
          setProgress(self.progress);
          // Coverflow + active-card pass: each card rotates around the
          // viewport's vertical center axis. Cards left of center tip
          // away to the right, cards right of center tip away to the
          // left, the centered card sits flat. Builds depth without
          // any per-frame asset work.
          var viewCenter = window.innerWidth / 2;
          var nearest = 0;
          var nearestDist = Infinity;
          var maxRot = 28; // degrees at full distance
          var halfView = window.innerWidth / 2;
          for (var i = 0; i < cards.length; i++) {
            var r = cards[i].getBoundingClientRect();
            var c = r.left + r.width / 2;
            var dist = c - viewCenter;
            // Clamp normalised distance to [-1, 1]
            var t = Math.max(-1, Math.min(1, dist / halfView));
            var rotY = t * maxRot;            // -28 .. +28
            var scale = 1 - Math.abs(t) * 0.06; // 1 .. 0.94
            var opacity = 1 - Math.abs(t) * 0.35;
            // Parent has perspective:1400px; card just rotates + scales.
            cards[i].style.transform =
              'rotateY(' + rotY.toFixed(2) + 'deg)' +
              ' scale(' + scale.toFixed(3) + ')';
            cards[i].style.opacity = opacity.toFixed(3);
            cards[i].style.zIndex = String(10 - Math.round(Math.abs(t) * 10));
            var absD = Math.abs(dist);
            if (absD < nearestDist) { nearestDist = absD; nearest = i; }
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

  /* ===== 2c. Hero 3D mouse-parallax ================================
     Cursor moves the hero video one way, the headline content the
     other way, building a parallax depth illusion. Only fires on
     hover-capable viewports.
  ====================================================================== */
  if (!isTouchOnly) {
    document.querySelectorAll('.hero').forEach(function (hero) {
      var bg = hero.querySelector('.hero-video-bg');
      var main = hero.querySelector('.hero-main') || hero.querySelector('.hero-inner');
      var card = hero.querySelector('.hero-card');
      if (!bg && !main) return;
      hero.style.perspective = '1400px';
      hero.style.transformStyle = 'preserve-3d';

      var bgX = 0, bgY = 0, mX = 0, mY = 0, cX = 0, cY = 0;
      var tBgX = 0, tBgY = 0, tMX = 0, tMY = 0, tCX = 0, tCY = 0;
      var raf = null;

      function tick() {
        bgX += (tBgX - bgX) * 0.08;
        bgY += (tBgY - bgY) * 0.08;
        mX  += (tMX  - mX)  * 0.10;
        mY  += (tMY  - mY)  * 0.10;
        cX  += (tCX  - cX)  * 0.10;
        cY  += (tCY  - cY)  * 0.10;
        if (bg)   bg.style.transform   = 'translate3d(' + bgX.toFixed(2) + 'px,' + bgY.toFixed(2) + 'px, -40px)';
        if (main) main.style.transform = 'translate3d(' + mX.toFixed(2) + 'px,' + mY.toFixed(2) + 'px, 30px)';
        if (card) card.style.transform = 'translate3d(' + cX.toFixed(2) + 'px,' + cY.toFixed(2) + 'px, 50px)';
        if (Math.abs(tBgX - bgX) > 0.05 || Math.abs(tMX - mX) > 0.05 || Math.abs(tCX - cX) > 0.05) {
          raf = requestAnimationFrame(tick);
        } else {
          raf = null;
        }
      }
      hero.addEventListener('mousemove', function (e) {
        var rect = hero.getBoundingClientRect();
        var x = (e.clientX - rect.left) / rect.width - 0.5;  // -0.5..0.5
        var y = (e.clientY - rect.top) / rect.height - 0.5;
        // Background moves WITH cursor (closer feel)
        tBgX = x * 18;  tBgY = y * 12;
        // Foreground moves OPPOSITE (parallax depth)
        tMX  = x * -10; tMY  = y * -7;
        tCX  = x * -16; tCY  = y * -10;
        if (!raf) raf = requestAnimationFrame(tick);
      }, { passive: true });
      hero.addEventListener('mouseleave', function () {
        tBgX = 0; tBgY = 0; tMX = 0; tMY = 0; tCX = 0; tCY = 0;
        if (!raf) raf = requestAnimationFrame(tick);
      });
    });
  }

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

  /* ===== 4. Chapter page-fold entrance ==============================
     Each home-page chapter section enters with a subtle rotateX +
     translateZ as it scrolls into the viewport — a paper-fold reveal
     that gives the whole page a 3D scrolling feel. Only fires on
     sections tagged with .chapter (or [data-fold-3d]) and only when
     ScrollTrigger is available; reduced motion already short-circuits
     this whole file.
  ====================================================================== */
  if (hasScrollTrigger) {
    var foldTargets = document.querySelectorAll('.chapter, [data-fold-3d]');
    if (foldTargets.length) {
      // Give the document an ambient perspective so the rotateX renders
      // as 3D depth, not flatten. We scope it on body so it only adds
      // depth where children opt in via transform.
      document.body.style.perspective = '1800px';
      document.body.style.perspectiveOrigin = '50% 30%';

      foldTargets.forEach(function (sec) {
        // Skip if the section already opts out (e.g. round-rail-section
        // is data-anim="off" — handled by its own pin).
        if (sec.dataset.anim === 'off') return;
        if (sec.classList.contains('round-rail-section')) return;
        gsap.set(sec, { transformPerspective: 1800, transformOrigin: 'center 50%' });
        gsap.fromTo(sec,
          { rotateX: -6, z: -80, autoAlpha: 0.65 },
          {
            rotateX: 0, z: 0, autoAlpha: 1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: sec,
              start: 'top 92%',
              end: 'top 50%',
              scrub: 0.6
            }
          }
        );
        // Mirror exit fold as the section leaves the top of the
        // viewport — sections fold back into the page on the way out.
        gsap.fromTo(sec,
          { rotateX: 0, z: 0 },
          {
            rotateX: 4, z: -50,
            ease: 'power2.in',
            scrollTrigger: {
              trigger: sec,
              start: 'bottom 60%',
              end: 'bottom 10%',
              scrub: 0.6
            }
          }
        );
      });
    }
  }

  /* ===== 5. Stat numbers — Z-axis pop ===============================
     Numbers tagged with [data-target] (the count-up convention used
     elsewhere on the site) get an entrance from translateZ(-180px)
     to 0 as they enter view. Combined with the existing count-up,
     the digits feel like they SNAP forward into focus.
  ====================================================================== */
  if (hasScrollTrigger) {
    document.querySelectorAll('[data-target]').forEach(function (el) {
      // The count-up logic lives in main.js; we only handle the entrance
      // transform. Skip if the element is already inside an active hero
      // parallax (the hero-card already animates on Z).
      if (el.closest('.hero-card')) return;
      gsap.set(el, { transformPerspective: 1200, transformOrigin: 'center' });
      gsap.fromTo(el,
        { z: -180, autoAlpha: 0, rotateX: 12 },
        {
          z: 0, autoAlpha: 1, rotateX: 0,
          duration: 0.9,
          ease: 'expo.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 88%',
            once: true
          }
        }
      );
    });
  }

  /* ===== 6. Three.js parallax-divider (one cinematic moment) ========
     Mounts a WebGL scene inside any [data-three-divider] host on the
     page. The CSS fallback (data-loaded="false") renders a flat photo
     bg if Three.js isn't loaded, WebGL isn't supported, or the user
     prefers reduced motion. Scene contents:
       - tilted image plane with the round photo texture-mapped
       - two accent glass panes (green + blue) at the edges, drifting
       - ~220 floating dust particles
       - ambient + directional + accent point lights (rim glow)
       - mouse parallax on the camera (eased)
     Pause when offscreen via IntersectionObserver to save battery.
  ====================================================================== */
  if (!isTouchOnly && typeof THREE !== 'undefined') {
    document.querySelectorAll('[data-three-divider]').forEach(function (host) {
      try { mountThreeDivider(host); }
      catch (err) {
        console.warn('[motion] three-divider failed; falling back to flat bg', err);
        host.dataset.loaded = 'false';
      }
    });
  } else {
    // Mark every divider as fallback so the CSS image kicks in.
    document.querySelectorAll('[data-three-divider]').forEach(function (host) {
      host.dataset.loaded = 'false';
    });
  }

  function mountThreeDivider(host) {
    // Quick WebGL availability check
    var probe = document.createElement('canvas');
    var hasWebGL = !!(probe.getContext('webgl') || probe.getContext('experimental-webgl'));
    if (!hasWebGL) { host.dataset.loaded = 'false'; return; }

    var imgUrl = host.dataset.image || 'assets/images/action-indore.jpg';
    var w = host.clientWidth;
    var h = host.clientHeight;

    var scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x05080e, 5, 16);

    var camera = new THREE.PerspectiveCamera(48, w / h, 0.1, 100);
    camera.position.set(0, 0, 6);

    var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setSize(w, h);
    renderer.outputColorSpace = THREE.SRGBColorSpace || THREE.sRGBEncoding;
    host.appendChild(renderer.domElement);

    // ----- Image plane -----
    var imgPlane = null;
    new THREE.TextureLoader().load(imgUrl, function (tex) {
      if (tex.colorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
      else tex.encoding = THREE.sRGBEncoding;
      // Cover-fit: scale plane to image aspect.
      var img = tex.image;
      var aspect = (img && img.width && img.height) ? (img.width / img.height) : (16 / 9);
      var planeH = 3.4;
      var planeW = planeH * aspect;
      var geom = new THREE.PlaneGeometry(planeW, planeH, 24, 14);
      var mat  = new THREE.MeshStandardMaterial({
        map: tex, metalness: 0.15, roughness: 0.55,
        transparent: true, opacity: 0.96
      });
      imgPlane = new THREE.Mesh(geom, mat);
      imgPlane.rotation.x = -0.04;
      imgPlane.rotation.y = 0.10;
      scene.add(imgPlane);
      host.dataset.loaded = 'true';
    }, undefined, function () { host.dataset.loaded = 'false'; });

    // ----- Accent glass panes -----
    var glassGeom = new THREE.PlaneGeometry(1.6, 3.2, 1, 1);
    var glassMatA = new THREE.MeshStandardMaterial({
      color: 0x22e66b, emissive: 0x22e66b, emissiveIntensity: 0.35,
      metalness: 0.2, roughness: 0.10,
      transparent: true, opacity: 0.18, side: THREE.DoubleSide
    });
    var glassMatB = glassMatA.clone();
    glassMatB.color    = new THREE.Color(0x38a9ff);
    glassMatB.emissive = new THREE.Color(0x38a9ff);

    var glassA = new THREE.Mesh(glassGeom, glassMatA);
    glassA.position.set(-3.6, 0.4, 1.3);
    glassA.rotation.y = 0.45;
    scene.add(glassA);

    var glassB = new THREE.Mesh(glassGeom.clone(), glassMatB);
    glassB.position.set(3.4, -0.5, 1.0);
    glassB.rotation.y = -0.42;
    glassB.scale.set(0.85, 0.78, 1);
    scene.add(glassB);

    // ----- Dust particles -----
    var pCount = 220;
    var pGeom = new THREE.BufferGeometry();
    var pPos = new Float32Array(pCount * 3);
    var pBase = new Float32Array(pCount * 3);
    for (var i = 0; i < pCount; i++) {
      pPos[i*3]   = pBase[i*3]   = (Math.random() - 0.5) * 14;
      pPos[i*3+1] = pBase[i*3+1] = (Math.random() - 0.5) * 8;
      pPos[i*3+2] = pBase[i*3+2] = (Math.random() - 0.5) * 6 - 1.5;
    }
    pGeom.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    var pMat = new THREE.PointsMaterial({
      color: 0xd0e3ff, size: 0.028,
      transparent: true, opacity: 0.55, depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    var particles = new THREE.Points(pGeom, pMat);
    scene.add(particles);

    // ----- Lights -----
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    var dir = new THREE.DirectionalLight(0xffffff, 0.7);
    dir.position.set(2, 3, 4);
    scene.add(dir);
    var greenP = new THREE.PointLight(0x22e66b, 3.0, 9, 1.6);
    greenP.position.set(-3, 2, 2.2);
    scene.add(greenP);
    var blueP = new THREE.PointLight(0x38a9ff, 2.4, 9, 1.6);
    blueP.position.set(3, -1.2, 2);
    scene.add(blueP);

    // ----- Mouse parallax (camera) -----
    var tmx = 0, tmy = 0, mx = 0, my = 0;
    function onMove(e) {
      var r = host.getBoundingClientRect();
      tmx = (e.clientX - r.left) / r.width  - 0.5;
      tmy = (e.clientY - r.top)  / r.height - 0.5;
    }
    function onLeave() { tmx = 0; tmy = 0; }
    host.addEventListener('mousemove', onMove);
    host.addEventListener('mouseleave', onLeave);

    // ----- Pause when offscreen -----
    var visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { visible = e.isIntersecting; });
      }, { threshold: 0.01 }).observe(host);
    }

    // ----- Animation loop -----
    var raf;
    function loop(t) {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      mx += (tmx - mx) * 0.05;
      my += (tmy - my) * 0.05;
      camera.position.x = mx * 0.7;
      camera.position.y = -my * 0.45;
      camera.lookAt(0, 0, 0);

      var s = t * 0.001;
      if (imgPlane) {
        imgPlane.rotation.y = 0.10 + Math.sin(s * 0.4) * 0.04;
        imgPlane.rotation.x = -0.04 + Math.cos(s * 0.3) * 0.025;
        imgPlane.position.y = Math.sin(s * 0.5) * 0.10;
      }
      glassA.rotation.y = 0.45 + Math.sin(s * 0.35) * 0.06;
      glassA.position.y = 0.4 + Math.sin(s * 0.5) * 0.18;
      glassB.rotation.y = -0.42 + Math.cos(s * 0.4) * 0.06;
      glassB.position.y = -0.5 + Math.cos(s * 0.45) * 0.15;

      // Drift particles up + wrap
      var arr = particles.geometry.attributes.position.array;
      for (var j = 0; j < pCount; j++) {
        arr[j*3+1] = pBase[j*3+1] + Math.sin(s * 0.3 + j) * 0.4;
        arr[j*3]   = pBase[j*3]   + Math.cos(s * 0.25 + j * 0.7) * 0.25;
      }
      particles.geometry.attributes.position.needsUpdate = true;
      particles.rotation.y = s * 0.04;

      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(loop);

    // ----- Resize -----
    function resize() {
      var nw = host.clientWidth;
      var nh = host.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    }
    window.addEventListener('resize', resize);
  }

})();

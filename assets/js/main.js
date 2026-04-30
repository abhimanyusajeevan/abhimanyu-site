// Abhimanyu Sajeevan — site interactions v2
// Cinematic hero, scroll motion, floating CTAs, Formspree form
(function () {
  'use strict';

  // ---------- CONFIG ----------
  // Formspree form — live endpoint
  var FORMSPREE_ID = 'mvzdbnpe';
  var FORMSPREE_ENDPOINT = 'https://formspree.io/f/' + FORMSPREE_ID;
  // Detect if we're inside the /pitch/ subdir and adjust hrefs accordingly
  var IN_PITCH = /\/pitch\//.test(window.location.pathname);
  var PROPOSAL_HREF = IN_PITCH ? 'index.html' : 'pitch/index.html';
  var CONTACT_HREF  = IN_PITCH ? '../contact.html' : 'contact.html';
  var ASSET_PREFIX  = IN_PITCH ? '../' : '';

  var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Cinematic intro loader (first visit per session) ----------
  // Shows a short driveby + engine audio, then fades out.
  (function mountLoader() {
    if (prefersReducedMotion) return;
    try {
      if (sessionStorage.getItem('abh_loader_shown') === '1') return;
    } catch (_) {}

    var loader = document.createElement('div');
    loader.className = 'site-loader';
    loader.innerHTML =
      '<video class="site-loader__video" muted playsinline preload="auto" autoplay>' +
      '  <source src="' + ASSET_PREFIX + 'assets/videos/intro-loader.mp4" type="video/mp4"/>' +
      '</video>' +
      '<div class="site-loader__overlay"></div>' +
      '<div class="site-loader__content">' +
      '  <div class="site-loader__eyebrow">INRC 2026–27</div>' +
      '  <div class="site-loader__title">Abhimanyu <span>&amp; Vijay</span></div>' +
      '  <div class="site-loader__sub">Rally duo · Calicut · VW Polo #41</div>' +
      '  <div class="site-loader__bar"><span></span></div>' +
      '  <button class="site-loader__sound" type="button" aria-label="Enter with sound">Tap for sound 🔊</button>' +
      '  <button class="site-loader__skip" type="button" aria-label="Skip intro">Skip intro &rsaquo;</button>' +
      '</div>';
    document.documentElement.classList.add('is-loading');
    var mount = function () {
      if (document.body) document.body.appendChild(loader);
      else document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(loader); });
    };
    mount();

    var v = loader.querySelector('video');
    var dismissed = false;
    var dismiss = function () {
      if (dismissed) return;
      dismissed = true;
      try { sessionStorage.setItem('abh_loader_shown', '1'); } catch (_) {}
      loader.classList.add('is-out');
      document.documentElement.classList.remove('is-loading');
      setTimeout(function () {
        if (loader.parentNode) loader.parentNode.removeChild(loader);
      }, 900);
    };

    // Start muted (autoplay guaranteed). Any user gesture (click/touch/key/mousemove)
    // unmutes and pauses the hard-cap so users get full audio + driveby.
    var extendedCap = null;
    var hardCap = null;
    if (v) {
      v.muted = true;
      v.play().catch(function () {});
      v.addEventListener('ended', dismiss);
    }
    // Default hard cap — dismiss at 4.5s if user never interacts
    hardCap = setTimeout(dismiss, 4500);

    var unmuteAndExtend = function () {
      if (!v || dismissed) return;
      if (!v.muted) return; // already unmuted
      v.muted = false;
      v.volume = 0.8;
      loader.classList.add('has-sound');
      // Extend so the full intro audio can play (up to 7s total)
      if (hardCap) { clearTimeout(hardCap); hardCap = null; }
      extendedCap = setTimeout(dismiss, 7000);
    };

    // Skip button — any click on skip dismisses
    loader.addEventListener('click', function (e) {
      if (e.target && e.target.classList && e.target.classList.contains('site-loader__skip')) {
        dismiss();
        return;
      }
      // Any other click on the loader unmutes
      unmuteAndExtend();
    });

    // First interaction anywhere unmutes
    var gestureEvents = ['click', 'touchstart', 'keydown', 'pointerdown'];
    var onGesture = function () {
      unmuteAndExtend();
      gestureEvents.forEach(function (ev) {
        document.removeEventListener(ev, onGesture, true);
      });
    };
    gestureEvents.forEach(function (ev) {
      document.addEventListener(ev, onGesture, true);
    });
  })();

  // ---------- Hero video autoplay + ready state ----------
  document.querySelectorAll('.hero-video-bg video').forEach(function (v) {
    var onReady = function () { v.classList.add('is-loaded'); };
    v.addEventListener('loadeddata', onReady);
    v.addEventListener('canplay', onReady);
    v.play().catch(function () {
      // Autoplay blocked — poster still shows
    });
  });
  var heroEl = document.querySelector('.hero');
  if (heroEl) {
    requestAnimationFrame(function () { heroEl.classList.add('is-ready'); });
  }

  // ---------- Engine-ambience audio (shared; played only when a reel is hovered) ----------
  // Loaded lazily on first hover because browsers block autoplaying audio until user interaction.
  var engineAudio = null;
  function getEngineAudio() {
    if (engineAudio) return engineAudio;
    engineAudio = new Audio(ASSET_PREFIX + 'assets/audio/engine-ambience.m4a');
    engineAudio.loop = true;
    engineAudio.preload = 'auto';
    engineAudio.volume = 0.0;
    return engineAudio;
  }
  function fadeAudio(audio, target, ms) {
    if (!audio) return;
    var start = audio.volume;
    var t0 = performance.now();
    (function tick() {
      var p = Math.min(1, (performance.now() - t0) / ms);
      audio.volume = start + (target - start) * p;
      if (p < 1) requestAnimationFrame(tick);
      else if (target === 0) { try { audio.pause(); } catch (_) {} }
    })();
  }

  // ---------- Reel hover-play + hover-unmute ----------
  document.querySelectorAll('.reel-item').forEach(function (item) {
    var video = item.querySelector('video');
    var playBtn = item.querySelector('.reel-play');
    if (!video) return;

    // Mark the item so CSS can show the audio indicator
    item.classList.add('has-audio');

    var startPlay = function () {
      video.play().catch(function () {});
      if (playBtn) playBtn.style.opacity = '0';

      // Try native unmute first (works if video has its own audio track)
      video.muted = false;
      item.classList.add('is-unmuted');

      // Layer engine-ambience track (works even if the reel itself has no audio)
      var a = getEngineAudio();
      try {
        if (a.paused) { a.currentTime = Math.random() * 2; a.play().catch(function () {}); }
        fadeAudio(a, 0.55, 400);
      } catch (_) {}
    };
    var stopPlay = function () {
      video.pause();
      video.currentTime = 0;
      video.muted = true;
      item.classList.remove('is-unmuted');
      if (playBtn) playBtn.style.opacity = '1';
      if (engineAudio) fadeAudio(engineAudio, 0, 350);
    };

    item.addEventListener('mouseenter', startPlay);
    item.addEventListener('mouseleave', stopPlay);
    item.addEventListener('click', function () {
      if (video.paused) { startPlay(); } else { stopPlay(); }
    });

    // Auto-play (muted) when scrolled into view on mobile — no audio without interaction
    if ('IntersectionObserver' in window) {
      var vio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            video.play().catch(function () {});
          } else {
            video.pause();
          }
        });
      }, { threshold: 0.55 });
      vio.observe(item);
    }
  });

  // ---------- Nav toggle + shadow on scroll ----------
  var toggleBtn = document.querySelector('[data-nav-toggle]');
  var navLinks  = document.querySelector('[data-nav-links]');
  if (toggleBtn && navLinks) {
    toggleBtn.addEventListener('click', function () {
      navLinks.classList.toggle('open');
    });
    navLinks.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { navLinks.classList.remove('open'); });
    });
  }

  // ---------- Scroll state: nav shadow + floater + parallax ----------
  var nav = document.querySelector('.nav');
  var floater; // populated after DOMContentLoaded via ensureFloater()
  var parallaxEls = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));

  var onScroll = function () {
    var y = window.scrollY || window.pageYOffset;

    // Nav shadow
    if (nav) {
      nav.style.boxShadow = (y > 20) ? '0 8px 30px rgba(0,0,0,0.35)' : 'none';
    }

    // Floater visibility — appear after 80px of scroll (early so it's discoverable)
    if (floater) {
      if (y > 80 && !floater.classList.contains('is-dismissed')) {
        floater.classList.add('is-visible');
      } else if (y <= 20) {
        floater.classList.remove('is-visible');
      }
    }

    // Parallax translate
    if (!prefersReducedMotion) {
      parallaxEls.forEach(function (el) {
        var rect = el.getBoundingClientRect();
        var speed = parseFloat(el.getAttribute('data-parallax')) || 0.15;
        var centerOffset = (rect.top + rect.height / 2) - window.innerHeight / 2;
        var translate = -centerOffset * speed;
        el.style.transform = 'translate3d(0, ' + translate.toFixed(1) + 'px, 0)';
      });
    }
  };

  // rAF throttle
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (!ticking) {
      window.requestAnimationFrame(function () { onScroll(); ticking = false; });
      ticking = true;
    }
  }, { passive: true });

  // ---------- Auto-add .reveal to common blocks so motion works sitewide ----------
  function autoTagReveals() {
    var autoClasses = [
      '.moment', '.moment-photo',
      '.why-card', '.category-card', '.partner-card',
      '.package', '.reach-item', '.stat-item',
      '.hero-card', '.mini-stat',
      '.reel-item', '.gallery-item',
      '.section-head', '.about-card', '.bts-main', '.bts-secondary',
      '.next-steps'
    ];
    autoClasses.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        if (!el.classList.contains('reveal') &&
            !el.classList.contains('reveal-left') &&
            !el.classList.contains('reveal-right') &&
            !el.classList.contains('reveal-scale')) {
          el.classList.add('reveal');
        }
      });
    });
  }
  autoTagReveals();

  // ---------- IntersectionObserver: reveal + stagger ----------
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale, .stagger, .stat-item')
      .forEach(function (el) { io.observe(el); });
  } else {
    // Fallback — everything visible
    document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale, .stagger, .stat-item')
      .forEach(function (el) { el.classList.add('is-visible'); });
  }

  // ---------- Floating CTAs: inject into every page ----------
  function ensureFloater() {
    if (document.querySelector('.floater')) {
      floater = document.querySelector('.floater');
      return;
    }
    var path = (window.location.pathname.split('/').pop() || '').toLowerCase();
    // Only skip on the contact page (form is already the focus)
    var html = '' +
      '<button class="floater-close" aria-label="Dismiss floating buttons" data-floater-close>&times;</button>' +
      '<a class="floater-btn is-primary" href="' + PROPOSAL_HREF + '" aria-label="View sponsorship proposal">' +
      '  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' +
      '  <span><span class="label-long">View </span>Proposal</span>' +
      '</a>' +
      '<a class="floater-btn" href="' + CONTACT_HREF + '" aria-label="Contact Abhimanyu">' +
      '  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
      '  <span>Contact</span>' +
      '</a>';

    var f = document.createElement('div');
    f.className = 'floater';
    f.setAttribute('role', 'complementary');
    f.setAttribute('aria-label', 'Quick actions');
    f.innerHTML = html;
    document.body.appendChild(f);
    floater = f;

    // Close button (mobile only via CSS)
    var closer = f.querySelector('[data-floater-close]');
    if (closer) {
      closer.addEventListener('click', function () {
        f.classList.add('is-dismissed');
        f.classList.remove('is-visible');
      });
    }

    // Active-page hint — on contact page, demote the contact CTA so it doesn't loop
    if (path === 'contact.html') {
      var contactBtn = f.querySelector('.floater-btn:not(.is-primary)');
      if (contactBtn) contactBtn.style.display = 'none';
    }
  }
  ensureFloater();

  // Kick scroll once so floater updates if user lands deep-linked
  onScroll();

  // ---------- Formspree submit (replaces mailto handoff) ----------
  var form = document.querySelector('[data-inquiry-form]');
  if (form) {
    var errorEl = form.querySelector('[data-form-error]');
    var successCard = document.querySelector('[data-form-success]');
    var setError = function (msg) {
      if (!errorEl) return;
      errorEl.textContent = msg;
      errorEl.classList.add('is-visible');
    };
    var clearError = function () {
      if (errorEl) errorEl.classList.remove('is-visible');
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearError();

      var data = new FormData(form);
      var name = (data.get('name') || '').toString().trim();
      var company = (data.get('company') || '').toString().trim();
      var email = (data.get('email') || '').toString().trim();
      var message = (data.get('message') || '').toString().trim();

      if (!name || !company || !email || !message) {
        setError('Please fill in name, company, email, and a short message.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('That email address doesn\u2019t look right — mind double-checking?');
        return;
      }

      // Build a subject so Formspree emails arrive with a useful header
      data.append('_subject', 'INRC 2026\u201327 sponsorship inquiry \u2014 ' + company);
      data.append('_replyto', email);

      form.classList.add('is-submitting');

      fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        body: data,
        headers: { 'Accept': 'application/json' }
      }).then(function (res) {
        form.classList.remove('is-submitting');
        if (res.ok) {
          form.style.display = 'none';
          if (successCard) successCard.classList.add('is-visible');
          // Scroll success into view
          setTimeout(function () {
            if (successCard && successCard.scrollIntoView) {
              successCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 80);
        } else {
          return res.json().then(function (body) {
            var msg = (body && body.errors && body.errors[0] && body.errors[0].message) ||
                      'Something went wrong. Please email abhimanyusajeevan@gmail.com directly.';
            setError(msg);
          }).catch(function () {
            setError('Something went wrong. Please email abhimanyusajeevan@gmail.com directly.');
          });
        }
      }).catch(function () {
        form.classList.remove('is-submitting');
        setError('Network error. Please check your connection — or email abhimanyusajeevan@gmail.com directly.');
      });
    });
  }

  // ---------- Sticky sub-nav: active state on scroll ----------
  // Looks for a [data-subnav] container with anchor links pointing at #ids in the page.
  // Highlights the link whose section is currently in view.
  (function () {
    var subnav = document.querySelector('[data-subnav]');
    if (!subnav) return;
    var links = subnav.querySelectorAll('a[href^="#"]');
    if (!links.length) return;

    var sectionMap = [];
    links.forEach(function (a) {
      var id = a.getAttribute('href').slice(1);
      var el = document.getElementById(id);
      if (el) sectionMap.push({ link: a, el: el });
    });
    if (!sectionMap.length) return;

    function setActive(link) {
      links.forEach(function (l) { l.classList.remove('is-active'); });
      if (link) link.classList.add('is-active');
    }

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var match = sectionMap.find(function (s) { return s.el === entry.target; });
            if (match) setActive(match.link);
          }
        });
      }, { rootMargin: '-30% 0px -55% 0px', threshold: 0 });
      sectionMap.forEach(function (s) { io.observe(s.el); });
    }

    // Click handler — smooth scroll with offset for sticky bars
    sectionMap.forEach(function (s) {
      s.link.addEventListener('click', function (ev) {
        ev.preventDefault();
        var topNav = document.querySelector('.nav');
        var navH = topNav ? topNav.offsetHeight : 0;
        var subH = subnav.offsetHeight;
        var y = s.el.getBoundingClientRect().top + window.pageYOffset - (navH + subH - 1);
        window.scrollTo({ top: y, behavior: 'smooth' });
        setActive(s.link);
      });
    });
  })();

  // ---------- Scroll reveal — fade-up on enter ----------
  (function () {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal').forEach(function (el) {
        el.classList.add('is-visible');
      });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
    document.querySelectorAll('.reveal, .chapter-num').forEach(function (el) {
      io.observe(el);
    });
  })();

  // ---------- Progress rail — chapter dots on the right ----------
  (function () {
    var rail = document.querySelector('[data-progress-rail]');
    if (!rail) return;
    var chapters = document.querySelectorAll('[data-chapter]');
    if (!chapters.length) {
      rail.style.display = 'none';
      return;
    }

    chapters.forEach(function (chapter) {
      var id = chapter.id || ('chapter-' + Math.random().toString(36).slice(2, 7));
      chapter.id = id;
      var label = chapter.getAttribute('data-chapter') || '';
      var a = document.createElement('a');
      a.href = '#' + id;
      a.setAttribute('aria-label', label);
      a.innerHTML = '<span class="rail-label">' + label + '</span>';
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        var y = chapter.getBoundingClientRect().top + window.pageYOffset - 60;
        window.scrollTo({ top: y, behavior: 'smooth' });
      });
      rail.appendChild(a);
    });

    var links = rail.querySelectorAll('a');

    // Show rail after scrolling past hero
    var showAfter = window.innerHeight * 0.6;
    function maybeShow() {
      if (window.scrollY > showAfter) rail.classList.add('is-visible');
      else rail.classList.remove('is-visible');
    }
    maybeShow();
    window.addEventListener('scroll', maybeShow, { passive: true });

    // Active dot
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var idx = Array.prototype.indexOf.call(chapters, entry.target);
            links.forEach(function (l, i) {
              l.classList.toggle('is-active', i === idx);
            });
          }
        });
      }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });
      chapters.forEach(function (c) { io.observe(c); });
    }
  })();

  // ---------- Parallax on dividers ----------
  (function () {
    var dividers = document.querySelectorAll('.parallax-divider-bg');
    if (!dividers.length) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var ticking = false;
    function update() {
      dividers.forEach(function (bg) {
        var rect = bg.parentElement.getBoundingClientRect();
        var winH = window.innerHeight;
        if (rect.bottom < 0 || rect.top > winH) return;
        var progress = (rect.top - winH) / (rect.height + winH);
        bg.style.transform = 'translateY(' + (progress * 60) + 'px)';
      });
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
    update();
  })();

})();

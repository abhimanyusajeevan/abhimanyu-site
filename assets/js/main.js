// Abhimanyu Sajeevan — site interactions v2
// Cinematic hero, scroll motion, floating CTAs, Formspree form
(function () {
  'use strict';

  // ---------- CONFIG ----------
  // Formspree form — live endpoint
  var FORMSPREE_ID = 'mvzdbnpe';
  var FORMSPREE_ENDPOINT = 'https://formspree.io/f/' + FORMSPREE_ID;
  var PROPOSAL_HREF = 'partners.html';
  var CONTACT_HREF = 'contact.html';

  var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  // ---------- Reel hover-play / tap-to-play ----------
  document.querySelectorAll('.reel-item').forEach(function (item) {
    var video = item.querySelector('video');
    var playBtn = item.querySelector('.reel-play');
    if (!video) return;

    var startPlay = function () {
      video.play().catch(function () {});
      if (playBtn) playBtn.style.opacity = '0';
    };
    var stopPlay = function () {
      video.pause();
      video.currentTime = 0;
      if (playBtn) playBtn.style.opacity = '1';
    };

    item.addEventListener('mouseenter', startPlay);
    item.addEventListener('mouseleave', stopPlay);
    item.addEventListener('click', function () {
      if (video.paused) { startPlay(); } else { stopPlay(); }
    });

    // Auto-play when scrolled into view on mobile
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

    // Floater visibility — appear after 320px of scroll
    if (floater) {
      if (y > 320 && !floater.classList.contains('is-dismissed')) {
        floater.classList.add('is-visible');
      } else {
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

    // Active-page hint — if we're on /partners, swap the primary action label to "Contact" focus
    if (path === 'partners.html') {
      var primary = f.querySelector('.floater-btn.is-primary');
      var secondary = f.querySelector('.floater-btn:not(.is-primary)');
      if (primary && secondary) {
        // Make Contact the primary-weight action on the partners page
        primary.classList.remove('is-primary');
        secondary.classList.add('is-primary');
      }
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

})();

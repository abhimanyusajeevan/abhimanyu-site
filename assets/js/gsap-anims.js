// GSAP animation layer — additive, sits on top of main.js without touching its systems.
// Hero video bg + loader intro are owned by main.js and untouched here.
(function () {
  'use strict';

  if (typeof window === 'undefined') return;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function waitFor(check, cb, tries) {
    tries = tries == null ? 60 : tries;
    if (check()) return cb();
    if (tries <= 0) return;
    setTimeout(function () { waitFor(check, cb, tries - 1); }, 50);
  }

  ready(function () {
    waitFor(function () { return window.gsap && window.ScrollTrigger; }, init);
  });

  function init() {
    var gsap = window.gsap;
    var ScrollTrigger = window.ScrollTrigger;
    gsap.registerPlugin(ScrollTrigger);

    // Default ease — cinematic, leans on quartic out
    gsap.defaults({ ease: 'power3.out', duration: 0.9 });

    // ---- Helper: split text into spans without paid SplitText plugin -----
    function splitChars(el) {
      if (!el || el.dataset.split === '1') return [];
      var nodes = [];
      var walk = function (parent) {
        var children = Array.prototype.slice.call(parent.childNodes);
        children.forEach(function (node) {
          if (node.nodeType === 3) {
            var text = node.nodeValue;
            var frag = document.createDocumentFragment();
            for (var i = 0; i < text.length; i++) {
              var ch = text.charAt(i);
              if (ch === ' ') {
                frag.appendChild(document.createTextNode(' '));
                continue;
              }
              var span = document.createElement('span');
              span.className = 'g-char';
              span.textContent = ch;
              frag.appendChild(span);
              nodes.push(span);
            }
            parent.replaceChild(frag, node);
          } else if (node.nodeType === 1 && !node.matches('br')) {
            walk(node);
          }
        });
      };
      walk(el);
      el.dataset.split = '1';
      return nodes;
    }

    function splitWords(el) {
      if (!el || el.dataset.splitW === '1') return [];
      var nodes = [];
      var html = el.innerHTML;
      // Preserve <br> + inline <em>/<strong>/<span> by walking text nodes
      var walk = function (parent) {
        var kids = Array.prototype.slice.call(parent.childNodes);
        kids.forEach(function (node) {
          if (node.nodeType === 3) {
            var parts = node.nodeValue.split(/(\s+)/);
            var frag = document.createDocumentFragment();
            parts.forEach(function (p) {
              if (!p) return;
              if (/^\s+$/.test(p)) {
                frag.appendChild(document.createTextNode(p));
              } else {
                var w = document.createElement('span');
                w.className = 'g-word';
                var inner = document.createElement('span');
                inner.className = 'g-word-inner';
                inner.textContent = p;
                w.appendChild(inner);
                frag.appendChild(w);
                nodes.push(inner);
              }
            });
            parent.replaceChild(frag, node);
          } else if (node.nodeType === 1 && node.tagName !== 'BR') {
            walk(node);
          }
        });
      };
      walk(el);
      el.dataset.splitW = '1';
      return nodes;
    }

    // ===== HERO entrance timeline =====
    (function heroIntro() {
      var hero = document.querySelector('.hero');
      if (!hero) return;
      var title = hero.querySelector('.hero-title');
      var lede = hero.querySelector('.hero-lede');
      var ctas = hero.querySelectorAll('.hero-cta .btn');
      var sub = hero.querySelector('.hero-sub');
      var eyebrow = hero.querySelector('.eyebrow');
      var card = hero.querySelector('.hero-card');
      var hint = hero.querySelector('.scroll-hint');

      var chars = title ? splitChars(title) : [];

      var tl = gsap.timeline({ delay: 0.2 });
      if (eyebrow) tl.from(eyebrow, { y: 18, opacity: 0, duration: 0.7 }, 0);
      if (chars.length) {
        tl.from(chars, {
          yPercent: 110,
          opacity: 0,
          duration: 0.9,
          stagger: { each: 0.018, from: 'start' },
          ease: 'power4.out'
        }, 0.05);
      }
      if (lede) tl.from(lede, { y: 24, opacity: 0, duration: 0.8 }, 0.55);
      if (ctas.length) tl.from(ctas, { y: 18, opacity: 0, duration: 0.7, stagger: 0.08 }, 0.7);
      if (sub) tl.from(sub, { y: 14, opacity: 0, duration: 0.7 }, 0.85);
      if (card) tl.from(card, { y: 30, opacity: 0, duration: 0.9, ease: 'power3.out' }, 0.4);
      if (hint) tl.from(hint, { opacity: 0, duration: 0.6 }, 1.1);

      // Subtle scroll-driven hero parallax — pushes content up & fades as you scroll.
      // Video bg is left alone (main.js owns it) so it keeps playing.
      gsap.to('.hero-inner', {
        yPercent: -12,
        opacity: 0.85,
        ease: 'none',
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: 'bottom top',
          scrub: true
        }
      });
      gsap.to('.hero-video-bg', {
        yPercent: 8,
        ease: 'none',
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: 'bottom top',
          scrub: true
        }
      });
    })();

    // ===== Press clipping — masked photo reveal + headline word stagger =====
    (function pressClipping() {
      var clip = document.querySelector('.press-clipping');
      if (!clip) return;
      var photo = clip.querySelector('.pc-photo img');
      var headline = clip.querySelector('.pc-headline');
      var byline = clip.querySelector('.pc-byline');
      var quote = clip.querySelector('.pc-quote');
      var paras = clip.querySelectorAll('.pc-columns p');

      if (photo) {
        gsap.fromTo(photo, { clipPath: 'inset(0 100% 0 0)', scale: 1.08 }, {
          clipPath: 'inset(0 0% 0 0)',
          scale: 1,
          duration: 1.4,
          ease: 'power4.out',
          scrollTrigger: { trigger: clip, start: 'top 75%' }
        });
      }
      if (headline) {
        var hwords = splitWords(headline);
        if (hwords.length) {
          gsap.from(hwords, {
            yPercent: 110,
            opacity: 0,
            duration: 0.9,
            stagger: 0.04,
            ease: 'power4.out',
            scrollTrigger: { trigger: clip, start: 'top 70%' }
          });
        }
      }
      [byline, quote].forEach(function (el, i) {
        if (!el) return;
        gsap.from(el, {
          y: 22, opacity: 0, duration: 0.8, delay: 0.1 + i * 0.08,
          scrollTrigger: { trigger: clip, start: 'top 70%' }
        });
      });
      if (paras.length) {
        gsap.from(paras, {
          y: 18, opacity: 0, duration: 0.7, stagger: 0.1,
          scrollTrigger: { trigger: clip, start: 'top 65%' }
        });
      }
    })();

    // ===== Pull-quote — strip existing .reveal, do a wordwise reveal =====
    (function pullQuote() {
      var pq = document.querySelector('.pull-quote-text');
      var attr = document.querySelector('.pull-quote-attr');
      if (pq) {
        pq.classList.remove('reveal');
        pq.classList.add('is-visible');
        var ws = splitWords(pq);
        if (ws.length) {
          gsap.set(ws, { yPercent: 110, opacity: 0 });
          gsap.to(ws, {
            yPercent: 0,
            opacity: 1,
            duration: 1,
            stagger: 0.05,
            ease: 'power4.out',
            scrollTrigger: { trigger: pq, start: 'top 80%' }
          });
        }
      }
      if (attr) {
        attr.classList.remove('reveal', 'reveal-delay-1');
        attr.classList.add('is-visible');
        gsap.set(attr, { y: 16, opacity: 0 });
        gsap.to(attr, {
          y: 0, opacity: 1, duration: 0.8, delay: 0.4,
          scrollTrigger: { trigger: pq || attr, start: 'top 80%' }
        });
      }
    })();

    // ===== Parallax divider headlines — wordwise reveal =====
    document.querySelectorAll('.parallax-divider-text').forEach(function (el) {
      el.classList.remove('reveal', 'reveal-delay-1');
      el.classList.add('is-visible');
      var ws = splitWords(el);
      if (!ws.length) return;
      gsap.set(ws, { yPercent: 110, opacity: 0 });
      gsap.to(ws, {
        yPercent: 0,
        opacity: 1,
        duration: 0.95,
        stagger: 0.045,
        ease: 'power4.out',
        scrollTrigger: { trigger: el, start: 'top 80%' }
      });
    });
    document.querySelectorAll('.parallax-divider-eyebrow').forEach(function (el) {
      el.classList.remove('reveal');
      el.classList.add('is-visible');
      gsap.set(el, { y: 14, opacity: 0 });
      gsap.to(el, {
        y: 0, opacity: 1, duration: 0.7,
        scrollTrigger: { trigger: el, start: 'top 85%' }
      });
    });

    // ===== Chapter heads — number scales/fades up subtly on scroll =====
    document.querySelectorAll('.chapter-num').forEach(function (num) {
      // Take ownership from the existing .reveal system
      num.classList.remove('reveal');
      num.classList.add('is-visible');
      gsap.fromTo(num, { scale: 0.6, opacity: 0, y: 30 }, {
        scale: 1, opacity: 1, y: 0,
        duration: 1.1,
        ease: 'power4.out',
        scrollTrigger: { trigger: num, start: 'top 85%' }
      });
      // Scrub a tiny y-shift across the chapter for depth
      var chapter = num.closest('.chapter');
      if (chapter) {
        gsap.to(num, {
          y: -40,
          ease: 'none',
          scrollTrigger: {
            trigger: chapter,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true
          }
        });
      }
    });

    // ===== Reel grid — scale-up + fade as it scrolls in =====
    (function reels() {
      var items = document.querySelectorAll('.reel-wall-grid .reel-item');
      if (!items.length) return;
      gsap.from(items, {
        y: 60,
        opacity: 0,
        scale: 0.92,
        duration: 1,
        stagger: 0.12,
        ease: 'power4.out',
        scrollTrigger: { trigger: '.reel-wall-grid', start: 'top 80%' }
      });
    })();

    // ===== Feature cards — stagger up + light tilt on hover =====
    (function featureCards() {
      var cards = document.querySelectorAll('.feature-row .feature-card');
      if (!cards.length) return;
      gsap.from(cards, {
        y: 60,
        opacity: 0,
        duration: 0.9,
        stagger: 0.12,
        scrollTrigger: { trigger: '.feature-row', start: 'top 80%' }
      });

      // Mouse-tilt only on devices with fine pointer
      if (!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches)) return;
      cards.forEach(function (card) {
        var rect;
        var qx = gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power3.out' });
        var qy = gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power3.out' });
        gsap.set(card, { transformPerspective: 800, transformStyle: 'preserve-3d' });
        card.addEventListener('mouseenter', function () { rect = card.getBoundingClientRect(); });
        card.addEventListener('mousemove', function (e) {
          if (!rect) rect = card.getBoundingClientRect();
          var px = (e.clientX - rect.left) / rect.width - 0.5;
          var py = (e.clientY - rect.top) / rect.height - 0.5;
          qx(px * 8);
          qy(-py * 8);
        });
        card.addEventListener('mouseleave', function () { qx(0); qy(0); });
      });
    })();

    // ===== Reach channels — bar fills are CSS, just stagger the rows in =====
    (function reachRows() {
      var rows = document.querySelectorAll('.reach-channel');
      if (!rows.length) return;
      rows.forEach(function (row) { row.classList.remove('reveal', 'reveal-delay-1', 'reveal-delay-2', 'reveal-delay-3'); row.classList.add('is-visible'); });
      gsap.set(rows, { x: -40, opacity: 0 });
      gsap.to(rows, {
        x: 0, opacity: 1, duration: 0.9, stagger: 0.1,
        scrollTrigger: { trigger: '.reach-channels', start: 'top 80%' }
      });
    })();

    // ===== Magnetic primary buttons (pointer:fine only) =====
    if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      document.querySelectorAll('.btn-primary').forEach(function (btn) {
        var rect;
        var qx = gsap.quickTo(btn, 'x', { duration: 0.4, ease: 'power3.out' });
        var qy = gsap.quickTo(btn, 'y', { duration: 0.4, ease: 'power3.out' });
        btn.addEventListener('mouseenter', function () { rect = btn.getBoundingClientRect(); });
        btn.addEventListener('mousemove', function (e) {
          if (!rect) rect = btn.getBoundingClientRect();
          var px = (e.clientX - rect.left) - rect.width / 2;
          var py = (e.clientY - rect.top) - rect.height / 2;
          qx(px * 0.18);
          qy(py * 0.25);
        });
        btn.addEventListener('mouseleave', function () { qx(0); qy(0); });
      });
    }

    // ===== Marquee city strip — injected before the CTA banner =====
    (function marquee() {
      var cta = document.querySelector('.cta-banner');
      if (!cta || document.querySelector('.g-marquee')) return;
      var strip = document.createElement('div');
      strip.className = 'g-marquee';
      strip.setAttribute('aria-hidden', 'true');
      var cities = ['NASHIK', 'INDORE', 'CHENNAI', 'COIMBATORE', 'COORG', 'BENGALURU K1000'];
      var line = cities.map(function (c) {
        return '<span class="g-mq-item">' + c + '</span><span class="g-mq-dot">●</span>';
      }).join('');
      // Duplicate for seamless loop
      strip.innerHTML = '<div class="g-mq-track">' + line + line + '</div>';
      cta.parentNode.insertBefore(strip, cta);

      var track = strip.querySelector('.g-mq-track');
      var width;
      function measure() { width = track.scrollWidth / 2; }
      measure();
      gsap.to(track, {
        x: function () { return -width; },
        duration: 22,
        ease: 'none',
        repeat: -1,
        modifiers: {
          x: function (x) {
            var n = parseFloat(x);
            return (n % width) + 'px';
          }
        }
      });
      window.addEventListener('resize', function () { measure(); });
    })();

    // ===== CTA banner — heading word stagger =====
    (function ctaHeading() {
      var h = document.querySelector('.cta-banner h2');
      if (!h) return;
      var ws = splitWords(h);
      if (!ws.length) return;
      gsap.from(ws, {
        yPercent: 110,
        opacity: 0,
        duration: 0.9,
        stagger: 0.05,
        ease: 'power4.out',
        scrollTrigger: { trigger: '.cta-banner', start: 'top 75%' }
      });
    })();

    // Refresh ScrollTrigger after images / fonts settle
    window.addEventListener('load', function () {
      ScrollTrigger.refresh();
    });
  }
})();

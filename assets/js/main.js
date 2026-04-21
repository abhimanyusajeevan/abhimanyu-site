// Abhimanyu Sajeevan — site interactions
(function () {
  'use strict';

  // Mobile nav toggle
  var toggleBtn = document.querySelector('[data-nav-toggle]');
  var navLinks  = document.querySelector('[data-nav-links]');
  if (toggleBtn && navLinks) {
    toggleBtn.addEventListener('click', function () {
      navLinks.classList.toggle('open');
    });

    // Close on link click (mobile)
    navLinks.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        navLinks.classList.remove('open');
      });
    });
  }

  // Shrink nav on scroll
  var nav = document.querySelector('.nav');
  if (nav) {
    var lastY = 0;
    var applyState = function () {
      var y = window.scrollY;
      if (y > 20) {
        nav.style.boxShadow = '0 8px 30px rgba(0,0,0,0.35)';
      } else {
        nav.style.boxShadow = 'none';
      }
      lastY = y;
    };
    applyState();
    window.addEventListener('scroll', applyState, { passive: true });
  }

  // Reveal on scroll for section elements
  if ('IntersectionObserver' in window) {
    var els = document.querySelectorAll('.moment, .why-card, .category-card, .partner-card, .package, .reach-item, .stat-item, .hero-card');
    els.forEach(function (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(16px)';
      el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.style.opacity = '1';
          e.target.style.transform = 'translateY(0)';
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  }

  // Sponsor inquiry form → mailto: handoff (no backend required)
  var form = document.querySelector('[data-inquiry-form]');
  if (form) {
    var status = form.querySelector('[data-form-status]');
    var setStatus = function (msg, type) {
      if (!status) return;
      status.textContent = msg;
      status.className = 'form-status ' + (type || 'ok');
    };
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = new FormData(form);
      var name     = (data.get('name') || '').toString().trim();
      var company  = (data.get('company') || '').toString().trim();
      var email    = (data.get('email') || '').toString().trim();
      var phone    = (data.get('phone') || '').toString().trim();
      var interest = (data.get('interest') || '').toString().trim();
      var budget   = (data.get('budget') || '').toString().trim();
      var message  = (data.get('message') || '').toString().trim();

      if (!name || !company || !email || !message) {
        setStatus('Please fill in name, company, email, and a short message.', 'err');
        return;
      }
      // Very light email sanity check
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setStatus('That email address doesn\u2019t look right. Mind double-checking?', 'err');
        return;
      }

      var subject = 'INRC 2026\u201327 sponsorship inquiry \u2014 ' + company;
      var bodyLines = [
        'Hi Abhimanyu,',
        '',
        'My name is ' + name + ' from ' + company + '.',
        '',
        'Area of interest: ' + interest,
        'Indicative budget: ' + budget,
        phone ? ('Phone: ' + phone) : null,
        'Reply-to: ' + email,
        '',
        '---',
        message,
        '',
        'Sent via abhimanyusajeevan.com'
      ].filter(function (l) { return l !== null; });

      var href = 'mailto:abhimanyusajeevan@gmail.com'
        + '?subject=' + encodeURIComponent(subject)
        + '&body='    + encodeURIComponent(bodyLines.join('\n'))
        + '&cc='      + encodeURIComponent(email);

      setStatus('Opening your email app\u2026 if nothing happens in a few seconds, email abhimanyusajeevan@gmail.com directly.', 'ok');
      window.location.href = href;
    });
  }

})();

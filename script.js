/* ==========================================================================
   Kenth Daniel Danes — Portfolio Script
   Handles: mobile nav toggle, footer year, meeting-form validation + submit
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function () {

  /* ---------- Mobile nav toggle ---------- */
  var navToggle = document.getElementById('navToggle');
  var mainNav = document.getElementById('mainNav');

  if (navToggle && mainNav) {
    navToggle.addEventListener('click', function () {
      var isOpen = mainNav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // Close mobile nav after a link is clicked
    mainNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        mainNav.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Project lightbox ---------- */
  var lightbox = document.getElementById('projectLightbox');
  var lightboxImg = lightbox ? lightbox.querySelector('.lightbox-img') : null;
  var lightboxCaption = lightbox ? lightbox.querySelector('.lightbox-caption') : null;
  var lightboxLink = lightbox ? lightbox.querySelector('.lightbox-link') : null;
  var lastFocusedTrigger = null;

  function openLightbox(imgSrc, caption, externalHref) {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.setAttribute('src', imgSrc);
    lightboxImg.setAttribute('alt', caption || 'Project preview');
    if (lightboxCaption) lightboxCaption.textContent = caption || '';
    if (lightboxLink) {
      if (externalHref) {
        lightboxLink.setAttribute('href', externalHref);
        lightboxLink.classList.add('visible');
      } else {
        lightboxLink.removeAttribute('href');
        lightboxLink.classList.remove('visible');
      }
    }
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightbox || lightbox.hidden) return;
    lightbox.hidden = true;
    document.body.style.overflow = '';
    if (lightboxImg) lightboxImg.setAttribute('src', '');
    if (lastFocusedTrigger) lastFocusedTrigger.focus();
  }

  if (lightbox) {
    // Open on any project thumbnail that opts in via data-lightbox
    lightbox.parentNode.querySelectorAll('[data-lightbox]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        lastFocusedTrigger = link;
        var caption = link.getAttribute('data-lightbox-caption') || '';
        var externalHref = link.getAttribute('data-lightbox-external') || '';
        openLightbox(link.getAttribute('href'), caption, externalHref);
      });
    });

    // Close on backdrop click
    lightbox.querySelectorAll('[data-lightbox-close]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (e.target === el) closeLightbox();
      });
    });

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeLightbox();
    });

    // Close if clicking directly on the lightbox backdrop region outside the dialog
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox || e.target.classList.contains('lightbox-backdrop')) {
        closeLightbox();
      }
    });
  }

  /* ---------- Back to top ---------- */
  var backToTop = document.getElementById('backToTop');
  if (backToTop) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 420) {
        backToTop.classList.add('visible');
      } else {
        backToTop.classList.remove('visible');
      }
    }, { passive: true });
    backToTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      backToTop.classList.remove('animating');
      void backToTop.offsetWidth; // restart the animation
      backToTop.classList.add('animating');
    });
  }

  /* ---------- Frosted header on scroll ---------- */
  var siteHeader = document.querySelector('.site-header');
  if (siteHeader) {
    var updateHeader = function () {
      siteHeader.classList.toggle('scrolled', window.scrollY > 8);
    };
    window.addEventListener('scroll', updateHeader, { passive: true });
    updateHeader();
  }

  /* ---------- Meeting request form (direct-to-Gmail, no captcha) ----------
     Sends JSON to a Google Apps Script Web App you own, which verifies
     token + honeypot + time-trap + daily limits (2/day per email, 2/day per
     IP, 20/day global) server-side, then emails your Gmail. No secrets in
     this file except the public FORM_TOKEN (rotatable) — recipient stays
     hardcoded in Apps Script Script Properties. See apps-script/Code.gs. */
  var form = document.getElementById('meetingForm');
  if (!form) return;

  // ==== Production config (public by design for a static site) ====
  // SECURITY NOTE: these 2 values are visible in View Source by design.
  // Real security is server-side in apps-script/Code.gs (honeypot +
  // time-trap + daily limits + hardcoded recipient). FORM_TOKEN is
  // only a rotatable anti-spam gate, not a password. If spammed, rotate it in
  // BOTH places: Apps Script Script Properties AND here, then redeploy.
  var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyVVp49Fh6F9LBUb881OtiWy31vIuTxUl8pxB-0VcKdYvlD4KPRMe-v3wJH-pCFhS-e/exec';
  var FORM_TOKEN = 'WBqdpmVPwMoZdVLlibKKjerSrd5ERUEvoBqZyexPDLOlobJx';
  // Test hook (used by Playwright): lets tests inject a mock endpoint without editing this file.
  try {
    if (window.__MEETING_FORM_URL) APPS_SCRIPT_URL = window.__MEETING_FORM_URL;
    if (window.__MEETING_FORM_TOKEN) FORM_TOKEN = window.__MEETING_FORM_TOKEN;
    window.__setMeetingFormConfig = function (url, token) {
      if (url) APPS_SCRIPT_URL = url;
      if (token) FORM_TOKEN = token;
    };
  } catch (ignore) {}
  // ===========================================================================

  // Destination inbox shown only in fallback messages (actual recipient is
  // hardcoded server-side in Apps Script, never trusted from the client).
  var DESTINATION_EMAIL = 'kenthdaniel.danes@gmail.com';
  var MIN_FILL_MS = 5000; // informational: enforced server-side in Code.gs
  var REQUEST_TIMEOUT_MS = 12000;

  var fields = {
    name: document.getElementById('name'),
    email: document.getElementById('email'),
    company: document.getElementById('company'),
    date: document.getElementById('date'),
    topic: document.getElementById('topic'),
    message: document.getElementById('message')
  };

  var formNote = document.getElementById('formNote');
  var filledAtEl = document.getElementById('filledAt');
  var botFieldEl = document.getElementById('botField');

  // Time-trap start: humans take >5s to fill the form; bots submit instantly.
  // (5s compensates for the removed captcha; normal users take much longer.)
  if (filledAtEl && !filledAtEl.value) filledAtEl.value = String(Date.now());

  // Best-effort client IP for the server's per-IP daily limit (2/day).
  // NOTE: Apps Script cannot see the real client IP server-side, so the page
  // fetches it from ipify and sends it along. Spoofable — the per-EMAIL
  // limit is the primary enforcement; IP is secondary. Never blocks submit
  // if the lookup fails (privacy/VPN users).
  var clientIp = '';
  function isValidIp(v) {
    return typeof v === 'string' && v.length >= 7 && v.length <= 45 && /^[0-9a-fA-F:.]+$/.test(v);
  }
  function fetchClientIp() {
    try {
      if (!('fetch' in window)) return;
      var ctrl = ('AbortController' in window) ? new AbortController() : null;
      var timer = null;
      if (ctrl) timer = setTimeout(function () { try { ctrl.abort(); } catch (ignore) {} }, 3000);
      fetch('https://api.ipify.org?format=json', { signal: ctrl ? ctrl.signal : undefined })
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d && isValidIp(d.ip)) clientIp = d.ip; })
        .catch(function () {})
        .then(function () { if (timer) clearTimeout(timer); });
    } catch (ignore) {}
  }
  fetchClientIp();

  function setError(fieldName, message) {
    var input = fields[fieldName];
    var errEl = document.getElementById('err-' + fieldName);
    var row = input ? input.closest('.form-row') : null;
    if (row) row.classList.toggle('invalid', !!message);
    if (errEl) errEl.textContent = message || '';
  }

  function isValidEmail(value) {
    // Simple, readable RFC-5322-ish check — good enough for client-side UX validation
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function validateForm() {
    var valid = true;

    if (!fields.name.value.trim()) {
      setError('name', 'Please enter your full name.');
      valid = false;
    } else {
      setError('name', '');
    }

    if (!fields.email.value.trim()) {
      setError('email', 'Please enter your email address.');
      valid = false;
    } else if (!isValidEmail(fields.email.value.trim())) {
      setError('email', 'Please enter a valid email address.');
      valid = false;
    } else {
      setError('email', '');
    }

    if (!fields.topic.value) {
      setError('topic', 'Please select a meeting topic.');
      valid = false;
    } else {
      setError('topic', '');
    }

    if (!fields.message.value.trim() || fields.message.value.trim().length < 10) {
      setError('message', 'Please add a short message (10+ characters).');
      valid = false;
    } else {
      setError('message', '');
    }

    return valid;
  }

  function dailyLimitMessage() {
    return 'Daily limit reached (2 per day). Please email me directly at ' + DESTINATION_EMAIL + '.';
  }

  function isConfigured() {
    return APPS_SCRIPT_URL.indexOf('REPLACE_WITH') === -1 && FORM_TOKEN.indexOf('REPLACE_WITH') === -1;
  }

  // Client-side cooldown: blocks double-click spam (server rate limit is the real gate).
  var lastSuccessAt = 0;
  var COOLDOWN_MS = 60000;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    formNote.textContent = '';
    formNote.style.color = '';

    if (Date.now() - lastSuccessAt < COOLDOWN_MS) {
      formNote.textContent = 'Already sent — please wait a minute before sending again.';
      formNote.style.color = '#ff6b6b';
      return;
    }

    if (!validateForm()) {
      formNote.textContent = 'Please fix the highlighted fields above.';
      formNote.style.color = '#ff6b6b';
      return;
    }

    // Client-side honeypot: silently fake success so bots move on.
    if (botFieldEl && botFieldEl.value) {
      formNote.textContent = 'Thanks! Your meeting request has been sent — I\'ll get back to you soon.';
      formNote.style.color = '#45c4b0';
      form.reset();
      if (filledAtEl) filledAtEl.value = String(Date.now());
      return;
    }

    if (!isConfigured()) {
      formNote.textContent = 'Form is not connected yet. Please email me directly at ' + DESTINATION_EMAIL + '.';
      formNote.style.color = '#ff6b6b';
      return;
    }

    sendViaAppsScript();
  });

  function sendViaAppsScript() {
    var submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    formNote.textContent = 'Sending your request...';
    formNote.style.color = '#45c4b0';

    // Defense in depth: enforce length caps client-side too (server re-checks).
    // Never console.log(payload) — it contains PII + token.
    var payload = {
      formToken: FORM_TOKEN,
      filledAt: filledAtEl ? filledAtEl.value : '',
      'bot-field': botFieldEl ? botFieldEl.value : '',
      clientIp: clientIp,
      name: fields.name.value.trim().slice(0, 100),
      email: fields.email.value.trim().slice(0, 254),
      company: fields.company ? fields.company.value.trim().slice(0, 100) : '',
      date: fields.date ? fields.date.value.slice(0, 20) : '',
      topic: String(fields.topic.value || '').slice(0, 60),
      message: fields.message.value.trim().slice(0, 2000)
    };

    var controller = ('AbortController' in window) ? new AbortController() : null;
    var timer = null;
    if (controller) {
      timer = setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS);
    }

    // text/plain avoids an Apps Script CORS preflight; body is still JSON.
    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined
    })
      .then(function (response) { return response.text(); })
      .then(function (text) {
        var data = {};
        try { data = JSON.parse(text); } catch (ignore) {}
        if (data && data.ok) {
          lastSuccessAt = Date.now();
          formNote.textContent = 'Thanks! Your meeting request has been sent — I\'ll get back to you soon.';
          formNote.style.color = '#45c4b0';
          form.reset();
          if (filledAtEl) filledAtEl.value = String(Date.now());
        } else {
          throw new Error((data && data.error) || 'Rejected by server');
        }
      })
      .catch(function (err) {
        // All server-provided errors are safe curated messages from Code.gs
        // (never internals), so show them as-is — e.g. 'Request rejected.'
        // means the deployment/token is mismatched, 'Spam check failed' means
        // the old captcha build is still deployed. Generic text only for true
        // network failures with no server response at all.
        var msg;
        if (err && err.name === 'AbortError') {
          msg = 'Request timed out. Please try again or email me directly at ' + DESTINATION_EMAIL + '.';
        } else if (err && err.name !== 'TypeError' && err.message && err.message !== 'Rejected by server') {
          // Plain Errors are server messages from Code.gs — safe to show.
          // TypeErrors are browser network failures (offline/CORS/DNS) — generic fallback.
          msg = /LIMIT_REACHED/.test(err.message) ? dailyLimitMessage() : err.message;
        } else {
          msg = 'Something went wrong sending the form. Please email me directly at ' + DESTINATION_EMAIL + '.';
        }
        formNote.textContent = msg;
        formNote.style.color = '#ff6b6b';
      })
      .then(function () {
        if (timer) clearTimeout(timer);
        if (submitBtn) submitBtn.disabled = false;
      });
  }

});
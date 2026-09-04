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

  /* ---------- Meeting request form (hardened direct-to-Gmail) ----------
     Sends JSON to a Google Apps Script Web App you own, which verifies
     token + Turnstile + honeypot + time-trap + rate limits server-side,
     then emails your Gmail. No secrets in this file except the public
     FORM_TOKEN (rotatable) — recipient + Turnstile secret stay in
     Apps Script Script Properties. See apps-script/Code.gs for setup. */
  var form = document.getElementById('meetingForm');
  if (!form) return;

  // ==== Production config (public by design for a static site) ====
  // SECURITY NOTE: these 3 values are visible in View Source by design.
  // Real security is server-side in apps-script/Code.gs (Turnstile verify +
  // honeypot + time-trap + rate limits + hardcoded recipient). FORM_TOKEN is
  // only a rotatable anti-spam gate, not a password. If spammed, rotate it in
  // BOTH places: Apps Script Script Properties AND here, then redeploy.
  // NEVER put TURNSTILE_SECRET here — it stays in Script Properties only.
  var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwfOJq48Gd-9esIkqke5odjyA9luxErJO2COgONe8dQojt4KSwEdKBpS_s2ZCJI6kzoDw/exec';
  var FORM_TOKEN = 'WBqdpmVPwMoZdVLlibKKjerSrd5ERUEvoBqZyexPDLOlobJx';
  var TURNSTILE_SITE_KEY = '0x4AAAAAAEm6ORaVMVlI10Ui';
  // Test hook (used by Playwright): lets tests inject a mock endpoint without editing this file.
  try {
    if (window.__MEETING_FORM_URL) APPS_SCRIPT_URL = window.__MEETING_FORM_URL;
    if (window.__MEETING_FORM_TOKEN) FORM_TOKEN = window.__MEETING_FORM_TOKEN;
    if (window.__MEETING_TURNSTILE_KEY) TURNSTILE_SITE_KEY = window.__MEETING_TURNSTILE_KEY;
    window.__setMeetingFormConfig = function (url, token, siteKey) {
      if (url) APPS_SCRIPT_URL = url;
      if (token) FORM_TOKEN = token;
      if (siteKey) TURNSTILE_SITE_KEY = siteKey;
    };
  } catch (ignore) {}
  // ===========================================================================

  // Destination inbox shown only in fallback messages (actual recipient is
  // hardcoded server-side in Apps Script, never trusted from the client).
  var DESTINATION_EMAIL = 'kenthdaniel.danes@gmail.com';
  var MIN_FILL_MS = 3000;
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

  // Time-trap start: humans take >3s to fill the form; bots submit instantly.
  if (filledAtEl && !filledAtEl.value) filledAtEl.value = String(Date.now());

  // Render Turnstile only when a real site key is configured. This keeps local
  // dev + tests (placeholders) free of Cloudflare 400020 errors, and production
  // gets the invisible captcha. The external api.js script scans for explicit
  // render, so we call turnstile.render once it loads.
  var turnstileWrap = document.getElementById('turnstileWrap');
  function isTurnstileConfigured() {
    return TURNSTILE_SITE_KEY && TURNSTILE_SITE_KEY.indexOf('REPLACE_WITH') === -1;
  }
  function renderTurnstileIfReady() {
    if (!turnstileWrap || !isTurnstileConfigured()) return false;
    try {
      if (window.turnstile && typeof window.turnstile.render === 'function' && !turnstileWrap.hasAttribute('data-rendered')) {
        window.turnstile.render('#turnstileWrap', { sitekey: TURNSTILE_SITE_KEY, theme: 'auto' });
        turnstileWrap.removeAttribute('hidden');
        turnstileWrap.setAttribute('data-rendered', 'true');
        return true;
      }
    } catch (ignore) {}
    return false;
  }
  if (isTurnstileConfigured()) {
    var renderAttempts = 0;
    var renderTimer = setInterval(function () {
      renderAttempts++;
      if (renderTurnstileIfReady() || renderAttempts > 50) clearInterval(renderTimer);
    }, 200);
  }

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

  function getTurnstileToken() {
    try {
      if (window.turnstile && typeof window.turnstile.getResponse === 'function') {
        return window.turnstile.getResponse() || '';
      }
    } catch (ignore) {}
    // Fallback: some Turnstile renderings expose the response in a hidden input.
    var alt = document.querySelector('[name="cf-turnstile-response"]');
    return alt ? (alt.value || '') : '';
  }

  function resetTurnstile() {
    try {
      if (window.turnstile && typeof window.turnstile.reset === 'function') window.turnstile.reset();
    } catch (ignore) {}
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
      turnstileToken: getTurnstileToken(),
      filledAt: filledAtEl ? filledAtEl.value : '',
      'bot-field': botFieldEl ? botFieldEl.value : '',
      name: fields.name.value.trim().slice(0, 100),
      email: fields.email.value.trim().slice(0, 254),
      company: fields.company ? fields.company.value.trim().slice(0, 100) : '',
      date: fields.date ? fields.date.value.slice(0, 20) : '',
      topic: String(fields.topic.value || '').slice(0, 60),
      message: fields.message.value.trim().slice(0, 2000)
    };

    if (!payload.turnstileToken) {
      formNote.textContent = 'Please complete the spam check and try again.';
      formNote.style.color = '#ff6b6b';
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

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
        var msg = (err && err.name === 'AbortError')
          ? 'Request timed out. Please try again or email me directly at ' + DESTINATION_EMAIL + '.'
          : 'Something went wrong sending the form. Please email me directly at ' + DESTINATION_EMAIL + '.';
        // Surface server-provided validation messages (rate limit, spam check) when safe.
        if (err && err.message && /Too many|Spam check|moment/.test(err.message)) msg = err.message;
        formNote.textContent = msg;
        formNote.style.color = '#ff6b6b';
      })
      .then(function () {
        if (timer) clearTimeout(timer);
        resetTurnstile();
        if (submitBtn) submitBtn.disabled = false;
      });
  }

});
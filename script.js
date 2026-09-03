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
    lightboxCaption.textContent = caption || '';
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

  /* ---------- Meeting request form ---------- */
  var form = document.getElementById('meetingForm');
  if (!form) return;

  // Destination inbox for meeting requests
  var DESTINATION_EMAIL = 'kenthdaniel.danes@gmail.com';

  var fields = {
    name: document.getElementById('name'),
    email: document.getElementById('email'),
    company: document.getElementById('company'),
    date: document.getElementById('date'),
    topic: document.getElementById('topic'),
    message: document.getElementById('message')
  };

  var formNote = document.getElementById('formNote');

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

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    formNote.textContent = '';
    formNote.style.color = '';

    if (!validateForm()) {
      formNote.textContent = 'Please fix the highlighted fields above.';
      formNote.style.color = '#ff6b6b';
      return;
    }

    /* Sends the form to Netlify. Netlify's build bot detects the
       data-netlify="true" form in index.html and creates an endpoint for
       it automatically once this site is deployed on Netlify. To get an
       email at your Gmail for every submission, turn it on once in the
       dashboard: Site settings → Forms → Form notifications → Add
       notification → Email notification → kenthdaniel.danes@gmail.com. */
    sendViaNetlify();
  });

  function encodeFormData(formEl) {
    // Netlify expects a standard application/x-www-form-urlencoded body
    var params = new URLSearchParams(new FormData(formEl)).toString();
    return params;
  }

  function sendViaNetlify() {
    var submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    formNote.textContent = 'Sending your request...';
    formNote.style.color = '#45c4b0';

    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: encodeFormData(form)
    })
      .then(function (response) {
        if (response.ok) {
          formNote.textContent = 'Thanks! Your meeting request has been sent — I\'ll get back to you soon.';
          formNote.style.color = '#45c4b0';
          form.reset();
        } else {
          throw new Error('Non-OK response from Netlify: ' + response.status);
        }
      })
      .catch(function () {
        formNote.textContent = 'Something went wrong sending the form. Please email me directly at ' + DESTINATION_EMAIL + '.';
        formNote.style.color = '#ff6b6b';
      })
      .finally(function () {
        if (submitBtn) submitBtn.disabled = false;
      });
  }

});
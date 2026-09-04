/**
 * Portfolio Meeting Form -> Gmail (hardened, free)
 * =================================================
 * Deploy: Extensions > Apps Script > paste this file > Project Settings >
 * Script Properties: RECIPIENT, FORM_TOKEN, TURNSTILE_SECRET, ALLOWED_ORIGIN
 * Deploy > New deployment > Web app > Execute as: Me > Who has access: Anyone
 *
 * Script Properties to set:
 *   RECIPIENT         = kenthdaniel.danes23@gmail.com
 *   FORM_TOKEN        = <random 32+ char string you generate>
 *   TURNSTILE_SECRET  = <Cloudflare Turnstile secret key>
 *   ALLOWED_ORIGIN    = https://kenthdaniel.netlify.app
 */

var ALLOWED_TOPICS = [
  'Data Analyst Jobs',
  'Customer Service',
  'Medical Office Administration Support',
  'Web Design / Portfolio Project',
  'Job Opportunity',
  'Other'
];

var MAX_LEN = { name: 100, email: 254, company: 100, date: 20, topic: 60, message: 2000 };
var MIN_FILL_MS = 3000;
var MAX_BODY_BYTES = 15000;

function doGet() {
  return jsonOut({ ok: true, status: 'ready' });
}

function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var RECIPIENT = props.getProperty('RECIPIENT');
    var FORM_TOKEN = props.getProperty('FORM_TOKEN');
    var TURNSTILE_SECRET = props.getProperty('TURNSTILE_SECRET');
    var ALLOWED_ORIGIN = props.getProperty('ALLOWED_ORIGIN') || '';

    if (!RECIPIENT || !FORM_TOKEN || !TURNSTILE_SECRET) {
      console.error('Missing Script Properties');
      return jsonOut({ ok: false, error: 'Server not configured.' });
    }

    // 0. Body size gate: blocks oversized специальную payloads before parsing.
    if (e && e.postData && e.postData.length > MAX_BODY_BYTES) {
      console.warn('Rejected: body too large');
      return jsonOut({ ok: false, error: 'Request rejected.' });
    }

    var data = parseBody(e);

    // 1. Shared token gate (safe compare; token is public in View Source by
    //    design — real protection is Turnstile + rate limits below).
    //    Rotate any time via Script Properties + script.js FORM_TOKEN.
    if (!safeEqual(String(data.formToken || ''), String(FORM_TOKEN))) {
      console.warn('Rejected: bad token');
      return jsonOut({ ok: false, error: 'Request rejected.' });
    }

    // 2. Honeypot: bots fill hidden bot-field
    if (data['bot-field']) {
      console.warn('Rejected: honeypot');
      return jsonOut({ ok: true }); // fake success so bots move on
    }

    // 3. Time-trap: humans take >3s to fill the form
    var filledAt = Number(data.filledAt || 0);
    if (!filledAt || (Date.now() - filledAt) < MIN_FILL_MS) {
      console.warn('Rejected: too fast');
      return jsonOut({ ok: false, error: 'Please take a moment to complete the form.' });
    }

    // 4. Validate + sanitize fields (server is source of truth; never trust client).
    var name = sanitize(data.name, MAX_LEN.name);
    var email = String(data.email || '').trim().slice(0, MAX_LEN.email);
    var company = sanitize(data.company, MAX_LEN.company);
    var date = sanitizeDate(data.date);
    var topic = sanitize(data.topic, MAX_LEN.topic);
    var message = sanitize(data.message, MAX_LEN.message);

    if (!name) return jsonOut({ ok: false, error: 'Name is required.' });
    if (!isValidEmail(email)) return jsonOut({ ok: false, error: 'Valid email is required.' });
    if (ALLOWED_TOPICS.indexOf(topic) === -1) return jsonOut({ ok: false, error: 'Please select a valid topic.' });
    if (!message || message.length < 10) return jsonOut({ ok: false, error: 'Message must be 10+ characters.' });

    // 5. Turnstile verification (invisible captcha, server-side) + hostname
    //    check: rejects tokens solved on an attacker's domain.
    if (!data.turnstileToken || !verifyTurnstile(data.turnstileToken, TURNSTILE_SECRET, ALLOWED_ORIGIN)) {
      console.warn('Rejected: turnstile failed');
      return jsonOut({ ok: false, error: 'Spam check failed. Please try again.' });
    }

    // 6. Rate limits (per-email 3/hr, global 30/hr) via CacheService + Lock.
    if (isRateLimited(email)) {
      console.warn('Rejected: rate limited domain=' + emailDomain(email));
      return jsonOut({ ok: false, error: 'Too many requests. Please try again later.' });
    }

    // 7. Send to Gmail. Recipient is hardcoded server-side; visitor can only
    //    affect replyTo/subject/body, never to/cc/bcc.
    var subject = '[Portfolio] ' + topic + ' — Meeting request from ' + name;
    var body = [
      'New meeting request from your portfolio site.',
      '',
      'Name: ' + name,
      'Email: ' + email,
      'Company: ' + (company || '(not provided)'),
      'Preferred date: ' + (date || '(not provided)'),
      'Topic: ' + topic,
      '',
      'Message:',
      message,
      '',
      '---',
      'Reply directly to this email to respond (reply-to is set to the visitor).'
    ].join('\n');

    MailApp.sendEmail({
      to: RECIPIENT,
      replyTo: email,
      subject: subject,
      body: body,
      name: 'Portfolio Meeting Form'
    });

    return jsonOut({ ok: true });
  } catch (err) {
    console.error('doPost error: ' + err);
    return jsonOut({ ok: false, error: 'Something went wrong. Please email directly.' });
  }
}

/* ---------- helpers ---------- */

function parseBody(e) {
  // Frontend sends JSON as text/plain (avoids Apps Script CORS preflight).
  if (e && e.postData && e.postData.contents) {
    try {
      var obj = JSON.parse(e.postData.contents);
      if (obj && typeof obj === 'object') return obj;
    } catch (ignore) {}
  }
  // Fallback for form-encoded posts.
  if (e && e.parameter) return e.parameter;
  return {};
}

function safeEqual(a, b) {
  // Constant-time-ish compare to avoid leaking token prefix via timing.
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function sanitize(v, max) {
  var s = String(v == null ? '' : v).trim();
  // Block email header injection: collapse CR/LF runs into a single space.
  s = s.replace(/[\r\n]+/g, ' ');
  // Strip control chars.
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\u0000-\u001F\u007F]+/g, '');
  if (s.length > max) s = s.slice(0, max);
  return s;
}

function sanitizeDate(v) {
  var s = sanitize(v, MAX_LEN.date);
  // Allow only YYYY-MM-DD or empty (native date input format).
  if (!s) return '';
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;
}

function emailDomain(v) {
  var parts = String(v || '').split('@');
  return parts.length === 2 ? parts[1].toLowerCase().slice(0, 60) : '(invalid)';
}

function verifyTurnstile(token, secret, allowedOrigin) {
  try {
    var res = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'post',
      payload: { secret: secret, response: token },
      muteHttpExceptions: true
    });
    var out = JSON.parse(res.getContentText());
    if (!(out && out.success)) return false;
    // Hostname binding: token must have been solved on YOUR domain, not an
    // attacker's copy of your form. Cloudflare returns e.g. kenthdaniel.netlify.app.
    if (allowedOrigin) {
      var expectedHost = String(allowedOrigin).replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
      var gotHost = String((out.hostname || '')).toLowerCase();
      if (gotHost && expectedHost && gotHost !== expectedHost) {
        console.warn('Rejected: turnstile hostname mismatch got=' + gotHost);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error('Turnstile verify error: ' + err);
    return false;
  }
}

function isRateLimited(emailKey) {
  // Lock prevents concurrent requests from bypassing the counters.
  var lock = LockService.getScriptLock();
  try { lock.waitLock(2000); } catch (ignore) {}
  try {
    var cache = CacheService.getScriptCache();
    var perEmail = 'rl_email_' + emailKey.toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
    var global = 'rl_global';

    var emailCount = Number(cache.get(perEmail) || 0);
    var globalCount = Number(cache.get(global) || 0);

    if (emailCount >= 3 || globalCount >= 30) return true;

    cache.put(perEmail, String(emailCount + 1), 3600); // 1 hour
    if (globalCount === 0) {
      cache.put(global, '1', 3600);
    } else {
      cache.put(global, String(globalCount + 1), 3600);
    }
    return false;
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Portfolio Meeting Form -> Gmail (no captcha, daily limits)
 * ==========================================================
 * Deploy: Extensions > Apps Script > paste this file > Project Settings >
 * Script Properties: RECIPIENT, FORM_TOKEN (ALLOWED_ORIGIN optional)
 * Deploy > Manage deployments > Edit > New version (same /exec URL)
 *
 * Script Properties to set:
 *   RECIPIENT      = kenthdaniel.danes23@gmail.com
 *   FORM_TOKEN     = <same 48-char value as script.js FORM_TOKEN>
 *
 * Spam defense without captcha: token gate + honeypot + 5s time-trap +
 * 2/day per email + 2/day per IP (best-effort) + 20/day global.
 * NOTE: Apps Script cannot see the real client IP, so the page sends a
 * best-effort IP (ipify). Spoofable — the per-EMAIL limit is the primary
 * enforcement; IP is secondary. Missing/invalid IP never blocks.
 */

var ALLOWED_TOPICS = [
  'Data Analyst Jobs',
  'Customer Service',
  'Medical Office Administration Support',
  'Web Design / Portfolio Project',
  'Job Opportunity',
  'Other'
];

var MAX_LEN = { name: 100, email: 254, company: 100, date: 20, topic: 60, message: 2000, ip: 45 };
var MIN_FILL_MS = 5000;
var MAX_BODY_BYTES = 15000;
var DAILY_PER_EMAIL = 2;
var DAILY_PER_IP = 2;
var DAILY_GLOBAL = 20;

function doGet() {
  return jsonOut({ ok: true, status: 'ready' });
}

function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var RECIPIENT = props.getProperty('RECIPIENT');
    var FORM_TOKEN = props.getProperty('FORM_TOKEN');

    if (!RECIPIENT || !FORM_TOKEN) {
      console.error('Missing Script Properties');
      return jsonOut({ ok: false, error: 'Server not configured.' });
    }

    // 0. Body size gate: blocks oversized payloads before parsing.
    if (e && e.postData && e.postData.length > MAX_BODY_BYTES) {
      console.warn('Rejected: body too large');
      return jsonOut({ ok: false, error: 'Request rejected.' });
    }

    var data = parseBody(e);

    // 1. Shared token gate (safe compare; token is public in View Source by
    //    design — real protection is honeypot + time-trap + daily limits).
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

    // 3. Time-trap: humans take >5s to fill the form
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
    var clientIp = sanitizeIp(data.clientIp);

    if (!name) return jsonOut({ ok: false, error: 'Name is required.' });
    if (!isValidEmail(email)) return jsonOut({ ok: false, error: 'Valid email is required.' });
    if (ALLOWED_TOPICS.indexOf(topic) === -1) return jsonOut({ ok: false, error: 'Please select a valid topic.' });
    if (!message || message.length < 10) return jsonOut({ ok: false, error: 'Message must be 10+ characters.' });

    // 5. Daily limits: 2/day per email, 2/day per IP, 20/day global.
    //    Frontend maps LIMIT_REACHED to a "use your personal email" warning.
    if (isDailyLimited(email, clientIp)) {
      console.warn('Rejected: daily limit reached');
      return jsonOut({ ok: false, error: 'LIMIT_REACHED' });
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

function sanitizeIp(v) {
  var s = String(v == null ? '' : v).trim().slice(0, MAX_LEN.ip);
  // Accept IPv4/IPv6 chars only; empty/invalid means "unknown" (never blocks).
  if (!/^[0-9a-fA-F:.]{7,45}$/.test(s)) return '';
  return s;
}

function shortHash(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s));
  var hex = '';
  for (var i = 0; i < 8; i++) {
    var b = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
    hex += ('0' + b.toString(16)).slice(-2);
  }
  return hex;
}

function todayStamp() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function propCount(props, key) {
  return Number(props.getProperty(key) || 0);
}

function isDailyLimited(email, clientIp) {
  // Daily counters in Script Properties (CacheService maxes at 6h, too short
  // for a per-day limit). Keys include the date so they reset automatically.
  // ~3 keys/day is far below the 50k property quota.
  var lock = LockService.getScriptLock();
  try { lock.waitLock(3000); } catch (ignore) {}
  try {
    var props = PropertiesService.getScriptProperties();
    var day = todayStamp();
    var emailKey = 'd_' + day + '_e_' + shortHash(email.toLowerCase());
    var globalKey = 'd_' + day + '_g';
    var hasIp = !!clientIp;
    var ipKey = hasIp ? 'd_' + day + '_i_' + shortHash(clientIp) : '';

    var emailCount = propCount(props, emailKey);
    var globalCount = propCount(props, globalKey);
    var ipCount = hasIp ? propCount(props, ipKey) : 0;

    if (emailCount >= DAILY_PER_EMAIL) return true;
    if (hasIp && ipCount >= DAILY_PER_IP) return true;
    if (globalCount >= DAILY_GLOBAL) return true;

    props.setProperty(emailKey, String(emailCount + 1));
    if (hasIp) props.setProperty(ipKey, String(ipCount + 1));
    props.setProperty(globalKey, String(globalCount + 1));
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

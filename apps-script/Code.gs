/**
 * Portfolio Meeting Form -> Gmail (no captcha, daily limits)
 * ==========================================================
 * Deploy: Extensions > Apps Script > paste this file > Project Settings >
 * Script Properties: RECIPIENT, FORM_TOKEN (ALLOWED_ORIGIN optional)
 * Deploy > Manage deployments > Edit > New version (same /exec URL)
 *
 * Script Properties to set:
 *   RECIPIENT      = kenthdaniel.danes23@gmail.com  (where mail is DELIVERED)
 *   FORM_TOKEN     = <same 48-char value as script.js FORM_TOKEN>
 *
 * Sender vs recipient: Google always sends FROM the account that owns this
 * Apps Script project (your server account). The mail is delivered TO
 * RECIPIENT above. replyTo is set to the visitor so you can reply directly.
 *
 * Spam defense without captcha: token gate + honeypot + 5s time-trap +
 * 2/day per email + DAILY_GLOBAL/day global.
 * An alert email goes to RECIPIENT the day the global cap is reached.
 * NOTE: there is deliberately NO per-IP block — people on shared wifi or
 * shared devices must not block each other. The low global cap bounds abuse
 * instead. A per-email rejection never consumes global quota.
 */

var ALLOWED_TOPICS = [
  'Data Analyst Jobs',
  'Customer Service',
  'Medical Office Administration Support',
  'Web Design / Portfolio Project',
  'Job Opportunity',
  'Other'
];

var ALLOWED_TIMEZONES = [
  'Asia/Manila',
  'UTC',
  'Pacific/Honolulu',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Asia/Dubai',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland'
];

var MAX_LEN = { name: 100, email: 254, company: 100, date: 20, time: 5, timezone: 50, topic: 60, message: 2000 };
var MIN_FILL_MS = 5000;
var MAX_BODY_BYTES = 15000;
var DAILY_PER_EMAIL = 2;
var DAILY_GLOBAL = 3; // TESTING value — alert fires on the 3rd delivery; raise to ~50 for production (Gmail free caps at 100 sends/day total)

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
    var time = sanitizeTime(data.time);
    var timezone = sanitize(data.timezone, MAX_LEN.timezone);
    var topic = sanitize(data.topic, MAX_LEN.topic);
    var message = sanitize(data.message, MAX_LEN.message);

    if (!name) return jsonOut({ ok: false, error: 'Name is required.' });
    if (!isValidEmail(email)) return jsonOut({ ok: false, error: 'Valid email is required.' });
    if (time && !isValidTime(time)) return jsonOut({ ok: false, error: 'Please enter a valid time.' });
    if (!timezone || ALLOWED_TIMEZONES.indexOf(timezone) === -1) return jsonOut({ ok: false, error: 'Please select a valid time zone.' });
    if (ALLOWED_TOPICS.indexOf(topic) === -1) return jsonOut({ ok: false, error: 'Please select a valid topic.' });
    if (!message || message.length < 10) return jsonOut({ ok: false, error: 'Message must be 10+ characters.' });

    // 5. Daily limits: 2/day per email, DAILY_GLOBAL/day global.
    //    Same-email rejections return here BEFORE sending, so they never
    //    consume global quota. Frontend maps LIMIT_REACHED to the capacity
    //    warning. If the global cap is already hit, alert the inbox
    //    (once/day) so you can take action.
    if (isOverDailyLimit(email)) {
      console.warn('Rejected: daily limit reached');
      sendCapAlertIfNeeded(props);
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
      'Preferred time: ' + (time ? time + ' (' + timezone + ')' : '(not provided)'),
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

    // Only delivered emails consume daily quota.
    recordDailyUsage(email);

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

function sanitizeTime(v) {
  var s = sanitize(v, MAX_LEN.time);
  // Allow only HH:MM (24h) or empty (native time input format).
  if (!s) return '';
  return isValidTime(s) ? s : s;
}

function isValidTime(v) {
  var m = /^(\d{2}):(\d{2})$/.exec(String(v || ''));
  if (!m) return false;
  var h = Number(m[1]);
  var min = Number(m[2]);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;
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

function dailyKeys(email) {
  var day = todayStamp();
  return {
    day: day,
    emailKey: 'd_' + day + '_e_' + shortHash(email.toLowerCase()),
    globalKey: 'd_' + day + '_g'
  };
}

function isOverDailyLimit(email) {
  // Read-only check. Daily counters live in Script Properties (CacheService
  // maxes at 6h, too short for a per-day limit). Keys include the date so
  // they reset automatically. ~2 keys/day is far below the 50k quota.
  var lock = LockService.getScriptLock();
  try { lock.waitLock(3000); } catch (ignore) {}
  try {
    var props = PropertiesService.getScriptProperties();
    var k = dailyKeys(email);
    if (propCount(props, k.emailKey) >= DAILY_PER_EMAIL) return true;
    if (propCount(props, k.globalKey) >= DAILY_GLOBAL) return true;
    return false;
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function recordDailyUsage(email) {
  // Called ONLY after MailApp.sendEmail succeeds, so failed attempts and
  // retries never burn quota.
  var lock = LockService.getScriptLock();
  try { lock.waitLock(3000); } catch (ignore) {}
  try {
    var props = PropertiesService.getScriptProperties();
    var k = dailyKeys(email);
    props.setProperty(k.emailKey, String(propCount(props, k.emailKey) + 1));
    var newGlobal = propCount(props, k.globalKey) + 1;
    props.setProperty(k.globalKey, String(newGlobal));
    // Alert once per day the moment the global cap is reached.
    if (newGlobal === DAILY_GLOBAL) sendCapAlert(props, k.day, newGlobal);
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function sendCapAlertIfNeeded(props) {
  // Fires the inbox alert when the GLOBAL cap is already reached — covers the
  // case where the cap was hit before this code went live (recordDailyUsage
  // then never runs again today). Per-email rejections do NOT alert.
  // Never throws.
  try {
    var day = todayStamp();
    var count = propCount(props, 'd_' + day + '_g');
    if (count >= DAILY_GLOBAL) sendCapAlert(props, day, count);
  } catch (ignore) {}
}

function sendCapAlert(props, day, count) {
  // One alert email per day to RECIPIENT (kenthdaniel.danes23@gmail.com).
  // Extra rejections after the cap stay silent to avoid alert spam.
  // Never throws — an alert failure must not break the visitor's response.
  try {
    var flagKey = 'd_' + day + '_alerted';
    if (props.getProperty(flagKey)) return; // already alerted today
    props.setProperty(flagKey, '1');
    var recipient = props.getProperty('RECIPIENT');
    if (!recipient) return;
    MailApp.sendEmail({
      to: recipient,
      subject: '[Portfolio] ACTION NEEDED: daily form limit reached (' + count + '/' + DAILY_GLOBAL + ')',
      body: [
        'Your portfolio meeting form hit its daily global cap. Please take action.',
        '',
        'Date: ' + day,
        'Delivered today: ' + count + ' (cap: ' + DAILY_GLOBAL + ')',
        'Per-email cap: ' + DAILY_PER_EMAIL + '/day (same address). No per-IP block.',
        '',
        'What is happening now:',
        '- Further visitors today see "Maximum email capacity temporary down.',
        '  Please email me directly." and must contact you by email instead.',
        '',
        'What you can do:',
        '1. Check your inbox for today\'s meeting requests and reply to them.',
        '2. To raise the cap, edit DAILY_GLOBAL in Code.gs and deploy a New version.',
        '3. To unblock today immediately, delete today\'s d_* properties in',
        '   Project Settings > Script Properties (counters reset on their own tomorrow).'
      ].join('\n'),
      name: 'Portfolio Meeting Form'
    });
  } catch (ignore) {}
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

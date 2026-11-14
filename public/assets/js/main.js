(function () {
  'use strict';

  var T = window.LTB_T;
  // Strings added for the production build (not in the prototype dictionary).
  var EXTRA = {
    en: {
      skip: 'Skip to content', faqH: 'FAQ',
      needFields: 'Please add your name, a valid mobile phone and email.',
      needTime: 'Please pick a day and a time.',
      sendErr: "Sorry, something went wrong sending your request. Please call us at (786) 891-1700 and we'll book you right away."
    },
    es: {
      skip: 'Ir al contenido', faqH: 'Preguntas frecuentes',
      needFields: 'Por favor escribe tu nombre, un celular y un email válidos.',
      needTime: 'Por favor escoge un día y un horario.',
      sendErr: 'Lo sentimos, algo salió mal al enviar tu solicitud. Llámanos al (786) 891-1700 y te agendamos enseguida.'
    }
  };
  Object.keys(EXTRA).forEach(function (k) { Object.keys(EXTRA[k]).forEach(function (x) { T[k][x] = EXTRA[k][x]; }); });

  var ANCHORS = ['how', 'calculator', 'pricing', 'about', 'faq'];
  var SPOTS_LEFT = 5;
  var TIMES = ['9:00 a.m.', '10:30 a.m.', '12:00 p.m.', '2:00 p.m.', '3:30 p.m.', '5:00 p.m.'];
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  var qLang = new URLSearchParams(location.search).get('lang');
  var state = {
    lang: (qLang === 'es' || qLang === 'en') ? qLang : (store('ltb-lang') || 'en'),
    theme: document.documentElement.getAttribute('data-theme') || 'light',
    tick: 0, prevFeed: 0,
    missed: 8, job: 650, close: 35, slow: 4,
    faq: null, menu: false,
    demo: 0, dlang: 'en',
    flang: null, step: 1, day: null, slot: null, submitting: false
  };
  if (state.lang !== 'en' && state.lang !== 'es') state.lang = 'en';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function get(obj, path) { return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, obj); }
  function t() { return T[state.lang] || T.en; }
  function lists(name) { return $$('[data-list="' + name + '"]'); }
  function fill(name, html) { lists(name).forEach(function (el) { el.innerHTML = html; }); }
  function money(n) { return '$' + Math.round(n).toLocaleString(state.lang === 'es' ? 'es-US' : 'en-US'); }

  /* ---------------- Static text ---------------- */
  function renderText() {
    var d = t();
    $$('[data-t]').forEach(function (el) {
      var v = get(d, el.getAttribute('data-t'));
      if (typeof v === 'string') el.textContent = v;
    });
    $$('[data-ph]').forEach(function (el) {
      var v = get(d, el.getAttribute('data-ph'));
      if (typeof v === 'string') el.placeholder = v;
    });
    document.documentElement.lang = state.lang;
    $$('[data-set-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-set-lang') === state.lang)); });
    $$('[data-other-lang]').forEach(function (el) { el.textContent = state.lang === 'en' ? 'ES' : 'EN'; });
    $('[data-spots]').textContent = d.spots(SPOTS_LEFT);
    $('[data-year]').textContent = String(new Date().getFullYear());
  }

  /* ---------------- Lists ---------------- */
  function renderLists() {
    var d = t();
    fill('nav', d.nav.map(function (label, i) { return '<a href="#' + ANCHORS[i] + '">' + esc(label) + '</a>'; }).join(''));
    fill('guar', d.guar.map(function (g) { return '<div><span class="tick" aria-hidden="true">✓</span>' + esc(g) + '</div>'; }).join(''));
    fill('guarRow', d.guar.map(function (g) { return '<span>✓ ' + esc(g) + '</span>'; }).join(''));
    fill('pains', d.pains.map(function (p) {
      return '<div class="card pain"><div class="stat">' + esc(p.stat) + '</div><div class="stat-l">' + esc(p.statLabel) + '</div>' +
        '<h3>' + esc(p.title) + '</h3><p>' + esc(p.body) + '</p>' +
        '<a href="' + esc(p.href) + '" target="_blank" rel="noopener">' + esc(p.src) + '</a></div>';
    }).join(''));
    fill('solP', d.solP.map(function (p) { return '<p class="p17">' + esc(p) + '</p>'; }).join(''));
    fill('beforeS', d.beforeS.map(function (label, i) {
      var dot = i === 0 ? '#F2545B' : i === 3 ? '#DC2626' : 'var(--field)';
      var col = i === 3 ? '#DC2626' : i === 0 ? 'var(--ink)' : 'var(--mute)';
      return '<div class="before-step"><i style="background:' + dot + '"></i><span style="color:' + col + '">' + esc(label) + '</span></div>';
    }).join(''));
    var abg = ['#FDECEC', '#D9F3F3', '#D9F3F3', '#DDF3E4', '#FFE7BF'];
    fill('afterS', d.afterS.map(function (label, i, a) {
      return '<span style="background:' + abg[i] + '">' + esc(label) + '</span>' + (i < a.length - 1 ? '<em aria-hidden="true">→</em>' : '');
    }).join(''));
    var sc = ['#0B3C5D', '#0E6E8C', '#14A3A8', '#C2410C'];
    fill('steps', d.steps.map(function (label, i) { return '<span><i style="background:' + sc[i] + '">' + (i + 1) + '</i>' + esc(label) + '</span>'; }).join(''));
    var inbox = [
      ['CALL', '(305) •••-•••8', 'Auto-text: "Sorry we missed you…"', '14s'],
      ['FB', 'Facebook · María R.', '¿Hacen mantenimiento de AC en Doral?', '✓'],
      ['WEB', 'Web · J. Pérez', 'Quote for a 3-ton change-out', d.booked],
      ['IG', 'Instagram · @kendallhome', 'Do you service pool heaters?', '✓']
    ];
    fill('inbox', inbox.map(function (m) {
      return '<div class="inbox-row"><span class="inbox-ch">' + m[0] + '</span><div class="inbox-txt"><b>' + esc(m[1]) + '</b><span>' + esc(m[2]) + '</span></div><span class="inbox-st">' + esc(m[3]) + '</span></div>';
    }).join(''));
    var dv = ['48', '14s', '21', '9'], dc = ['#fff', '#fff', '#3CCFCF', '#FFB547'];
    fill('dash', d.dash.l.map(function (l, i) { return '<div><span>' + esc(l) + '</span><b style="color:' + dc[i] + '">' + dv[i] + '</b></div>'; }).join(''));
    renderTiers();
    renderFaq();
    fill('trust', d.trust.map(function (x) { return '<div><i aria-hidden="true">✓</i><span>' + esc(x) + '</span></div>'; }).join(''));
    fill('finalTrust', d.finalTrust.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join(''));
    // Footer links: map known items to on-page anchors; the rest stay placeholders until those pages exist.
    var footHref = [
      ['#how', '#how', '#how', '#how', '#how', '#pricing'],
      ['#top', '#top', '#top', '#top', '#top'],
      ['#about', '#audit', '#faq', 'mailto:ramon@leadtobooked.com', '#'],
      ['#', '#', '#', '#', '#']
    ];
    fill('footCols', d.footCols.map(function (c, ci) {
      return '<div class="foot-col"><h4>' + esc(c.h) + '</h4>' + c.items.map(function (it, ii) {
        var href = (footHref[ci] && footHref[ci][ii]) || '#';
        var attr = href === '#audit' ? ' href="#" data-open-modal' : ' href="' + href + '"';
        return '<a' + attr + '>' + esc(it) + '</a>';
      }).join('') + '</div>';
    }).join(''));
  }

  function renderTiers() {
    var d = t();
    var tiers = [
      { name: 'Lead Launch', mo: '$197', setup: '+ $1,497' + d.setup, lead: '', items: d.t1, cta: d.getStarted, pop: false },
      { name: 'Lead Engine', mo: '$397', setup: '+ $2,997' + d.setup, lead: d.evLaunch, items: d.t2, cta: d.cta, pop: true },
      { name: 'Lead Machine', mo: '$797', setup: '+ $4,997' + d.setup, lead: d.evEngine, items: d.t3, cta: d.talk, pop: false }
    ];
    fill('tiers', tiers.map(function (tr) {
      return '<div class="card tier' + (tr.pop ? ' pop' : '') + '">' +
        (tr.pop ? '<span class="pop-tag">' + esc(d.popular) + '</span>' : '') +
        '<h3>' + tr.name + '</h3>' +
        '<div class="tier-price"><b>' + tr.mo + '<small>' + esc(d.perMo) + '</small></b><span>' + esc(tr.setup) + '</span></div>' +
        '<ul>' + (tr.lead ? '<li class="lead">' + esc(tr.lead) + '</li>' : '') + tr.items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
        '<button type="button" class="btn ' + (tr.pop ? 'btn-cta' : 'btn-outline') + ' btn-wrap" data-open-modal data-plan="' + tr.name + '">' + esc(tr.cta) + '</button>' +
        '</div>';
    }).join(''));
  }

  function renderFaq() {
    var d = t();
    fill('faqs', d.faqs.map(function (f, i) {
      var open = state.faq === i;
      return '<div class="faq-item"><button type="button" data-faq="' + i + '" aria-expanded="' + open + '" aria-controls="faq-a' + i + '">' +
        '<span>' + esc(f[0]) + '</span><i aria-hidden="true">' + (open ? '−' : '+') + '</i></button>' +
        '<p id="faq-a' + i + '"' + (open ? '' : ' hidden') + '>' + esc(f[1]) + '</p></div>';
    }).join(''));
  }

  /* ---------------- Hero ticker ---------------- */
  var FCOL = ['#F2545B', '#14A3A8', '#0E6E8C', '#0B3C5D', '#16A34A'], FICO = ['!', '↗', '↙', 'AI', '✓'];
  function renderTicker() {
    var d = t();
    $('[data-trade]').textContent = d.trades[state.tick % 4];
    var n = REDUCED ? 5 : Math.min((state.tick % 7) + 1, 5);
    var prev = state.prevFeed;
    fill('feed', d.feed.slice(0, n).map(function (f, i) {
      return '<div class="feed-item' + (i >= prev ? ' new' : '') + '"><span class="feed-ico" style="background:' + FCOL[i] + '">' + FICO[i] + '</span><div><b>' + esc(f[0]) + '</b><span>' + esc(f[1]) + '</span></div></div>';
    }).join(''));
    state.prevFeed = n;
  }

  /* ---------------- Calculator ---------------- */
  function renderCalc() {
    var d = t();
    var job = Math.min(50000, Math.max(50, +state.job || 50));
    var lost = (state.missed + state.slow) * 4.33 * (state.close / 100) * job;
    var rec = lost * 0.4, fee = 397, mx = Math.max(lost, rec, fee, 1);
    var out = function (k, v) { var el = $('[data-out="' + k + '"]'); if (el) el.textContent = v; };
    out('missed', state.missed); out('close', state.close); out('slow', state.slow);
    out('lostM', money(lost)); out('lostY', money(lost * 12) + d.perYr); out('recM', money(rec));
    out('payback', d.payback(Math.ceil(fee / job)));
    $('[data-bar="lost"]').style.width = (lost / mx * 100) + '%';
    $('[data-bar="rec"]').style.width = (rec / mx * 100) + '%';
    $('[data-bar="fee"]').style.width = (fee / mx * 100) + '%';
  }

  /* ---------------- Live demo ---------------- */
  var demoTimers = [];
  function later(ms, fn) { demoTimers.push(setTimeout(fn, ms)); }
  function setDemo(n) { state.demo = n; renderDemo(); }
  function renderDemo() {
    var d = t(), s = state.demo, es = state.dlang === 'es';
    $('[data-demo-status]').textContent = d.demoSt[s];
    var reached = [s >= 1, s >= 2, s >= 3, s >= 5, s >= 6];
    fill('demoSteps', d.demoS.map(function (label, i) {
      return '<div class="demo-step' + (reached[i] ? ' on' : '') + '"><i aria-hidden="true">' + (reached[i] ? '✓' : '') + '</i>' + esc(label) + '</div>';
    }).join(''));
    var html = '';
    if (s === 0) {
      html = '<div class="demo-idle"><button type="button" data-demo-start aria-label="' + esc(d.callBiz) + '"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2"/></svg></button><span>' + esc(d.callBiz) + '</span></div>';
    }
    var msg = function (cls, text) { html += '<div class="dmsg ' + cls + '">' + esc(text) + '</div>'; };
    if (s >= 2) msg('sys', d.notAnswered);
    if (s >= 3) msg('them', es ? '¡Perdón que no contestamos! ¿Cómo le podemos ayudar? — Mendoza Cooling' : 'Sorry we missed you! How can we help? — Mendoza Cooling');
    if (s >= 4) msg('me', es ? 'AC no enfría, ¿pueden venir mañana?' : 'Can you come out tomorrow?');
    if (s >= 5) {
      msg('them', es ? '¡Claro! Tengo el viernes a las 8:00 a.m. en Kendall Lakes. ¿Se lo reservo?' : 'Sure! I have Friday at 8:00 a.m. in Kendall Lakes. Want me to book it?');
      msg('me', es ? 'Sí, perfecto' : 'Yes please');
    }
    if (s === 3) {
      html += '<div class="demo-chips"><span>' + esc(d.pickQ) + '</span>' +
        '<button type="button" data-demo-pick="en">"Can you come out tomorrow?"</button>' +
        '<button type="button" data-demo-pick="es">"AC no enfría, ¿pueden venir mañana?"</button></div>';
    }
    if (s >= 6) {
      html += '<div class="demo-booked"><div class="booked-card"><i aria-hidden="true">✓</i><div><b>' + esc(d.booked) + '</b><span>' + esc(d.bookedWhen) + '</span></div></div>' +
        '<button type="button" class="replay" data-demo-reset>' + esc(d.replay) + '</button></div>';
    }
    var body = $('[data-demo-body]');
    body.innerHTML = html;
    body.scrollTop = body.scrollHeight;
  }

  /* ---------------- Booking modal ---------------- */
  var modal = $('#modal'), form = $('#audit-form'), lastFocus = null;

  function businessDays() {
    var out = [], dt = new Date();
    var loc = state.lang === 'es' ? 'es-US' : 'en-US';
    while (out.length < 5) {
      dt.setDate(dt.getDate() + 1);
      var wd = dt.getDay();
      if (wd === 0 || wd === 6) continue;
      var w = dt.toLocaleDateString(loc, { weekday: 'short' }).replace('.', '');
      w = w.charAt(0).toUpperCase() + w.slice(1);
      var iso = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
      out.push({ label: w + ' ' + dt.getDate(), iso: iso });
    }
    return out;
  }
  var days = businessDays();

  function renderModal() {
    var d = t();
    var flang = state.flang || state.lang;
    $$('[data-flang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-flang') === flang)); });
    form.elements.preferred_language.value = flang;
    form.elements.site_language.value = state.lang;
    days = businessDays();
    fill('days', days.map(function (x, i) { return '<button type="button" class="chip-btn" data-day="' + i + '" aria-pressed="' + (state.day === i) + '">' + esc(x.label) + '</button>'; }).join(''));
    fill('slots', TIMES.map(function (x, i) { return '<button type="button" class="chip-btn" data-slot="' + i + '" aria-pressed="' + (state.slot === i) + '">' + x + '</button>'; }).join(''));
    form.elements.audit_day.value = state.day == null ? '' : days[state.day].iso + ' (' + days[state.day].label + ')';
    form.elements.audit_time.value = state.slot == null ? '' : TIMES[state.slot];
    $$('[data-step]', modal).forEach(function (el) { el.hidden = +el.getAttribute('data-step') !== state.step; });
    $('[data-step-label]').textContent = state.step === 3 ? d.confirmed : d.step(state.step);
    var sub = $('[data-submit]');
    sub.textContent = state.submitting ? d.sending : d.confirmBtn;
    sub.disabled = state.submitting;
    if (state.step === 3 && state.day != null && state.slot != null) {
      $('[data-confirm-text]').textContent = d.confirmText(days[state.day].label, TIMES[state.slot]);
    }
  }

  function openModal(plan) {
    lastFocus = document.activeElement;
    if (state.step === 3) { form.reset(); state.step = 1; state.day = null; state.slot = null; state.flang = null; }
    $$('[data-err1],[data-err2]').forEach(function (e) { e.hidden = true; });
    setMenu(false);
    modal.hidden = false;
    document.body.classList.add('no-scroll');
    renderModal();
    var first = $('input[name="name"]', modal);
    setTimeout(function () { (state.step === 1 ? first : $('[data-close-modal]', modal)).focus(); }, 30);
  }
  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('no-scroll');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function validStep1() {
    var ok = true;
    ['name', 'phone', 'email'].forEach(function (n) {
      var el = form.elements[n];
      var v = el.value.trim();
      var good = v.length > 0 && el.checkValidity();
      if (n === 'phone') good = good && v.replace(/\D/g, '').length >= 10;
      el.classList.toggle('invalid', !good);
      el.setAttribute('aria-invalid', String(!good));
      if (!good && ok) { el.focus(); ok = false; }
    });
    var err = $('[data-err1]');
    err.hidden = ok;
    if (!ok) err.textContent = t().needFields;
    return ok;
  }

  function submitForm(e) {
    e.preventDefault();
    if (state.submitting) return;
    var err = $('[data-err2]');
    if (state.day == null || state.slot == null) { err.textContent = t().needTime; err.hidden = false; return; }
    err.hidden = true;
    state.submitting = true; renderModal();
    var body = new URLSearchParams(new FormData(form)).toString();
    fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); })
      .then(function () { state.submitting = false; state.step = 3; renderModal(); $('[data-close-modal]', modal).focus(); })
      .catch(function () { state.submitting = false; renderModal(); err.textContent = t().sendErr; err.hidden = false; });
  }

  /* ---------------- Menu / theme / language ---------------- */
  function setMenu(open) {
    state.menu = open;
    $('#mmenu').hidden = !open;
    $('[data-toggle-menu]').setAttribute('aria-expanded', String(open));
  }
  function setTheme(th) {
    state.theme = th;
    document.documentElement.setAttribute('data-theme', th);
    store('ltb-theme', th);
    $$('[data-theme-icon]').forEach(function (el) { el.textContent = th === 'dark' ? '☀' : '☾'; });
  }
  function setLang(l) {
    state.lang = l;
    store('ltb-lang', l);
    renderAll();
  }

  function renderAll() {
    renderText(); renderLists(); renderTicker(); renderCalc(); renderDemo();
    if (!modal.hidden) renderModal();
  }

  /* ---------------- Events ---------------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('button, a');
    if (!el) {
      if (e.target === modal) closeModal();
      return;
    }
    if (el.hasAttribute('data-open-modal')) { e.preventDefault(); openModal(el.getAttribute('data-plan')); return; }
    if (el.hasAttribute('data-close-modal')) { closeModal(); return; }
    if (el.hasAttribute('data-set-lang')) { setLang(el.getAttribute('data-set-lang')); return; }
    if (el.hasAttribute('data-toggle-lang')) { setLang(state.lang === 'en' ? 'es' : 'en'); return; }
    if (el.hasAttribute('data-toggle-theme')) { setTheme(state.theme === 'dark' ? 'light' : 'dark'); return; }
    if (el.hasAttribute('data-toggle-menu')) { setMenu(!state.menu); return; }
    if (el.hasAttribute('data-faq')) { var i = +el.getAttribute('data-faq'); state.faq = state.faq === i ? null : i; renderFaq(); $('[data-faq="' + i + '"]').focus(); return; }
    if (el.hasAttribute('data-demo-start')) {
      demoTimers.forEach(clearTimeout); demoTimers = [];
      setDemo(1); later(1600, function () { setDemo(2); }); later(2800, function () { setDemo(3); });
      return;
    }
    if (el.hasAttribute('data-demo-pick')) {
      state.dlang = el.getAttribute('data-demo-pick');
      setDemo(4); later(1300, function () { setDemo(5); }); later(2800, function () { setDemo(6); });
      return;
    }
    if (el.hasAttribute('data-demo-reset')) { demoTimers.forEach(clearTimeout); demoTimers = []; setDemo(0); return; }
    if (el.hasAttribute('data-flang')) { state.flang = el.getAttribute('data-flang'); renderModal(); return; }
    if (el.hasAttribute('data-day')) { state.day = +el.getAttribute('data-day'); renderModal(); $('[data-day="' + state.day + '"]').focus(); return; }
    if (el.hasAttribute('data-slot')) { state.slot = +el.getAttribute('data-slot'); renderModal(); $('[data-slot="' + state.slot + '"]').focus(); return; }
    if (el.hasAttribute('data-next')) { if (validStep1()) { state.step = 2; renderModal(); var b = $('[data-day]'); if (b) b.focus(); } return; }
    if (el.hasAttribute('data-back')) { state.step = 1; renderModal(); return; }
    // Close the mobile menu after following an in-page link.
    if (state.menu && el.closest('#mmenu') && el.tagName === 'A') setMenu(false);
  });

  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (!modal.hidden) closeModal();
      else if (state.menu) setMenu(false);
    }
    if (e.key === 'Tab' && !modal.hidden) {
      var f = $$('button, [href], input, select, textarea', modal).filter(function (x) { return !x.disabled && x.offsetParent !== null && x.type !== 'hidden'; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  form.addEventListener('submit', submitForm);
  form.addEventListener('keydown', function (e) {
    // Enter on step 1 advances instead of submitting.
    if (e.key === 'Enter' && state.step === 1 && e.target.tagName === 'INPUT') { e.preventDefault(); $('[data-next]').click(); }
  });
  $$('input[name="name"], input[name="phone"], input[name="email"]', form).forEach(function (el) {
    el.addEventListener('input', function () { el.classList.remove('invalid'); el.removeAttribute('aria-invalid'); });
  });

  $$('[data-calc]').forEach(function (inp) {
    inp.addEventListener('input', function () {
      var k = inp.getAttribute('data-calc');
      state[k] = k === 'job' ? inp.value : +inp.value;
      renderCalc();
    });
    if (inp.getAttribute('data-calc') === 'job') {
      inp.addEventListener('blur', function () { var v = Math.min(50000, Math.max(50, +inp.value || 50)); inp.value = v; state.job = v; renderCalc(); });
    }
  });

  window.addEventListener('resize', function () { if (state.menu && window.innerWidth > 1180) setMenu(false); });

  /* ---------------- Boot ---------------- */
  setTheme(state.theme);
  renderAll();
  if (!REDUCED) setInterval(function () { state.tick++; renderTicker(); }, 2500);
})();

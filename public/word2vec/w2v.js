/* Word2Vec Lab: nearest neighbours, analogies and a 3D PCA map, all computed in the browser. */
(function () {
  'use strict';

  var MODEL = '/word2vec/model/';
  var K = 10;                 // neighbours per query
  var MAX_QUERIES = 4;
  var CONTEXT_PER_NEIGHBOR = 3;
  var COLORS = ['#14A3A8', '#FF7A45', '#7C5CFF', '#16A34A'];

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  var vocab = [], index = new Map(), E = null, dim = 0, n = 0, meta = null;
  var last = null;            // last search result, for re-plotting on toggle/theme change

  /* ---------------- Model loading ---------------- */
  function load() {
    var status = $('#status');
    return Promise.all([
      fetch(MODEL + 'meta.json').then(function (r) { return r.json(); }),
      fetch(MODEL + 'vocab.json').then(function (r) { return r.json(); }),
      fetch(MODEL + 'vectors.bin').then(function (r) { if (!r.ok) throw new Error('vectors ' + r.status); return r.arrayBuffer(); })
    ]).then(function (res) {
      meta = res[0]; vocab = res[1]; dim = meta.dim; n = vocab.length;
      var q = new Int8Array(res[2]);
      if (q.length !== n * dim) throw new Error('Model size mismatch');
      E = new Float32Array(n * dim);
      for (var i = 0; i < n; i++) {
        var off = i * dim, norm = 0, j;
        for (j = 0; j < dim; j++) { var v = q[off + j]; E[off + j] = v; norm += v * v; }
        norm = Math.sqrt(norm) || 1;
        for (j = 0; j < dim; j++) E[off + j] /= norm;
        index.set(vocab[i], i);
      }
      status.textContent = 'Model ready: ' + fmt(n) + ' words × ' + dim + ' dimensions. Search any of them.';
      $$('#q, #go, #a-go').forEach(function (el) { el.disabled = false; });
      renderMeta();
    }).catch(function (e) {
      status.textContent = 'Could not load the model (' + e.message + '). Please refresh the page.';
      status.classList.add('err');
      throw e;
    });
  }

  function renderMeta() {
    $$('[data-meta]').forEach(function (el) {
      var k = el.getAttribute('data-meta'), v = meta[k];
      if (v == null) return;
      el.textContent = (k === 'tokens' && el.closest('.hero-sub')) ? (v / 1e6).toFixed(1) + ' million' : fmt(v);
    });
    var names = { brown: 'Brown (mixed genres, 1961)', gutenberg: 'Project Gutenberg (classic books)', reuters: 'Reuters (financial news)', webtext: 'Web text (forums, reviews)', inaugural: 'US inaugural addresses', abc: 'ABC Australia (science & rural news)', state_union: 'State of the Union addresses', movie_reviews: 'Movie reviews (IMDb)' };
    $('#corpora tbody').innerHTML = Object.keys(meta.corpora).map(function (c) {
      return '<tr><td>' + esc(names[c] || c) + '</td><td>' + fmt(meta.corpora[c]) + '</td></tr>';
    }).join('') + '<tr><td><b>Total</b></td><td>' + fmt(meta.tokens) + '</td></tr>';
    var p = meta.params;
    var rows = [
      ['Algorithm', 'Skip-gram, negative sampling'],
      ['Vector size', p.vector_size],
      ['Context window', '±' + p.window + ' words'],
      ['Negative samples', p.negative],
      ['Min word count', p.min_count],
      ['Sub-sampling', p.sample],
      ['Epochs', p.epochs],
      ['Shipped to browser', fmt(meta.words) + ' words, ' + meta.quantization]
    ];
    $('#params tbody').innerHTML = rows.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>'; }).join('');
  }

  /* ---------------- Vector math ---------------- */
  function row(i) { return E.subarray(i * dim, (i + 1) * dim); }

  function nearest(vec, exclude, k) {
    var top = [];                      // sorted descending by score, length <= k
    for (var i = 0; i < n; i++) {
      if (exclude && exclude.has(i)) continue;
      var off = i * dim, s = 0;
      for (var j = 0; j < dim; j++) s += E[off + j] * vec[j];
      if (top.length < k || s > top[top.length - 1].s) {
        var p = top.length < k ? top.length : k - 1;
        while (p > 0 && top[p - 1].s < s) p--;
        top.splice(p, 0, { i: i, w: vocab[i], s: s });
        if (top.length > k) top.pop();
      }
    }
    return top;
  }

  function normalize(v) {
    var s = 0; for (var j = 0; j < v.length; j++) s += v[j] * v[j];
    s = Math.sqrt(s) || 1;
    for (j = 0; j < v.length; j++) v[j] /= s;
    return v;
  }

  // PCA via power iteration with deflation on the d x d covariance of the fitted rows.
  function pca(ids, comps) {
    var m = ids.length, d = dim, mean = new Float64Array(d), i, j, k;
    for (i = 0; i < m; i++) { var r = row(ids[i]); for (j = 0; j < d; j++) mean[j] += r[j] / m; }
    var C = new Float64Array(d * d);
    for (i = 0; i < m; i++) {
      var x = row(ids[i]), c = new Float64Array(d);
      for (j = 0; j < d; j++) c[j] = x[j] - mean[j];
      for (j = 0; j < d; j++) { var cj = c[j]; if (!cj) continue; for (k = 0; k < d; k++) C[j * d + k] += cj * c[k]; }
    }
    var trace = 0; for (j = 0; j < d; j++) trace += C[j * d + j];
    var axes = [], vars = [];
    for (var p = 0; p < comps; p++) {
      var v = new Float64Array(d); for (j = 0; j < d; j++) v[j] = Math.sin(j * 12.9898 + p * 78.233) + 0.5;  // deterministic start
      var lambda = 0;
      for (var it = 0; it < 300; it++) {
        var w = new Float64Array(d);
        for (j = 0; j < d; j++) { var s = 0; for (k = 0; k < d; k++) s += C[j * d + k] * v[k]; w[j] = s; }
        var nrm = 0; for (j = 0; j < d; j++) nrm += w[j] * w[j]; nrm = Math.sqrt(nrm);
        if (nrm < 1e-12) break;
        for (j = 0; j < d; j++) w[j] /= nrm;
        var diff = 0; for (j = 0; j < d; j++) diff += Math.abs(w[j] - v[j]);
        v = w; lambda = nrm;
        if (diff < 1e-9) break;
      }
      axes.push(v); vars.push(trace > 0 ? lambda / trace : 0);
      for (j = 0; j < d; j++) for (k = 0; k < d; k++) C[j * d + k] -= lambda * v[j] * v[k];
    }
    return {
      vars: vars,
      project: function (id) {
        var r = row(id), out = [];
        for (var a = 0; a < axes.length; a++) { var s = 0; for (var q = 0; q < d; q++) s += (r[q] - mean[q]) * axes[a][q]; out.push(s); }
        return out;
      }
    };
  }

  /* ---------------- Search ---------------- */
  function parse(text) {
    var seen = new Set();
    return text.toLowerCase().split(/[,;\s]+/).map(function (w) { return w.replace(/[^a-z']/g, ''); })
      .filter(function (w) { if (!w || seen.has(w)) return false; seen.add(w); return true; })
      .slice(0, MAX_QUERIES);
  }

  function suggestFor(word, limit) {
    var out = [], stems = [word.replace(/s$/, ''), word.slice(0, Math.max(3, word.length - 2))];
    for (var t = 0; t < stems.length && out.length < limit; t++) {
      for (var i = 0; i < n && out.length < limit; i++) {
        if (vocab[i].indexOf(stems[t]) === 0 && out.indexOf(vocab[i]) < 0) out.push(vocab[i]);
      }
    }
    return out;
  }

  function search(text, opts) {
    opts = opts || {};
    var words = parse(text);
    var status = $('#status');
    status.classList.remove('err');
    if (!words.length) { status.textContent = 'Type a word first.'; status.classList.add('err'); return; }
    var groups = [], misses = [];
    words.forEach(function (w) {
      var i = index.get(w);
      if (i == null) { misses.push(w); return; }
      groups.push({ word: w, i: i, color: COLORS[groups.length % COLORS.length], nn: nearest(row(i), new Set([i]), K) });
    });
    last = { groups: groups, misses: misses };
    renderResults();
    plot();
    if (groups.length) {
      status.textContent = 'Showing the ' + K + ' closest of ' + fmt(n) + ' words by cosine similarity' + (groups.length > 1 ? ' for ' + groups.length + ' words.' : '.');
    } else {
      status.textContent = 'None of those words are in the vocabulary.';
      status.classList.add('err');
    }
    if (!opts.silent) {
      var url = new URL(location.href);
      url.searchParams.set('w', words.join(','));
      history.replaceState(null, '', url);
    }
    if (opts.scroll && groups.length) $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderResults() {
    var html = last.groups.map(function (g) {
      return '<div class="card w2v-res" style="--g:' + g.color + '">' +
        '<div class="w2v-res-h"><h3>' + esc(g.word) + '</h3><span>frequency rank #' + fmt(g.i + 1) + '</span></div>' +
        '<ol>' + g.nn.map(function (x, r) {
          var pct = Math.max(0, x.s) * 100;
          return '<li><span class="w2v-rank">' + (r + 1) + '</span>' +
            '<button type="button" class="w2v-word" data-explore="' + esc(x.w) + '" title="Explore “' + esc(x.w) + '”">' + esc(x.w) + '</button>' +
            '<span class="w2v-bar" aria-hidden="true"><i style="width:' + pct.toFixed(1) + '%"></i></span>' +
            '<span class="w2v-sim" title="cosine similarity">' + x.s.toFixed(3) + '</span></li>';
        }).join('') + '</ol></div>';
    }).join('');
    html += last.misses.map(function (w) {
      var sug = suggestFor(w, 5);
      return '<div class="card w2v-miss"><b>“' + esc(w) + '”</b> isn’t among the ' + fmt(n) + ' most frequent words in the training text.' +
        (sug.length ? ' Did you mean: ' + sug.map(function (s) { return '<button type="button" data-explore="' + esc(s) + '">' + esc(s) + '</button>'; }).join(', ') + '?' : ' Try a more common word.') + '</div>';
    }).join('');
    $('#results').innerHTML = html;
  }

  /* ---------------- 3D plot ---------------- */
  function plot() {
    var el = $('#plot');
    if (!last || !last.groups.length) return;
    if (!window.Plotly) { el.innerHTML = '<div class="w2v-plot-empty">The 3D chart library didn’t load. The neighbor tables above still work.</div>'; return; }

    var showLabels = $('#opt-labels').checked, showLines = $('#opt-lines').checked, showCtx = $('#opt-context').checked;
    var core = [], seen = new Set();
    last.groups.forEach(function (g) {
      [g.i].concat(g.nn.map(function (x) { return x.i; })).forEach(function (i) { if (!seen.has(i)) { seen.add(i); core.push(i); } });
    });
    var P = pca(core, 3);
    var pos = new Map(); core.forEach(function (i) { pos.set(i, P.project(i)); });

    var ink = cssVar('--ink') || '#0F1E33', mute = cssVar('--mute') || '#5B6B7F', line = cssVar('--line') || '#E2E8F0';
    var traces = [], placed = new Set();
    last.groups.forEach(function (g) { placed.add(g.i); });

    // Context: 2nd-degree neighbours projected into the same PCA space (not used to fit it).
    if (showCtx) {
      var ctx = [];
      last.groups.forEach(function (g) {
        g.nn.forEach(function (x) {
          nearest(row(x.i), seen, CONTEXT_PER_NEIGHBOR).forEach(function (y) { if (!seen.has(y.i) && ctx.indexOf(y.i) < 0) ctx.push(y.i); });
        });
      });
      var cp = ctx.map(function (i) { return P.project(i); });
      traces.push({
        type: 'scatter3d', mode: showLabels ? 'markers+text' : 'markers', name: 'context',
        x: cp.map(function (p) { return p[0]; }), y: cp.map(function (p) { return p[1]; }), z: cp.map(function (p) { return p[2]; }),
        text: ctx.map(function (i) { return vocab[i]; }), textposition: 'top center',
        textfont: { size: 10, color: mute, family: 'Inter, sans-serif' },
        marker: { size: 3, color: mute, opacity: 0.45 },
        hovertemplate: '%{text}<br><i>neighbor of a neighbor</i><extra></extra>', showlegend: false
      });
    }

    last.groups.forEach(function (g) {
      var q = pos.get(g.i);
      if (showLines) {
        var lx = [], ly = [], lz = [];
        g.nn.forEach(function (x) { var p = pos.get(x.i); lx.push(q[0], p[0], null); ly.push(q[1], p[1], null); lz.push(q[2], p[2], null); });
        traces.push({ type: 'scatter3d', mode: 'lines', x: lx, y: ly, z: lz, line: { color: g.color, width: 3 }, opacity: 0.35, hoverinfo: 'skip', showlegend: false });
      }
      var nn = g.nn.filter(function (x) { if (placed.has(x.i)) return false; placed.add(x.i); return true; });
      var pts = nn.map(function (x) { return pos.get(x.i); });
      traces.push({
        type: 'scatter3d', mode: showLabels ? 'markers+text' : 'markers', name: g.word + ' neighbors',
        x: pts.map(function (p) { return p[0]; }), y: pts.map(function (p) { return p[1]; }), z: pts.map(function (p) { return p[2]; }),
        text: nn.map(function (x) { return x.w; }), customdata: nn.map(function (x) { return x.s.toFixed(3); }),
        textposition: 'top center', textfont: { size: 13, color: ink, family: 'Inter, sans-serif' },
        marker: { size: nn.map(function (x) { return 5 + Math.max(0, x.s) * 9; }), color: g.color, opacity: 0.9, line: { width: 0 } },
        hovertemplate: '<b>%{text}</b><br>cosine to “' + esc(g.word) + '”: %{customdata}<extra></extra>', showlegend: false
      });
      traces.push({
        type: 'scatter3d', mode: 'markers+text', name: g.word,
        x: [q[0]], y: [q[1]], z: [q[2]], text: ['<b>' + esc(g.word) + '</b>'],
        textposition: 'top center', textfont: { size: 18, color: g.color, family: 'Inter, sans-serif' },
        marker: { size: 13, color: g.color, symbol: 'diamond', line: { color: ink, width: 1 } },
        hovertemplate: '<b>' + esc(g.word) + '</b> (query)<extra></extra>', showlegend: false
      });
    });

    var axis = function (k) {
      return {
        title: { text: 'PC' + (k + 1) + ' · ' + (P.vars[k] * 100).toFixed(0) + '%', font: { size: 12, color: mute } },
        showgrid: true, gridcolor: line, zeroline: false, showbackground: false,
        showticklabels: false, showspikes: false, color: mute
      };
    };
    var layout = {
      margin: { l: 0, r: 0, t: 0, b: 0 }, paper_bgcolor: 'rgba(0,0,0,0)', showlegend: false,
      font: { family: 'Inter, sans-serif', color: ink },
      hoverlabel: { font: { family: 'Inter, sans-serif' } },
      scene: { xaxis: axis(0), yaxis: axis(1), zaxis: axis(2), aspectmode: 'cube', camera: { eye: { x: 1.45, y: 1.45, z: 0.9 } } },
      uirevision: last.groups.map(function (g) { return g.word; }).join(',')   // keep the camera while toggling options
    };
    if (!el._fullLayout) el.innerHTML = '';   // remove the placeholder only before the first draw; later draws update in place
    window.Plotly.react(el, traces, layout, { displaylogo: false, responsive: true, modeBarButtonsToRemove: ['toImage', 'resetCameraLastSave3d'] });

    $('#legend').innerHTML = last.groups.map(function (g) { return '<span><i style="background:' + g.color + '"></i>' + esc(g.word) + '</span>'; }).join('') +
      (showCtx ? '<span><i style="background:' + mute + ';opacity:.5"></i>context</span>' : '');
    var total = P.vars.reduce(function (a, b) { return a + b; }, 0);
    $('#plot-foot').textContent = 'PCA of ' + core.length + ' words. These 3 components keep ' + (total * 100).toFixed(0) +
      '% of the variance among the plotted words, so 3D distances are approximate. Rely on the cosine scores in the tables.';
  }

  /* ---------------- Analogies ---------------- */
  function analogy() {
    var ws = ['#a1', '#a2', '#a3'].map(function (s) { return $(s).value.trim().toLowerCase(); });
    var out = $('#a-out');
    var missing = ws.filter(function (w) { return !index.has(w); });
    if (missing.length) { out.innerHTML = '<div class="w2v-status err">Not in vocabulary: ' + missing.map(esc).join(', ') + '</div>'; return; }
    var ids = ws.map(function (w) { return index.get(w); });
    var v = new Float32Array(dim), a = row(ids[0]), b = row(ids[1]), c = row(ids[2]);
    for (var j = 0; j < dim; j++) v[j] = a[j] - b[j] + c[j];
    normalize(v);
    var res = nearest(v, new Set(ids), 6);
    out.innerHTML = '<div class="w2v-a-best">' + esc(ws[0]) + ' − ' + esc(ws[1]) + ' + ' + esc(ws[2]) + ' ≈ <b>' + esc(res[0].w) + '</b></div>' +
      '<div class="w2v-a-list">' + res.map(function (x) { return '<span>' + esc(x.w) + '<small>' + x.s.toFixed(3) + '</small></span>'; }).join('') + '</div>' +
      '<div><button type="button" class="btn btn-outline" data-explore-map="' + esc(ws[0] + ',' + res[0].w) + '">Compare “' + esc(ws[0]) + '” and “' + esc(res[0].w) + '” in 3D →</button></div>';
  }

  /* ---------------- Autocomplete ---------------- */
  var sugIdx = -1;
  function currentPrefix(val) { var parts = val.split(','); return parts[parts.length - 1].trim().toLowerCase(); }
  function showSuggest() {
    var input = $('#q'), list = $('#suggest'), pre = currentPrefix(input.value);
    sugIdx = -1;
    if (!pre || !n) { list.hidden = true; input.setAttribute('aria-expanded', 'false'); return; }
    var out = [];
    for (var i = 0; i < n && out.length < 8; i++) if (vocab[i].indexOf(pre) === 0) out.push(i);
    if (!out.length || (out.length === 1 && vocab[out[0]] === pre)) { list.hidden = true; input.setAttribute('aria-expanded', 'false'); return; }
    list.innerHTML = out.map(function (i, k) { return '<li role="option" id="sg' + k + '" data-word="' + esc(vocab[i]) + '" aria-selected="false">' + esc(vocab[i]) + '<small>#' + fmt(i + 1) + '</small></li>'; }).join('');
    list.hidden = false; input.setAttribute('aria-expanded', 'true');
  }
  function pickSuggest(word) {
    var input = $('#q'), parts = input.value.split(',');
    parts[parts.length - 1] = (parts.length > 1 ? ' ' : '') + word;
    input.value = parts.join(',');
    $('#suggest').hidden = true; input.setAttribute('aria-expanded', 'false');
  }
  function moveSuggest(d) {
    var items = $$('#suggest li'); if (!items.length) return;
    sugIdx = (sugIdx + d + items.length) % items.length;
    items.forEach(function (li, k) { li.setAttribute('aria-selected', String(k === sugIdx)); });
    $('#q').setAttribute('aria-activedescendant', 'sg' + sugIdx);
  }

  /* ---------------- Theme ---------------- */
  function setTheme(th) {
    document.documentElement.setAttribute('data-theme', th);
    try { localStorage.setItem('ltb-theme', th); } catch (e) {}
    $$('[data-theme-icon]').forEach(function (el) { el.textContent = th === 'dark' ? '☀' : '☾'; });
    if (last) plot();
  }

  /* ---------------- Wire up ---------------- */
  function run(text) { $('#q').value = text; search(text, { scroll: false }); }

  $('#search-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var list = $('#suggest');
    if (!list.hidden && sugIdx >= 0) { pickSuggest($$('#suggest li')[sugIdx].getAttribute('data-word')); }
    list.hidden = true;
    search($('#q').value);
  });
  $('#q').addEventListener('input', showSuggest);
  $('#q').addEventListener('keydown', function (e) {
    if ($('#suggest').hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); moveSuggest(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveSuggest(-1); }
    else if (e.key === 'Escape') { $('#suggest').hidden = true; }
  });
  $('#q').addEventListener('blur', function () { setTimeout(function () { $('#suggest').hidden = true; }, 150); });
  $('#suggest').addEventListener('mousedown', function (e) {
    var li = e.target.closest('li'); if (!li) return;
    e.preventDefault(); pickSuggest(li.getAttribute('data-word')); search($('#q').value);
  });
  $('#analogy-form').addEventListener('submit', function (e) { e.preventDefault(); analogy(); });
  ['#opt-labels', '#opt-lines', '#opt-context'].forEach(function (s) { $(s).addEventListener('change', plot); });

  document.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-try')) { if (n) run(b.getAttribute('data-try')); return; }
    if (b.hasAttribute('data-explore')) { run(b.getAttribute('data-explore')); $('#neighbors').scrollIntoView({ behavior: 'smooth' }); return; }
    if (b.hasAttribute('data-explore-map')) { run(b.getAttribute('data-explore-map').replace(',', ', ')); $('#map').scrollIntoView({ behavior: 'smooth' }); return; }
    if (b.hasAttribute('data-analogy')) {
      var p = b.getAttribute('data-analogy').split(',');
      $('#a1').value = p[0]; $('#a2').value = p[1]; $('#a3').value = p[2];
      if (n) analogy();
      return;
    }
    if (b.hasAttribute('data-toggle-theme')) setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  $('[data-year]').textContent = String(new Date().getFullYear());
  setTheme(document.documentElement.getAttribute('data-theme') || 'light');
  $('#plot').innerHTML = '<div class="w2v-plot-empty">Loading model…</div>';

  load().then(function () {
    var w = new URLSearchParams(location.search).get('w');
    $('#q').value = w || 'france';
    search($('#q').value, { silent: !w });
    analogy();
  });
})();

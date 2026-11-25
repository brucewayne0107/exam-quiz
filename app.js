'use strict';
// 防被别的网站嵌进框里（点击劫持）
if (window.top !== window.self) { try { window.top.location = window.self.location.href; } catch (e) { document.documentElement.style.display = 'none'; } }
// 题库里的 HTML 只留排版：去掉脚本、框架、表单、事件属性和 javascript: 链接（以防以后 AI 生成的内容里混进东西）
var OK_TAGS = /^(P|DIV|SPAN|B|STRONG|I|EM|U|SUB|SUP|BR|UL|OL|LI|TABLE|THEAD|TBODY|TR|TH|TD|CODE|PRE|BLOCKQUOTE|H[1-6]|HR|SMALL|MARK|A)$/;
function clean(html) {
  var doc = new DOMParser().parseFromString('<body>' + (html || '') + '</body>', 'text/html'), all = doc.body.querySelectorAll('*'), i, j, el, at, n;
  for (i = all.length - 1; i >= 0; i--) {
    el = all[i];
    if (!OK_TAGS.test(el.tagName)) { if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|FORM|INPUT|BUTTON|TEXTAREA|SELECT|LINK|META|SVG|MATH|TEMPLATE|IMG|VIDEO|AUDIO|SOURCE)$/.test(el.tagName)) { el.remove(); } else { el.replaceWith.apply(el, Array.prototype.slice.call(el.childNodes)); } continue; }
    for (j = el.attributes.length - 1; j >= 0; j--) {
      at = el.attributes[j]; n = at.name.toLowerCase();
      if (n !== 'class' && n !== 'colspan' && n !== 'rowspan' && !(n === 'href' && /^https:\/\//i.test(at.value))) { el.removeAttribute(at.name); }
    }
    if (el.tagName === 'A') { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer'); }
  }
  return doc.body.innerHTML;
}
function plain(html) { return new DOMParser().parseFromString('<body>' + clean(html) + '</body>', 'text/html').body.textContent; }
var $ = function (id) { return document.getElementById(id); };
var BOOKS = [], book = '', D = null, ST = null, pool = [], at = 0, mode = '', picks = {}, sesOk = 0, sesBad = 0;
function load(k, d) { try { var v = localStorage.getItem(k), x = v ? JSON.parse(v) : d; return x === null || typeof x === typeof d || d === null ? x : d; } catch (e) { return d; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function toast(t) { var e = $('toast'); e.textContent = t; e.className = 'on'; clearTimeout(toast.t); toast.t = setTimeout(function () { e.className = ''; }, 1600); }
function esc(t) { return String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function st() { return ST; }
function persist() { save('eq_' + book, ST); }

// 题库是 gzip 后再按 KEY 异或的 .bin（挡简单爬虫；不是加密，和 export_quiz.py 的 KEY 一致）
var KEY = 'lulu-exam-quiz-2026';
function getBook(b) {
  if (typeof DecompressionStream === 'undefined') { return Promise.reject(new Error('old')); }
  return fetch('data/' + b + '.bin').then(function (r) { if (!r.ok) { throw new Error(r.status); } return r.arrayBuffer(); }).then(function (buf) {
    var u = new Uint8Array(buf), i, k = KEY.length;
    for (i = 0; i < u.length; i++) { u[i] ^= KEY.charCodeAt(i % k); }
    return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
  });
}
function getJSON(u) { return fetch(u).then(function (r) { if (!r.ok) { throw new Error(r.status); } return r.json(); }); }
function openBook(b) {
  book = b; save('eq_book', b);
  ST = load('eq_' + b, { ans: {}, wrong: {} });
  drawBooks(); $('sum').innerHTML = '<div class="empty">加载题库…</div>'; $('chs').innerHTML = '';
  getBook(b).then(function (d) { if (book !== b) { return; } D = d; drawHome(); restoreSes(); }, function () { $('sum').innerHTML = '<div class="empty">题库加载失败，检查网络后刷新</div>'; });
}
function drawBooks() {
  $('books').innerHTML = BOOKS.map(function (b) { return '<button data-b="' + esc(b.id) + '" class="' + (b.id === book ? 'on' : '') + '">' + esc(b.name) + '</button>'; }).join('');
}
function stats(qs) {
  var done = 0, ok = 0, w = 0;
  qs.forEach(function (q) { var a = ST.ans[q.id]; if (a) { done++; if (a === q.a) { ok++; } } if (ST.wrong[q.id]) { w++; } });
  return { done: done, ok: ok, w: w };
}
function drawHome() {
  var s = stats(D.qs), n = D.qs.length, todo = n - s.done;
  $('sum').innerHTML = '<div class="big">' + s.done + '<small>/ ' + n + ' 已做</small></div><div class="bar"><i style="width:' + (s.done / n * 100).toFixed(1) + '%"></i></div>' +
    '<div class="row"><span>正确率 <b>' + (s.done ? Math.round(s.ok / s.done * 100) + '%' : '—') + '</b></span><span>错题本 <b>' + s.w + '</b></span></div>' +
    '<div class="modes"><button class="pri" data-m="todo">没做过的<small>' + todo + ' 题</small></button><button data-m="wrong">错题本<small>' + s.w + ' 题</small></button><button data-m="rand">随机<small>全书</small></button></div>';
  $('chs').innerHTML = D.chapters.map(function (c) {
    var qs = D.qs.filter(function (q) { return q.ch === c.code; }), t = stats(qs);
    return '<button class="ch" data-c="' + esc(c.code) + '"><span class="code">' + esc(c.code) + '</span><span class="nm"><b>' + esc(c.name || c.code) + '</b><span class="bar"><i style="width:' + (t.done / c.n * 100).toFixed(1) + '%"></i></span></span><span class="ct">' + t.done + '/' + c.n + (t.w ? '<span class="w">错 ' + t.w + '</span>' : '') + '</span></button>';
  }).join('');
}
function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function start(m, ch) {
  var all = D.qs.map(function (q, i) { return i; }), first = 0;
  mode = m; picks = {}; sesOk = 0; sesBad = 0;
  if (m === 'ch') { pool = all.filter(function (i) { return D.qs[i].ch === ch; }); first = pool.findIndex(function (i) { return !ST.ans[D.qs[i].id]; }); if (first < 0) { first = 0; } }
  else if (m === 'wrong') { pool = all.filter(function (i) { return ST.wrong[D.qs[i].id]; }); }
  else if (m === 'todo') { pool = all.filter(function (i) { return !ST.ans[D.qs[i].id]; }); }
  else { pool = shuffle(all); }
  if (!pool.length) { toast(m === 'wrong' ? '错题本是空的' : '这里的题都做过了'); return; }
  at = first;
  $('qmode').textContent = m === 'ch' ? ch + ' ' + ((D.chapters.find(function (c) { return c.code === ch; }) || {}).name || '') : { wrong: '错题本', todo: '没做过的', rand: '随机' }[m];
  showQ(); drawQ(true);
}
function showQ() { $('home').hidden = true; $('q').hidden = false; $('dock').hidden = false; }
// 记住做到哪题：切到别的 App、手机把页面回收重载后，回来还在原题原位置
function saveSes() { if (!$('q').hidden && D) { save('eq_ses', { book: book, mode: mode, label: $('qmode').textContent, pool: pool, at: at, picks: picks, ok: sesOk, bad: sesBad, y: window.scrollY, t: Date.now() }); } }
function restoreSes() {
  var x = load('eq_ses', null);
  if (!x || x.book !== book || Date.now() - x.t > 12 * 3600 * 1000 || !x.pool || !x.pool.length || x.pool.some(function (i) { return !D.qs[i]; })) { return false; }
  mode = x.mode; pool = x.pool; at = Math.min(x.at, pool.length - 1); picks = x.picks || {}; sesOk = x.ok || 0; sesBad = x.bad || 0;
  $('qmode').textContent = x.label || ''; showQ(); drawQ(false); window.scrollTo(0, x.y || 0);
  return true;
}
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') { saveSes(); } });
window.addEventListener('pagehide', saveSes);
function drawQ(top) {
  var q = D.qs[pool[at]], p = picks[q.id], h = '', prev = ST.ans[q.id];
  $('qpos').innerHTML = '<b>' + (at + 1) + '</b> / ' + pool.length + ' · ' + esc(q.id);
  $('qsc').innerHTML = '<span style="color:var(--ok)">对 ' + sesOk + '</span> · <span style="color:var(--bad)">错 ' + sesBad + '</span>';
  $('qfill').style.width = ((at + 1) / pool.length * 100).toFixed(1) + '%';
  h += '<h3>' + (ST.wrong[q.id] ? '<span class="tag w">错题本</span>' : '') + (prev && !p ? '<span class="tag">上次' + (prev === q.a ? '对' : '错') + '</span>' : '') + esc(q.t) + '<small>' + esc(q.en) + '</small></h3>';
  h += '<div class="md stem">' + clean(q.s) + '</div>';
  q.o.forEach(function (o) {
    var c = 'op';
    if (p) { c += o[0] === q.a ? ' right' : (o[0] === p ? ' wrong' : ' dim'); }
    h += '<button class="' + c + '" data-k="' + o[0] + '"><b>' + esc(o[0]) + '</b><span>' + clean(o[1]) + '</span></button>';
  });
  if (p) {
    h += '<div class="vd ' + (p === q.a ? 'ok">✓ 答对了' : 'bad">✗ 你选 ' + p + '，正确答案 ' + q.a) + '</div>';
    if (q.tp) { h += '<div class="tp">考点：' + esc(q.tp) + '</div>'; }
    h += '<div class="md">' + clean(q.x) + '</div>';
  }
  h += '<div class="ai"><div class="hd"><span>问 AI（会先复制题目）</span><select id="aisel">' + AIS.map(function (a) { return '<option value="' + a[0] + '"' + (a[0] === aiTo ? ' selected' : '') + '>' + a[1] + '</option>'; }).join('') + '</select></div>' +
    '<div class="two"><button data-ai="frame">大框架<small>这题在知识树的哪里</small></button><button data-ai="deep">系统梳理<small>相关知识点全面讲透</small></button></div></div>';
  h += '<div class="fb">这题有错？<a target="_blank" rel="noopener" href="https://github.com/brucewayne0107/exam-quiz/issues/new?title=' + encodeURIComponent('[' + q.id + '] ' + q.t + '：') + '&body=' + encodeURIComponent('题号：' + q.id + '\n哪里有问题（答案 / 解析 / 题干 / 条款号）：\n\n依据（官方来源链接更好）：\n') + '">反馈给作者</a></div>';
  $('qbody').innerHTML = h;
  $('mk').className = ST.wrong[q.id] ? 'on' : '';
  $('pv').disabled = at === 0; $('pv').style.opacity = at === 0 ? .4 : 1;
  $('nx').textContent = at === pool.length - 1 ? '完成' : '下一题';
  if (top) { window.scrollTo(0, 0); }
  saveSes();
}
// 问 AI：拼好提示词 → 复制 → 打开选的 AI（带上提示词；App 不认的话直接粘贴）
var AIS = [['claude', 'Claude'], ['chatgpt', 'ChatGPT'], ['gemini', 'Gemini'], ['copy', '只复制']];
var aiTo = load('eq_ai', 'claude');
var ASK = {
  frame: '请用中文，从「大框架」讲这道题：\n1. 它的考点在 CPA {B} 考纲里属于哪一块，用 3 层以内的层级结构（缩进列表）画出这一块的知识树，标出本题所在的节点；\n2. 用 3–5 句话说明这个节点和上下游概念的关系；\n3. 一句话说明这题为什么选正确答案。\n只讲框架，不要展开细节；拿不准的准则条款号请标注「待核实」，不要编造。',
  deep: '请用中文，围绕这道题的考点做一次系统、全面的知识点梳理：\n1. 核心定义与适用准则（标准名称 / 条款号）；\n2. 相关的全部规则、例外和数字门槛，容易混淆的概念用表格对比；\n3. 逐个选项说明对或错的原因；\n4. 这个考点常见的出题方式和陷阱；\n5. 出 3 道同考点的变式选择题，附答案和一句解析；\n6. 最后给一句便于记忆的口诀。\n拿不准的准则条款号或数字请标注「待核实」，不要编造。'
};
function aiPrompt(kind) {
  var q = D.qs[pool[at]], p = picks[q.id] || '', ch = (D.chapters.find(function (c) { return c.code === q.ch; }) || {}).name || '';
  var stem = (document.querySelector('.stem') || {}).innerText || '';
  var t = ASK[kind].replace('{B}', book.replace(/_\d+$/, '')) + '\n\n【' + q.id + '】' + q.ch + ' ' + ch + (q.tp ? '｜考点：' + q.tp : '') + '\n' + q.t + ' ' + q.en + '\n\n' + stem.trim() + '\n\n';
  q.o.forEach(function (o) { t += o[0] + '. ' + plain(o[1]) + '\n'; });
  if (p) { t += '\n我选了 ' + p + '，正确答案是 ' + q.a + '。'; }
  return t;
}
function copyText(t, done) {
  function old() { var a = document.createElement('textarea'); a.value = t; a.style.position = 'fixed'; a.style.opacity = '0'; document.body.appendChild(a); a.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} document.body.removeChild(a); done(ok); }
  if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(t).then(function () { done(true); }, old); } else { old(); }
}
function askAI(kind) {
  var t = aiPrompt(kind), u = { claude: 'https://claude.ai/new?q=', chatgpt: 'https://chatgpt.com/?q=', gemini: 'https://gemini.google.com/app?q=' }[aiTo];
  copyText(t, function (ok) { toast(ok ? (u ? '已复制题目；没自动填上就粘贴' : '已复制，去 AI 那里粘贴') : '复制失败'); });
  // 不开新标签：iPhone 会把链接交给 AI App，留下一个空白标签页，切回来就是白屏。
  // 本页直接跳转：装了 App 就打开 App、本页不动；没装就在本页打开网页版，按返回回来，题目和位置都会恢复。
  if (u) { saveSes(); location.href = u + encodeURIComponent(t); }
}
function pick(k) {
  var q = D.qs[pool[at]];
  if (picks[q.id]) { return; }
  picks[q.id] = k; ST.ans[q.id] = k;
  if (k === q.a) { sesOk++; } else { sesBad++; ST.wrong[q.id] = 1; }
  persist();
  if (navigator.vibrate) { navigator.vibrate(k === q.a ? 15 : [20, 40, 20]); }
  drawQ(false);
  var v = document.querySelector('.vd'); if (v) { v.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}
function go(d) {
  var n = at + d;
  if (n < 0) { return; }
  if (n >= pool.length) { toast('这一组做完了：对 ' + sesOk + '，错 ' + sesBad); home(); return; }
  at = n; drawQ(true);
}
function home() { save('eq_ses', null); $('home').hidden = false; $('q').hidden = true; $('dock').hidden = true; drawHome(); window.scrollTo(0, 0); }

document.addEventListener('click', function (e) {
  var t = e.target.closest('button'); if (!t) { return; }
  if (t.dataset.b) { openBook(t.dataset.b); }
  else if (t.dataset.m) { start(t.dataset.m); }
  else if (t.dataset.c) { start('ch', t.dataset.c); }
  else if (t.dataset.k) { pick(t.dataset.k); }
  else if (t.id === 'bk') { home(); }
  else if (t.id === 'pv') { go(-1); }
  else if (t.id === 'nx') { go(1); }
  else if (t.id === 'mk') { var id = D.qs[pool[at]].id; if (ST.wrong[id]) { delete ST.wrong[id]; toast('移出错题本'); } else { ST.wrong[id] = 1; toast('加入错题本'); } persist(); drawQ(false); }
  else if (t.dataset.ai) { askAI(t.dataset.ai); }
  else if (t.id === 'exp') { exportProg(); }
  else if (t.id === 'imp') { importProg(); }
});
document.addEventListener('change', function (e) { if (e.target.id === 'aisel') { aiTo = e.target.value; save('eq_ai', aiTo); } });
// 左右滑切题（横向位移明显大于纵向时才算，表格横向滚动不触发）
var sx = 0, sy = 0, sok = false;
document.addEventListener('touchstart', function (e) { if ($('q').hidden) { return; } var t = e.touches[0]; sx = t.clientX; sy = t.clientY; sok = !e.target.closest('table'); }, { passive: true });
document.addEventListener('touchend', function (e) {
  if ($('q').hidden || !sok) { return; }
  var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
  if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2) { go(dx < 0 ? 1 : -1); }
}, { passive: true });

function exportProg() {
  var all = {}; BOOKS.forEach(function (b) { all[b.id] = load('eq_' + b.id, null); });
  var text = JSON.stringify(all);
  if (navigator.clipboard) { navigator.clipboard.writeText(text).then(function () { toast('进度已复制，粘贴到备忘录保存'); }, function () { window.prompt('复制下面的进度文字', text); }); }
  else { window.prompt('复制下面的进度文字', text); }
}
function importProg() {
  var text = window.prompt('粘贴之前导出的进度文字（会和现在的进度合并）');
  if (!text) { return; }
  if (text.length > 300000) { toast('内容太长，不像进度文字'); return; }
  var ID = /^[A-Z]\d{2}-\d{3}$/, KEY = /^[A-F]$/;
  try {
    var all = JSON.parse(text), n = 0;
    if (!all || typeof all !== 'object' || Array.isArray(all)) { throw new Error('bad'); }
    Object.keys(all).forEach(function (b) {
      var src = all[b]; if (!BOOKS.some(function (x) { return x.id === b; }) || !src || typeof src.ans !== 'object' || !src.ans) { return; }
      var cur = load('eq_' + b, { ans: {}, wrong: {} });
      Object.keys(src.ans).forEach(function (k) { if (ID.test(k) && KEY.test(String(src.ans[k])) && !Object.prototype.hasOwnProperty.call(cur.ans, k)) { cur.ans[k] = String(src.ans[k]); n++; } });
      Object.keys(src.wrong && typeof src.wrong === 'object' ? src.wrong : {}).forEach(function (k) { if (ID.test(k)) { cur.wrong[k] = 1; } });
      save('eq_' + b, cur);
    });
    toast('导入了 ' + n + ' 题的记录'); openBook(book);
  } catch (e) { toast('格式不对'); }
}

getJSON('data/books.json').then(function (b) {
  BOOKS = b;
  var last = load('eq_book', ''); openBook(BOOKS.some(function (x) { return x.id === last; }) ? last : BOOKS[0].id);
}, function () { $('sum').innerHTML = '<div class="empty">题库加载失败，检查网络后刷新</div>'; });

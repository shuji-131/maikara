/* ══════════════════════════════════════════════════
   マイカラ — 画面

   ・一覧（歌本の体裁で組む）
   ・曲の中身／登録・修正
   ・控えの書き出しと読み戻し

   Android の入れ物とのやりとりは window.Maikara の3つだけ。
   無い場合（PCのブラウザ）はその場で代わりの動きに落とす。
   ══════════════════════════════════════════════════ */
(function(){
'use strict';

var BUILD = 'v1';
var $ = function(id){ return document.getElementById(id); };
var bridge = (typeof window.Maikara !== 'undefined') ? window.Maikara : null;

var state = { q:'', sort:'title', tags:[], eras:[], mode:'simple', onlyNoYomi:false };
var editingId = null;              // 修正中の曲。新規のときは null
var formTags = [], formEra = '2010年代', formKey = 0;

/* ══ 小物 ══ */

function el(tag, cls, text){
  var n = document.createElement(tag);
  if(cls) n.className = cls;
  if(text != null) n.textContent = text;
  return n;
}
function keyText(k){
  var v = parseInt(k, 10) || 0;
  return v === 0 ? '±0' : (v > 0 ? '+' + v : String(v));
}
var toastTimer = null;
function toast(msg){
  var t = $('toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ t.classList.remove('on'); }, 2800);
}

/** その場で聞く。window.confirm は端末によって出ないことがあるので自前で出す */
var askCb = null;
function ask(msg, okLabel, cb){
  $('askMsg').textContent = msg;
  $('askOk').textContent = okLabel || 'はい';
  askCb = cb;
  $('ask').hidden = false;
  requestAnimationFrame(function(){ $('ask').classList.add('on'); });
}
function askClose(yes){
  $('ask').classList.remove('on');
  var cb = askCb;
  askCb = null;
  setTimeout(function(){ $('ask').hidden = true; }, 180);
  if(yes && cb) cb();
}

/* ══ 並べ方 ══ */

function songs(){ return Store.data.songs; }

function matches(s){
  // 「?」の棚に入るものだけ。英語タイトルでよみ空のものは Ａ〜Ｚ が正しい置き場なので数えない
  if(state.onlyNoYomi && Kana.bucketOf(s.yomi, s.title) !== '?') return false;
  // タグは「どれか1つでも持っていれば出す」（some＝Or）。every に変えると And になる
  if(state.tags.length && !state.tags.some(function(t){ return s.tags.indexOf(t) >= 0; })) return false;
  if(state.eras.length && state.eras.indexOf(s.era) < 0) return false;
  var q = state.q.trim();
  if(!q) return true;
  var hay = [s.title, s.artist, s.yomi, s.artistYomi].join(' ').toLowerCase();
  if(hay.indexOf(q.toLowerCase()) >= 0) return true;
  var nq = Kana.norm(q);
  if(nq && (Kana.norm(s.yomi).indexOf(nq) === 0 || Kana.norm(s.artistYomi).indexOf(nq) === 0)) return true;
  return false;
}

function byTitle(a, c){
  var ka = Kana.key(a.yomi), kc = Kana.key(c.yomi);
  if(ka !== kc) return ka < kc ? -1 : 1;
  return a.title.localeCompare(c.title, 'ja');
}

function grouped(){
  var list = songs().filter(matches);

  if(state.sort === 'added'){
    list.sort(function(a, b){ return b.id - a.id; });
    return [{ kind:'flat', b:null, items:list }];
  }

  var order = Kana.buckets();

  /* 歌手名順：歌手ごとに黒帯を立てて、その下に曲名を並べる（歌本の歌手名さくいんと同じ） */
  if(state.sort === 'artist'){
    var amap = {}, akeys = [];
    list.forEach(function(s){
      if(!amap[s.artist]){
        amap[s.artist] = {
          kind:'artist', label:s.artist, sub:Kana.norm(s.artistYomi),
          b:Kana.bucketOf(s.artistYomi, s.artist), items:[]
        };
        akeys.push(s.artist);
      }
      amap[s.artist].items.push(s);
    });
    var arr = akeys.map(function(k){ return amap[k]; });
    arr.sort(function(a, c){
      var ba = order.indexOf(a.b), bc = order.indexOf(c.b);
      if(ba !== bc) return ba - bc;
      if(a.b === 'AZ'){
        var ta = a.label.toUpperCase(), tc = c.label.toUpperCase();
        return ta < tc ? -1 : ta > tc ? 1 : 0;
      }
      var ka = Kana.key(a.sub), kc = Kana.key(c.sub);
      if(ka !== kc) return ka < kc ? -1 : 1;
      return a.label.localeCompare(c.label, 'ja');
    });
    var seen = {};
    arr.forEach(function(g){
      g.items.sort(byTitle);
      if(!seen[g.b]){ g.anchor = true; seen[g.b] = true; }
    });
    return arr;
  }

  /* 曲名順：行（あ・か・さ…）ごとに黒帯 */
  var map = {};
  list.forEach(function(s){
    var b = Kana.bucketOf(s.yomi, s.title);
    (map[b] = map[b] || []).push(s);
  });
  return order.filter(function(b){ return map[b]; }).map(function(b){
    var items = map[b].slice();
    if(b === 'AZ') items.sort(function(a, c){
      var ta = a.title.toUpperCase(), tc = c.title.toUpperCase();
      return ta < tc ? -1 : ta > tc ? 1 : 0;
    });
    else if(b === '?') items.sort(function(a, c){ return a.id - c.id; });
    else items.sort(byTitle);
    return { kind:'row', label:Kana.title(b), b:b, items:items, anchor:true };
  });
}

/* ══ 描く ══ */

function render(){
  var groups = grouped();
  var page = $('page');
  page.textContent = '';
  page.setAttribute('data-mode', state.mode);
  var by = state.sort === 'artist' ? 'artist' : 'title';
  page.setAttribute('data-by', state.sort === 'added' ? 'added' : by);
  var shown = 0;
  var total = songs().length;

  if(!groups.length || !groups[0].items.length){
    var e = el('div', 'empty');
    if(total === 0){
      e.appendChild(el('b', null, 'まだ1曲も入っていません'));
      e.appendChild(el('span', null, '下の「＋ 曲を追加」から入れていきます。'));
      var mini = el('button', 'mini', '見本を入れて試す');
      mini.type = 'button';
      mini.addEventListener('click', function(){
        var n = Store.loadSample();
        render();
        toast('見本を' + n + '曲入れました');
      });
      e.appendChild(mini);
    } else {
      e.appendChild(el('b', null, '見つかりませんでした'));
      e.appendChild(el('span', null, '検索の言葉を短くするか、絞り込みを外してみてください。'));
    }
    page.appendChild(e);
  }

  groups.forEach(function(g){
    if(g.kind === 'artist'){
      var ha = el('div', 'gyo name');
      if(g.anchor) ha.id = 'gyo-' + g.b;
      var lab = el('span', 'glabel');
      lab.appendChild(el('b', null, g.label));
      if(g.sub) lab.appendChild(el('em', null, g.sub + '‥'));
      ha.appendChild(lab);
      ha.appendChild(el('span', null, g.items.length + '曲'));
      page.appendChild(ha);
    } else if(g.kind === 'row'){
      var h = el('div', 'gyo');
      h.id = 'gyo-' + g.b;
      h.appendChild(document.createTextNode(g.label));
      h.appendChild(el('span', null, g.items.length + '曲'));
      page.appendChild(h);
    }

    g.items.forEach(function(s, i){
      shown++;
      var row = el('button', 'song' + (Math.floor(i / 5) % 2 === 1 ? ' band' : ''));
      row.type = 'button';
      row.setAttribute('data-id', s.id);

      row.appendChild(el('span', 'ruby', Kana.norm(s.yomi) || '‥'));
      row.appendChild(el('span', 't', s.title));
      if(state.mode === 'detail') row.appendChild(el('span', 'no', keyText(s.key)));
      // 歌手名順のときは歌手名が黒帯に出ているので、右の欄には歌い出しを入れる
      row.appendChild(el('span', 'a', by === 'artist' ? (s.hum || '') : s.artist));

      if(state.mode === 'detail'){
        var m = el('div', 'meta');
        s.tags.forEach(function(t){ m.appendChild(el('i', null, t)); });
        if(s.era) m.appendChild(el('span', null, s.era));
        row.appendChild(m);
        if(s.hum && by !== 'artist') row.appendChild(el('div', 'hum', s.hum));
      }
      page.appendChild(row);
    });
  });

  $('footRight').textContent = shown + (shown !== total ? ' / ' + total : '');
  $('runLeft').textContent = state.sort === 'artist' ? '歌手名さくいん'
                           : (state.sort === 'added' ? '登録順' : '曲名さくいん');
  var bs = groups.filter(function(g){ return g.b; });
  $('runRight').textContent = bs.length
    ? (Kana.label(bs[0].b) + ' 〜 ' + Kana.label(bs[bs.length - 1].b)) : '—';

  var n = state.tags.length + state.eras.length;
  $('fcount').textContent = n;
  $('fcount').hidden = n === 0;

  var noYomi = songs().filter(function(s){
    return Kana.bucketOf(s.yomi, s.title) === '?';
  }).length;
  $('noticeN').textContent = noYomi;
  $('notice').hidden = noYomi === 0;
  $('noticeBtn').textContent = state.onlyNoYomi ? 'ぜんぶ表示に戻す' : 'その曲を見る';

  $('sCount').textContent = total + '曲' +
    (Store.data.updated ? '　最後に書いたのは ' + Store.data.updated : '');

  renderTabs(groups);
}

function renderTabs(groups){
  var tabs = $('tabs');
  tabs.textContent = '';
  var has = {};
  groups.forEach(function(g){ if(g.b) has[g.b] = (has[g.b] || 0) + g.items.length; });
  var off = state.sort === 'added';
  Kana.buckets().forEach(function(b){
    var t = el('button', 'tab');
    t.type = 'button';
    t.appendChild(document.createTextNode(Kana.label(b)));
    if(b === 'AZ') t.appendChild(el('small', null, 'Z'));
    t.disabled = off || !has[b];
    t.title = off ? '登録順のときは棚に分かれません'
                  : Kana.title(b) + '（' + (has[b] || 0) + '曲）';
    t.setAttribute('data-b', b);
    t.setAttribute('aria-current', 'false');
    t.addEventListener('click', function(){
      var h = document.getElementById('gyo-' + b);
      if(h) h.scrollIntoView({ behavior:'smooth', block:'start' });
      Array.prototype.forEach.call(tabs.children, function(x){
        x.setAttribute('aria-current', x === t ? 'true' : 'false');
      });
    });
    tabs.appendChild(t);
  });
  spy();
}

// 2段組のときは上下の位置で行を追えないので、押した爪だけを光らせる
var oneCol = window.matchMedia('(max-width:760px)');
var spyTimer = null;
function spy(){
  if(!oneCol.matches) return;
  var tabs = $('tabs');
  var heads = Array.prototype.slice.call(document.querySelectorAll('.gyo[id]'));
  var top = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hh')) || 120) + 60;
  var cur = null;
  heads.forEach(function(h){ if(h.getBoundingClientRect().top <= top) cur = h.id.slice(4); });
  if(!cur && heads.length) cur = heads[0].id.slice(4);
  Array.prototype.forEach.call(tabs.children, function(t){
    t.setAttribute('aria-current', t.getAttribute('data-b') === cur ? 'true' : 'false');
  });
}
window.addEventListener('scroll', function(){
  if(spyTimer) return;
  spyTimer = setTimeout(function(){ spyTimer = null; spy(); }, 100);
}, { passive:true });

/* ══ 下からのシート ══ */

function openSheet(id){
  $('scrim').hidden = false;
  var s = $(id);
  s.hidden = false;
  requestAnimationFrame(function(){ $('scrim').classList.add('on'); s.classList.add('on'); });
  document.body.style.overflow = 'hidden';
}
function closeSheets(){
  $('scrim').classList.remove('on');
  ['detail','form','settings'].forEach(function(id){ $(id).classList.remove('on'); });
  document.body.style.overflow = '';
  setTimeout(function(){
    $('scrim').hidden = true;
    ['detail','form','settings'].forEach(function(id){ $(id).hidden = true; });
  }, 220);
}

var detailId = null;
function showDetail(s){
  detailId = s.id;
  var y = Kana.norm(s.yomi);
  $('dRuby').textContent = y ? y + '‥' : 'よみ未設定';
  $('dTitle').textContent = s.title;
  $('dSub').textContent = (s.artist || '（歌手名なし）') +
    (Kana.norm(s.artistYomi) ? '（' + Kana.norm(s.artistYomi) + '‥）' : '');
  var b = $('dBody');
  b.textContent = '';
  function add(k, build){
    b.appendChild(el('dt', null, k));
    var dd = el('dd');
    build(dd);
    b.appendChild(dd);
  }
  add('キー', function(dd){
    var w = el('span', 'big-key');
    w.appendChild(document.createTextNode(keyText(s.key)));
    var v = parseInt(s.key, 10) || 0;
    w.appendChild(el('span', null, v === 0 ? '原曲のまま' : (v > 0 ? '上げる' : '下げる')));
    dd.appendChild(w);
  });
  add('歌い出し', function(dd){ dd.appendChild(el('div', 'quote', s.hum || '（未入力）')); });
  add('タグ', function(dd){
    var w = el('div', 'dtags');
    if(s.tags.length) s.tags.forEach(function(t){ w.appendChild(el('span', 'dtag', t)); });
    else w.appendChild(el('span', 'dtag', '（なし）'));
    dd.appendChild(w);
  });
  add('年代', function(dd){ dd.textContent = s.era || '（未設定）'; });
  add('自由欄', function(dd){ dd.textContent = s.memo || '（未入力）'; });
  openSheet('detail');
}

/* ══ タグ・年代のチップ ══ */

function buildChips(box, items, get, set){
  box.textContent = '';
  items.forEach(function(v){
    var c = el('button', 'chip', v);
    c.type = 'button';
    c.setAttribute('aria-pressed', get().indexOf(v) >= 0 ? 'true' : 'false');
    c.addEventListener('click', function(){
      var arr = get().slice(), i = arr.indexOf(v);
      if(i >= 0) arr.splice(i, 1); else arr.push(v);
      set(arr);
      c.setAttribute('aria-pressed', arr.indexOf(v) >= 0 ? 'true' : 'false');
      render();
    });
    box.appendChild(c);
  });
}
function rebuildFilterChips(){
  buildChips($('tagChips'), Store.data.tags,
    function(){ return state.tags; }, function(v){ state.tags = v; });
  buildChips($('eraChips'), Store.ERAS,
    function(){ return state.eras; }, function(v){ state.eras = v; });
}

/* ══ 登録・修正 ══ */

function buildFormChips(){
  var box = $('fTags');
  box.textContent = '';
  Store.data.tags.forEach(function(v){
    var c = el('button', 'chip', v);
    c.type = 'button';
    c.setAttribute('aria-pressed', formTags.indexOf(v) >= 0 ? 'true' : 'false');
    c.addEventListener('click', function(){
      var i = formTags.indexOf(v);
      if(i >= 0) formTags.splice(i, 1); else formTags.push(v);
      c.setAttribute('aria-pressed', formTags.indexOf(v) >= 0 ? 'true' : 'false');
    });
    box.appendChild(c);
  });
  var eb = $('fEras');
  eb.textContent = '';
  Store.ERAS.forEach(function(v){
    var c = el('button', 'chip', v);
    c.type = 'button';
    c.setAttribute('aria-pressed', formEra === v ? 'true' : 'false');
    c.addEventListener('click', function(){
      formEra = v;
      Array.prototype.forEach.call(eb.children, function(x){
        x.setAttribute('aria-pressed', x.textContent === v ? 'true' : 'false');
      });
    });
    eb.appendChild(c);
  });
}

// 曲名・歌手名を打っている間、よみ3文字を自動で埋める。
// 自分で書き換えたら、そこから先は触らない。
function hookAuto(srcId, yomiId, badgeId){
  var src = $(srcId), yo = $(yomiId), badge = $(badgeId);
  yo.addEventListener('input', function(){
    yo.setAttribute('data-touched', '1');
    badge.hidden = true;
  });
  src.addEventListener('input', function(){
    if(yo.getAttribute('data-touched') === '1') return;
    var a = Kana.auto(src.value);
    yo.value = a;
    badge.hidden = !a;
  });
}

function openForm(song){
  editingId = song ? song.id : null;
  $('fTitle').textContent = song ? '曲をなおす' : '曲を追加';
  $('fSave').textContent = song ? 'なおす' : 'この曲を登録';
  ['fSongYomi','fArtistYomi'].forEach(function(id){ $(id).removeAttribute('data-touched'); });
  $('fSongAuto').hidden = true;
  $('fArtistAuto').hidden = true;
  $('fNewTag').value = '';

  $('fSong').value       = song ? song.title : '';
  $('fSongYomi').value   = song ? song.yomi : '';
  $('fArtist').value     = song ? song.artist : '';
  $('fArtistYomi').value = song ? song.artistYomi : '';
  $('fHum').value        = song ? song.hum : '';
  $('fMemo').value       = song ? song.memo : '';
  formTags = song ? song.tags.slice() : [];
  formEra  = song ? (song.era || '2010年代') : '2010年代';
  formKey  = song ? (parseInt(song.key, 10) || 0) : 0;
  if(song){
    // 既にある曲は、よみを勝手に書き換えない
    $('fSongYomi').setAttribute('data-touched', '1');
    $('fArtistYomi').setAttribute('data-touched', '1');
  }
  $('fKey').textContent = keyText(formKey);
  buildFormChips();
  openSheet('form');
}

function saveForm(){
  var title = $('fSong').value.trim();
  if(!title){ $('fSong').focus(); toast('曲名を入れてください'); return; }
  var row = {
    title: title,
    yomi: $('fSongYomi').value.trim(),
    artist: $('fArtist').value.trim(),
    artistYomi: $('fArtistYomi').value.trim(),
    tags: formTags.slice(),
    era: formEra,
    hum: $('fHum').value.trim(),
    key: String(formKey),
    memo: $('fMemo').value.trim()
  };
  if(editingId){
    Store.update(editingId, row);
    toast('「' + title + '」をなおしました');
  } else {
    Store.add(row);
    state.onlyNoYomi = false;
    toast('「' + title + '」を登録しました');
  }
  editingId = null;
  closeSheets();
  rebuildFilterChips();
  render();
}

/* ══ 控え ══ */

function doExport(share){
  var text = Store.exportText();
  var name = Store.fileName();
  if(bridge){
    try {
      if(share){
        if(bridge.shareFile(name, text, 'application/json')) return;
        toast('渡す先の画面を出せませんでした');
      } else {
        var where = bridge.saveFile(name, text, 'application/json');
        toast(where ? (where + ' に置きました') : '端末に保存できませんでした');
      }
      return;
    } catch(e){ /* 下の代わりの動きに落ちる */ }
  }
  // PC のブラウザのとき
  try {
    var url = URL.createObjectURL(new Blob([text], { type:'application/json' }));
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
    toast(name + ' を書き出しました');
  } catch(e){
    toast('書き出せませんでした');
  }
}

var importMode = 'replace';
function pickFile(mode){
  importMode = mode;
  // accept は付けない。絞るとドライブ経由のファイルが選べなくなる
  $('impFile').value = '';
  $('impFile').click();
}
function readPicked(file){
  var r = new FileReader();
  r.onload = function(){
    var res = Store.importText(String(r.result || ''), importMode);
    if(!res.ok){ toast(res.msg); return; }
    state.tags = [];
    state.eras = [];
    state.onlyNoYomi = false;
    rebuildFilterChips();
    render();
    closeSheets();
    toast(res.n + '曲を読み込みました');
  };
  r.onerror = function(){ toast('ファイルを読めませんでした'); };
  r.readAsText(file, 'utf-8');
}

/* ══ きせかえ・表示・画面 ══ */

function applyPref(){
  var p = Store.pref;
  if(p.skin === 'neon') document.documentElement.setAttribute('data-skin', 'neon');
  else document.documentElement.removeAttribute('data-skin');
  if(p.theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', p.theme);
  state.mode = (p.mode === 'detail') ? 'detail' : 'simple';
  state.sort = p.sort || 'title';
  $('sort').value = state.sort;
  mark('skinSeg', 'data-skin', p.skin);
  mark('modeSeg', 'data-mode', state.mode);
  mark('themeSeg', 'data-theme', p.theme);
  $('themeSeg').setAttribute('aria-disabled', p.skin === 'neon' ? 'true' : 'false');
}
function mark(segId, attr, value){
  Array.prototype.forEach.call($(segId).children, function(x){
    x.setAttribute('aria-pressed', x.getAttribute(attr) === value ? 'true' : 'false');
  });
}

/* ══ 立ち上げ ══ */

var booted = false;
function init(){
  if(booted) return;
  booted = true;

  Store.load();
  applyPref();

  var header = $('top');
  function setHH(){ document.documentElement.style.setProperty('--hh', header.offsetHeight + 'px'); }
  if(window.ResizeObserver) new ResizeObserver(setHH).observe(header);
  window.addEventListener('resize', setHH);
  setHH();

  $('skinSeg').addEventListener('click', function(e){
    var b = e.target.closest('button'); if(!b) return;
    Store.pref.skin = b.getAttribute('data-skin');
    Store.savePref();
    applyPref();
    setHH();
    if(Store.pref.skin === 'neon') toast('ネオンは暗い画面専用のテーマです');
  });
  $('modeSeg').addEventListener('click', function(e){
    var b = e.target.closest('button'); if(!b) return;
    Store.pref.mode = b.getAttribute('data-mode');
    Store.savePref();
    applyPref();
    render();
  });
  $('themeSeg').addEventListener('click', function(e){
    var b = e.target.closest('button'); if(!b) return;
    Store.pref.theme = b.getAttribute('data-theme');
    Store.savePref();
    applyPref();
  });

  $('q').addEventListener('input', function(){
    state.q = this.value;
    $('qclear').hidden = !this.value;
    render();
  });
  $('qclear').addEventListener('click', function(){
    $('q').value = ''; state.q = ''; this.hidden = true; render(); $('q').focus();
  });
  $('sort').addEventListener('change', function(){
    state.sort = this.value;
    Store.pref.sort = this.value;
    Store.savePref();
    render();
  });
  $('filterBtn').addEventListener('click', function(){
    var open = $('filters').hidden;
    $('filters').hidden = !open;
    this.setAttribute('aria-expanded', open ? 'true' : 'false');
    setHH();
  });
  $('noticeBtn').addEventListener('click', function(){
    state.onlyNoYomi = !state.onlyNoYomi;
    render();
    window.scrollTo({ top:0, behavior:'smooth' });
  });

  rebuildFilterChips();

  $('page').addEventListener('click', function(e){
    var row = e.target.closest('.song'); if(!row) return;
    var s = Store.get(parseInt(row.getAttribute('data-id'), 10));
    if(s) showDetail(s);
  });

  $('scrim').addEventListener('click', closeSheets);
  document.addEventListener('click', function(e){
    if(e.target.closest('[data-close]')) closeSheets();
  });
  document.addEventListener('keydown', function(e){
    if(e.key !== 'Escape') return;
    if(!$('ask').hidden) askClose(false);
    else closeSheets();
  });

  $('askOk').addEventListener('click', function(){ askClose(true); });
  $('askNo').addEventListener('click', function(){ askClose(false); });

  $('addBtn').addEventListener('click', function(){ openForm(null); });
  $('dEdit').addEventListener('click', function(){
    var s = Store.get(detailId);
    if(s) openForm(s);
  });
  $('dDel').addEventListener('click', function(){
    var s = Store.get(detailId);
    if(!s) return;
    ask('「' + s.title + '」を消します。元には戻せません。', '消す', function(){
      Store.remove(s.id);
      closeSheets();
      render();
      toast('消しました');
    });
  });

  hookAuto('fSong', 'fSongYomi', 'fSongAuto');
  hookAuto('fArtist', 'fArtistYomi', 'fArtistAuto');
  $('fSave').addEventListener('click', saveForm);
  $('fAddTag').addEventListener('click', function(){
    var v = Store.addTag($('fNewTag').value);
    if(!v) return;
    if(formTags.indexOf(v) < 0) formTags.push(v);
    $('fNewTag').value = '';
    buildFormChips();
    rebuildFilterChips();
    toast('タグ「' + v + '」を作りました');
  });
  $('fNewTag').addEventListener('keydown', function(e){
    if(e.key === 'Enter'){ e.preventDefault(); $('fAddTag').click(); }
  });
  $('fKeyUp').addEventListener('click', function(){
    formKey = Math.min(6, formKey + 1); $('fKey').textContent = keyText(formKey);
  });
  $('fKeyDown').addEventListener('click', function(){
    formKey = Math.max(-6, formKey - 1); $('fKey').textContent = keyText(formKey);
  });

  $('setBtn').addEventListener('click', function(){ openSheet('settings'); });
  $('expSave').addEventListener('click', function(){ doExport(false); });
  $('expShare').addEventListener('click', function(){ doExport(true); });
  $('impReplace').addEventListener('click', function(){
    ask('控えのファイルを選びます。今入っている' + songs().length + '曲は消えて、ファイルの中身に入れ替わります。',
        '選ぶ', function(){ pickFile('replace'); });
  });
  $('impMerge').addEventListener('click', function(){ pickFile('merge'); });
  $('impFile').addEventListener('change', function(){
    if(this.files && this.files[0]) readPicked(this.files[0]);
  });
  $('sample').addEventListener('click', function(){
    ask('見本を36曲入れます。今入っている' + songs().length + '曲は消えます。', '入れる', function(){
      var n = Store.loadSample();
      rebuildFilterChips();
      render();
      closeSheets();
      toast('見本を' + n + '曲入れました');
    });
  });
  $('clearAll').addEventListener('click', function(){
    ask('登録した' + songs().length + '曲をすべて消します。元には戻せません。', 'ぜんぶ消す', function(){
      Store.clear();
      render();
      closeSheets();
      toast('ぜんぶ消しました');
    });
  });

  var mark2 = BUILD;
  if(bridge){
    try { mark2 = bridge.buildMark() || BUILD; } catch(e){}
  }
  $('ver').textContent = 'マイカラ ' + mark2 + (bridge ? '' : '（ブラウザで表示中）');

  render();
}

// 裏に回された時に、入れ物から呼ばれる
window.Store = Store;

document.addEventListener('DOMContentLoaded', init);
if(document.readyState !== 'loading') init();
})();

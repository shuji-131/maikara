/* ══════════════════════════════════════════════════
   マイカラ — 五十音のきまり

   歌本と同じ棚分け・同じ並びにするための計算だけを置く。
   画面のことは知らない。

   決めていること
     ・カタカナは ひらがな に直してから比べる
     ・濁点・半濁点は落とす（「ジ」は「し」と同じ棚に入る＝歌本と同じ）
     ・小さい字は大きい字に直す（「ャ」は「や」）
     ・長音「ー」は、ひとつ前の字の母音として読む（「ラーメン」→ らあめ）
     ・よみが空のときは、先頭が英数字なら Ａ〜Ｚ の棚、そうでなければ「?」の棚
   ══════════════════════════════════════════════════ */
var Kana = (function(){
  'use strict';

  var GYO = [
    ['あ','あいうえお'],['か','かきくけこ'],['さ','さしすせそ'],['た','たちつてと'],
    ['な','なにぬねの'],['は','はひふへほ'],['ま','まみむめも'],['や','やゆよ'],
    ['ら','らりるれろ'],['わ','わをん']
  ];

  var ROWMAP = {};   // 字 → どの行か
  var VOWEL  = {};   // 字 → その母音（長音の読み替えに使う）
  var ORDER  = '';   // 五十音の並び順そのもの

  GYO.forEach(function(g){
    ORDER += g[1];
    g[1].split('').forEach(function(c){ ROWMAP[c] = g[0]; });
  });
  ['あいうえお','かきくけこ','さしすせそ','たちつてと','なにぬねの',
   'はひふへほ','まみむめも','らりるれろ'].forEach(function(g){
    g.split('').forEach(function(c, i){ VOWEL[c] = 'あいうえお'[i]; });
  });
  'やゆよ'.split('').forEach(function(c, i){ VOWEL[c] = ['あ','う','お'][i]; });
  VOWEL['わ'] = 'あ';
  VOWEL['を'] = 'お';

  var SMALL = {
    'ぁ':'あ','ぃ':'い','ぅ':'う','ぇ':'え','ぉ':'お',
    'っ':'つ','ゃ':'や','ゅ':'ゆ','ょ':'よ','ゎ':'わ','ゕ':'か','ゖ':'け'
  };

  /** 比べるための形に均す。返るのは ひらがな だけ */
  function norm(s){
    if(!s) return '';
    var t = String(s).normalize('NFKC');
    // カタカナ → ひらがな
    t = t.replace(/[ァ-ヶ]/g, function(c){
      return String.fromCharCode(c.charCodeAt(0) - 0x60);
    });
    // 濁点・半濁点を落とす
    t = t.normalize('NFD').replace(/[゙゚]/g, '').normalize('NFC');
    // 小さい字 → 大きい字
    t = t.replace(/[ぁぃぅぇぉっゃゅょゎゕゖ]/g, function(c){ return SMALL[c] || c; });
    // 長音 → ひとつ前の母音
    var out = '';
    for(var i = 0; i < t.length; i++){
      var ch = t[i];
      if(ch === 'ー' || ch === '―' || ch === '‐' || ch === '-'){
        out += (VOWEL[out.slice(-1)] || '');
      } else {
        out += ch;
      }
    }
    return out.replace(/[^ぁ-ん]/g, '');
  }

  /** 並べ替えに使う鍵。五十音の順番を2桁の数字にして並べたもの */
  function key(s){
    var n = norm(s), k = '';
    for(var i = 0; i < n.length; i++){
      var idx = ORDER.indexOf(n[i]);
      k += (idx < 0 ? '99' : (idx < 10 ? '0' + idx : String(idx)));
    }
    return k;
  }

  /** 曲名や歌手名の頭から、よみ3文字を自動で拾う。かな始まりのときだけ */
  function auto(s){
    var head = String(s || '').trim().slice(0, 6);
    if(!/^[ぁ-んァ-ヶ]/.test(head)) return '';
    return norm(head.replace(/[^ぁ-んァ-ヶー]/g, '')).slice(0, 3);
  }

  /** 棚の一覧（爪の並び順） */
  function buckets(){
    return GYO.map(function(g){ return g[0]; }).concat(['AZ','?']);
  }

  /** よみと表記から、どの棚に入るかを決める */
  function bucketOf(yomi, text){
    var n = norm(yomi);
    if(n) return ROWMAP[n[0]] || '?';
    return /^[A-Za-z0-9]/.test(String(text || '').trim()) ? 'AZ' : '?';
  }

  function label(b){ return b === 'AZ' ? 'A' : b; }
  function title(b){ return b === 'AZ' ? 'Ａ 〜 Ｚ' : (b === '?' ? 'よみ未設定' : b + '行'); }

  return {
    norm: norm, key: key, auto: auto,
    buckets: buckets, bucketOf: bucketOf, label: label, title: title
  };
})();

/* ══════════════════════════════════════════════════
   マイカラ — 覚えておくところ

   曲も、作ったタグも、きせかえの選びも、すべて端末の中だけに残る。
   外へ出る口は無い（APK に通信の許可を入れていない）。

   ★localStorage は空で返ってくることがある（シークレット窓・データ削除・
     初回起動）。読み書きは必ず try/catch で囲み、失敗しても画面が
     出るようにしてある。
   ★控え（バックアップ）は .json のまま。読み戻す側の accept は絞らない
     ＝ドライブ経由だとファイルを選べなくなるため。
   ══════════════════════════════════════════════════ */
var Store = (function(){
  'use strict';

  var KEY  = 'maikara.v1';
  var PREF = 'maikara.pref';

  var TAGS_DEFAULT = ['定番','バラード','盛り上がる','しっとり','みんなで',
                      'アニメ','青春','高音','最近','夏','冬'];
  var ERAS = ['70年代以前','80年代','90年代','2000年代','2010年代','2020年代'];

  var data = { v:1, seq:0, songs:[], tags:TAGS_DEFAULT.slice(), updated:'' };
  var pref = { skin:'songbook', mode:'simple', theme:'auto', sort:'title' };
  var dirty = false;

  function readRaw(k){
    try { return window.localStorage.getItem(k); } catch(e){ return null; }
  }
  function writeRaw(k, v){
    try { window.localStorage.setItem(k, v); return true; } catch(e){ return false; }
  }

  /** 1曲ぶんの形を整える。どこから来た値でも、ここを通れば安全に使える */
  function clean(s, seq){
    return {
      id: (typeof s.id === 'number' && s.id > 0) ? s.id : seq,
      title:      String(s.title || '').slice(0, 120),
      yomi:       String(s.yomi || '').slice(0, 3),
      artist:     String(s.artist || '').slice(0, 80),
      artistYomi: String(s.artistYomi || '').slice(0, 3),
      tags:       (Array.isArray(s.tags) ? s.tags : []).map(function(t){
                    return String(t).slice(0, 20);
                  }).slice(0, 20),
      era:        String(s.era || ''),
      hum:        String(s.hum || '').slice(0, 300),
      key:        String(parseInt(s.key, 10) || 0),
      memo:       String(s.memo || '').slice(0, 600)
    };
  }

  function load(){
    var raw = readRaw(KEY);
    if(raw){
      try {
        var o = JSON.parse(raw);
        if(o && Array.isArray(o.songs)){
          var n = 0;
          data.songs = o.songs.map(function(s){ n++; return clean(s, n); });
          data.seq = Math.max(o.seq || 0, data.songs.reduce(function(m, s){
            return Math.max(m, s.id);
          }, 0));
          data.tags = Array.isArray(o.tags) && o.tags.length
                      ? o.tags.map(String) : TAGS_DEFAULT.slice();
          data.updated = String(o.updated || '');
        }
      } catch(e){ /* 壊れていたら空から始める。上書きはしない */ }
    }
    var p = readRaw(PREF);
    if(p){
      try {
        var q = JSON.parse(p);
        if(q && typeof q === 'object'){
          if(q.skin)  pref.skin  = String(q.skin);
          if(q.mode)  pref.mode  = String(q.mode);
          if(q.theme) pref.theme = String(q.theme);
          if(q.sort)  pref.sort  = String(q.sort);
        }
      } catch(e){}
    }
    return data;
  }

  function stamp(){
    var d = new Date();
    function p(n){ return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
           ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function save(){
    data.updated = stamp();
    dirty = !writeRaw(KEY, JSON.stringify(data));
    return !dirty;
  }
  function savePref(){ writeRaw(PREF, JSON.stringify(pref)); }

  /** 裏に回された時に呼ばれる。書けていなければもう一度だけ試す */
  function flush(){ if(dirty) save(); }

  function add(s){
    data.seq += 1;
    var row = clean(s, data.seq);
    row.id = data.seq;
    data.songs.push(row);
    save();
    return row;
  }
  function update(id, s){
    for(var i = 0; i < data.songs.length; i++){
      if(data.songs[i].id === id){
        var row = clean(s, id);
        row.id = id;
        data.songs[i] = row;
        save();
        return row;
      }
    }
    return null;
  }
  function remove(id){
    var before = data.songs.length;
    data.songs = data.songs.filter(function(s){ return s.id !== id; });
    if(data.songs.length !== before){ save(); return true; }
    return false;
  }
  function get(id){
    return data.songs.filter(function(s){ return s.id === id; })[0] || null;
  }
  function addTag(t){
    t = String(t || '').trim().slice(0, 20);
    if(!t) return '';
    if(data.tags.indexOf(t) < 0){ data.tags.push(t); save(); }
    return t;
  }

  /* ── 控え（バックアップ） ── */

  function fileName(){
    var d = new Date();
    function p(n){ return (n < 10 ? '0' : '') + n; }
    return 'マイカラ_' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '.json';
  }
  function exportText(){
    return JSON.stringify({
      app:'マイカラ', v:1, seq:data.seq, tags:data.tags,
      songs:data.songs, updated:stamp()
    }, null, 1);
  }

  /**
   * 控えから読み戻す。
   * @param mode 'replace' = 今の中身と入れ替える / 'merge' = 今のものに足す
   * @return {ok:真偽, n:入った曲数, msg:だめだった理由}
   */
  function importText(text, mode){
    var o;
    try { o = JSON.parse(text); }
    catch(e){ return { ok:false, n:0, msg:'控えのファイルとして読めませんでした' }; }
    if(!o || !Array.isArray(o.songs)){
      return { ok:false, n:0, msg:'この中に曲が入っていません' };
    }
    if(mode === 'merge'){
      var base = data.seq;
      o.songs.forEach(function(s){
        base += 1;
        var row = clean(s, base);
        row.id = base;
        data.songs.push(row);
      });
      data.seq = base;
    } else {
      var n = 0;
      data.songs = o.songs.map(function(s){ n++; return clean(s, n); });
      data.seq = data.songs.reduce(function(m, s){ return Math.max(m, s.id); }, 0);
    }
    if(Array.isArray(o.tags)){
      o.tags.map(String).forEach(function(t){
        if(data.tags.indexOf(t) < 0) data.tags.push(t);
      });
    }
    save();
    return { ok:true, n:o.songs.length, msg:'' };
  }

  /* ── 見本（からっぽの時に試せるように） ── */

  var SAMPLE = [
    ['愛のかたまり','あい','KinKi Kids','きん',['バラード','定番'],'2000年代','前奏なしでいきなり声から','-1',''],
    ['青いベンチ','あお','サスケ','さす',['青春','盛り上がる'],'2000年代','サビが高い。2番から本気','-2','一発目には重い'],
    ['あの鐘を鳴らすのはあなた','あの','和田アキ子','わだ',['定番'],'70年代以前','ゆっくり立ち上がる','-2',''],
    ['糸','','中島みゆき','なか',['定番','しっとり'],'90年代','たて、よこ、のところ','0','よみを入れ忘れている例'],
    ['イエスタデイ','いえ','Official髭男dism','おふ',['最近','高音'],'2010年代','終始高い。無理なら−4','-3',''],
    ['M','えむ','プリンセス プリンセス','ぷり',['バラード'],'80年代','出だしが低い。息を落として入る','+1','英語でもよみを入れた例'],
    ['乾杯','かん','長渕剛','なが',['定番','しっとり'],'80年代','かんぱーい、から','-1','二次会の〆'],
    ['香水','こう','瑛人','えい',['最近','しっとり'],'2020年代','ギター1本。テンポ遅め','0',''],
    ['粉雪','こな','レミオロメン','れみ',['バラード','冬'],'2000年代','サビの1音目がいきなり高い','-2','サビ前で必ず息を吸う'],
    ['残酷な天使のテーゼ','ざん','高橋洋子','たか',['アニメ','盛り上がる'],'90年代','ジャーン、から入る','0','誰か一人は歌える'],
    ['島唄','しま','THE BOOM','ざぶ',['定番'],'90年代','でいごの花、のところ','-1',''],
    ['シルエット','しる','KANA-BOON','かな',['アニメ','盛り上がる'],'2010年代','Aメロが早口','0',''],
    ['白い恋人達','しろ','桑田佳祐','くわ',['冬','バラード'],'2000年代','冬の定番。サビが長い','-2',''],
    ['宿命','しゅ','Official髭男dism','おふ',['最近','盛り上がる'],'2010年代','走るテンポ','-3',''],
    ['世界に一つだけの花','せか','SMAP','すま',['定番','みんなで'],'2000年代','花屋の店先、から','0','全員で歌える'],
    ['前前前世','ぜん','RADWIMPS','らど',['アニメ','盛り上がる'],'2010年代','ドラムの入りが速い','-1','息継ぎの場所を覚える'],
    ['ソラニン','そら','ASIAN KUNG-FU GENERATION','あじ',['青春'],'2000年代','静かに始まる','0',''],
    ['大都会','だい','クリスタルキング','くり',['高音','盛り上がる'],'80年代','いきなり最高音','-4','歌えたら拍手が来る'],
    ['チェリー','ちぇ','スピッツ','すぴ',['定番','青春'],'90年代','愛してる、の一言','0',''],
    ['天体観測','てん','BUMP OF CHICKEN','ばん',['青春','盛り上がる'],'2000年代','午前2時、から','0',''],
    ['涙そうそう','なみ','夏川りみ','なつ',['しっとり','定番'],'2000年代','ゆっくり。焦らない','+2',''],
    ['猫','','DISH//','でぃ',['最近','しっとり'],'2010年代','サビで一気に上がる','-2','よみを入れ忘れている例'],
    ['ノーダウト','のー','Official髭男dism','おふ',['最近','盛り上がる'],'2010年代','跳ねるリズム','-2',''],
    ['花','はな','ORANGE RANGE','おれ',['夏','みんなで'],'2000年代','ラップの前で息を整える','0',''],
    ['ハナミズキ','はな','一青窈','ひと',['バラード','定番'],'2000年代','ゆっくり、遠くへ置く','+1',''],
    ['ひまわりの約束','ひま','秦基博','はた',['バラード'],'2010年代','どうして、から','-1',''],
    ['プラネタリウム','ぷら','大塚愛','おお',['バラード'],'2000年代','サビが高い','-2',''],
    ['ベイビー・アイラブユー','べい','TEE','てぃ',['しっとり'],'2010年代','跳ねる。裏拍','0',''],
    ['マリーゴールド','まり','あいみょん','あい',['最近','みんなで'],'2010年代','風の強さが、から','-3','下げすぎると低い'],
    ['夜に駆ける','よる','YOASOBI','よあ',['最近','高音'],'2020年代','沈むように、から。音が多い','-3','歌詞が速い。画面を見る'],
    ['ロビンソン','ろび','スピッツ','すぴ',['定番','青春'],'90年代','新しい季節、から','0','外さない一曲'],
    ['若者のすべて','わか','フジファブリック','ふじ',['しっとり','夏'],'2000年代','真夏のピーク、から','-1','〆に強い'],
    ['HOWEVER','','GLAY','ぐれ',['バラード'],'90年代','サビが長い。息を配る','-2','よみ未入力＝Ａ〜Ｚの棚'],
    ['Lemon','','米津玄師','よね',['バラード','最近'],'2010年代','夢ならば、から','-4','よみ未入力＝Ａ〜Ｚの棚'],
    ['secret base 〜君がくれたもの〜','','ZONE','ぞー',['青春','夏'],'2000年代','君と夏の終わり、から','0','よみ未入力＝Ａ〜Ｚの棚'],
    ['TSUNAMI','つな','サザンオールスターズ','さざ',['バラード','定番'],'2000年代','風が吹く、から','-1','英語でもよみを入れた例']
  ];

  function loadSample(){
    data.songs = SAMPLE.map(function(r, i){
      return clean({
        id:i + 1, title:r[0], yomi:r[1], artist:r[2], artistYomi:r[3],
        tags:r[4], era:r[5], hum:r[6], key:r[7], memo:r[8]
      }, i + 1);
    });
    data.seq = data.songs.length;
    save();
    return data.songs.length;
  }

  function clear(){
    data.songs = [];
    data.seq = 0;
    save();
  }

  return {
    load:load, save:save, flush:flush, savePref:savePref,
    add:add, update:update, remove:remove, get:get, addTag:addTag,
    exportText:exportText, importText:importText, fileName:fileName,
    loadSample:loadSample, clear:clear,
    ERAS:ERAS,
    get data(){ return data; },
    get pref(){ return pref; }
  };
})();

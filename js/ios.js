"use strict";
/* ══════════════════════════════════════════════════
   ios.js — iPhone / iPad で使うときの手当て

   iPhone には Android のような「インストール」ボタンが作れない。
   ページ側から「入れますか？」を出す合図を Apple が用意していないので、
   本人に 共有 → ホーム画面に追加 を押してもらうしかない。ここはその案内係。

   ★ホーム画面に追加してもらうのは見た目のためだけではない。
     Safari で開いているだけだと、しばらく使わない期間があったときに
     中身（登録した曲）が消されることがある。ホーム画面に追加したものは
     その対象から外れる＝「追加してもらう」は曲を守る工程でもある。

   ★ここは案内を出すだけ。曲のデータは Store を読むだけで書き換えない。
   ★iPhone 以外（PC・Android の入れ物）では何も起きない。
     main.js は IIFE で包まれていて中を触れないので、このファイルは
     自分だけで完結している（#toast と window.Store しか当てにしない）。
   ══════════════════════════════════════════════════ */
var Ios = (function () {

  var KEY = "maikara.iosGuideHidden";
  var $ = function (id) { return document.getElementById(id); };

  /* ---- 置かれ方の手当て ----
     ★置き場所によっては、こちらのページが「外側の入れ物」に包まれて配られる。
       そうなると <head> に書いた名札（アイコン・アプリ名・全画面の指定）が
       <body> の中に落ちる。iPhone は「ホーム画面に追加」を押したその時に
       これらを見に行くので、落ちたままだとアイコンが付かず全画面にもならない。
       GitHub Pages は素のまま配るので、ふつうは何も起きない。 */
  function liftHead() {
    var head = document.head;
    if (!head || !document.body) return 0;
    var sel = 'title,' +
      'link[rel="manifest"],link[rel="apple-touch-icon"],link[rel="icon"],' +
      'meta[name="theme-color"],meta[name="mobile-web-app-capable"],' +
      'meta[name="apple-mobile-web-app-capable"],' +
      'meta[name="apple-mobile-web-app-title"],' +
      'meta[name="apple-mobile-web-app-status-bar-style"]';
    var moved = 0;
    Array.prototype.forEach.call(document.body.querySelectorAll(sel), function (n) {
      head.appendChild(n);          /* 動かすだけ。同じものが2つにはならない */
      moved++;
    });
    return moved;
  }

  /* ---- 見分け ---- */

  /* iPhone / iPad か。
     ★iPadOS 13以降の iPad は自分を Mac と名乗るので名前だけでは見分けられない。
       「Mac と名乗っているのに指で触れる」ものは iPad として扱う */
  function isIos() {
    var ua = navigator.userAgent || "";
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    return /Macintosh/.test(ua) && typeof document.ontouchend !== "undefined";
  }

  /* もうホーム画面から開いている（＝案内は要らない） */
  function isStandalone() {
    if (window.navigator.standalone === true) return true;     /* iOS はこの印 */
    try { return window.matchMedia("(display-mode: standalone)").matches; }
    catch (e) { return false; }
  }

  /* LINE や Instagram の中で開いた画面。
     ここの共有ボタンには「ホーム画面に追加」が無いので、先に Safari で開いてもらう */
  function inApp() {
    return /Line\/|FBAN|FBAV|Instagram|Twitter|MicroMessenger|KAKAOTALK/i
      .test(navigator.userAgent || "");
  }

  /* Safari そのものか。
     ★iOS の Chrome・Edge・Firefox は中身が Safari と同じで「ホーム画面に追加」も持つ。
       ただし共有ボタンの位置が違い、こちらからは相手の画面を確かめられない。
       確かめられない画面の手順は書かず、Safari で開いてもらう */
  function isSafari() {
    var ua = navigator.userAgent || "";
    if (inApp()) return false;
    return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome/.test(ua);
  }

  /* Android の入れ物（APK）の中か。ここでは何も出さない */
  function inApk() { return typeof window.Maikara !== "undefined"; }

  function shouldOffer() { return isIos() && !inApk() && !isStandalone(); }

  function hidden() {
    try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; }
  }
  function hide() {
    try { localStorage.setItem(KEY, "1"); } catch (e) { /* 覚えられなくても困らない */ }
  }

  /* ---- 小物 ---- */

  var toastTimer = null;
  function toast(msg) {
    var t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("on"); }, 2800);
  }

  function copyUrl() {
    var url = location.href;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url)
          .then(function () { toast("アドレスをコピーしました"); })
          ["catch"](function () { toast("アドレス欄から手でコピーしてください"); });
        return;
      }
    } catch (e) { /* 下で拾う */ }
    toast("アドレス欄から手でコピーしてください");
  }

  /* iOS の共有ボタンの絵（四角から上に矢印）。見た目で名指しできるように */
  var SHARE_SVG =
    '<svg class="iosshare" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M12 3v12M12 3l-3.5 3.5M12 3l3.5 3.5"/>' +
    '<path d="M6.5 11H5.2A1.2 1.2 0 0 0 4 12.2v7.6A1.2 1.2 0 0 0 5.2 21h13.6' +
    'a1.2 1.2 0 0 0 1.2-1.2v-7.6A1.2 1.2 0 0 0 18.8 11h-1.3"/></svg>';

  function steps() {
    return '<span class="iosnum">1</span>下の真ん中の ' + SHARE_SVG + ' を押す<br>' +
           '<span class="iosnum">2</span>出てきた一覧を下にたどる<br>' +
           '<span class="iosnum">3</span>「ホーム画面に追加」を押す';
  }

  /* ---- 下に出る帯 ---- */

  function bar() {
    if (!shouldOffer() || hidden()) return;
    if ($("iosbar")) return;

    var d = document.createElement("div");
    d.id = "iosbar";
    d.className = "iosbar";

    if (!isSafari()) {
      /* Safari 以外。手順を書いても押すものが違うので、開き直してもらう */
      d.innerHTML =
        '<div class="iosbar-t">Safari で開いてください</div>' +
        '<div class="iosbar-b">この画面のままだと、ホーム画面に入れられません。<br>' +
        'アドレスをコピーして、Safari に貼り付けて開いてください。</div>' +
        '<div class="iosbar-f">' +
          '<button type="button" data-ios="later">あとで</button>' +
          '<button type="button" class="go" data-ios="copy">アドレスをコピー</button></div>';
    } else {
      d.innerHTML =
        '<div class="iosbar-t">ホーム画面に入れて使ってください</div>' +
        '<div class="iosbar-b">' + steps() + '</div>' +
        '<div class="iosbar-w">入れておくと全画面で開き、<b>登録した曲が消えにくくなります</b>。' +
        'Safari で開いたままだと、しばらく使わない期間があったときに消されることがあります。</div>' +
        '<div class="iosbar-f">' +
          '<button type="button" data-ios="later">あとで</button>' +
          '<button type="button" class="go" data-ios="done">入れた</button></div>';
    }

    document.body.appendChild(d);
    requestAnimationFrame(function () { d.classList.add("on"); });

    Array.prototype.forEach.call(d.querySelectorAll("[data-ios]"), function (b) {
      b.onclick = function () {
        var k = b.getAttribute("data-ios");
        if (k === "copy") { copyUrl(); return; }
        if (k === "done") hide();          /* 入れたなら二度と出さない */
        close();
      };
    });
  }

  function close() {
    var d = $("iosbar");
    if (!d) return;
    d.classList.remove("on");
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 200);
  }

  /* ---- 自前の覆い（main.js のシートは中を触れないので、ここで持つ） ---- */

  function overlay(title, bodyHtml, footHtml, bind) {
    var o = document.createElement("div");
    o.className = "iosover";
    o.innerHTML =
      '<div class="iosbox" role="dialog" aria-modal="true">' +
        '<h2>' + title + '</h2>' +
        '<div class="iosbody">' + bodyHtml + '</div>' +
        '<div class="iosfoot">' + footHtml + '</div></div>';
    document.body.appendChild(o);
    requestAnimationFrame(function () { o.classList.add("on"); });
    function shut() {
      o.classList.remove("on");
      setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, 200);
    }
    o.addEventListener("click", function (e) { if (e.target === o) shut(); });
    Array.prototype.forEach.call(o.querySelectorAll("[data-shut]"), function (b) {
      b.onclick = shut;
    });
    if (bind) bind(o, shut);
    return o;
  }

  /* 帯を「あとで」で閉じたあと、もう一度見たい時の入口（設定から呼ぶ） */
  function guide() {
    var body = isSafari()
      ? '<p>' + steps() + '</p>' +
        '<p class="dim">ホーム画面にアイコンが並びます。押すと全画面で開き、アドレス欄も出ません。' +
        '入れておくと<b>登録した曲が消えにくくなります</b>。Safari で開いたままだと、' +
        'しばらく使わない期間があったときに消されることがあります。</p>'
      : '<p>いま見ているのは Safari ではありません。' +
        'この画面からはホーム画面に入れられないので、' +
        'アドレスをコピーして Safari に貼り付けて開いてください。</p>';
    overlay("ホーム画面への入れ方", body,
      '<button type="button" data-shut>閉じる</button>' +
      (isSafari() ? "" : '<button type="button" class="go" id="iosCopy">アドレスをコピー</button>'),
      function (o) {
        var c = o.querySelector("#iosCopy");
        if (c) c.onclick = copyUrl;
      });
  }

  /* ---- 控えの書き出しが滑ったときの逃げ道 ----
     ★iPhone の「ファイルとして保存」は、ホーム画面から開いた状態だと
       黙って何も起きないことがある。こちらからは実機を確かめられないので、
       落ちたときに中身を取り出せる道を必ず用意しておく。 */
  function textBackup() {
    if (!window.Store || !window.Store.exportText) { toast("控えを作れませんでした"); return; }
    var text;
    try { text = window.Store.exportText(); }
    catch (e) { toast("控えを作れませんでした"); return; }

    overlay("文字で控えを出す",
      '<p>下の文字が控えそのものです。まるごとコピーして、メモ帳やメールなど、' +
      '消えない所に貼って残してください。<br>戻すときは、その文字を <b>.json</b> という名前の' +
      'ファイルにして「控えから戻す」で読み込みます。</p>' +
      '<textarea id="iosBkText" class="iostext" readonly rows="8" autocomplete="off"></textarea>' +
      '<p class="dim">' + Math.max(1, Math.round(text.length / 1024)) + " KB ぶんの文字です。</p>",
      '<button type="button" data-shut>閉じる</button>' +
      '<button type="button" class="go" id="iosBkCopy">まるごとコピー</button>',
      function (o) {
        var ta = o.querySelector("#iosBkText");
        ta.value = text;
        o.querySelector("#iosBkCopy").onclick = function () {
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(text)
                .then(function () { toast("コピーしました"); })
                ["catch"](function () { toast("長押しして「すべてを選択」→「コピー」してください"); });
              return;
            }
          } catch (e) { /* 下で拾う */ }
          ta.focus();
          ta.setSelectionRange(0, ta.value.length);
          var ok = false;
          try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
          toast(ok ? "コピーしました" : "長押しして「すべてを選択」→「コピー」してください");
        };
      });
  }

  /* ---- 設定の中に iPhone 用の一段を足す ---- */
  function addSettingRow() {
    if (!isIos() || inApk()) return;             /* iPhone のときだけ出す */
    var box = $("settings");
    var ver = box ? box.querySelector(".ver") : null;
    if (!box || !ver || $("iosSetRow")) return;

    var row = document.createElement("div");
    row.className = "setrow";
    row.id = "iosSetRow";
    row.innerHTML =
      "<h3>iPhoneで使う</h3>" +
      "<p>ホーム画面に入れると全画面で開き、<b>登録した曲が消えにくくなります</b>。" +
      "「端末に保存」がうまくいかないときは、文字で控えを出してください。</p>" +
      '<div class="row">' +
        '<button type="button" id="iosGuideBtn">ホーム画面への入れ方</button>' +
        '<button type="button" id="iosTextBtn">文字で控えを出す</button></div>';
    box.insertBefore(row, ver);
    $("iosGuideBtn").onclick = guide;
    $("iosTextBtn").onclick = textBackup;
  }

  /* ---- 2回目からネット無しで開けるようにする ----
     ★https で配られている時だけ。file:// では動かない。

     ★★Android の入れ物（APK）でも必ず外すこと。
       入れ物は assets を https://maikara.local/ と名乗らせて出しているので、
       protocol を見るだけでは通ってしまう。通すと WebView の中に画面が
       溜め込まれ、APK を作り直しても古い画面が出続ける
       （「直したのに変わらない」の原因になる）。入れ物は元から
       ネット無しで動くので、そもそも要らない。 */
  function registerSw() {
    if (inApk()) return;
    if (location.protocol !== "https:") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("sw.js")["catch"](function () { /* 無くても使える */ });
  }

  function init() {
    liftHead();
    registerSw();
    addSettingRow();
    setTimeout(bar, 700);       /* 画面が出てから、少し置いて案内する */
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return {
    liftHead: liftHead, isIos: isIos, isStandalone: isStandalone,
    isSafari: isSafari, inApp: inApp, inApk: inApk, shouldOffer: shouldOffer,
    bar: bar, close: close, guide: guide, textBackup: textBackup
  };
})();
window.Ios = Ios;

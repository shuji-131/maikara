/* ═══════════════════════════════════════════════════
   sw.js — 2回目からネット不要にする係（iPhone / PC のブラウザ用）

   中身（画面のファイル）を端末に置いておくだけ。登録した曲は一切扱わない。
   曲は localStorage にあり、ここを通らない。

   ★Android の入れ物（APK）では動かない。js/ios.js が https のときだけ
     登録するようにしてある。

   ★画面のファイルを直したら必ず下の番号を上げること。
     上げないと、前に置いた古い JS がそのまま出て「直したのに変わらない」になる。
     js/main.js の BUILD と同じ番号に揃えておく。
   ═══════════════════════════════════════════════════ */
var CACHE = "maikara-v2";

var FILES = [
  "./",
  "index.html",
  "app.webmanifest",
  "css/style.css",
  "js/kana.js", "js/store.js", "js/main.js", "js/ios.js",
  "icons/icon-192.png", "icons/icon-512.png",
  "icons/icon-maskable-192.png", "icons/icon-maskable-512.png",
  "icons/apple-touch-icon-180.png", "icons/favicon-32.png", "icons/favicon-16.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      /* 1つ落とせなくても全体を諦めない */
      return Promise.all(FILES.map(function (f) {
        return c.add(f)["catch"](function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.map(function (k) {
        return k === CACHE ? null : caches["delete"](k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  /* 外へは一切取りに行かない（webフォントも使っていない） */
  if (new URL(req.url).origin !== location.origin) return;

  /* まず置いてあるものを返す（速い・ネット不要）。裏で新しくしておく */
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) {
        fetch(req).then(function (res) {
          if (res && res.ok) caches.open(CACHE).then(function (c) { c.put(req, res); });
        })["catch"](function () {});
        return hit;
      }
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      })["catch"](function () { return caches.match("index.html"); });
    })
  );
});

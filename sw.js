/* Сервис-воркер «На_просвет»: офлайн и обновления (раздел 6 спецификации приложения).
   ФАЙЛ sw.js СОБРАН из sw/sw.template.js скриптом sw/build.py — правь шаблон и запускай python3 sw/build.py.
   Версия кэша = хеш содержимого предкэшируемых файлов: любая правка сайта даёт новую версию. */
'use strict';

var VERSION = '356e7c71b2';
var PRECACHE = [
  "./app.css",
  "./app.js",
  "./apple-touch-icon.png",
  "./brodsky/index.html",
  "./chekhov/index.html",
  "./favicon.ico",
  "./favicon.svg",
  "./gary/index.html",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./index.html",
  "./manifest.webmanifest",
  "./shelf/index.html",
  "./shelf/shelf.css",
  "./shelf/shelf.js",
  "./theme.js",
  "./today/cards.json",
  "./today/index.html",
  "./today/links.json",
  "./today/share.js",
  "./today/today.css",
  "./today/today.js",
  "./voices/data.json",
  "./voices/index.html"
];

var CACHE = 'naprosvet-' + VERSION;   // предкэш этой версии
var RT = 'naprosvet-rt';              // кэш «по запросу»: видео портретов и шрифты, живёт между версиями
var SCOPE = self.registration.scope;  // со слешем на конце: https://…/naprosvet/ или http://localhost:8765/
var SCOPE_PATH = new URL(SCOPE).pathname;
var FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
var SWR_FILES = ['voices/data.json', 'today/cards.json', 'today/links.json'];

/* Ключ кэша: без ?query и #hash, а адрес папки (…/brodsky/) = …/brodsky/index.html.
   Так одна запись обслуживает обе формы адреса. */
function keyFor(url) {
  var u = new URL(url.href);
  u.search = '';
  u.hash = '';
  if (/\/$/.test(u.pathname)) u.pathname += 'index.html';
  return u.href;
}

self.addEventListener('install', function (e) {
  /* skipWaiting здесь нарочно нет: новую версию включает пользователь кнопкой «Обновить» (см. app.js) */
  e.waitUntil(caches.open(CACHE).then(function (cache) {
    return Promise.all(PRECACHE.map(function (rel) {
      var u = new URL(rel, SCOPE);
      /* cache:'reload' — мимо HTTP-кэша браузера, иначе GitHub Pages (max-age=600) отдаст устаревший файл под новой версией */
      return fetch(new Request(u.href, { cache: 'reload' })).then(function (res) {
        if (!res.ok) throw new Error(res.status + ' ' + rel);
        return cache.put(keyFor(u), res);
      });
    }));
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (names) {
    return Promise.all(names.filter(function (n) {
      return n.indexOf('naprosvet-') === 0 && n !== CACHE && n !== RT;
    }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  if (FONT_HOSTS.indexOf(url.hostname) >= 0) { e.respondWith(fontFetch(req)); return; }
  /* всё чужое (mc.yandex.ru и прочее) и всё вне папки сайта не трогаем */
  if (url.origin !== self.location.origin || url.pathname.indexOf(SCOPE_PATH) !== 0) return;

  var path = url.pathname.slice(SCOPE_PATH.length);
  if (/(^|\/)portrait\.(webm|mp4)$/.test(path)) { videoFetch(e, req, url); return; }
  if (req.headers.has('range')) return;
  if (/(^|\/)$/.test(path) || /\.html$/.test(path) || SWR_FILES.indexOf(path) >= 0) {
    e.respondWith(staleWhileRevalidate(e, req, url));
    return;
  }
  e.respondWith(cacheFirst(req, url));
});

function storable(res) {
  /* редирект в кэш не кладём: навигации его не принимают */
  return res && res.ok && res.status === 200 && !res.redirected && res.type === 'basic';
}

function cacheFirst(req, url) {
  return caches.match(keyFor(url), { cacheName: CACHE }).then(function (hit) {
    return hit || fetch(req);
  });
}

function staleWhileRevalidate(e, req, url) {
  var key = keyFor(url);
  return caches.open(CACHE).then(function (cache) {
    return cache.match(key).then(function (hit) {
      if (hit) {
        /* no-cache: пересверка по ETag мимо HTTP-кэша; результат ляжет в кэш к следующему открытию */
        e.waitUntil(fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' }).then(function (res) {
          if (storable(res)) return cache.put(key, res);
        }).catch(function () {}));
        return hit;
      }
      return fetch(req).then(function (res) {
        if (storable(res)) cache.put(key, res.clone());
        return res;
      }).catch(function (err) {
        if (req.mode !== 'navigate') throw err;
        return cache.match(new URL('index.html', SCOPE).href).then(function (home) {
          if (home) return home;
          throw err;
        });
      });
    });
  });
}

/* Шрифты Google: после первого запроса живут в RT. Таблица стилей подключена <link> без crossorigin
   (ответ был бы opaque, status 0, и в кэш не попал бы), поэтому запрашиваем её в режиме cors:
   googleapis отдаёт Access-Control-Allow-Origin: *, а cors-ответ годится и для no-cors запроса. */
function fontFetch(req) {
  return caches.open(RT).then(function (cache) {
    return cache.match(req.url, { ignoreVary: true }).then(function (hit) {
      if (hit) return hit;
      var asCors = req.mode === 'no-cors' ? new Request(req.url, { mode: 'cors', credentials: 'omit' }) : req;
      return fetch(asCors).catch(function () { return fetch(req); }).then(function (res) {
        if (res.status === 200) cache.put(req.url, res.clone());
        return res;
      });
    });
  });
}

/* Видео портретов. <video> почти всегда просит Range, а Cache API частичные ответы не хранит.
   Поэтому: Range без кэша — идём в сеть как есть и тихо докачиваем целиком (один раз) в RT;
   Range при кэше — режем 206 из целого файла; обычный запрос — cache-first, кладём только 200. */
var warming = {};
function videoFetch(e, req, url) {
  var key = url.origin + url.pathname;
  var range = req.headers.get('range');
  e.respondWith(caches.open(RT).then(function (cache) {
    return cache.match(key).then(function (hit) {
      if (hit) return range ? sliceRange(hit, range, key) : hit;
      if (range) {
        if (!warming[key]) {
          warming[key] = true;
          e.waitUntil(fetch(key).then(function (res) {
            if (res.status === 200) return cache.put(key, res);
          }).catch(function () {}).then(function () { delete warming[key]; }));
        }
        return fetch(req);
      }
      return fetch(req).then(function (res) {
        if (res.status === 200) cache.put(key, res.clone());
        return res;
      });
    });
  }));
}

function sliceRange(res, range, key) {
  var m = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!m || (m[1] === '' && m[2] === '')) return res;
  return res.arrayBuffer().then(function (buf) {
    var size = buf.byteLength, start, end;
    if (m[1] === '') { start = Math.max(0, size - Number(m[2])); end = size - 1; }
    else { start = Number(m[1]); end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1); }
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
    }
    return new Response(buf.slice(start, end + 1), {
      status: 206,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || (/\.mp4$/.test(key) ? 'video/mp4' : 'video/webm'),
        'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
        'Content-Length': String(end - start + 1)
      }
    });
  });
}

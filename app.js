/* Single-file build (no ES modules) for maximum mobile compatibility. */

(function () {
  'use strict';

  // Extremely old browsers can't run Firebase compat (Promise required).
  if (typeof Promise === 'undefined') {
    var v = document.getElementById('view');
    if (v) {
      v.innerHTML =
        '<div class="stack"><div class="badge">エラー</div><div class="big">このブラウザは古すぎます</div><div class="muted">別のブラウザ（Chrome/Safari最新版）で開いてください。</div></div>';
    }
    return;
  }

  // -------------------- tiny helpers --------------------
  var hasOwn = Object.prototype.hasOwnProperty;

  function assign(target) {
    if (!target) target = {};
    for (var i = 1; i < arguments.length; i++) {
      var src = arguments[i];
      if (!src) continue;
      for (var k in src) {
        if (hasOwn.call(src, k)) target[k] = src[k];
      }
    }
    return target;
  }

  function qs(selector, root) {
    var r = root || document;
    var el = r.querySelector(selector);
    if (!el) throw new Error('Not found: ' + selector);
    return el;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function nowMs() {
    return Date.now ? Date.now() : new Date().getTime();
  }

  function pad2(n) {
    var s = String(Math.floor(Math.abs(n)));
    return s.length >= 2 ? s : '0' + s;
  }

  function formatMMSS(totalSeconds) {
    var s = Math.max(0, Math.floor(totalSeconds));
    return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60);
  }

  function parseIntSafe(v, fallback) {
    var n = parseInt(String(v), 10);
    return isFinite(n) ? n : fallback;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function randomId(len) {
    var l = len == null ? 20 : len;
    var alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var out = '';
    var bytes = null;
    try {
      if (typeof crypto !== 'undefined' && crypto.getRandomValues && typeof Uint8Array !== 'undefined') {
        bytes = crypto.getRandomValues(new Uint8Array(l));
      }
    } catch (e) {
      bytes = null;
    }
    for (var i = 0; i < l; i++) {
      var v = bytes ? bytes[i] : Math.floor(Math.random() * 256);
      out += alphabet[v % alphabet.length];
    }
    return out;
  }

  // -------------------- query helpers (no URL/URLSearchParams) --------------------
  function decodeQS(s) {
    try {
      return decodeURIComponent(String(s || '').replace(/\+/g, ' '));
    } catch (e) {
      return String(s || '');
    }
  }

  function encodeQS(s) {
    try {
      return encodeURIComponent(String(s));
    } catch (e) {
      return String(s);
    }
  }

  function parseQuery() {
    var q = String(location.search || '').replace(/^\?/, '');
    var out = {};
    if (!q) return out;
    var parts = q.split('&');
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (!part) continue;
      var idx = part.indexOf('=');
      var k = idx >= 0 ? part.slice(0, idx) : part;
      var v = idx >= 0 ? part.slice(idx + 1) : '';
      out[decodeQS(k)] = decodeQS(v);
    }
    return out;
  }

  function buildQuery(obj) {
    var parts = [];
    for (var k in obj) {
      if (!hasOwn.call(obj, k)) continue;
      if (obj[k] == null || obj[k] === '') continue;
      parts.push(encodeQS(k) + '=' + encodeQS(obj[k]));
    }
    return parts.join('&');
  }

  function baseUrl() {
    var origin = '';
    if (location.protocol && location.host) origin = location.protocol + '//' + location.host;
    return origin + (location.pathname || '/');
  }

  function setQuery(obj) {
    var q = buildQuery(obj);
    var url = baseUrl() + (q ? '?' + q : '');
    if (location.hash) url += location.hash;
    history.pushState(null, '', url);
  }

  function getScriptQueryParam(src, key) {
    var s = String(src || '');
    var qi = s.indexOf('?');
    if (qi < 0) return '';
    var q = s.slice(qi + 1);
    var parts = q.split('&');
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (!part) continue;
      var idx = part.indexOf('=');
      var k = idx >= 0 ? part.slice(0, idx) : part;
      var v = idx >= 0 ? part.slice(idx + 1) : '';
      if (decodeQS(k) === key) return decodeQS(v);
    }
    return '';
  }

  var _bundledAssetV = null;

  function getBundledAssetVersion() {
    if (_bundledAssetV != null) return _bundledAssetV;

    var src = '';
    try {
      if (document.currentScript && document.currentScript.src) src = String(document.currentScript.src);
    } catch (e) {
      src = '';
    }

    if (!src) {
      var scripts = document.getElementsByTagName('script');
      for (var i = scripts.length - 1; i >= 0; i--) {
        var s = scripts[i];
        if (s && s.src && String(s.src).indexOf('app.js') !== -1) {
          src = String(s.src);
          break;
        }
      }
    }

    _bundledAssetV = getScriptQueryParam(src, 'v') || '';
    return _bundledAssetV;
  }

  function getCacheBusterParam() {
    var q = parseQuery();
    if (q.v) return String(q.v);
    return getBundledAssetVersion();
  }

  function ensureUrlHasCacheBuster() {
    var q = parseQuery();
    if (q.v) return;
    var v = getCacheBusterParam();
    if (!v) return;
    q.v = v;
    setQuery(q);
  }

  // -------------------- topics --------------------
  var TOPIC_CATEGORIES = [
    {
      id: 'food',
      name: '食べ物',
      pairs: [
        ['カレー', 'シチュー'],
        ['ラーメン', 'うどん'],
        ['寿司', '刺身'],
        ['ハンバーガー', 'サンドイッチ'],
        ['チョコ', 'クッキー'],
        ['おにぎり', 'サンドイッチ'],
        ['焼肉', 'しゃぶしゃぶ'],
        ['ピザ', 'グラタン'],
        ['アイス', 'かき氷'],
        ['プリン', 'ゼリー']
      ]
    },
    {
      id: 'place',
      name: '場所',
      pairs: [
        ['映画館', '劇場'],
        ['学校', '塾'],
        ['コンビニ', 'スーパー'],
        ['病院', '薬局'],
        ['図書館', '本屋'],
        ['温泉', '銭湯'],
        ['水族館', '動物園'],
        ['空港', '駅'],
        ['海', '山'],
        ['カフェ', 'レストラン']
      ]
    },
    {
      id: 'thing',
      name: 'モノ',
      pairs: [
        ['スマホ', 'タブレット'],
        ['テレビ', 'パソコン'],
        ['傘', 'レインコート'],
        ['時計', 'カレンダー'],
        ['リュック', 'バッグ'],
        ['自転車', 'バイク'],
        ['鉛筆', 'シャーペン'],
        ['ノート', '教科書'],
        ['鍵', '財布'],
        ['メガネ', 'コンタクト']
      ]
    },
    {
      id: 'job',
      name: '職業',
      pairs: [
        ['先生', '講師'],
        ['医者', '看護師'],
        ['警察官', '消防士'],
        ['料理人', 'パティシエ'],
        ['スポーツ選手', '監督'],
        ['店員', '店長'],
        ['運転手', '整備士'],
        ['漫画家', 'イラストレーター'],
        ['記者', '編集者'],
        ['配達員', '郵便局員']
      ]
    }
  ];

  function getCategoryById(id) {
    for (var i = 0; i < TOPIC_CATEGORIES.length; i++) {
      if (TOPIC_CATEGORIES[i].id === id) return TOPIC_CATEGORIES[i];
    }
    return TOPIC_CATEGORIES[0];
  }

  function pickRandomPair(categoryId) {
    var cat = getCategoryById(categoryId);
    var pairs = (cat && cat.pairs) || [];
    if (!pairs.length) throw new Error('候補がありません');
    var idx = Math.floor(Math.random() * pairs.length);
    var pair = pairs[idx];
    if (Math.random() < 0.5) return { category: cat, majority: pair[0], minority: pair[1] };
    return { category: cat, majority: pair[1], minority: pair[0] };
  }

  // -------------------- firebase (compat scripts) --------------------
  var LS_KEY = 'ww_firebase_config_v1';

  function trimString(v) {
    return String(v == null ? '' : v).replace(/^\s+|\s+$/g, '');
  }

  function normalizeDatabaseURL(input) {
    var url = trimString(input);
    if (!url) return '';
    // Remove trailing slashes
    while (url.length > 1 && url.charAt(url.length - 1) === '/') url = url.slice(0, -1);
    return url;
  }

  function isValidDatabaseURL(url) {
    var u = normalizeDatabaseURL(url);
    if (!u) return false;
    // Must be https://<host>(/...)
    if (u.indexOf('https://') !== 0) return false;
    var rest = u.slice('https://'.length);
    var slash = rest.indexOf('/');
    var host = slash >= 0 ? rest.slice(0, slash) : rest;
    if (!host) return false;

    // Realtime Database URLs (old + new)
    // - https://<project>.firebaseio.com
    // - https://<project>-default-rtdb.firebaseio.com
    // - https://<project>-default-rtdb.<region>.firebasedatabase.app
    var h = host.toLowerCase();
    if (h.indexOf('firebaseio.com') >= 0 && h !== 'firebaseio.com') return true;
    if (h.indexOf('firebasedatabase.app') >= 0 && h !== 'firebasedatabase.app') return true;
    return false;
  }

  function ensureValidDatabaseURLOrThrow(url) {
    var normalized = normalizeDatabaseURL(url);
    if (!isValidDatabaseURL(normalized)) {
      throw new Error(
        'databaseURL の形式が正しくありません。Realtime Database のURLを https:// から貼り付けてください。\n例: https://<プロジェクト>.firebaseio.com\n例: https://<プロジェクト>-default-rtdb.<リージョン>.firebasedatabase.app'
      );
    }
    return normalized;
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error('Failed to load: ' + src));
      };
      document.head.appendChild(s);
    });
  }

  function saveFirebaseConfigToLocalStorage(config) {
    localStorage.setItem(LS_KEY, JSON.stringify(config));
  }

  function loadFirebaseConfigFromLocalStorage() {
    var raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  var _dbReady = null;

  function firebaseReady() {
    if (_dbReady) return _dbReady;

    _dbReady = Promise.resolve()
      .then(function () {
        var firebaseConfig = window.firebaseConfig || loadFirebaseConfigFromLocalStorage();
        if (!firebaseConfig || !firebaseConfig.apiKey) {
          throw new Error('Firebase設定がありません。?screen=setup で設定してください。');
        }
        if (!firebaseConfig.databaseURL) {
          throw new Error('Firebase設定に databaseURL がありません。');
        }

        // Normalize & validate early to avoid confusing SDK errors.
        firebaseConfig.databaseURL = ensureValidDatabaseURLOrThrow(firebaseConfig.databaseURL);
        return firebaseConfig;
      })
      .then(function (firebaseConfig) {
        return loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js')
          .then(function () {
            return loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js');
          })
          .then(function () {
            firebase.initializeApp(firebaseConfig);
            return firebase.database();
          });
      });

    return _dbReady;
  }

  function dbRef(path) {
    return firebaseReady().then(function (db) {
      return db.ref(path);
    });
  }

  function onValue(path, cb) {
    return dbRef(path).then(function (ref) {
      var handler = function (snap) {
        cb(snap.val());
      };
      ref.on('value', handler);
      return function () {
        ref.off('value', handler);
      };
    });
  }

  function setValue(path, value) {
    return dbRef(path).then(function (ref) {
      return ref.set(value);
    });
  }

  function runTxn(path, updateFn) {
    return dbRef(path)
      .then(function (ref) {
        return ref.transaction(function (current) {
          return updateFn(current);
        });
      })
      .then(function (res) {
        return res.snapshot.val();
      });
  }

  // -------------------- state --------------------
  function getUrlState() {
    var q = parseQuery();
    var roomId = q.room ? String(q.room) : '';
    var isHost = q.host === '1';
    return { roomId: roomId, isHost: isHost };
  }

  function makeRoomId() {
    return randomId(8);
  }

  function getOrCreatePlayerId(roomId) {
    var key = 'ww_player_' + roomId;
    var id = localStorage.getItem(key);
    if (!id) {
      id = randomId(12);
      localStorage.setItem(key, id);
    }
    return id;
  }

  function roomPath(roomId) {
    return 'rooms/' + roomId;
  }

  function playerPath(roomId, playerId) {
    return 'rooms/' + roomId + '/players/' + playerId;
  }

  function createRoom(roomId, settings) {
    var base = roomPath(roomId);
    var room = {
      createdAt: nowMs(),
      phase: 'lobby',
      settings: {
        minorityCount: settings.minorityCount,
        talkSeconds: settings.talkSeconds,
        reversal: settings.reversal
      },
      words: {
        majority: settings.majorityWord,
        minority: settings.minorityWord
      },
      discussion: {
        startedAt: 0,
        endsAt: 0
      },
      reveal: {
        revealedAt: 0
      },
      guess: {
        enabled: !!settings.reversal,
        submittedAt: 0,
        guessText: '',
        correct: null
      },
      voting: {
        startedAt: 0,
        revealedAt: 0
      },
      votes: {},
      players: {}
    };
    return setValue(base, room);
  }

  function joinPlayerInRoom(roomId, playerId, name) {
    var base = roomPath(roomId);
    return runTxn(base, function (room) {
      if (!room) return room;
      if (room.phase !== 'lobby') return room;

      var players = assign({}, room.players || {});
      var prev = players[playerId] || {};
      players[playerId] = assign({}, prev, {
        name: name,
        joinedAt: prev.joinedAt || nowMs(),
        lastSeenAt: nowMs()
      });

      return assign({}, room, { players: players });
    });
  }

  function listActivePlayerIds(room) {
    var playersObj = (room && room.players) || {};
    var keys = Object.keys(playersObj);
    var out = [];
    for (var i = 0; i < keys.length; i++) {
      var id = keys[i];
      var p = playersObj[id];
      if (!p) continue;
      if (p.role === 'spectator') continue;
      out.push(id);
    }
    return out;
  }

  function isVotingComplete(room) {
    var ids = listActivePlayerIds(room);
    if (!ids.length) return false;
    var votes = (room && room.votes) || {};
    for (var i = 0; i < ids.length; i++) {
      var voterId = ids[i];
      var v = votes[voterId];
      if (!v || !v.to) return false;
    }
    return true;
  }

  function startGame(roomId) {
    var base = roomPath(roomId);
    return runTxn(base, function (room) {
      if (!room) return room;
      if (room.phase !== 'lobby') return room;

      var ids = listActivePlayerIds(room);
      if (ids.length < 3) return room;

      var talkSeconds = room.settings && room.settings.talkSeconds != null ? room.settings.talkSeconds : 180;
      var minorityCount = room.settings && room.settings.minorityCount != null ? room.settings.minorityCount : 1;
      minorityCount = clamp(minorityCount, 1, Math.max(1, ids.length - 1));

      var shuffled = ids.slice();
      for (var i = shuffled.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = shuffled[i];
        shuffled[i] = shuffled[j];
        shuffled[j] = tmp;
      }

      var minoritySet = {};
      for (var k = 0; k < minorityCount; k++) minoritySet[shuffled[k]] = true;

      var nextPlayers = assign({}, room.players || {});
      for (var m = 0; m < ids.length; m++) {
        var pid = ids[m];
        var p = nextPlayers[pid] || {};
        nextPlayers[pid] = assign({}, p, { role: minoritySet[pid] ? 'minority' : 'majority' });
      }

      var startedAt = nowMs();
      return assign({}, room, {
        phase: 'discussion',
        players: nextPlayers,
        discussion: { startedAt: startedAt, endsAt: startedAt + talkSeconds * 1000 },
        voting: { startedAt: 0, revealedAt: 0 },
        votes: {},
        reveal: { revealedAt: 0 },
        guess: {
          enabled: !!(room.settings && room.settings.reversal),
          submittedAt: 0,
          guessText: '',
          correct: null
        }
      });
    });
  }

  function autoStartVotingIfEnded(roomId) {
    var base = roomPath(roomId);
    return runTxn(base, function (room) {
      if (!room) return room;
      if (room.phase !== 'discussion') return room;
      var endAt = room.discussion && room.discussion.endsAt ? room.discussion.endsAt : 0;
      if (!endAt) return room;
      if (nowMs() < endAt) return room;
      return assign({}, room, {
        phase: 'voting',
        voting: { startedAt: nowMs(), revealedAt: 0 },
        votes: {}
      });
    });
  }

  function revealAfterVoting(roomId) {
    var base = roomPath(roomId);
    return runTxn(base, function (room) {
      if (!room) return room;
      if (room.phase !== 'voting') return room;
      if (!isVotingComplete(room)) return room;
      var reversal = !!(room.settings && room.settings.reversal);
      return assign({}, room, {
        phase: reversal ? 'guess' : 'finished',
        reveal: { revealedAt: nowMs() }
      });
    });
  }

  function submitVote(roomId, voterId, toPlayerId) {
    var base = roomPath(roomId);
    return runTxn(base, function (room) {
      if (!room) return room;
      if (room.phase !== 'voting') return room;
      var playersObj = room.players || {};
      var voter = playersObj[voterId];
      var to = playersObj[toPlayerId];
      if (!voter || voter.role === 'spectator') return room;
      if (!to || to.role === 'spectator') return room;
      var nextVotes = assign({}, room.votes || {});
      nextVotes[voterId] = { to: toPlayerId, at: nowMs() };
      return assign({}, room, { votes: nextVotes });
    });
  }

  function submitGuess(roomId, playerId, guessText) {
    var base = roomPath(roomId);
    return runTxn(base, function (room) {
      if (!room) return room;
      if (room.phase !== 'guess') return room;
      var playersObj = room.players || {};
      var me = playersObj[playerId];
      if (!me || me.role !== 'minority') return room;
      var majorityWord = String((room.words && room.words.majority) || '').trim();
      var gt = String(guessText || '').trim();
      var correct = gt.length > 0 && majorityWord.length > 0 && gt === majorityWord;
      return assign({}, room, {
        phase: 'finished',
        guess: assign({}, room.guess || {}, { submittedAt: nowMs(), guessText: gt, correct: correct })
      });
    });
  }

  function subscribeRoom(roomId, cb) {
    return onValue(roomPath(roomId), cb);
  }

  // -------------------- UI --------------------
  function render(viewEl, html) {
    viewEl.innerHTML = html;
  }

  function renderError(viewEl, message) {
    var msg = escapeHtml(message);
    var showSetupLink =
      String(message || '').indexOf('Firebase設定がありません') >= 0 ||
      String(message || '').indexOf('?screen=setup') >= 0 ||
      String(message || '').indexOf('databaseURL') >= 0;

    render(
      viewEl,
      '\n    <div class="stack">\n      <div class="badge">エラー</div>\n      <div class="big">' +
        msg +
        '</div>\n      <div class="muted">設定やURLを確認してください。</div>' +
        (showSetupLink
          ? '\n      <a class="btn primary" href="?screen=setup">Firebaseセットアップを開く</a>'
          : '') +
        '\n    </div>\n  '
    );
  }

  function renderHome(viewEl) {
    render(
      viewEl,
      '\n    <div class="stack">\n      <div class="big">はじめる</div>\n      <div class="muted">ゲームマスターが部屋を作り、QRを配布します。</div>\n\n      <hr />\n\n      <div class="stack">\n        <a class="btn primary" href="?screen=create">部屋を作る（ゲームマスター）</a>\n\n        <div class="field">\n          <label>ルームIDがある場合（参加者）</label>\n          <div class="row">\n            <input id="joinRoomId" placeholder="例: a1b2c3d4" inputmode="latin" />\n            <button id="goJoin" class="ghost">参加</button>\n          </div>\n          <div class="muted">QRが読めない時の手入力用です。</div>\n        </div>\n      </div>\n    </div>\n  '
    );
  }

  function renderSetup(viewEl) {
    render(
      viewEl,
      '\n    <div class="stack">\n      <div class="big">セットアップ</div>\n      <div class="muted">Firebase（Realtime Database）のWeb設定を貼り付けて保存します（JSON でも firebaseConfig のサンプルコードでもOK）。</div>\n\n      <div class="field">\n        <label>Firebase config</label>\n        <textarea id="firebaseConfigJson" placeholder=\'{"apiKey":"...","authDomain":"...","databaseURL":"...","projectId":"...","appId":"..."}\n\nまたは\n\nconst firebaseConfig = { apiKey: "...", databaseURL: "..." }\'></textarea>\n        <div class="muted">※ databaseURL は https:// から始まるRealtime DatabaseのURLです（firebaseio.com / firebasedatabase.app）。</div>\n      </div>\n\n      <div class="row">\n        <button id="saveSetup" class="primary">保存</button>\n        <a class="btn ghost" href="./">戻る</a>\n      </div>\n    </div>\n  '
    );

    var saved = loadFirebaseConfigFromLocalStorage();
    if (saved) {
      var el = document.getElementById('firebaseConfigJson');
      if (el) el.value = JSON.stringify(saved);
    }
  }

  function extractObjectLiteralAfter(text, marker) {
    var idx = text.indexOf(marker);
    if (idx < 0) return null;
    var braceStart = text.indexOf('{', idx);
    if (braceStart < 0) return null;
    var depth = 0;
    for (var i = braceStart; i < text.length; i++) {
      var ch = text.charAt(i);
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          return text.slice(braceStart, i + 1);
        }
      }
    }
    return null;
  }

  function jsObjectLiteralToJsonText(objText) {
    // Convert a simple JS object literal (no functions) into JSON text.
    // Handles common Firebase snippet format.
    var s = String(objText || '');
    // Remove line comments
    s = s.replace(/\/\/.*$/gm, '');
    // Remove trailing commas before } or ]
    s = s.replace(/,\s*([}\]])/g, '$1');
    // Quote unquoted keys: { apiKey: "..." } -> { "apiKey": "..." }
    s = s.replace(/([\{,]\s*)([A-Za-z0-9_$]+)\s*:/g, '$1"$2":');
    return s;
  }

  function parseLooseFirebaseConfig(objText) {
    // Last-resort tolerant parser: picks `key: value` pairs even if commas are missing.
    // Accepts string/number/boolean/null values.
    var text = String(objText || '');
    // Strip surrounding braces if present
    var start = text.indexOf('{');
    var end = text.lastIndexOf('}');
    if (start >= 0 && end > start) text = text.slice(start + 1, end);

    // Remove line comments
    text = text.replace(/\/\/.*$/gm, '');

    var out = {};
    var re = /([A-Za-z0-9_$]+)\s*:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|true|false|null|-?\d+(?:\.\d+)?)\s*,?/g;
    var m;
    while ((m = re.exec(text))) {
      var k = m[1];
      var rawVal = m[2];
      var val;
      if (rawVal === 'true') val = true;
      else if (rawVal === 'false') val = false;
      else if (rawVal === 'null') val = null;
      else if (rawVal.charAt(0) === '"' || rawVal.charAt(0) === "'") {
        // Use JSON.parse for double-quoted strings; for single-quoted, convert safely.
        if (rawVal.charAt(0) === '"') {
          try {
            val = JSON.parse(rawVal);
          } catch (e) {
            val = rawVal.slice(1, -1);
          }
        } else {
          var dq = '"' + rawVal.slice(1, -1).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
          try {
            val = JSON.parse(dq);
          } catch (e2) {
            val = rawVal.slice(1, -1);
          }
        }
      } else {
        val = Number(rawVal);
      }
      out[k] = val;
    }
    return out;
  }

  function readSetupForm() {
    var el = document.getElementById('firebaseConfigJson');
    var raw = String((el && el.value) || '').trim();
    if (!raw) throw new Error('Firebase config JSON を貼り付けてください。');

    // Accept either strict JSON or the official Firebase snippet code.
    var candidate = raw;
    if (raw.indexOf('firebaseConfig') >= 0) {
      var extracted = extractObjectLiteralAfter(raw, 'firebaseConfig');
      if (extracted) candidate = extracted;
    }

    var parsed;
    try {
      parsed = JSON.parse(candidate);
    } catch (e1) {
      try {
        parsed = JSON.parse(jsObjectLiteralToJsonText(candidate));
      } catch (e2) {
        try {
          parsed = parseLooseFirebaseConfig(candidate);
        } catch (e3) {
          parsed = null;
        }
        if (!parsed || !parsed.apiKey) {
          throw new Error('JSONとして解釈できません。firebaseConfig の { ... } 部分だけを貼るか、Firebaseコンソールの設定をそのまま貼ってください。');
        }
      }
    }
    if (!parsed || !parsed.apiKey) throw new Error('apiKey が見つかりません。');
    if (!parsed.databaseURL) throw new Error('databaseURL が見つかりません。');

    // Normalize & validate databaseURL (Realtime Database)
    parsed.databaseURL = ensureValidDatabaseURLOrThrow(parsed.databaseURL);
    return parsed;
  }

  function renderCreate(viewEl) {
    render(
      viewEl,
      '\n    <div class="stack">\n      <div class="big">部屋を作成</div>\n\n      <div class="field">\n        <label>GMの名前（表示用）</label>\n        <input id="gmName" placeholder="例: たろう" />\n      </div>\n\n      <div class="field">\n        <label>少数側の人数</label>\n        <input id="minorityCount" type="number" min="1" max="10" value="1" />\n      </div>\n\n      <div class="field">\n        <label>トーク時間（秒）</label>\n        <input id="talkSeconds" type="number" min="30" max="1800" value="180" />\n      </div>\n\n      <div class="field">\n        <label>逆転あり（少数側が最後に多数側ワードを当てたら勝ち）</label>\n        <select id="reversal">\n          <option value="1" selected>あり</option>\n          <option value="0">なし</option>\n        </select>\n      </div>\n\n      <hr />\n\n      <div class="field">\n        <label>お題カテゴリ（ランダム出題）</label>\n        <div class="row">\n          <select id="topicCategory"></select>\n          <button id="pickRandom" class="ghost">ランダム出題</button>\n        </div>\n        <div class="muted">※ 手入力でもOKです。</div>\n      </div>\n\n      <div class="field">\n        <label>多数側ワード</label>\n        <input id="majorityWord" placeholder="例: カレー" />\n      </div>\n\n      <div class="field">\n        <label>少数側ワード</label>\n        <input id="minorityWord" placeholder="例: シチュー" />\n      </div>\n\n      <hr />\n\n      <div class="row">\n        <button id="createRoom" class="primary">作成してQRを表示</button>\n        <a class="btn ghost" href="./">戻る</a>\n      </div>\n    </div>\n  '
    );

    var sel = document.getElementById('topicCategory');
    if (sel) {
      var html = '';
      for (var i = 0; i < TOPIC_CATEGORIES.length; i++) {
        var c = TOPIC_CATEGORIES[i];
        html += '<option value="' + escapeHtml(c.id) + '">' + escapeHtml(c.name) + '</option>';
      }
      sel.innerHTML = html;
    }
  }

  function readCreateForm() {
    var gn = document.getElementById('gmName');
    var mc = document.getElementById('minorityCount');
    var ts = document.getElementById('talkSeconds');
    var rv = document.getElementById('reversal');
    var mj = document.getElementById('majorityWord');
    var mn = document.getElementById('minorityWord');

    var gmName = String((gn && gn.value) || '').trim();
    var minorityCount = clamp(parseIntSafe(mc && mc.value, 1), 1, 10);
    var talkSeconds = clamp(parseIntSafe(ts && ts.value, 180), 30, 1800);
    var reversal = ((rv && rv.value) || '1') === '1';

    var majorityWord = String((mj && mj.value) || '').trim();
    var minorityWord = String((mn && mn.value) || '').trim();

    if (!gmName) throw new Error('GMの名前を入力してください。');
    if (!majorityWord) throw new Error('多数側ワードを入力してください。');
    if (!minorityWord) throw new Error('少数側ワードを入力してください。');

    return {
      gmName: gmName,
      minorityCount: minorityCount,
      talkSeconds: talkSeconds,
      reversal: reversal,
      majorityWord: majorityWord,
      minorityWord: minorityWord
    };
  }

  function renderJoin(viewEl, roomId) {
    render(
      viewEl,
      '\n    <div class="stack">\n      <div class="big">参加</div>\n      <div class="kv"><span class="muted">ルームID</span><b>' +
        escapeHtml(roomId) +
        '</b></div>\n\n      <div class="field">\n        <label>名前（表示用）</label>\n        <input id="playerName" placeholder="例: たろう" />\n      </div>\n\n      <div class="row">\n        <button id="join" class="primary">参加する</button>\n        <a class="btn ghost" href="./">戻る</a>\n      </div>\n    </div>\n  '
    );
  }

  function readJoinForm() {
    var el = document.getElementById('playerName');
    var name = String((el && el.value) || '').trim();
    if (!name) throw new Error('名前を入力してください。');
    return { name: name };
  }

  function renderHostQr(viewEl, opts) {
    var roomId = opts.roomId;
    var joinUrl = opts.joinUrl;
    var hostUrl = opts.hostUrl;
    var room = opts.room;

    var playerCount = room && room.players ? Object.keys(room.players).length : 0;
    var phase = (room && room.phase) || '-';

    var actionHtml = '';
    if (phase === 'lobby') actionHtml = '<button id="startGame" class="primary">スタート（トーク開始）</button>';
    if (phase === 'voting') actionHtml = '<button id="revealNext" class="primary">次へ進む（結果開示）</button>';

    render(
      viewEl,
      '\n    <div class="stack">\n      <div class="big">QR配布</div>\n      <div class="muted">参加者はこのQRを読み取って参加します。</div>\n\n      <div class="field">\n        <label>参加者用URL</label>\n        <div class="code" id="joinUrl">' +
        escapeHtml(joinUrl) +
        '</div>\n      </div>\n\n      <div class="center" id="qrWrap">\n        <canvas id="qr"></canvas>\n      </div>\n      <div class="muted center" id="qrError"></div>\n\n      <div class="kv"><span class="muted">参加状況</span><b>' +
        playerCount +
        '</b></div>\n      <div class="kv"><span class="muted">フェーズ</span><b>' +
        escapeHtml(phase) +
        '</b></div>\n\n      <hr />\n\n      <div class="stack">\n        <div class="row">\n          <button id="copyJoin" class="ghost">URLコピー</button>\n          <a class="badge" href="' +
        escapeHtml(hostUrl) +
        '">この端末をGMモードで開く</a>\n        </div>\n\n        <div class="row">\n          ' +
        actionHtml +
        '\n        </div>\n      </div>\n\n      <div class="muted">※ スタートでトーク開始。時間終了で全員が投票へ進みます。投票完了後、GMが次へ進むで結果開示。</div>\n    </div>\n  '
    );
  }

  function renderPlayer(viewEl, opts) {
    var roomId = opts.roomId;
    var playerId = opts.playerId;
    var player = opts.player;
    var room = opts.room;

    var isHost = !!opts.isHost;

    var role = (player && player.role) || 'unknown';
    var phase = (room && room.phase) || 'lobby';

    var players = (room && room.players) || {};
    var activePlayers = [];
    var playerKeys = Object.keys(players);
    for (var i = 0; i < playerKeys.length; i++) {
      var id = playerKeys[i];
      var p = players[id];
      if (!p || p.role === 'spectator') continue;
      activePlayers.push({ id: id, name: p.name || '' });
    }

    var votedTo = room && room.votes && room.votes[playerId] && room.votes[playerId].to ? room.votes[playerId].to : '';

    var votesObj = (room && room.votes) || {};
    var counts = {};
    var voteKeys = Object.keys(votesObj);
    for (var vki = 0; vki < voteKeys.length; vki++) {
      var vid = voteKeys[vki];
      var v = votesObj[vid];
      if (!v || !v.to) continue;
      counts[v.to] = (counts[v.to] || 0) + 1;
    }

    var tally = [];
    for (var ai = 0; ai < activePlayers.length; ai++) {
      var ap = activePlayers[ai];
      tally.push({ id: ap.id, name: ap.name, count: counts[ap.id] || 0 });
    }
    tally.sort(function (a, b) {
      return b.count - a.count;
    });

    var word = '';
    if (!isHost) {
      if (role === 'minority') word = (room && room.words ? room.words.minority : '') || '';
      if (role === 'majority') word = (room && room.words ? room.words.majority : '') || '';
    }

    var roleLabel = '未確定';
    if (role === 'minority') roleLabel = '少数側';
    if (role === 'majority') roleLabel = '多数側';
    if (role === 'spectator') roleLabel = '観戦';

    var roleLabelView = roleLabel;
    var wordView = word;
    if (isHost) {
      roleLabelView = '（非表示）';
      wordView = '（非表示）';
    }

    var endAt = room && room.discussion && room.discussion.endsAt ? room.discussion.endsAt : 0;
    var remain = Math.max(0, Math.floor((endAt - (Date.now ? Date.now() : new Date().getTime())) / 1000));

    var votingHtml = '';
    if (phase === 'voting') {
      if (votedTo) {
        votingHtml =
          '<div class="stack">' +
          '<div class="big">投票</div>' +
          '<div class="muted">投票済み。結果開示を待ってください。</div>' +
          '</div>';
      } else {
        var options = '';
        for (var oi = 0; oi < activePlayers.length; oi++) {
          var ap2 = activePlayers[oi];
          if (ap2.id === playerId) continue;
          options += '<option value="' + escapeHtml(ap2.id) + '">' + escapeHtml(ap2.name) + '</option>';
        }

        votingHtml =
          '<div class="stack">' +
          '<div class="big">投票</div>' +
          '<div class="muted">少数側だと思う人を選んで投票します。</div>' +
          '<div class="row">' +
          '<select id="voteTo"><option value="">選択…</option>' +
          options +
          '</select>' +
          '<button id="submitVote" class="primary">投票</button>' +
          '</div>' +
          '<div class="muted">未投票</div>' +
          '</div>';
      }
    }

    var voteResultHtml = '';
    if (phase === 'finished') {
      var rows = '';
      for (var ti = 0; ti < tally.length; ti++) {
        var r = tally[ti];
        rows += '<div class="kv"><span class="muted">' + escapeHtml(r.name) + '</span><b>' + r.count + '</b></div>';
      }
      voteResultHtml = '<hr /><div class="muted">投票結果（得票数）</div><div class="stack">' + rows + '</div>';
    }

    var minorityNames = [];
    for (var mi = 0; mi < activePlayers.length; mi++) {
      var apm = activePlayers[mi];
      var pr = players[apm.id] && players[apm.id].role;
      if (pr === 'minority') minorityNames.push(apm.name);
    }
    var minorityLine = minorityNames.length ? minorityNames.join(' / ') : '（未確定）';

    var guessHtml = '';
    if (phase === 'guess') {
      guessHtml =
        '<div class="stack">' +
        '<div class="big">開示</div>' +
        '<div class="kv"><span class="muted">少数側</span><b>' +
        escapeHtml(minorityLine) +
        '</b></div>' +
        '<hr />' +
        '<div class="muted">逆転あり: 少数側は多数側ワードを入力</div>' +
        (role === 'minority'
          ? '<div class="row"><input id="guessText" placeholder="多数側ワード" />' +
            '<button id="submitGuess" class="primary">確定</button></div>'
          : '<div class="muted">少数側の入力を待っています…</div>') +
        '</div>';
    }

    var finishedHtml = '';
    if (phase === 'finished') {
      var mj = (room && room.words && room.words.majority) || '';
      var mn = (room && room.words && room.words.minority) || '';
      var reversal = room && room.settings && room.settings.reversal;
      var guessText = (room && room.guess && room.guess.guessText) || '（未回答）';
      var correct = room && room.guess ? room.guess.correct : null;

      var correctness = '未確定';
      if (correct === true) correctness = '正解（少数側勝ち）';
      if (correct === false) correctness = '不正解（多数側勝ち）';

      finishedHtml =
        '<div class="stack">' +
        '<div class="big">結果</div>' +
        '<div class="kv"><span class="muted">少数側</span><b>' +
        escapeHtml(minorityLine) +
        '</b></div>' +
        '<div class="kv"><span class="muted">多数側ワード</span><b>' +
        escapeHtml(mj) +
        '</b></div>' +
        '<div class="kv"><span class="muted">少数側ワード</span><b>' +
        escapeHtml(mn) +
        '</b></div>' +
        (reversal
          ? '<hr /><div class="kv"><span class="muted">少数側の回答</span><b>' +
            escapeHtml(guessText) +
            '</b></div><div class="kv"><span class="muted">正誤</span><b>' +
            escapeHtml(correctness) +
            '</b></div>'
          : '') +
        voteResultHtml +
        '</div>';
      voteResultHtml = '';
    }

    render(
      viewEl,
      '\n    <div class="stack">\n      <div class="row" style="justify-content:space-between">\n        <div>\n          <div class="badge">ルーム ' +
        escapeHtml(roomId) +
        '</div>\n          <div class="big">' +
        escapeHtml((player && player.name) || '') +
        '</div>\n        </div>\n        <div class="badge">' +
        escapeHtml(phase) +
        '</div>\n      </div>\n\n      <div class="card" style="padding:12px">\n        <div class="muted">あなたの役職</div>\n        <div class="big">' +
        escapeHtml(roleLabelView) +
        '</div>\n        <hr />\n        <div class="muted">あなたのワード</div>\n        <div class="big">' +
        escapeHtml(wordView || '（未配布）') +
        '</div>\n      </div>\n\n      <div class="card center" style="padding:12px">\n        <div class="muted">残り時間</div>\n        <div class="timer" id="timer">' +
        escapeHtml(formatMMSS(remain)) +
        '</div>\n      </div>\n\n      ' +
        votingHtml +
        guessHtml +
        finishedHtml +
        '\n\n      <div class="row">\n        <a class="btn ghost" href="./">ホームへ</a>\n      </div>\n    </div>\n  '
    );
    var q = {};
    var v = getCacheBusterParam();
    if (v) q.v = v;
    q.room = roomId;
    return baseUrl() + '?' + buildQuery(q);
  }

  function makeHostUrl(roomId) {
    var q = {};
    var v = getCacheBusterParam();
    if (v) q.v = v;
    q.room = roomId;
    q.host = '1';
    return baseUrl() + '?' + buildQuery(q);
  }

  function routeHome() {
    renderHome(viewEl);
    var joinBtn = document.getElementById('goJoin');
    if (joinBtn) {
      joinBtn.addEventListener('click', function () {
        var ridEl = document.getElementById('joinRoomId');
        var rid = String((ridEl && ridEl.value) || '').trim();
        if (!rid) return;
        var q = {};
        var v = getCacheBusterParam();
        if (v) q.v = v;
        q.room = rid;
        setQuery(q);
        route();
      });
    }
  }

  function routeSetup() {
    renderSetup(viewEl);
    var saveBtn = document.getElementById('saveSetup');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        try {
          var cfg = readSetupForm();
          saveFirebaseConfigToLocalStorage(cfg);
        } catch (e) {
          renderError(viewEl, (e && e.message) || '保存に失敗しました');
          return;
        }

        firebaseReady()
          .then(function () {
            alert('保存しました。');
            var q = {};
            var v = getCacheBusterParam();
            if (v) q.v = v;
            setQuery(q);
            route();
          })
          .catch(function (e) {
            renderError(viewEl, (e && e.message) || '保存に失敗しました');
          });
      });
    }
  }

  function routeCreate() {
    renderCreate(viewEl);

    var pickBtn = document.getElementById('pickRandom');
    if (pickBtn) {
      pickBtn.addEventListener('click', function () {
        var el = document.getElementById('topicCategory');
        var catId = String((el && el.value) || TOPIC_CATEGORIES[0].id);
        try {
          var picked = pickRandomPair(catId);
          var mj = document.getElementById('majorityWord');
          var mn = document.getElementById('minorityWord');
          if (mj) mj.value = picked.majority;
          if (mn) mn.value = picked.minority;
        } catch (e) {
          alert((e && e.message) || '出題に失敗しました');
        }
      });
    }

    var createBtn = document.getElementById('createRoom');
    if (createBtn) {
      createBtn.addEventListener('click', function () {
        var settings;
        try {
          settings = readCreateForm();
        } catch (e) {
          renderError(viewEl, (e && e.message) || '作成に失敗しました');
          return;
        }
        var roomId = makeRoomId();
        firebaseReady()
          .then(function () {
            return createRoom(roomId, settings);
          })
          .then(function () {
            var playerId = getOrCreatePlayerId(roomId);
            return joinPlayerInRoom(roomId, playerId, settings.gmName).then(function (room) {
              if (!room || !room.players || !room.players[playerId]) {
                throw new Error('GMの参加に失敗しました');
              }
              return room;
            });
          })
          .then(function () {
            var q = {};
            var v = getCacheBusterParam();
            if (v) q.v = v;
            q.room = roomId;
            q.host = '1';
            setQuery(q);
            route();
          })
          .catch(function (e) {
            renderError(viewEl, (e && e.message) || '作成に失敗しました');
          });
      });
    }
  }

  function routeJoin(roomId, isHost) {
    renderJoin(viewEl, roomId);
    var joinBtn = document.getElementById('join');
    if (!joinBtn) return;

    joinBtn.addEventListener('click', function () {
      var form;
      try {
        form = readJoinForm();
      } catch (e) {
        renderError(viewEl, (e && e.message) || '参加に失敗しました');
        return;
      }

      firebaseReady()
        .then(function () {
          var playerId = getOrCreatePlayerId(roomId);
          return joinPlayerInRoom(roomId, playerId, form.name).then(function (room) {
            if (!room || !room.players || !room.players[playerId]) {
              throw new Error('参加できません（ゲームが開始済みです）');
            }
            return playerId;
          });
        })
        .then(function () {
          var q = {};
          var v = getCacheBusterParam();
          if (v) q.v = v;
          q.room = roomId;
          q.player = '1';
          if (isHost) q.host = '1';
          setQuery(q);
          route();
        })
        .catch(function (e) {
          renderError(viewEl, (e && e.message) || '参加に失敗しました');
        });
    });
  }

  function routeHost(roomId) {
    var unsub = null;
    var joinUrl = makeJoinUrl(roomId);
    var hostUrl = makeHostUrl(roomId);

    function drawQr() {
      return new Promise(function (resolve) {
        var canvas = document.getElementById('qr');
        var errEl = document.getElementById('qrError');
        var wrapEl = document.getElementById('qrWrap');
        if (errEl) errEl.textContent = '';
        if (!canvas) {
          if (errEl) errEl.textContent = 'QR表示領域が見つかりません。';
          return resolve();
        }

        var qr = window.QRCode || window.qrcode || window.QR;
        if (!qr || !qr.toCanvas) {
          if (errEl) errEl.textContent = 'QRの生成に失敗しました（ライブラリ未読込）。URLをコピーして配布してください。';
          return resolve();
        }

        function showAsImage() {
          if (!qr.toDataURL || !wrapEl) return;
          try {
            qr.toDataURL(joinUrl, { margin: 1, width: 240 }, function (err, url) {
              if (err || !url) {
                if (errEl) errEl.textContent = 'QRの生成に失敗しました。URLをコピーして配布してください。';
                return resolve();
              }
              wrapEl.innerHTML = '<img id="qrImg" alt="QR" src="' + escapeHtml(url) + '" />';
              if (errEl) errEl.textContent = '（QRは画像で表示しています）';
              return resolve();
            });
          } catch (e) {
            if (errEl) errEl.textContent = 'QRの生成に失敗しました。URLをコピーして配布してください。';
            return resolve();
          }
        }

        function looksBlank(c) {
          try {
            var ctx = c.getContext && c.getContext('2d');
            if (!ctx) return true;
            var w = c.width || 0;
            var h = c.height || 0;
            if (!w || !h) return true;
            // sample a few pixels; if all fully transparent or all white-ish, treat as blank
            var img = ctx.getImageData(0, 0, Math.min(16, w), Math.min(16, h)).data;
            var allZero = true;
            var allWhite = true;
            for (var i = 0; i < img.length; i += 4) {
              var r = img[i], g = img[i + 1], b = img[i + 2], a = img[i + 3];
              if (a !== 0) allZero = false;
              if (!(a !== 0 && r > 240 && g > 240 && b > 240)) allWhite = false;
              if (!allZero && !allWhite) return false;
            }
            return allZero || allWhite;
          } catch (e) {
            // If we can't read pixels, don't assume blank.
            return false;
          }
        }

        try {
          qr.toCanvas(canvas, joinUrl, { margin: 1, width: 240 }, function (err) {
            if (err) {
              if (errEl) errEl.textContent = 'QRの生成に失敗しました。URLをコピーして配布してください。';
              showAsImage();
              return;
            }
            if (looksBlank(canvas)) {
              showAsImage();
              return;
            }
            resolve();
          });
        } catch (e) {
          if (errEl) errEl.textContent = 'QRの生成に失敗しました。URLをコピーして配布してください。';
          showAsImage();
        }
      });
    }

    function renderWithRoom(room) {
      renderHostQr(viewEl, { roomId: roomId, joinUrl: joinUrl, hostUrl: hostUrl, room: room });
      drawQr();

      var startGameBtn = document.getElementById('startGame');
      if (startGameBtn)
        startGameBtn.addEventListener('click', function () {
          startGame(roomId).catch(function (e) {
            alert((e && e.message) || '失敗');
          });
        });

      var revealNextBtn = document.getElementById('revealNext');
      if (revealNextBtn)
        revealNextBtn.addEventListener('click', function () {
          revealAfterVoting(roomId).catch(function (e) {
            alert((e && e.message) || '失敗');
          });
        });

      var copyJoin = document.getElementById('copyJoin');
      if (copyJoin)
        copyJoin.addEventListener('click', function () {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(joinUrl).catch(function () {
              prompt('コピーしてください', joinUrl);
            });
          } else {
            prompt('コピーしてください', joinUrl);
          }
        });
    }

    firebaseReady()
      .then(function () {
        return subscribeRoom(roomId, function (room) {
          if (!room) {
            renderError(viewEl, '部屋が見つかりません');
            return;
          }
          renderWithRoom(room);
        });
      })
      .then(function (u) {
        unsub = u;
      })
      .catch(function (e) {
        renderError(viewEl, (e && e.message) || 'Firebase接続に失敗しました');
      });

    window.addEventListener('popstate', function () {
      if (unsub) unsub();
    });
  }

  function routePlayer(roomId, isHost) {
    var playerId = getOrCreatePlayerId(roomId);
    var unsub = null;
    var timerHandle = null;
    var autoVoteRequested = false;

    function rerenderTimer(room) {
      var el = document.getElementById('timer');
      if (!el) return;
      var endAt = room && room.discussion && room.discussion.endsAt ? room.discussion.endsAt : 0;
      var remain = Math.max(0, Math.floor((endAt - (Date.now ? Date.now() : new Date().getTime())) / 1000));
      el.textContent = formatMMSS(remain);
    }

    firebaseReady()
      .then(function () {
        return subscribeRoom(roomId, function (room) {
          if (!room) {
            renderError(viewEl, '部屋が見つかりません');
            return;
          }

          var player = room.players ? room.players[playerId] : null;
          renderPlayer(viewEl, { roomId: roomId, playerId: playerId, player: player, room: room, isHost: isHost });

          if ((room && room.phase) !== 'discussion') autoVoteRequested = false;

          if (timerHandle) clearInterval(timerHandle);
          timerHandle = setInterval(function () {
            rerenderTimer(room);
            if (!autoVoteRequested && room && room.phase === 'discussion') {
              var endAt = room.discussion && room.discussion.endsAt ? room.discussion.endsAt : 0;
              if (endAt && nowMs() >= endAt) {
                autoVoteRequested = true;
                autoStartVotingIfEnded(roomId);
              }
            }
          }, 250);

          var submitGuessBtn = document.getElementById('submitGuess');
          if (submitGuessBtn) {
            submitGuessBtn.addEventListener('click', function () {
              var el = document.getElementById('guessText');
              var guessText = String((el && el.value) || '').trim();
              if (!guessText) return;
              submitGuess(roomId, playerId, guessText).catch(function (e) {
                alert((e && e.message) || '失敗');
              });
            });
          }

          var voteBtn = document.getElementById('submitVote');
          if (voteBtn) {
            voteBtn.addEventListener('click', function () {
              var el2 = document.getElementById('voteTo');
              var toPlayerId = String((el2 && el2.value) || '').trim();
              if (!toPlayerId) return;
              submitVote(roomId, playerId, toPlayerId).catch(function (e) {
                alert((e && e.message) || '失敗');
              });
            });
          }
        });
      })
      .then(function (u) {
        unsub = u;
      })
      .catch(function (e) {
        renderError(viewEl, (e && e.message) || 'Firebase接続に失敗しました');
      });

    window.addEventListener('popstate', function () {
      if (unsub) unsub();
      if (timerHandle) clearInterval(timerHandle);
    });
  }

  function route() {
    var q = parseQuery();
    var screen = q.screen ? String(q.screen) : '';
    var st = getUrlState();
    var roomId = st.roomId;
    var isHost = st.isHost;
    var isPlayer = q.player === '1';

    if (screen === 'setup') return routeSetup();
    if (screen === 'create') return routeCreate();

    if (!roomId) return routeHome();

    if (screen === 'join') return routeJoin(roomId, isHost);
    if (isPlayer) return routePlayer(roomId, isHost);
    if (isHost) return routeHost(roomId);

    return routeJoin(roomId, false);
  }

  // boot
  try {
    viewEl = qs('#view');
    var buildInfoEl = document.querySelector('#buildInfo');
    if (buildInfoEl) {
      var assetV = getCacheBusterParam();
      buildInfoEl.textContent = 'v0.9 (gm-first + auto vote + reveal flow)' + (assetV ? ' / assets ' + assetV : '');
    }

    window.addEventListener('popstate', function () {
      route();
    });

    try {
      ensureUrlHasCacheBuster();
    } catch (e1) {
      // Some environments can throw on history.pushState; ignore and continue.
      try {
        if (typeof console !== 'undefined' && console && console.warn) console.warn('ensureUrlHasCacheBuster failed', e1);
      } catch (e2) {
        // ignore
      }
    }

    try {
      route();
    } catch (e3) {
      try {
        if (typeof console !== 'undefined' && console && console.error) console.error('route failed', e3);
      } catch (e4) {
        // ignore
      }
      var v2 = document.getElementById('view');
      if (v2) {
        v2.innerHTML =
          '<div class="stack"><div class="badge">エラー</div><div class="big">起動できません</div><div class="muted">詳細: ' +
          escapeHtml((e3 && e3.message) || String(e3)) +
          '</div></div>';
      }
    }
  } catch (e) {
    try {
      if (typeof console !== 'undefined' && console && console.error) console.error('boot failed', e);
    } catch (e5) {
      // ignore
    }
    var el = document.getElementById('view');
    if (el) {
      el.innerHTML =
        '<div class="stack"><div class="badge">エラー</div><div class="big">起動できません</div><div class="muted">この端末のブラウザが古い可能性があります。</div><div class="muted">詳細: ' +
        escapeHtml((e && e.message) || String(e)) +
        '</div></div>';
    }
  }
})();

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

  function copyTextToClipboard(text) {
    var t = String(text == null ? '' : text);
    if (!t) return Promise.resolve(false);

    try {
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard
          .writeText(t)
          .then(function () {
            return true;
          })
          .catch(function () {
            return false;
          });
      }
    } catch (e) {
      // ignore
    }

    try {
      var ta = document.createElement('textarea');
      ta.value = t;
      ta.setAttribute('readonly', 'readonly');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.left = '-1000px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      var ok = false;
      try {
        ok = document.execCommand && document.execCommand('copy');
      } catch (e2) {
        ok = false;
      }
      document.body.removeChild(ta);
      return Promise.resolve(!!ok);
    } catch (e3) {
      return Promise.resolve(false);
    }
  }

  function nowMs() {
    return Date.now ? Date.now() : new Date().getTime();
  }

  function randomInt(maxExclusive) {
    var max = Math.floor(Math.abs(maxExclusive || 0));
    if (!max) return 0;
    try {
      if (typeof crypto !== 'undefined' && crypto.getRandomValues && typeof Uint32Array !== 'undefined') {
        // Rejection sampling to avoid modulo bias
        var limit = Math.floor(4294967296 / max) * max;
        var buf = new Uint32Array(1);
        while (true) {
          crypto.getRandomValues(buf);
          var x = buf[0] >>> 0;
          if (x < limit) return x % max;
        }
      }
    } catch (e) {
      // ignore
    }
    return Math.floor(Math.random() * max);
  }

  // TEMP (testing): force discussion time to 10 seconds.
  // Revert later by setting to 0 (or removing override).
  var FORCE_TALK_SECONDS = 0;

  // Codenames: long-press duration (ms) to confirm a card pick.
  // Short tap = pending toggle.
  var CN_LONG_PRESS_MS = 700;

  // Firebase server time correction (helps devices with clock drift / iOS timer lag)
  var _serverTimeOffsetMs = 0;
  function serverNowMs() {
    return nowMs() + (_serverTimeOffsetMs || 0);
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
        if (s && s.src) {
          var ss = String(s.src);
          if (ss.indexOf('app.js') !== -1 || ss.indexOf('bbg.js') !== -1) {
          src = String(s.src);
          break;
          }
        }
      }
    }

    _bundledAssetV = getScriptQueryParam(src, 'v') || '';
    return _bundledAssetV;
  }

  function getCacheBusterParam() {
    // Prefer the version baked into the currently-loaded script tag.
    // This prevents old bookmarked URLs like ?v=20251228u from pinning the app to an old asset version.
    var bundled = getBundledAssetVersion();
    if (bundled) return String(bundled);
    var q = parseQuery();
    if (q.v) return String(q.v);
    return '';
  }

  function ensureUrlHasCacheBuster() {
    var q = parseQuery();
    var bundled = getBundledAssetVersion();
    if (!bundled) return;
    // If missing or different, overwrite to the bundled asset version.
    if (q.v && String(q.v) === String(bundled)) return;
    q.v = String(bundled);
    setQuery(q);
  }

  // -------------------- topics --------------------
  var TOPIC_CATEGORIES = [
    {
      id: 'general',
      name: '一般',
      pairs: [
        ['Google', 'Yahoo'],
        ['マクドナルド', 'モスバーガー'],
        ['ロッテリア', 'モスバーガー'],
        ['ガスト', 'サイゼリア'],
        ['吉野家', 'すきや'],
        ['docomo', 'softbank'],
        ['スタバ', 'ドトール'],
        ['セブンイレブン', 'ファミマ'],
        ['ローソン', 'ファミマ'],
        ['楽天市場', 'amazon'],
        ['任天堂', 'ソニー'],
        ['キリン', 'アサヒ'],
        ['TOYOTA', 'NISSAN'],
        ['目玉焼き', 'スクランブルエッグ'],
        ['鍋料理', 'おでん'],
        ['チョコレート', 'キャラメル'],
        ['コーヒー', '紅茶'],
        ['日本酒', 'ウィスキー'],
        ['にんにく', 'しょうが'],
        ['白菜', 'キャベツ'],
        ['ゆで卵', '生卵'],
        ['かき氷', 'アイスクリーム'],
        ['スイカ', 'メロン'],
        ['お茶漬け', 'ふりかけ'],
        ['塩', '砂糖'],
        ['りんご', 'なし'],
        ['うどん', 'そうめん']
      ]
    },
    {
      id: 'general_hard',
      name: '一般（難しい）',
      pairs: [
        ['ポッキー', 'トッポ'],
        ['アンパン', 'あんまん'],
        ['幼稚園', '保育園'],
        ['ボールペン', 'シャープペン'],
        ['ファミチキ', 'からあげくん'],
        ['青', '水色'],
        ['ポイントカード', 'クレジットカード'],
        ['色鉛筆', 'クレヨン'],
        ['不倫', '浮気'],
        ['トマトパスタ', 'クリームパスタ'],
        ['餃子', 'シューマイ'],
        ['友達', '親友'],
        ['パチンコ', 'スロット'],
        ['石鹸', 'ハンドソープ'],
        ['レモン', 'グレープフルーツ'],
        ['スキー', 'スノボー'],
        ['コカコーラ', 'ペプシ'],
        ['野球', 'ソフトボール'],
        ['肉まん', 'ピザまん'],
        ['ポカリスエット', 'アクエリアス'],
        ['サッカー', 'ラグビー'],
        ['パンツ', '財布'],
        ['１億円', '１０００万円'],
        ['炎', '赤'],
        ['桃太郎', '鬼滅の刃'],
        ['時間', 'お金'],
        ['痴漢', '鬼ごっこ'],
        ['赤ちゃん', 'ハムスター'],
        ['ウォータースライダー', '流しそうめん'],
        ['母乳', '青汁（もしくは、豆乳か牛乳）'],
        ['恋人', 'おおきなぬいぐるみ'],
        ['荷物検査', '職務質問'],
        ['お好み焼き', 'ピザ'],
        ['リコーダー', 'ペロペロキャンディ'],
        ['アクリルスタンド', '将棋の駒'],
        ['残業', '転売'],
        ['ロボット', '幽霊'],
        ['ピアノ', 'パソコン'],
        ['サンタクロース', '忍者'],
        ['自転車', '冷蔵庫'],
        ['トランプ', 'スマホ'],
        ['コンビニ', '自動販売機'],
        ['プリン', '温泉卵']


      ]
    },
    {
      id: 'anime_game',
      name: 'アニメ・ゲーム',
      pairs: [
          ['ドラえもん', 'アンパンマン'],
          ['ポケットモンスター', 'デジモン'],
          ['ピカチュウ', 'ミッキーマウス'],
          ['マリオ', 'ルイージ'],
          ['ドラゴンボール', 'ワンピース'],
          ['サザエさん', 'ちびまる子ちゃん'],
          ['トトロ', 'くまのプーさん'],
          ['名探偵コナン', '金田一少年の事件簿'],
          ['セーラームーン', 'プリキュア'],
          ['クレヨンしんちゃん', '天才バカボン'],
          ['ガンダム', 'エヴァンゲリオン'],
          ['ニンテンドースイッチ', 'プレイステーション'],
          ['ゲームボーイ', 'たまごっち'],
          ['ストリートファイター', 'スマッシュブラザーズ'],
          ['マインクラフト', 'レゴブロック'],
          ['どうぶつの森', 'たまごっち'],
          ['ハローキティ', 'マイメロディ'],
          ['ジブリ', 'ディズニー'],
          ['ルパン三世', '怪盗キッド'],
          ['太鼓の達人', 'ダンスダンスレボリューション'],
          ['ピカチュウ', 'くまのプーさん']
      ]
    },
    {
      id: 'love',
      name: '男女',
      pairs: [
        ['片思い', '失恋'],
        ['ファーストキス', '初デート'],
        ['LINEで告白', '手紙で告白'],
        ['束縛系', 'ストーカー'],
        ['筋肉フェチ', '手フェチ'],
        ['声フェチ', '匂いフェチ'],
        ['高収入の異性', '高身長の異性'],
        ['誠実な恋人', '優しい恋人'],
        ['好みの顔の異性', '好みの体系の異性'],
        ['金銭感覚が合う', '趣味が合う'],
        ['笑顔が素敵な異性', 'ユーモアがある異性'],
        ['肉食男子', '草食男子'],
        ['水族館デート', '動物園デート'],
        ['カラオケデート', '映画館デート'],
        ['花畑デート', '牧場デート'],
        ['浮気', '性格の不一致'],
        ['結婚', '同棲'],
        ['約束を破る恋人', '悪口を言う恋人'],
        ['煙草をたくさん吸う異性', 'お酒をたくさん飲む異性'],
        ['浪費癖がある恋人', 'スマホ中毒の恋人'],
        ['社内恋愛', '校内恋愛'],
        ['話しが合う異性', 'ユーモアがある異性'],
        ['制服デート', '浴衣デート'],
        ['誕生日プレゼント', 'サプライズプレゼント'],
        ['かわいい系', 'キレイ系'],
        ['ツンデレ', 'ヤンデレ'],
        ['母乳', '牛乳'],
        ['パンツ', '財布'],
        ['初めてのおつかい', '初めてのキス'],
        ['盆踊り', 'ラジオ体操'],
        ['かくれんぼ', '痴漢'],
        ['トランクス', 'ブリーフ'],
        ['おなら', 'しゃっくり'],
        ['1億円貰ったら', '10万円貰ったら'],
        ['絵本', 'エロ本']
      ]
    },
    {
      id: 'shimoneta',
      name: 'ド下ネタ',
      pairs: [
        ['スパンキング', 'ピアッシング'],
        ['口内射精', '顔射'],
        ['乱交', '公開プレイ'],
        ['裸ネクタイ', '裸靴下'],
        ['早漏', '絶倫'],
        ['催眠', '睡眠姦'],
        ['嘔吐', '放尿'],
        ['乗馬マシン', '三角木馬'],
        ['青姦', '痴漢'],
        ['鼻水', '涎'],
        ['セルフフェラ', 'アナニー'],
        ['足コキ', '手コキ'],
        ['スライム姦', '触手姦'],
        ['パンツ', '靴下'],
        ['セックス', 'スポーツ'],
        ['竿', '金玉'],
        ['BL', 'AV'],
        ['早漏', '頻尿'],
        ['ローション', '我慢汁'],
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

  function pickRandomPairAny() {
    if (!TOPIC_CATEGORIES.length) throw new Error('候補がありません');
    var idx = Math.floor(Math.random() * TOPIC_CATEGORIES.length);
    return pickRandomPair(TOPIC_CATEGORIES[idx].id);
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
            var db = firebase.database();

            // Keep an approximate server clock for consistent timers across devices.
            try {
              db.ref('.info/serverTimeOffset').on('value', function (snap) {
                var v = snap && snap.val ? snap.val() : 0;
                _serverTimeOffsetMs = parseIntSafe(v, 0) || 0;
              });
            } catch (e) {
              // ignore
            }

            return db;
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

  // -------------------- codenames (state) --------------------
  function getOrCreateCodenamesPlayerId(roomId) {
    var key = 'cn_player_' + roomId;
    var id = localStorage.getItem(key);
    if (!id) {
      id = randomId(12);
      localStorage.setItem(key, id);
    }
    return id;
  }

  function codenamesRoomPath(roomId) {
    return 'codenamesRooms/' + roomId;
  }

  function codenamesPlayerPath(roomId, playerId) {
    return codenamesRoomPath(roomId) + '/players/' + playerId;
  }

  function subscribeCodenamesRoom(roomId, cb) {
    return onValue(codenamesRoomPath(roomId), cb);
  }

  function parseWordListText(text) {
    var s = String(text || '');
    s = s.replace(/\r\n/g, '\n');
    s = s.replace(/\r/g, '\n');
    // accept newline / comma / Japanese comma / tab
    var parts = s.split(/[\n,、\t]+/);
    var out = [];
    var seen = {};
    for (var i = 0; i < parts.length; i++) {
      var w = String(parts[i] || '').trim();
      if (!w) continue;
      if (seen[w]) continue;
      seen[w] = true;
      out.push(w);
    }
    return out;
  }

  // Built-in word pool for Codenames (no in-app word registration).
  var CODENAMES_WORDS = [
    '会議',
    '麻痺',
    '消しゴム',
    '筆',
    'たいあたり',
    'なめくじ',
    '熱帯夜',
    'えんぴつ',
    '鉛',
    '賢者',
    '霊',
    '気球',
    'エルフ',
    'たんぽぽ',
    '乗客',
    'ごはん',
    '焼き肉',
    'トランクス',
    '虫歯',
    '入れ歯',
    '写真',
    'ウエハース',
    'モーニング',
    'ミッション',
    'リュック',
    'マジック',
    'サプリメント',
    '箸',
    '電気',
    '北朝鮮',
    'アウェイ',
    '老眼',
    '視力',
    '反省会',
    '魔法使い',
    '僧侶',
    '戦士',
    '武闘家',
    '舞台',
    'マッスル',
    '筋肉',
    '咳',
    'サウナ',
    '麻薬',
    '税金',
    '女優',
    '歌手',
    'タレント',
    'お洒落',
    '砂漠',
    '原始人',
    'バンザイ',
    'エコ',
    '発表会',
    'ＡＩ',
    '運動会',
    '遠足',
    'スマホ',
    'テレビ',
    '電話',
    'リモコン',
    'リモート',
    'キックボード',
    '原付',
    'カッター',
    'ハサミ',
    '羊',
    '扇風機',
    '肩凝り',
    '約束',
    '頭痛',
    'オンライン',
    'カーテン',
    'カードゲーム',
    '消毒',
    'アルコール',
    'ゴキブリ',
    'カブトムシ',
    'カタツムリ',
    'クワガタ',
    'セミ',
    'おじいちゃん',
    'カマキリ',
    '幼虫',
    '封筒',
    '納豆',
    'ネギ',
    '缶詰',
    '抽選',
    '宝くじ',
    'コンプレックス',
    '負債',
    '悩み',
    '肩車',
    'コンテスト',
    '魔法陣',
    '召喚',
    '悪魔',
    'ブラシ',
    '下水',
    '北海道',
    'ハッタリ',
    'はまぐり',
    'イチゴ',
    '宿題',
    'アウトドア',
    '七五三',
    '袴',
    'ボージョレ・ヌーボー',
    '辞典',
    '掲示板',
    'やまんば',
    '魔法少女',
    '無制限',
    'ウクレレ',
    'フラダンス',
    'ステーキ',
    'パニック',
    '習い事',
    'レンタカー',
    '電光石火',
    'ショック',
    '運転手',
    'パイオニア',
    '迷路',
    'メデューサ',
    '防水',
    '回覧板',
    'お地蔵様',
    'コンパクト',
    '努力',
    '渡り鳥',
    '権利',
    '肥料',
    '神社',
    '神殿',
    'プリンター',
    'ものまね',
    '占い',
    '漫画家',
    'アスリート',
    'エンジニア',
    'アシスタント',
    'UFO',
    '博士',
    'ギャグ',
    '画家',
    '無双',
    '気圧',
    '映え',
    '暇つぶし',
    'おうち時間',
    'ドライブレコーダー',
    'オーディション',
    'クラウドファンディング',
    '不倫',
    '防災グッズ',
    'ちゃぶ台',
    '矯正',
    '経営',
    '絶縁',
    '小判',
    '懸賞',
    '個人情報',
    'おみくじ',
    'タピオカ',
    'テレポート',
    'DNA',
    '暗黒',
    '血液',
    'モニター',
    '蛍光',
    'ホタル',
    'スキル',
    '派閥',
    'デラックス',
    '投資',
    'フリー',
    '出張',
    'お年玉',
    'おせち',
    '年賀状',
    'だるま落とし',
    '習字',
    'コマ',
    'けん玉',
    'ダーツ',
    'ボーリング',
    'ビリヤード',
    'ハンガー',
    '仮面',
    '注射',
    'エレベーター',
    '給食',
    'レポート',
    'どんぐり',
    '紅葉',
    '栗',
    '新生活',
    '入学',
    '双子',
    '親戚',
    'ホッカイロ',
    '赤ちゃん',
    '父',
    '飢餓',
    '湿度',
    'カビ',
    '温度',
    '熱',
    '型',
    'トリガー',
    'インプット',
    '抹茶',
    'モンブラン',
    'コーラ',
    '電子決済',
    'クレジットカード',
    'シフト',
    'ダイナマイト',
    'バカンス',
    '沖縄',
    'もずく',
    'ダイビング',
    'スノボー',
    'リフト',
    'ハイキング',
    '変装',
    '試験',
    '拳銃',
    '妨害',
    'タイマー',
    '黒幕',
    '術',
    '異世界',
    'ラブコメ',
    '恋人',
    '告白',
    'ラブレター',
    'デリバリー',
    '地上',
    '空',
    '敏感',
    '鈍感',
    '反射',
    'センサー',
    '怪物',
    'タヌキ',
    '心',
    '精神',
    '欠陥',
    'カウントダウン',
    'シャンパン',
    'シェアハウス',
    'カウンター',
    '出会い',
    'ヒロイン',
    '心理戦',
    'デザイン',
    'タクシー',
    'オバケ',
    '輪ゴム',
    '輪投げ',
    '鉄棒',
    'ヨーヨー',
    'ヒヨコ',
    '明太子',
    '支配人',
    '尻',
    '腰',
    'かかと',
    '肘',
    '膝',
    '天狗',
    '団子',
    'ワンピース',
    'アプリ',
    'アイテム',
    '脳トレ',
    'サーフィン',
    'ビーチ',
    'ショッピング',
    '不動産',
    'お絵描き',
    '蛾',
    'フリスビー',
    'チアリーダー',
    '応援歌',
    '詩',
    '偽善者',
    '発射',
    'ビンタ',
    'メリケンサック',
    'リーゼント',
    'エスカレーター',
    '耳鼻科',
    'ソーラーパネル',
    '神出鬼没',
    'ミミズ',
    '市民',
    '摩擦',
    'マインド',
    'イラスト',
    'パントマイム',
    'コピー',
    'コント',
    '小説',
    'デザイナー',
    '農業',
    '声優',
    '埋蔵金',
    '通訳',
    'ダイエット',
    '影武者',
    'トイレ',
    'ディナー',
    'モテ期',
    'ヨガ',
    '商店街',
    'ドッキリ',
    'カリスマ',
    'マンガ喫茶',
    'じゃんけん',
    'グルメ',
    'スキャンダル',
    'ゴール',
    'ダミー',
    '姿勢',
    'フランチャイズ',
    'クリエイター',
    'ご褒美',
    '民泊',
    'キャッシュバック',
    'ゾロ目',
    'カロリー',
    'タイムマシン',
    'ネッシー',
    '武将',
    'カヌー',
    'かさぶた',
    '波',
    'クッション',
    'CM',
    '王子',
    'ドーパミン',
    'ハーバリウム',
    'カステラ',
    'ほうき',
    'ちりとり',
    'スコップ',
    '帽子',
    '竹',
    '自販機',
    'お茶漬け',
    'かき',
    'カタログ',
    'ギフト',
    'ゼリー',
    '塩辛',
    '花札',
    '雛人形',
    'ブーメラン',
    '高速道路',
    'パーマ',
    'リゾット',
    'おかゆ',
    'タバコ',
    '矢印',
    '目玉',
    '織姫',
    'きのこ',
    'セミナー',
    '餅',
    'モップ',
    'こたつ',
    'マッサージ',
    '流れ星',
    '通り魔',
    '事件',
    '花壇',
    '木彫り',
    '介護士',
    'パパラッチ',
    'パパイヤ',
    'パンケーキ',
    'パイナップル',
    '薬局',
    'アンテナ',
    'カーナビ',
    'スパム',
    'ロコモコ',
    'ボランティア',
    '団体',
    '湿布',
    'スチュワーデス',
    '社長',
    '監督',
    'スピーカー',
    'スピーチ',
    'ファラオ',
    'ドラキュラ',
    '執事',
    'メイド',
    '喫茶店',
    'オムライス',
    'ポスター',
    'ラジオ体操',
    '網',
    'プラモデル',
    'キツネ',
    '絨毯',
    'バレリーナ',
    '跳び箱',
    'リズム',
    '葉巻',
    'ドラマ',
    'ペットボトル',
    '駐車場',
    'テーブル',
    'ねじ',
    'プロレス',
    'プロフェッショナル',
    'プリン',
    'フラミンゴ',
    'メロディー',
    '珊瑚礁',
    'マグロ',
    '数珠',
    'キャラメル',
    'アーモンド',
    'ポテトサラダ',
    'おにぎり',
    'ツナ',
    'ガスバーナー',
    'バッシング',
    'ふりかけ',
    '指紋',
    '入れ墨',
    '銭湯',
    'コロシアム',
    'バジル',
    '脂肪',
    'おなか',
    '背中',
    '内蔵',
    'ウコン',
    'エキス',
    'ライセンス',
    'コンクリート',
    '倉庫',
    '補聴器',
    '墓地',
    'ぼったくり',
    '水泳',
    'シロップ',
    'モアイ',
    'グッズ',
    'ペンダント',
    '懐中電灯',
    '競馬',
    '定規',
    'コンパス',
    'スキップ',
    '水筒',
    '上司',
    '部下',
    '新入社員',
    '地平線',
    'フランケンシュタイン',
    '噂話',
    'スキンシップ',
    '東京タワー',
    '心臓',
    '防弾チョッキ',
    'ご当地キャラ',
    'シークヮーサー',
    'ハイビスカス',
    'K-POP',
    'コスメ',
    '万里の長城',
    'チャイナドレス',
    '小籠包',
    'エアーズロック',
    'ハンター',
    '旅行',
    '職業',
    '怪談',
    '湯気',
    'サンドイッチ',
    'ハプニング',
    '俳句',
    'テーマパーク',
    '天体観測',
    '事故',
    '大暴落',
    '賞金',
    '寄生虫',
    '自作',
    '炎上',
    'スイーツ',
    '深夜',
    'オーロラ',
    'あやとり',
    'オマケ',
    'ベストセラー',
    '日焼け止め',
    '叫び声',
    '傷',
    'めだか',
    'ダンベル',
    'トレーニング',
    'ウェア',
    'ブランド',
    '口紅',
    '指輪',
    'ネックレス',
    '研究',
    'テーマ',
    '実験',
    '法律',
    '平原',
    'ダニ',
    'ストーブ',
    'コウモリ',
    '将棋',
    '囲碁',
    '未来予知',
    'オセロ',
    'トランプ',
    'かるた',
    '通帳',
    'タイピング',
    'ソフト',
    '罰',
    '唐辛子',
    'ハンバーグ',
    '弁当',
    '箱',
    '屋台',
    '飴',
    'グミ',
    'エリア',
    'トラウマ',
    'ハッスル',
    'サビ',
    'たんこぶ',
    '甘酒',
    '饅頭',
    '鼻水',
    'にきび',
    'リサイクル',
    'パートナー',
    'フレンド',
    'マスター',
    'パズル',
    '煮干し',
    '出汁',
    'こんぶ',
    '水鉄砲',
    'ピーマン',
    'フライパン',
    'ブラック企業',
    '転職',
    'ヘッドハンティング',
    '体温計',
    'マイナスイオン',
    '積み木',
    'やかん',
    'ハイボール',
    '麻酔',
    'ココナッツ',
    'コインランドリー',
    'テレパシー',
    '保険',
    '朝市',
    'ハト',
    'バザー',
    'セール',
    '接待',
    '朝帰り',
    '四国',
    'ムエタイ',
    '空手',
    '柔道',
    '道着',
    '深呼吸',
    'チェリー',
    'うに',
    '礼儀',
    'エクササイズ',
    '終電',
    '梅干し',
    '酢',
    '三輪車',
    'シャボン玉',
    'ビジネス',
    'チャット',
    '花火',
    'ろうそく',
    'ラクダ',
    'ワニ',
    'にんじん',
    '信号',
    'アザラシ',
    'カレンダー',
    'ボンベ',
    'ヒマワリ',
    'チューリップ',
    'レンズ',
    '水着',
    '露天風呂',
    '泡',
    '兜',
    'レントゲン',
    'スマイル',
    'プレイヤー',
    '誕生日',
    'サプライズ',
    '年金',
    '粘土',
    '腱鞘炎',
    'インターネット',
    'インタビュー',
    '常連',
    'いたずら',
    '貯金',
    'アレルギー',
    '空き家',
    '職人',
    '火事',
    'ショートカット',
    '卒業',
    'お盆',
    'フェス',
    'コアラ',
    '変身',
    'ステッキ',
    'ミリオンヒット',
    'ちんすこう',
    '泡盛',
    'シーサー',
    'サーターアンダギー',
    '韓流',
    'サムギョプサル',
    'ビビンバ',
    'チヂミ',
    '冷麺',
    '三国志',
    'ハンドメイド',
    '料理家',
    '棋士',
    '給料日',
    '恩返し',
    '婚活',
    '交番',
    'VR',
    'ニート',
    'チャック',
    'メッセージ',
    '予言',
    '沈没船',
    'カメラ',
    'ラジカセ',
    'ターゲット',
    '思い出',
    'キャッシュレス',
    'くじ引き',
    '家庭菜園',
    '残像',
    'レシート',
    '大人買い',
    '別荘',
    '保湿',
    '冷房',
    '暖房',
    '空気清浄機',
    '蔵',
    '串',
    '枯れ葉',
    '傘',
    '誘拐',
    'コンビニ',
    '新幹線',
    '換気扇',
    'クイズ',
    'ヒール',
    '睡眠薬',
    'オーダー',
    'レンタル',
    'ファミレス',
    'チェーン',
    '神様',
    '大仏',
    '細胞',
    'パフェ',
    'かき氷',
    'サングラス',
    '磁石',
    'マント',
    'パソコン',
    'カラオケ',
    'マイク',
    'はてな',
    'ノスタルジー',
    '代表',
    '覗き',
    '目隠し',
    '魔王',
    '親衛隊',
    'ポケベル',
    '経験値',
    'ガムテープ',
    '段ボール',
    '切手',
    'たこ焼き',
    'お好み焼き',
    'キムチ',
    'うなぎ',
    'マンション',
    '暗号',
    'タオル',
    'サンダル',
    '新作',
    '税理士',
    'コントロール',
    'ひつまぶし',
    '割り勘',
    'おごり',
    'ジェル',
    '焚き火',
    '薪',
    'カスタマイズ',
    'ゴーヤ',
    'すき焼き',
    'スイートルーム',
    '天むす',
    'きしめん',
    'ういろう',
    '手羽先',
    'おでん',
    'みかん',
    'ドーム',
    '寝癖',
    'コンタクト',
    'シールド',
    'ヨット',
    '雲',
    'わた菓子',
    'フランクフルト',
    '焼きそば',
    '味噌',
    'ヨーグルト',
    '乙女',
    'セメント',
    '金髪',
    '白髪',
    '忠誠',
    '中古',
    '闇鍋',
    'ミキサー',
    '餃子',
    'しゃぶしゃぶ',
    '乳酸菌',
    'ループ',
    '力士',
    '木材',
    '接着剤',
    '溶接',
    '工事',
    'コイン',
    'クレヨン',
    'リコーダー',
    'ランドセル',
    '甲子園',
    '祭り',
    '人魚',
    'イカ',
    '大気圏',
    '隕石',
    '賄賂',
    '家紋',
    '花粉',
    '通路',
    'スライディング',
    'ハンドル',
    '原子力',
    '奴隷',
    '競り',
    'オークション',
    '無人',
    '卓球',
    'ダウンロード',
    'コンテンツ',
    'アウトプット',
    '仙人',
    '哺乳瓶',
    'おむつ',
    'ポーチ',
    'マフラー',
    'タンバリン',
    '手品',
    'ハンカチ',
    'ティッシュ',
    'ボックス',
    'ガチャ',
    'ブログ',
    'リメイク',
    '雑踏',
    'ザリガニ',
    'エビ',
    '暖炉',
    'ゲリラ',
    '発泡スチロール',
    '金属',
    '肝試し',
    '放火',
    '歯車',
    '副業',
    'フリーター',
    '布団',
    'ふるさと納税',
    'お祝い',
    '化石',
    'アカウント',
    '人気者',
    '家事',
    '和尚',
    '妖怪',
    'ノーベル賞',
    'CD',
    'アタック',
    'ストッパー',
    'トレーナー',
    'リフレッシュ',
    '模様替え',
    '移住',
    '形見',
    'フォロワー',
    '世界一周',
    'ワンオペ',
    '唐揚げ',
    'いかだ',
    'トランシーバー',
    '毛布',
    'ジャングルジム',
    'ブランコ',
    '滑り台',
    '絆創膏',
    'ストッキング',
    'リップ',
    'マシュマロ',
    '電子書籍',
    'マッチング',
    '基地',
    'アルバイト',
    'マヨネーズ',
    '怪盗',
    '殺人鬼',
    '脅迫',
    '念力',
    '移籍',
    '電池',
    'ノイズ',
    '畑',
    'ニュース',
    'ワクチン',
    'ウイルス',
    '配信',
    'キャンセル',
    'ポリシー',
    '都市',
    'ラーメン',
    'しょうが',
    'ニンニク',
    'うどん',
    'パスタ',
    '腐敗',
    '研修',
    '被害',
    '交渉',
    '更新',
    '感染',
    'パーフェクト',
    'トップ',
    '帰省',
    '健康診断',
    '充電',
    'エネルギー',
    '濃厚',
    '入院',
    'サーキット',
    'サーキュレーター',
    'ドーピング',
    'ドッペルゲンガー',
    '怪力',
    '呼吸',
    '酸素',
    '独裁者',
    '総理大臣',
    '大統領',
    '選挙',
    '出勤',
    'パジャマ',
    '空港',
    'ゴミ',
    'アイス',
    '包丁',
    '攻撃',
    '防御',
    '議論',
    '休暇',
    '映画',
    'ランニング',
    '散歩',
    '筋トレ',
    'プロテイン',
    '水分',
    '雨音',
    '眩暈',
    '海',
    '浮き輪',
    'ゴーグル',
    '地下',
    '人混み',
    'ブーム',
    '天然',
    'ストレス',
    '骨',
    '自宅',
    '異端',
    'サブカル',
    'ヤンデレ',
    'クソリプ',
    '焼き鳥',
    '八ツ橋',
    '金閣寺',
    '舞妓',
    '科学',
    'サブスク',
    'アパレル',
    '素材',
    '課金',
    'シャツ',
    'シャッフル',
    '落書き',
    '生命',
    '大阪',
    'メロン',
    'ジンギスカン',
    '通販',
    'アナウンス',
    '施設',
    '動物園',
    '水族館',
    '災害',
    '派遣',
    '台風',
    '自衛隊',
    'サラリーマン',
    '戦略',
    '安全',
    '避難',
    'カフェイン',
    'くぎ',
    'オリジナル',
    '透明',
    'エアコン',
    '冷蔵庫',
    '転生',
    '体質',
    '滝',
    '修行',
    'クーポン',
    '営業',
    '芸人',
    'スロット',
    '群れ',
    'バトル',
    '融合',
    '滑舌',
    'ひな祭り',
    'エイプリルフール',
    'ホワイト',
    '競合',
    '迷子',
    '爆笑',
    '倍返し',
    'ボーナス',
    '寝坊',
    'ファッション',
    'インドア',
    'ログイン',
    'おひとり様',
    'ビーム',
    '坊主',
    'アンバサダー',
    'アドレス',
    'DVD',
    '無料',
    'どんでん返し',
    '破局',
    '登山',
    '縁起物',
    '発明品',
    '悪夢',
    'ビンゴ',
    'クーリングオフ',
    'やんちゃ',
    '幻覚',
    'ATM',
    'なると',
    '七光り',
    '刺身',
    '継承',
    '品種改良',
    'シングル',
    'ライフ',
    'サポーター',
    'ファイナル',
    '馬車',
    'ステッカー',
    'ワッペン',
    'スクランブル',
    'スランプ',
    '後遺症',
    '更衣室',
    '好感度',
    '高所恐怖症',
    '突然変異',
    '景品',
    '電卓',
    '資格',
    'マニア',
    '免許証',
    'わびさび',
    'おもてなし',
    'スクープ',
    'ストイック',
    'フライング',
    '修羅場',
    'タブー',
    '観覧車',
    'ジェットコースター',
    'メリーゴーランド',
    'バンジージャンプ',
    'タスク',
    'オパール',
    'グアム',
    'ツアー',
    'ツーリング',
    '欲望',
    '嘘',
    'よいしょ',
    '幼稚園',
    '進化',
    '折り紙',
    '中学校',
    '小学校',
    '高校',
    '抜け殻',
    '冬眠',
    'おやじ',
    'プライド',
    '説教',
    'セーブ',
    'レア',
    '専門家',
    'カラコン',
    'ホームセンター',
    'カンニング',
    '転売',
    'ごぼう',
    '接続',
    'ハッキング',
    'たらこ',
    'たいやき',
    '出産',
    '育児',
    '教育',
    '再生',
    'たばこ',
    '疲労',
    'ハイブリッド',
    '復讐',
    'ハイスペック',
    '鬼ごっこ',
    'かくれんぼ',
    '縄跳び',
    'ドッジボール',
    'サッカー',
    'リフティング',
    'ドリブル',
    'ハンドボール',
    'アイスホッケー',
    'フェンシング',
    '勉強',
    '一夜漬け',
    '暗記',
    'ヒトデ',
    '手裏剣',
    '煙幕',
    'ピンチ',
    'パンチ',
    '放課後',
    '星座',
    '家庭教師',
    'ハンモック',
    '新鮮',
    'マウント',
    '首輪',
    '知育',
    '絵本',
    '解約',
    '基本',
    '装填',
    '寝言',
    'うまい棒',
    'ファミチキ',
    'ハーゲンダッツ',
    'ガリガリ君',
    'ポッキー',
    'UNO',
    '柿の種',
    'ヤクルト',
    '雪見だいふく',
    'ハッピーターン',
    'じゃがりこ',
    'コアラのマーチ',
    'かっぱえびせん',
    'どん兵衛',
    'ファブリーズ',
    'ファンタ',
    'フリスク',
    'ブラックサンダー',
    'ベビースターラーメン',
    'ジョージア',
    'カルピス',
    'ポカリスエット',
    'ハイチュウ',
    'シーチキン',
    'G-SHOCK',
    '氷結',
    '午後の紅茶',
    '綾鷹',
    'ラ王',
    'ウォークマン',
    'iPhone',
    'バブ',
    'カラムーチョ',
    'リポビタンD',
    'レッドブル',
    'ダイソン',
    'ルンバ',
    'プッチンプリン',
    'チロルチョコ',
    'きのこの山',
    'たけのこの里',
    'からあげクン',
    'フルグラ',
    'カロリーメイト',
    'レゴ',
    'サンデー',
    'マガジン',
    '野菜生活',
    'キットカット',
    'カップヌードル',
    'スターバックス',
    '任天堂',
    '楽天',
    'Google',
    'NIKE',
    'Yahoo',
    'マクドナルド',
    '吉野家',
    'ユニクロ',
    'トイザらス',
    'エルメス',
    'ゴディバ',
    'ケンタッキーフライドチキン',
    'ソフトバンク',
    'ドコモ',
    'au',
    '花王',
    'ドトール',
    'アサヒ',
    'サントリー',
    'ヤマハ',
    '無印良品',
    'モスバーガー',
    'コストコ',
    'ニトリ',
    'ダイソー',
    'ドン・キホーテ',
    'ヨドバシカメラ',
    'ヤマダ電機',
    'イオン',
    'セブンイレブン',
    'ファミマ',
    'ローソン',
    'ミニストップ',
    'CoCo壱番屋',
    'ガスト',
    'サイゼリヤ',
    '高島屋',
    '生協',
    'ヤマト運輸',
    '東急ハンズ',
    'ディズニーランド',
    'ユニバーサルスタジオ',
    'ANA',
    'JAL',
    'カルビー',
    'ソニー',
    'キャノン',
    'Netflix',
    '松屋',
    '丸亀製麺',
    'パナソニック',
    'ブックオフ',
    'すき家',
    'ミスタードーナツ',
    'IKEA',
    'ロッテリア',
    'Wikipedia',
    'Skype',
    'Twitter',
    'ニコニコ動画',
    'YouTube',
    'Facebook',
    'Instagram',
    'LINE',
    '食べログ',
    'ウーバーイーツ',
    'Zoom',
    'PayPay',
    'ホットペッパー',
    'メルカリ',
    'ドラクエ',
    'ポケモン',
    'カービィ',
    'マリオ',
    'ルイージ',
    'クッパ',
    'キノピオ',
    'ピカチュウ',
    'ヨッシー',
    'パックマン',
    'テトリス',
    'ぷよぷよ',
    'Switch',
    'プレイステーション',
    'マインクラフト',
    '一寸法師',
    'シンデレラ',
    '浦島太郎',
    'かぐや姫',
    '白雪姫',
    'ピーターパン',
    '赤ずきん',
    '三匹の子豚',
    'マッチ売りの少女',
    '3びきの子ぶた',
    'パトラッシュ',
    '一休さん',
    'ウルトラマン',
    '孫悟空',
    'ドラえもん',
    'アンパンマン',
    'サザエさん',
    'バイキンマン',
    'ミッキーマウス',
    'キティーちゃん',
    '仮面ライダー',
    'トトロ',
    'ちびまる子ちゃん',
    'コナン',
    '機関車トーマス',
    'のび太',
    'ルパン三世',
    'ゴジラ',
    'ゲゲゲの鬼太郎',
    'スヌーピー',
    'くまのプーさん',
    'ガンダム',
    'エヴァンゲリオン',
    'フック船長',
    'ジャイアン',
    'スネ夫',
    'ドラゴンボール',
    '鬼滅の刃',
    '天空の城ラピュタ',
    'ムスカ',
    '魔女の宅急便',
    'もののけ姫',
    'モンスターボール',
    'アトム',
    'くまモン',
    'スター・ウォーズ',
    'ハリー・ポッター',
    'スパイダーマン',
    'ターミネーター',
    'リラックマ',
    'ムーミン',
    'ミッフィ―',
    '風の谷のナウシカ',
    '貞子'
  ];

  function getCodenamesWordPool() {
    // dedupe while keeping insertion order
    var seen = {};
    var out = [];
    for (var i = 0; i < CODENAMES_WORDS.length; i++) {
      var w = String(CODENAMES_WORDS[i] || '').trim();
      if (!w) continue;
      if (seen[w]) continue;
      seen[w] = true;
      out.push(w);
    }
    return out;
  }

  function buildCodenamesKey(total, firstTeam) {
    var assassin = 1;
    var base = Math.floor((total - assassin) / 3);
    var first = base + 1;
    var second = base;
    var neutral = total - assassin - first - second;

    var arr = [];
    var i;
    if (firstTeam === 'blue') {
      for (i = 0; i < first; i++) arr.push('B');
      for (i = 0; i < second; i++) arr.push('R');
    } else {
      for (i = 0; i < first; i++) arr.push('R');
      for (i = 0; i < second; i++) arr.push('B');
    }
    for (i = 0; i < neutral; i++) arr.push('N');
    for (i = 0; i < assassin; i++) arr.push('A');

    for (var k = arr.length - 1; k > 0; k--) {
      var j = randomInt(k + 1);
      var tmp = arr[k];
      arr[k] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function pickCodenamesWords(pool, total) {
    var p = Array.isArray(pool) ? pool.slice() : [];
    for (var i = p.length - 1; i > 0; i--) {
      var j = randomInt(i + 1);
      var tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    return p.slice(0, total);
  }

  function createCodenamesRoom(roomId, settings) {
    var base = codenamesRoomPath(roomId);
    var size = clamp(parseIntSafe(settings && settings.size, 5), 3, 8);
    var total = size * size;

    var firstTeam = randomInt(2) === 0 ? 'red' : 'blue';

    var pool = getCodenamesWordPool();
    if (!pool || pool.length < total) {
      throw new Error('ワードが足りません（最低 ' + total + ' 個必要）。');
    }

    var words = pickCodenamesWords(pool, total);
    if (!words || words.length < total) {
      throw new Error('ワードが足りません（最低 ' + total + ' 個必要）。');
    }

    var key = buildCodenamesKey(total, firstTeam);
    var revealed = [];
    for (var i = 0; i < total; i++) revealed.push(false);

    var remainRed = 0;
    var remainBlue = 0;
    for (var k = 0; k < key.length; k++) {
      if (key[k] === 'R') remainRed++;
      if (key[k] === 'B') remainBlue++;
    }

    var room = {
      createdAt: serverNowMs(),
      phase: 'lobby',
      settings: { size: size },
      board: {
        size: size,
        words: words,
        key: key,
        revealed: revealed
      },
      firstTeam: firstTeam,
      clueLog: [],
      turn: {
        team: firstTeam,
        status: 'awaiting_clue',
        guessesLeft: 0,
        clue: { word: '', number: 0, by: '', at: 0 },
        pending: {}
      },
      progress: {
        redRemaining: remainRed,
        blueRemaining: remainBlue
      },
      result: { winner: '', finishedAt: 0, reason: '' },
      players: {}
    };
    return setValue(base, room);
  }

  function joinPlayerInCodenamesRoom(roomId, playerId, name, isHostPlayer) {
    var base = codenamesRoomPath(roomId);
    return runTxn(base, function (room) {
      if (!room) return room;
      if (room.phase !== 'lobby') return room;

      var players = assign({}, room.players || {});
      var prev = players[playerId] || {};
      var next = assign({}, prev, {
        name: name,
        joinedAt: prev.joinedAt || serverNowMs(),
        lastSeenAt: serverNowMs(),
        team: prev.team || '',
        role: prev.role || ''
      });
      if (isHostPlayer) next.isHost = true;
      players[playerId] = next;
      return assign({}, room, { players: players });
    });
  }

  function setCodenamesPlayerPrefs(roomId, playerId, team, role) {
    var path = codenamesPlayerPath(roomId, playerId);
    return runTxn(path, function (p) {
      if (!p) return p;
      var t = team === 'red' || team === 'blue' ? team : '';
      var r = role === 'spymaster' || role === 'operative' ? role : '';
      return assign({}, p, { team: t, role: r, lastSeenAt: serverNowMs() });
    });
  }

  function setCodenamesPlayerProfile(roomId, playerId, name, team, role) {
    var path = codenamesPlayerPath(roomId, playerId);
    return runTxn(path, function (p) {
      if (!p) return p;
      var nm = String(name == null ? '' : name).trim();
      var t = team === 'red' || team === 'blue' ? team : '';
      var r = role === 'spymaster' || role === 'operative' ? role : '';
      return assign({}, p, { name: nm || p.name || '', team: t, role: r, lastSeenAt: serverNowMs() });
    });
  }

  function resetCodenamesToLobby(roomId) {
    var base = codenamesRoomPath(roomId);
    return runTxn(base, function (room) {
      if (!room) return room;

      var players = assign({}, room.players || {});
      var keys = Object.keys(players);
      for (var i = 0; i < keys.length; i++) {
        var id = keys[i];
        var p = players[id];
        if (!p) continue;
        players[id] = assign({}, p, { team: '', role: '' });
      }

      var size = room && room.board && room.board.size ? room.board.size : (room.settings && room.settings.size ? room.settings.size : 5);
      var total = size * size;
      var revealed = [];
      for (var ri = 0; ri < total; ri++) revealed.push(false);

      var key = (room && room.board && room.board.key) || [];
      var remainRed = 0;
      var remainBlue = 0;
      for (var k = 0; k < key.length; k++) {
        if (key[k] === 'R') remainRed++;
        if (key[k] === 'B') remainBlue++;
      }

      return assign({}, room, {
        phase: 'lobby',
        players: players,
        clueLog: [],
        turn: assign({}, room.turn || {}, { status: 'awaiting_clue', guessesLeft: 0, clue: { word: '', number: 0, by: '', at: 0 }, pending: {} }),
        progress: { redRemaining: remainRed, blueRemaining: remainBlue },
        result: { winner: '', finishedAt: 0, reason: '' },
        board: assign({}, room.board || {}, { revealed: revealed })
      });
    });
  }

  function resetCodenamesForNewPlayers(roomId, hostPlayerId) {
    var base = codenamesRoomPath(roomId);
    return runTxn(base, function (room) {
      if (!room) return room;

      var players = assign({}, room.players || {});
      var host = hostPlayerId ? players[hostPlayerId] : null;
      var nextPlayers = {};
      if (host) {
        nextPlayers[hostPlayerId] = assign({}, host, { team: '', role: '' });
      }

      var size = room && room.board && room.board.size ? room.board.size : (room.settings && room.settings.size ? room.settings.size : 5);
      var total = size * size;
      var revealed = [];
      for (var ri = 0; ri < total; ri++) revealed.push(false);

      var key = (room && room.board && room.board.key) || [];
      var remainRed = 0;
      var remainBlue = 0;
      for (var k = 0; k < key.length; k++) {
        if (key[k] === 'R') remainRed++;
        if (key[k] === 'B') remainBlue++;
      }

      return assign({}, room, {
        phase: 'lobby',
        players: nextPlayers,
        clueLog: [],
        turn: assign({}, room.turn || {}, { status: 'awaiting_clue', guessesLeft: 0, clue: { word: '', number: 0, by: '', at: 0 }, pending: {} }),
        progress: { redRemaining: remainRed, blueRemaining: remainBlue },
        result: { winner: '', finishedAt: 0, reason: '' },
        board: assign({}, room.board || {}, { revealed: revealed })
      });
    });
  }

  function countCodenamesRoles(room) {
    var players = (room && room.players) || {};
    var keys = Object.keys(players);
    var out = {
      redSpymaster: 0,
      blueSpymaster: 0,
      redOperative: 0,
      blueOperative: 0,
      total: 0
    };
    for (var i = 0; i < keys.length; i++) {
      var p = players[keys[i]];
      if (!p) continue;
      out.total++;
      if (p.team === 'red' && p.role === 'spymaster') out.redSpymaster++;
      if (p.team === 'blue' && p.role === 'spymaster') out.blueSpymaster++;
      if (p.team === 'red' && p.role === 'operative') out.redOperative++;
      if (p.team === 'blue' && p.role === 'operative') out.blueOperative++;
    }
    return out;
  }

  function startCodenamesGame(roomId) {
    var base = codenamesRoomPath(roomId);
    return runTxn(base, function (room) {
      if (!room) return room;
      if (room.phase !== 'lobby') return room;

      var counts = countCodenamesRoles(room);
      if (counts.redSpymaster !== 1 || counts.blueSpymaster !== 1) return room;
      if (counts.redOperative < 1 || counts.blueOperative < 1) return room;

      return assign({}, room, {
        phase: 'playing',
        turn: assign({}, room.turn || {}, {
          team: room.firstTeam || (room.turn && room.turn.team) || 'red',
          status: 'awaiting_clue',
          guessesLeft: 0,
          clue: { word: '', number: 0, by: '', at: 0 },
          pending: {}
        }),
        result: { winner: '', finishedAt: 0, reason: '' }
      });
    });
  }

  function submitCodenamesClue(roomId, playerId, clueWord, clueNumber) {
    var base = codenamesRoomPath(roomId);
    return runTxn(base, function (room) {
      if (!room) return room;
      if (room.phase !== 'playing') return room;
      if (!room.turn || room.turn.status !== 'awaiting_clue') return room;

      var player = room.players && room.players[playerId] ? room.players[playerId] : null;
      if (!player || player.role !== 'spymaster') return room;
      if (player.team !== room.turn.team) return room;

      var w = String(clueWord || '').trim();
      var n = clamp(parseIntSafe(clueNumber, 0), 0, 20);
      if (!w) return room;

      var log = [];
      try {
        log = Array.isArray(room.clueLog) ? room.clueLog.slice() : [];
      } catch (e0) {
        log = [];
      }
      if (log.length > 20) log = log.slice(log.length - 20);
      log.push({ team: room.turn.team, word: w, number: n, by: playerId, at: serverNowMs() });
      if (log.length > 20) log = log.slice(log.length - 20);

      return assign({}, room, {
        clueLog: log,
        turn: {
          team: room.turn.team,
          status: 'guessing',
          guessesLeft: n + 1,
          clue: { word: w, number: n, by: playerId, at: serverNowMs() },
          pending: {}
        }
      });
    });
  }

  function toggleCodenamesPending(roomId, playerId, index) {
    var base = codenamesRoomPath(roomId);
    return runTxn(base, function (room) {
      if (!room) return room;
      if (room.phase !== 'playing') return room;
      if (!room.board || !room.board.words || !room.board.revealed) return room;
      if (!room.turn || room.turn.status !== 'guessing') return room;

      var idx = parseIntSafe(index, -1);
      if (idx < 0 || idx >= room.board.words.length) return room;
      if (room.board.revealed[idx]) return room;

      var player = room.players && room.players[playerId] ? room.players[playerId] : null;
      if (!player || player.role !== 'operative') return room;
      if (player.team !== room.turn.team) return room;

      var pending = assign({}, (room.turn && room.turn.pending) || {});
      var k = String(idx);
      if (pending[k]) {
        try {
          delete pending[k];
        } catch (e) {
          pending[k] = null;
        }
      } else {
        pending[k] = { by: playerId, at: serverNowMs() };
      }

      return assign({}, room, { turn: assign({}, room.turn, { pending: pending }) });
    });
  }

  function endCodenamesTurn(roomId) {
    var base = codenamesRoomPath(roomId);
    return runTxn(base, function (room) {
      if (!room) return room;
      if (room.phase !== 'playing') return room;
      var team = room.turn && room.turn.team ? room.turn.team : 'red';
      var nextTeam = team === 'red' ? 'blue' : 'red';
      return assign({}, room, {
        turn: {
          team: nextTeam,
          status: 'awaiting_clue',
          guessesLeft: 0,
          clue: { word: '', number: 0, by: '', at: 0 },
          pending: {}
        }
      });
    });
  }

  function revealCodenamesCard(roomId, playerId, index) {
    var base = codenamesRoomPath(roomId);
    return runTxn(base, function (room) {
      if (!room) return room;
      if (room.phase !== 'playing') return room;
      if (!room.board || !room.board.words || !room.board.key || !room.board.revealed) return room;
      if (!room.turn || room.turn.status !== 'guessing') return room;
      var idx = parseIntSafe(index, -1);
      if (idx < 0 || idx >= room.board.words.length) return room;
      if (room.board.revealed[idx]) return room;

      var player = room.players && room.players[playerId] ? room.players[playerId] : null;
      if (!player || player.role !== 'operative') return room;
      if (player.team !== room.turn.team) return room;

      var key = room.board.key[idx];
      var nextRevealed = room.board.revealed.slice();
      nextRevealed[idx] = true;

      var nextProgress = assign({}, room.progress || {});
      if (key === 'R') nextProgress.redRemaining = Math.max(0, (nextProgress.redRemaining || 0) - 1);
      if (key === 'B') nextProgress.blueRemaining = Math.max(0, (nextProgress.blueRemaining || 0) - 1);

      var winner = '';
      var reason = '';
      if (key === 'A') {
        winner = room.turn.team === 'red' ? 'blue' : 'red';
        reason = 'assassin';
      } else {
        if ((nextProgress.redRemaining || 0) === 0) {
          winner = 'red';
          reason = 'all-red';
        }
        if ((nextProgress.blueRemaining || 0) === 0) {
          winner = 'blue';
          reason = 'all-blue';
        }
      }

      var nextRoom = assign({}, room, {
        board: assign({}, room.board, { revealed: nextRevealed }),
        progress: nextProgress
      });

      if (winner) {
        nextRoom.phase = 'finished';
        nextRoom.result = { winner: winner, finishedAt: serverNowMs(), reason: reason };
        nextRoom.turn = assign({}, room.turn || {}, { pending: {} });
        return nextRoom;
      }

      var shouldSwitch = false;
      if (key !== (room.turn.team === 'red' ? 'R' : 'B')) {
        shouldSwitch = true;
      }

      if (shouldSwitch) {
        var nextTeam = room.turn.team === 'red' ? 'blue' : 'red';
        nextRoom.turn = {
          team: nextTeam,
          status: 'awaiting_clue',
          guessesLeft: 0,
          clue: { word: '', number: 0, by: '', at: 0 },
          pending: {}
        };
        return nextRoom;
      }

      var left = Math.max(0, (room.turn.guessesLeft || 0) - 1);
      if (left === 0) {
        var nt = room.turn.team === 'red' ? 'blue' : 'red';
        nextRoom.turn = {
          team: nt,
          status: 'awaiting_clue',
          guessesLeft: 0,
          clue: { word: '', number: 0, by: '', at: 0 },
          pending: {}
        };
        return nextRoom;
      }

      nextRoom.turn = assign({}, room.turn, { guessesLeft: left, pending: {} });
      return nextRoom;
    });
  }

  function createRoom(roomId, settings) {
    var base = roomPath(roomId);

    var picked;
    try {
      if (settings.topicCategoryId === 'random') picked = pickRandomPairAny();
      else picked = pickRandomPair(settings.topicCategoryId);
    } catch (e) {
      picked = pickRandomPairAny();
    }

    var room = {
      createdAt: serverNowMs(),
      phase: 'lobby',
      settings: {
        minorityCount: settings.minorityCount,
        talkSeconds: settings.talkSeconds,
        reversal: settings.reversal
      },
      topic: {
        categoryId: picked.category && picked.category.id ? picked.category.id : '',
        categoryName: picked.category && picked.category.name ? picked.category.name : ''
      },
      words: {
        majority: picked.majority,
        minority: picked.minority
      },
      discussion: {
        startedAt: 0,
        endsAt: 0
      },
      reveal: {
        revealedAt: 0,
        votedOutId: ''
      },
      guess: {
        enabled: !!settings.reversal,
        submittedAt: 0,
        guesses: {}
      },
      result: {
        winner: '',
        decidedAt: 0,
        decidedBy: ''
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

  function joinPlayerInRoom(roomId, playerId, name, isHostPlayer) {
    var base = roomPath(roomId);
    return runTxn(base, function (room) {
      if (!room) return room;
      if (room.phase !== 'lobby') return room;

      var players = assign({}, room.players || {});
      var prev = players[playerId] || {};
      var next = assign({}, prev, {
        name: name,
        joinedAt: prev.joinedAt || serverNowMs(),
        lastSeenAt: serverNowMs()
      });

      if (isHostPlayer) next.isHost = true;

      players[playerId] = next;

      return assign({}, room, { players: players });
    });
  }

  function formatPlayerDisplayName(player) {
    return player && player.name ? String(player.name) : '';
  }

  function formatPlayerMenuName(player) {
    var name = formatPlayerDisplayName(player);
    if (player && player.isHost) name += ' (ゲームマスター)';
    return name;
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

  function computeVotedOutId(room) {
    var ids = listActivePlayerIds(room);
    if (!ids.length) return '';

    var votesObj = (room && room.votes) || {};
    var counts = {};
    for (var i = 0; i < ids.length; i++) counts[ids[i]] = 0;

    var voterIds = Object.keys(votesObj);
    for (var j = 0; j < voterIds.length; j++) {
      var voterId = voterIds[j];
      var v = votesObj[voterId];
      if (!v || !v.to) continue;
      if (counts[v.to] == null) continue;
      counts[v.to] = (counts[v.to] || 0) + 1;
    }

    var bestId = '';
    var bestCount = -1;
    // deterministic tie-break: lexicographically smaller id wins
    for (var k = 0; k < ids.length; k++) {
      var pid = ids[k];
      var c = counts[pid] || 0;
      if (c > bestCount) {
        bestCount = c;
        bestId = pid;
      } else if (c === bestCount && bestId && pid < bestId) {
        bestId = pid;
      }
    }
    return bestId;
  }

  function listMinorityPlayerIds(room) {
    var playersObj = (room && room.players) || {};
    var keys = Object.keys(playersObj);
    var out = [];
    for (var i = 0; i < keys.length; i++) {
      var id = keys[i];
      var p = playersObj[id];
      if (!p) continue;
      if (p.role !== 'minority') continue;
      out.push(id);
    }
    return out;
  }

  function areAllMinorityGuessesSubmitted(room) {
    var ids = listMinorityPlayerIds(room);
    if (!ids.length) return true;
    var guessObj = (room && room.guess) || {};
    var guesses = guessObj.guesses || {};
    for (var i = 0; i < ids.length; i++) {
      var pid = ids[i];
      if (!guesses[pid] || !guesses[pid].text) return false;
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
      if (FORCE_TALK_SECONDS > 0) talkSeconds = FORCE_TALK_SECONDS;
      var minorityCount = room.settings && room.settings.minorityCount != null ? room.settings.minorityCount : 1;
      minorityCount = clamp(minorityCount, 1, Math.max(1, ids.length - 1));

      var shuffled = ids.slice();
      for (var i = shuffled.length - 1; i > 0; i--) {
        var j = randomInt(i + 1);
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

      var startedAt = serverNowMs();
      return assign({}, room, {
        phase: 'discussion',
        players: nextPlayers,
        discussion: { startedAt: startedAt, endsAt: startedAt + talkSeconds * 1000 },
        voting: { startedAt: 0, revealedAt: 0 },
        votes: {},
        reveal: { revealedAt: 0, votedOutId: '' },
        guess: {
          enabled: !!(room.settings && room.settings.reversal),
          submittedAt: 0,
          guesses: {}
        },
        result: { winner: '', decidedAt: 0, decidedBy: '' }
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
      if (serverNowMs() < endAt) return room;
      return assign({}, room, {
        phase: 'voting',
        voting: { startedAt: serverNowMs(), revealedAt: 0 },
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

      // Determine leaders; if tie => runoff revote among tied players.
      var votesObj = (room && room.votes) || {};
      var activeIds = listActivePlayerIds(room);
      if (!activeIds.length) return room;

      var candidateIds = null;
      if (room.voting && room.voting.runoff && Array.isArray(room.voting.runoff.candidates) && room.voting.runoff.candidates.length) {
        candidateIds = room.voting.runoff.candidates.slice();
      }

      var counts = {};
      var baseIds = candidateIds || activeIds;
      for (var bi = 0; bi < baseIds.length; bi++) counts[baseIds[bi]] = 0;

      var voterIds = Object.keys(votesObj);
      for (var vi = 0; vi < voterIds.length; vi++) {
        var voterId = voterIds[vi];
        var v = votesObj[voterId];
        if (!v || !v.to) continue;
        if (counts[v.to] == null) continue;
        counts[v.to] = (counts[v.to] || 0) + 1;
      }

      var bestCount = -1;
      for (var ci = 0; ci < baseIds.length; ci++) {
        var pid = baseIds[ci];
        var c = counts[pid] || 0;
        if (c > bestCount) bestCount = c;
      }

      var leaders = [];
      for (var li = 0; li < baseIds.length; li++) {
        var pid2 = baseIds[li];
        if ((counts[pid2] || 0) === bestCount) leaders.push(pid2);
      }

      if (leaders.length > 1) {
        // If this is already a runoff revote and it's still tied, minority wins.
        if (candidateIds && candidateIds.length) {
          return assign({}, room, {
            phase: 'finished',
            reveal: { revealedAt: serverNowMs(), votedOutId: '' },
            result: { winner: 'minority', decidedAt: serverNowMs(), decidedBy: 'runoff-tie' }
          });
        }
        var prevRound = room.voting && room.voting.runoff && room.voting.runoff.round ? parseIntSafe(room.voting.runoff.round, 0) : 0;
        return assign({}, room, {
          phase: 'voting',
          votes: {},
          voting: {
            startedAt: serverNowMs(),
            revealedAt: 0,
            runoff: { round: prevRound + 1, candidates: leaders }
          },
          reveal: { revealedAt: 0, votedOutId: '' }
        });
      }

      var votedOutId = leaders[0] || computeVotedOutId(room);
      var votedOutRole = votedOutId && room.players && room.players[votedOutId] ? room.players[votedOutId].role : '';
      var reversal = !!(room.settings && room.settings.reversal);

      // Branch:
      // - voted-out is majority => minority wins immediately
      // - voted-out is minority => if reversal enabled -> minority can guess, then ゲームマスター decides; else majority wins
      if (votedOutRole === 'majority') {
        return assign({}, room, {
          phase: 'finished',
          reveal: { revealedAt: serverNowMs(), votedOutId: votedOutId },
          result: { winner: 'minority', decidedAt: serverNowMs(), decidedBy: 'auto' }
        });
      }

      if (votedOutRole === 'minority' && reversal) {
        var nextGuess = assign(
          {
            enabled: true,
            submittedAt: 0,
            guesses: {}
          },
          room.guess || {}
        );
        if (!nextGuess.guesses) nextGuess.guesses = {};
        return assign({}, room, {
          phase: 'guess',
          reveal: { revealedAt: serverNowMs(), votedOutId: votedOutId },
          guess: nextGuess,
          result: { winner: '', decidedAt: 0, decidedBy: '' }
        });
      }

      // default: majority wins
      return assign({}, room, {
        phase: 'finished',
        reveal: { revealedAt: serverNowMs(), votedOutId: votedOutId },
        result: { winner: 'majority', decidedAt: serverNowMs(), decidedBy: 'auto' }
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
      if (String(voterId) === String(toPlayerId)) return room;

      if (room.voting && room.voting.runoff && Array.isArray(room.voting.runoff.candidates) && room.voting.runoff.candidates.length) {
        var allowed = false;
        for (var i = 0; i < room.voting.runoff.candidates.length; i++) {
          if (String(room.voting.runoff.candidates[i]) === String(toPlayerId)) {
            allowed = true;
            break;
          }
        }
        if (!allowed) return room;
      }
      var nextVotes = assign({}, room.votes || {});
      nextVotes[voterId] = { to: toPlayerId, at: serverNowMs() };
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
      var gt = String(guessText || '').trim();

      var nextGuess = assign(
        {
          enabled: true,
          submittedAt: 0,
          guesses: {}
        },
        room.guess || {}
      );
      var guesses = assign({}, nextGuess.guesses || {});
      if (gt) guesses[playerId] = { text: gt, at: serverNowMs() };
      nextGuess.guesses = guesses;
      nextGuess.submittedAt = serverNowMs();

      var nextRoom = assign({}, room, { guess: nextGuess });

      if (areAllMinorityGuessesSubmitted(nextRoom)) {
        return assign({}, nextRoom, { phase: 'judge' });
      }
      return nextRoom;
    });
  }

  function decideWinner(roomId, winner) {
    var base = roomPath(roomId);
    var w = winner === 'minority' ? 'minority' : 'majority';
    return runTxn(base, function (room) {
      if (!room) return room;
      if (room.phase !== 'judge') return room;
      return assign({}, room, {
        phase: 'finished',
        result: { winner: w, decidedAt: serverNowMs(), decidedBy: 'gm' }
      });
    });
  }

  function restartGameWithSettings(roomId, settings) {
    var base = roomPath(roomId);

    var picked;
    try {
      if (settings.topicCategoryId === 'random') picked = pickRandomPairAny();
      else picked = pickRandomPair(settings.topicCategoryId);
    } catch (e) {
      picked = pickRandomPairAny();
    }

    return runTxn(base, function (room) {
      if (!room) return room;
      if (room.phase !== 'finished') return room;

      var ids = listActivePlayerIds(room);
      if (ids.length < 3) return room;

      var talkSeconds = settings && settings.talkSeconds != null ? settings.talkSeconds : 180;
      var minorityCount = settings && settings.minorityCount != null ? settings.minorityCount : 1;
      talkSeconds = clamp(parseIntSafe(talkSeconds, 180), 60, 5 * 60);
      if (FORCE_TALK_SECONDS > 0) talkSeconds = FORCE_TALK_SECONDS;
      minorityCount = clamp(parseIntSafe(minorityCount, 1), 1, Math.max(1, ids.length - 1));
      var reversal = !!(settings && settings.reversal);

      var shuffled = ids.slice();
      for (var i = shuffled.length - 1; i > 0; i--) {
        var j = randomInt(i + 1);
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

      var startedAt = serverNowMs();
      return assign({}, room, {
        phase: 'discussion',
        settings: {
          minorityCount: minorityCount,
          talkSeconds: talkSeconds,
          reversal: reversal
        },
        topic: {
          categoryId: picked.category && picked.category.id ? picked.category.id : '',
          categoryName: picked.category && picked.category.name ? picked.category.name : ''
        },
        words: {
          majority: picked.majority,
          minority: picked.minority
        },
        players: nextPlayers,
        discussion: { startedAt: startedAt, endsAt: startedAt + talkSeconds * 1000 },
        voting: { startedAt: 0, revealedAt: 0 },
        votes: {},
        reveal: { revealedAt: 0, votedOutId: '' },
        guess: {
          enabled: reversal,
          submittedAt: 0,
          guesses: {}
        },
        result: { winner: '', decidedAt: 0, decidedBy: '' }
      });
    });
  }

  function resetRoomForPlayerChange(roomId, hostPlayerId) {
    var base = roomPath(roomId);
    return runTxn(base, function (room) {
      if (!room) return room;
      if (room.phase !== 'finished') return room;

      var players = room.players || {};
      var hostId = hostPlayerId;
      if (!players[hostId] || !players[hostId].isHost) {
        hostId = '';
        var keys = Object.keys(players);
        for (var i = 0; i < keys.length; i++) {
          var pid = keys[i];
          if (players[pid] && players[pid].isHost) {
            hostId = pid;
            break;
          }
        }
      }

      var host = hostId && players[hostId] ? players[hostId] : null;
      if (!hostId || !host) return room;

      var nextPlayers = {};
      nextPlayers[hostId] = {
        name: host.name || 'ゲームマスター',
        isHost: true,
        joinedAt: host.joinedAt || serverNowMs(),
        lastSeenAt: serverNowMs()
      };

      return assign({}, room, {
        phase: 'lobby',
        players: nextPlayers,
        discussion: { startedAt: 0, endsAt: 0 },
        voting: { startedAt: 0, revealedAt: 0 },
        votes: {},
        reveal: { revealedAt: 0, votedOutId: '' },
        guess: { enabled: !!(room.settings && room.settings.reversal), submittedAt: 0, guesses: {} },
        result: { winner: '', decidedAt: 0, decidedBy: '' }
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
      '\n    <div class="stack">\n      <div class="big">B_BoardGames</div>\n      <div class="muted">遊ぶゲームを選びます。</div>\n\n      <hr />\n\n      <div class="stack">\n        <div class="muted">ワードウルフ</div>\n        <div class="row">\n          <a class="btn primary" href="?screen=create">ワードウルフ開始</a>\n          <a class="btn ghost" href="?screen=history">勝敗履歴</a>\n        </div>\n        <div class="muted">参加者はQRを読み取って参加します。</div>\n      </div>\n\n      <hr />\n\n      <div class="stack">\n        <div class="muted">コードネーム</div>\n        <div class="row">\n          <a class="btn primary" href="?screen=codenames_create">コードネーム開始</a>\n        </div>\n        <div class="muted">各チームにスパイマスター1人＋諜報員で遊びます。</div>\n      </div>\n    </div>\n  '
    );
  }

  function renderCodenamesCreate(viewEl) {
    render(
      viewEl,
      '\n    <div class="stack">\n      <div class="big">コードネーム：部屋を作成</div>\n\n      <div class="field">\n        <label>あなたの名前（表示用）</label>\n        <input id="cnHostName" placeholder="例: たろう" />\n      </div>\n\n      <div class="field">\n        <label>ボードサイズ（デフォルト 5x5）</label>\n        <input id="cnSize" type="number" min="3" max="8" value="5" />\n        <div class="muted">※ NxN（最大8）</div>\n      </div>\n\n      <div class="row">\n        <button id="cnCreateRoom" class="primary">QRを表示</button>\n        <a class="btn ghost" href="./">戻る</a>\n      </div>\n    </div>\n  '
    );
  }

  function readCodenamesCreateForm() {
    var n = document.getElementById('cnHostName');
    var s = document.getElementById('cnSize');
    var name = String((n && n.value) || '').trim();
    var size = clamp(parseIntSafe(s && s.value, 5), 3, 8);
    if (!name) throw new Error('名前を入力してください。');
    return { name: name, size: size };
  }

  function renderCodenamesJoin(viewEl, roomId) {
    render(
      viewEl,
      '\n    <div class="stack">\n      <div class="big">コードネーム：参加</div>\n      <div class="kv"><span class="muted">ルームID</span><b>' +
        escapeHtml(roomId) +
        '</b></div>\n\n      <div class="field">\n        <label>名前（表示用）</label>\n        <input id="cnPlayerName" placeholder="例: たろう" />\n      </div>\n\n      <div class="row">\n        <button id="cnJoin" class="primary">参加する</button>\n        <a class="btn ghost" href="./">戻る</a>\n      </div>\n    </div>\n  '
    );
  }

  function readCodenamesJoinForm() {
    var el = document.getElementById('cnPlayerName');
    var name = String((el && el.value) || '').trim();
    if (!name) throw new Error('名前を入力してください。');
    return { name: name };
  }

  function makeCodenamesJoinUrl(roomId) {
    var q = {};
    var v = getCacheBusterParam();
    if (v) q.v = v;
    q.room = roomId;
    q.screen = 'codenames_join';
    return baseUrl() + '?' + buildQuery(q);
  }

  function renderCodenamesHost(viewEl, opts) {
    var roomId = opts.roomId;
    var joinUrl = opts.joinUrl;
    var room = opts.room;
    var hostPlayerId = opts.hostPlayerId;
    var hostPlayer = (room && room.players && hostPlayerId && room.players[hostPlayerId]) || null;

    var playerCount = room && room.players ? Object.keys(room.players).length : 0;
    var phase = (room && room.phase) || '-';
    var counts = countCodenamesRoles(room);

    var canStart = phase === 'lobby' && counts.redSpymaster === 1 && counts.blueSpymaster === 1 && counts.redOperative >= 1 && counts.blueOperative >= 1;
    var actionHtml = '';
    if (phase === 'lobby') {
      actionHtml =
        '<div class="stack">' +
        '<div class="muted">準備: 赤/青それぞれスパイマスター1人＋諜報員1人以上</div>' +
        '<div class="kv"><span class="muted">赤</span><b>スパイマスター ' +
        counts.redSpymaster +
        ' / 諜報員 ' +
        counts.redOperative +
        '</b></div>' +
        '<div class="kv"><span class="muted">青</span><b>スパイマスター ' +
        counts.blueSpymaster +
        ' / 諜報員 ' +
        counts.blueOperative +
        '</b></div>' +
        (canStart ? '<button id="cnStart" class="primary">スタート</button>' : '<button class="primary" disabled>スタート</button>') +
        '</div>';
    }

    var playersHtml = '';
    try {
      var ps = (room && room.players) || {};
      var pkeys = Object.keys(ps);
      if (pkeys.length) {
        pkeys.sort(function (a, b) {
          var pa = ps[a] || {};
          var pb = ps[b] || {};
          var aa = pa.joinedAt || 0;
          var bb = pb.joinedAt || 0;
          return aa - bb;
        });
        for (var pi = 0; pi < pkeys.length; pi++) {
          var id = pkeys[pi];
          var p = ps[id] || {};
          var nm = escapeHtml(formatPlayerDisplayName(p) || '-');
          var t = p.team === 'red' ? '赤' : p.team === 'blue' ? '青' : '未選択';
          var r = p.role === 'spymaster' ? 'スパイマスター' : p.role === 'operative' ? '諜報員' : '未選択';
          var hostMark = p.isHost ? ' <span class="badge">GM</span>' : '';
          playersHtml += '<div class="kv"><span class="muted">' + nm + hostMark + '</span><b>' + escapeHtml(t + ' / ' + r) + '</b></div>';
        }
      } else {
        playersHtml = '<div class="muted">まだ参加者がいません。</div>';
      }
    } catch (e) {
      playersHtml = '<div class="muted">参加者一覧を表示できませんでした。</div>';
    }

    var gmName = hostPlayer ? String(hostPlayer.name || '') : '';
    var gmTeam = hostPlayer ? String(hostPlayer.team || '') : '';
    var gmRole = hostPlayer ? String(hostPlayer.role || '') : '';
    var gmHtml =
      '<hr />' +
      '<div class="stack">' +
      '<div class="big">GM（この端末）</div>' +
      '<div class="field"><label>名前（表示用）</label><input id="cnGmName" placeholder="例: たろう" value="' +
      escapeHtml(gmName) +
      '" /></div>' +
      '<div class="field"><label>チーム</label><select id="cnGmTeam">' +
      '<option value="">未選択</option><option value="red">赤</option><option value="blue">青</option></select></div>' +
      '<div class="field"><label>役職</label><select id="cnGmRole">' +
      '<option value="">未選択</option><option value="spymaster">スパイマスター</option><option value="operative">諜報員</option></select></div>' +
      '<div class="row"><button id="cnGmSave" class="ghost">保存</button><div class="muted" id="cnGmStatus"></div></div>' +
      '<div class="muted">※ GMもプレイヤーとして参加します（ここで設定できます）。</div>' +
      '</div>';

    render(
      viewEl,
      '\n    <div class="stack">\n      <div class="big">コードネーム：QR配布</div>\n      <div class="muted">参加者はこのQRを読み取って参加します。</div>\n\n      <div class="center" id="qrWrap">\n        <canvas id="qr"></canvas>\n      </div>\n      <div class="muted center" id="qrError"></div>\n\n      <div class="field">\n        <label>参加URL（スマホ以外はこちら）</label>\n        <div class="code" id="joinUrlText">' +
        escapeHtml(joinUrl || '') +
        '</div>\n        <div class="row">\n          <button id="copyJoinUrl" class="ghost">コピー</button>\n        </div>\n        <div class="muted" id="copyStatus"></div>\n      </div>\n\n      <div class="kv"><span class="muted">参加状況</span><b>' +
        playerCount +
        '</b></div>\n      <div class="kv"><span class="muted">フェーズ</span><b>' +
        escapeHtml(phase) +
        '</b></div>\n\n      <hr />\n\n      <div class="stack">\n        <div class="big">参加者（保存状況）</div>\n        ' +
        playersHtml +
        '\n      </div>\n\n      ' +
        gmHtml +
        '\n\n      <hr />\n\n      ' +
        actionHtml +
        '\n\n      <div class="muted">※ 参加後は各自の画面でチーム/役職を選びます。</div>\n    </div>\n  '
    );

    try {
      var tsel = document.getElementById('cnGmTeam');
      if (tsel) tsel.value = gmTeam || '';
      var rsel = document.getElementById('cnGmRole');
      if (rsel) rsel.value = gmRole || '';
    } catch (e) {
      // ignore
    }
  }

  function codenamesCellClass(key, revealed) {
    if (!revealed) return 'cn-card';
    if (key === 'R') return 'cn-card cn-revealed cn-red';
    if (key === 'B') return 'cn-card cn-revealed cn-blue';
    if (key === 'A') return 'cn-card cn-revealed cn-assassin';
    return 'cn-card cn-revealed cn-neutral';
  }

  function renderCodenamesPlayer(viewEl, opts) {
    var roomId = opts.roomId;
    var playerId = opts.playerId;
    var room = opts.room;
    var player = opts.player;
    var isHost = !!opts.isHost;

    var phase = (room && room.phase) || 'lobby';
    var myTeam = player && player.team ? player.team : '';
    var myRole = player && player.role ? player.role : '';

    var pendingObj = (room && room.turn && room.turn.pending) || {};

    var board = room && room.board ? room.board : null;
    var size = board && board.size ? board.size : 5;
    var total = board && board.words ? board.words.length : 0;
    var key = board && board.key ? board.key : [];
    var revealed = board && board.revealed ? board.revealed : [];

    var nameText = escapeHtml(formatPlayerDisplayName(player));
    var roleText = myTeam || myRole ? escapeHtml((myTeam === 'red' ? '赤' : myTeam === 'blue' ? '青' : '-') + ' / ' + (myRole === 'spymaster' ? 'スパイマスター' : myRole === 'operative' ? '諜報員' : '-')) : '-';
    var turnTeam = phase === 'playing' && room && room.turn ? room.turn.team : '';
    var turnLabel = turnTeam === 'red' ? '赤' : turnTeam === 'blue' ? '青' : '-';
    var turnCls = 'cn-turn' + (turnTeam === 'red' ? ' cn-turn-red' : turnTeam === 'blue' ? ' cn-turn-blue' : '') + (myTeam && turnTeam && myTeam === turnTeam ? ' cn-turn-active' : '');
    var topLine =
      '<div class="cn-topline">' +
      '<div class="cn-me">' +
      nameText +
      '</div>' +
      '<div class="cn-role">' +
      roleText +
      '</div>' +
      '<div class="' +
      turnCls +
      '">手番: ' +
      escapeHtml(turnLabel) +
      '</div>' +
      '</div>';

    var lobbyHtml = '';
    if (phase === 'lobby') {
      var playersHtml = '';
      try {
        var ps = (room && room.players) || {};
        var pkeys = Object.keys(ps);
        if (pkeys.length) {
          pkeys.sort(function (a, b) {
            var pa = ps[a] || {};
            var pb = ps[b] || {};
            var aa = pa.joinedAt || 0;
            var bb = pb.joinedAt || 0;
            return aa - bb;
          });
          for (var pi = 0; pi < pkeys.length; pi++) {
            var id = pkeys[pi];
            var p = ps[id] || {};
            var nm = escapeHtml(formatPlayerDisplayName(p) || '-');
            var t = p.team === 'red' ? '赤' : p.team === 'blue' ? '青' : '未選択';
            var r = p.role === 'spymaster' ? 'スパイマスター' : p.role === 'operative' ? '諜報員' : '未選択';
            var hostMark = p.isHost ? ' <span class="badge">GM</span>' : '';
            playersHtml += '<div class="kv"><span class="muted">' + nm + hostMark + '</span><b>' + escapeHtml(t + ' / ' + r) + '</b></div>';
          }
        } else {
          playersHtml = '<div class="muted">まだ参加者がいません。</div>';
        }
      } catch (e) {
        playersHtml = '<div class="muted">参加者一覧を表示できませんでした。</div>';
      }

      var counts = countCodenamesRoles(room);
      var canStart = counts.redSpymaster === 1 && counts.blueSpymaster === 1 && counts.redOperative >= 1 && counts.blueOperative >= 1;
      var isGm = !!(player && player.isHost);

      lobbyHtml =
        '<div class="stack">' +
        '<div class="big">待機中</div>' +
        '<div class="muted">チームと役職を選んでください。</div>' +
        '<div class="field"><label>チーム</label>' +
        '<select id="cnTeam"><option value="">未選択</option><option value="red">赤</option><option value="blue">青</option></select></div>' +
        '<div class="field"><label>役職</label>' +
        '<select id="cnRole"><option value="">未選択</option><option value="spymaster">スパイマスター</option><option value="operative">諜報員</option></select></div>' +
        '<button id="cnSavePrefs" class="primary">保存</button>' +
        (isGm
          ? '<hr />' +
            '<div class="muted">準備: 赤/青それぞれスパイマスター1人＋諜報員1人以上</div>' +
            '<div class="kv"><span class="muted">赤</span><b>スパイマスター ' +
            counts.redSpymaster +
            ' / 諜報員 ' +
            counts.redOperative +
            '</b></div>' +
            '<div class="kv"><span class="muted">青</span><b>スパイマスター ' +
            counts.blueSpymaster +
            ' / 諜報員 ' +
            counts.blueOperative +
            '</b></div>' +
            (canStart ? '<button id="cnStartFromPlayer" class="primary">スタート</button>' : '<button class="primary" disabled>スタート</button>')
          : (isHost ? '<div class="muted">※ スタートはGMが行います。</div>' : '')) +
        '<hr />' +
        '<div class="big">参加者（登録状況）</div>' +
        playersHtml +
        '</div>';
    }

    var clueRowHtml = '';
    if (phase === 'playing') {
      var tt = room.turn || {};
      var clue = tt.clue || { word: '', number: 0 };
      var clueText = clue && clue.word ? String(clue.word) : '';
      var clueNum = clue && clue.number != null ? String(clue.number) : '';
      var guessesLeft = tt.guessesLeft != null ? String(tt.guessesLeft) : '0';
      var canClue = myRole === 'spymaster' && myTeam && tt.team === myTeam && tt.status === 'awaiting_clue';

      if (canClue) {
        clueRowHtml =
          '<div class="cn-clue-row">' +
          '<input id="cnClueWord" placeholder="ヒント" />' +
          '<input id="cnClueNum" class="cn-clue-num" type="number" min="0" max="20" value="1" />' +
          '<button id="cnSubmitClue" class="primary">送信</button>' +
          '</div>';
      } else {
        var clueLine = clueText ? escapeHtml(clueText) + ' / ' + escapeHtml(clueNum || '0') : '（未提示）';
        clueRowHtml =
          '<div class="cn-clue-row">' +
          '<div class="cn-clue-view">ヒント: <b>' +
          clueLine +
          '</b></div>' +
          '<div class="cn-clue-left">残り: <b>' +
          escapeHtml(guessesLeft) +
          '</b></div>' +
          '</div>';
      }
    }

    var boardHtml = '';
    if (phase === 'playing' || phase === 'finished') {
      var cells = '';
      var showKey = myRole === 'spymaster';
      for (var i = 0; i < total; i++) {
        var word = board && board.words ? board.words[i] : '';
        var isRev = !!revealed[i];
        var k = key[i];
        var cls = codenamesCellClass(k, isRev || (showKey && phase === 'playing'));
        if (!isRev && pendingObj && pendingObj[String(i)]) cls += ' cn-pending';
        var disabled = phase !== 'playing' || isRev || myRole !== 'operative' || !myTeam || !room.turn || room.turn.team !== myTeam || room.turn.status !== 'guessing';
        var tagStart = disabled ? '<button class="' + cls + '" disabled>' : '<button class="' + cls + ' cnPick" data-idx="' + i + '">';
        cells += tagStart + '<span class="cn-word">' + escapeHtml(word) + '</span></button>';
      }

      boardHtml =
        '<hr /><div class="stack">' +
        '<div class="cn-board" style="grid-template-columns: repeat(' +
        escapeHtml(String(size)) +
        ', 1fr);">' +
        cells +
        '</div>' +
        '</div>';
    }

    var actionsHtml = '';
    if (phase === 'playing') {
      var ttt = room.turn || {};
      var myTurn = myTeam && ttt.team === myTeam;
      if (myTurn && ttt.status === 'guessing') {
        actionsHtml = '<hr /><div class="row"><button id="cnEndTurn" class="ghost">ターン終了</button></div>';
      }
    }

    var finishedHtml = '';
    if (phase === 'finished') {
      var winner = room && room.result ? room.result.winner : '';
      var wLabel = winner === 'red' ? '赤の勝ち' : winner === 'blue' ? '青の勝ち' : '-';
      var amHost = !!isHost || !!(player && player.isHost);
      finishedHtml =
        '<div class="stack">' +
        '<div class="big">結果</div>' +
        '<div class="kv"><span class="muted">勝者</span><b>' +
        escapeHtml(wLabel) +
        '</b></div>' +
        (amHost
          ? '<div class="row"><button id="cnContinue" class="primary">継続</button><button id="cnChangePlayers" class="ghost">参加者変更</button></div>'
          : '') +
        '</div>';
    }

    var clueHistoryHtml = '';
    if (phase === 'playing' || phase === 'finished') {
      var rows = '';
      try {
        var log = room && Array.isArray(room.clueLog) ? room.clueLog : [];
        var start = Math.max(0, log.length - 10);
        for (var li = start; li < log.length; li++) {
          var it = log[li] || {};
          var t = it.team === 'red' ? '赤' : it.team === 'blue' ? '青' : '-';
          var w = it.word ? String(it.word) : '';
          var num = it.number != null ? String(it.number) : '0';
          if (!w) continue;
          rows += '<div class="kv"><span class="muted">' + escapeHtml(t) + '</span><b>' + escapeHtml(w) + ' / ' + escapeHtml(num) + '</b></div>';
        }
      } catch (e2) {
        rows = '';
      }

      clueHistoryHtml =
        '<hr /><div class="stack">' +
        '<div class="big">ヒント履歴</div>' +
        (rows || '<div class="muted">（まだありません）</div>') +
        '</div>';
    }

    render(
      viewEl,
      '\n    <div class="stack">\n      ' +
        topLine +
        '\n\n      ' +
        (phase === 'lobby' ? lobbyHtml : '') +
        (phase === 'playing' ? clueRowHtml : '') +
        (phase === 'playing' ? actionsHtml : '') +
        (phase === 'finished' ? finishedHtml : '') +
        boardHtml +
        clueHistoryHtml +
        '\n    </div>\n  '
    );

    if (phase === 'lobby') {
      var teamSel = document.getElementById('cnTeam');
      if (teamSel) teamSel.value = myTeam || '';
      var roleSel = document.getElementById('cnRole');
      if (roleSel) roleSel.value = myRole || '';
    }
  }

  function renderHistory(viewEl, items) {
    var rows = '';
    if (!items || !items.length) {
      rows = '<div class="muted">履歴はまだありません。</div>';
    } else {
      for (var i = 0; i < items.length; i++) {
        var it = items[i] || {};
        rows +=
          '<div class="card" style="padding:12px">' +
          '<div class="kv"><span class="muted">日時</span><b>' +
          escapeHtml(it.when || '-') +
          '</b></div>' +
          '<div class="kv"><span class="muted">勝利</span><b>' +
          escapeHtml(it.winner || '-') +
          '</b></div>' +
          (it.minorityNames ? '<div class="muted">少数側: ' + escapeHtml(it.minorityNames) + '</div>' : '') +
          (it.words ? '<div class="muted">お題: ' + escapeHtml(it.words) + '</div>' : '') +
          '</div>';
      }
    }

    render(
      viewEl,
      '\n    <div class="stack">\n      <div class="big">勝敗履歴</div>\n      <div class="muted">この端末（主にゲームマスター）に保存される簡易履歴です。</div>\n\n      <div class="stack">' +
        rows +
        '</div>\n\n      <div class="row">\n        <a class="btn ghost" href="./">戻る</a>\n      </div>\n    </div>\n  '
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
      '\n    <div class="stack">\n      <div class="big">部屋を作成</div>\n\n      <div class="field">\n        <label>ゲームマスターの名前（表示用）</label>\n        <input id="gmName" placeholder="例: たろう" />\n        <div class="muted">※ 待機中など一部の画面では「(ゲームマスター)」を付けて表示します。</div>\n      </div>\n\n      <div class="field">\n        <label>少数側の人数（最大5）</label>\n        <input id="minorityCount" type="range" min="1" max="5" step="1" value="1" />\n        <div class="kv"><span class="muted">現在</span><b id="minorityCountLabel">1</b></div>\n      </div>\n\n      <div class="field">\n        <label>トーク時間（分・最大5分）</label>\n        <input id="talkMinutes" type="range" min="1" max="5" step="1" value="3" />\n        <div class="kv"><span class="muted">現在</span><b id="talkMinutesLabel">3分</b></div>\n      </div>\n\n      <div class="field">\n        <label>逆転あり（少数側が最後に多数側ワードを当てたら勝ち）</label>\n        <select id="reversal">\n          <option value="1" selected>あり</option>\n          <option value="0">なし</option>\n        </select>\n      </div>\n\n      <hr />\n\n      <div class="field">\n        <label>お題カテゴリ</label>\n        <select id="topicCategory"></select>\n        <div class="muted">※ 作成時点（QR表示時）にワードを確定してDBに保持します。画面には表示しません。</div>\n      </div>\n\n      <div class="row">\n        <button id="createRoom" class="primary">QRを表示</button>\n        <a class="btn ghost" href="./">戻る</a>\n      </div>\n    </div>\n  '
    );

    var sel = document.getElementById('topicCategory');
    if (sel) {
      var html = '<option value="random">ランダム</option>';
      for (var i = 0; i < TOPIC_CATEGORIES.length; i++) {
        var c = TOPIC_CATEGORIES[i];
        html += '<option value="' + escapeHtml(c.id) + '">' + escapeHtml(c.name) + '</option>';
      }
      sel.innerHTML = html;
      sel.value = 'random';
    }

    function updateLabels() {
      var mc = document.getElementById('minorityCount');
      var mcl = document.getElementById('minorityCountLabel');
      if (mc && mcl) mcl.textContent = String(mc.value || '1');
      var tm = document.getElementById('talkMinutes');
      var tml = document.getElementById('talkMinutesLabel');
      if (tm && tml) tml.textContent = String(tm.value || '1') + '分';
    }

    var mcEl = document.getElementById('minorityCount');
    if (mcEl) mcEl.addEventListener('input', updateLabels);
    var tmEl = document.getElementById('talkMinutes');
    if (tmEl) tmEl.addEventListener('input', updateLabels);
    updateLabels();
  }

  function readCreateForm() {
    var gn = document.getElementById('gmName');
    var mc = document.getElementById('minorityCount');
    var tm = document.getElementById('talkMinutes');
    var rv = document.getElementById('reversal');
    var tc = document.getElementById('topicCategory');

    var gmName = String((gn && gn.value) || '').trim();
    var minorityCount = clamp(parseIntSafe(mc && mc.value, 1), 1, 5);
    var talkMinutes = clamp(parseIntSafe(tm && tm.value, 3), 1, 5);
    var talkSeconds = talkMinutes * 60;
    var reversal = ((rv && rv.value) || '1') === '1';

    var topicCategoryId = String((tc && tc.value) || 'random');

    if (!gmName) throw new Error('ゲームマスターの名前を入力してください。');

    return {
      gmName: gmName,
      minorityCount: minorityCount,
      talkSeconds: talkSeconds,
      reversal: reversal,
      topicCategoryId: topicCategoryId
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
    var room = opts.room;

    var playerCount = room && room.players ? Object.keys(room.players).length : 0;
    var phase = (room && room.phase) || '-';

    var actionHtml = '';
    if (phase === 'lobby') actionHtml = '<button id="startGame" class="primary">スタート（トーク開始）</button>';

    render(
      viewEl,
      '\n    <div class="stack">\n      <div class="big">QR配布</div>\n      <div class="muted">参加者はこのQRを読み取って参加します。</div>\n\n      <div class="center" id="qrWrap">\n        <canvas id="qr"></canvas>\n      </div>\n      <div class="muted center" id="qrError"></div>\n\n      <div class="field">\n        <label>参加URL（スマホ以外はこちら）</label>\n        <div class="code" id="joinUrlText">' +
        escapeHtml(joinUrl || '') +
        '</div>\n        <div class="row">\n          <button id="copyJoinUrl" class="ghost">コピー</button>\n        </div>\n        <div class="muted" id="copyStatus"></div>\n      </div>\n\n      <div class="kv"><span class="muted">参加状況</span><b>' +
        playerCount +
        '</b></div>\n      <div class="kv"><span class="muted">フェーズ</span><b>' +
        escapeHtml(phase) +
        '</b></div>\n\n      <hr />\n\n      <div class="row">\n        ' +
        actionHtml +
        '\n      </div>\n\n      <div class="muted">※ スタート後、ゲームマスター端末もプレイヤー画面に移動します。</div>\n    </div>\n  '
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

    var ui = opts.ui || {};

    var players = (room && room.players) || {};
    var activePlayers = [];
    var playerKeys = Object.keys(players);
    for (var i = 0; i < playerKeys.length; i++) {
      var id = playerKeys[i];
      var p = players[id];
      if (!p || p.role === 'spectator') continue;
      activePlayers.push({ id: id, name: formatPlayerDisplayName(p) });
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

    var majorityWord = (room && room.words ? room.words.majority : '') || '';
    var minorityWord = (room && room.words ? room.words.minority : '') || '';

    var word = '';
    if (role === 'minority') word = minorityWord;
    if (role === 'majority') word = majorityWord;

    // Reveal both words when:
    // - majority wins (phase finished), or
    // - minority guesses are completed (phase judge)
    // (Finished always reveals.)
    var shouldRevealBothWords = phase === 'judge' || phase === 'finished';

    var singleWordHtml = '<div class="big">' + escapeHtml(word || '（未配布）') + '</div>';
    var bothWordsHtml =
      '<div class="stack">' +
      '<div><div class="muted">多数側</div><div class="big">' +
      escapeHtml(majorityWord || '（未配布）') +
      '</div></div>' +
      '<div><div class="muted">少数側</div><div class="big">' +
      escapeHtml(minorityWord || '（未配布）') +
      '</div></div>' +
      '</div>';

    // Role label is hidden during voting; show only after reveal (guess/judge/finished).
    var showRoleLabel = phase === 'guess' || phase === 'judge' || phase === 'finished';
    var roleLabel = '';
    if (showRoleLabel) {
      if (role === 'majority') roleLabel = '多人数側';
      if (role === 'minority') roleLabel = '少人数側';
    }
    var wordMainHtml = shouldRevealBothWords ? bothWordsHtml : singleWordHtml;
    var wordHtml = roleLabel
      ? '<div class="stack"><div class="inline-row"><span class="badge">' + escapeHtml(roleLabel) + '</span></div>' + wordMainHtml + '</div>'
      : wordMainHtml;

    var endAt = room && room.discussion && room.discussion.endsAt ? room.discussion.endsAt : 0;
    var remain = phase === 'discussion' ? Math.max(0, Math.floor((endAt - serverNowMs()) / 1000)) : 0;

    var statusText = '';
    if (phase === 'lobby') statusText = '待機中：ゲームマスターがスタートするまでお待ちください。';
    else if (phase === 'discussion') statusText = 'トーク中：少数側を探しましょう。';
    else if (phase === 'voting') statusText = votedTo ? '待機中：全員の投票を待っています。' : '投票してください。';
    else if (phase === 'guess') statusText = role === 'minority' ? '少数側は多数側ワードを入力してください。' : '待機中：少数側の入力を待っています。';
    else if (phase === 'judge') statusText = isHost ? '判定：勝敗を決定してください。' : '待機中：ゲームマスターの判定を待っています。';
    else if (phase === 'finished') statusText = 'ゲーム終了：結果を確認してください。';

    var votedOutId = room && room.reveal && room.reveal.votedOutId ? room.reveal.votedOutId : '';
    var votedOutName = votedOutId && players && players[votedOutId] ? formatPlayerDisplayName(players[votedOutId]) : '';
    var votedOutLine = votedOutId ? votedOutName || votedOutId : '';

    var votingHtml = '';
    if (phase === 'voting') {
      var candidates = null;
      if (room && room.voting && room.voting.runoff && Array.isArray(room.voting.runoff.candidates) && room.voting.runoff.candidates.length) {
        candidates = room.voting.runoff.candidates;
      }

      var voteStatusRows = '';
      var votedCount = 0;
      for (var vsi = 0; vsi < activePlayers.length; vsi++) {
        var apv = activePlayers[vsi];
        var hasVoted = !!(votesObj && votesObj[apv.id] && votesObj[apv.id].to);
        if (hasVoted) votedCount++;
        voteStatusRows +=
          '<div class="kv"><span class="muted">' +
          escapeHtml(apv.name) +
          '</span><b>' +
          (hasVoted ? '投票済' : '未投票') +
          '</b></div>';
      }
      var voteStatusHtml =
        '<div class="stack">' +
        '<div class="muted">投票状況 ' +
        votedCount +
        '/' +
        activePlayers.length +
        '</div>' +
        '<div class="stack">' +
        voteStatusRows +
        '</div>' +
        '</div>';

      if (votedTo) {
        votingHtml =
          '<div class="stack">' +
          '<div class="big">投票</div>' +
          '<div class="muted">投票済み。待機中です。</div>' +
          voteStatusHtml +
          '</div>';
      } else {
        var buttons = '';
        for (var oi = 0; oi < activePlayers.length; oi++) {
          var ap2 = activePlayers[oi];
          if (ap2.id === playerId) continue;
          if (candidates) {
            var ok = false;
            for (var ci = 0; ci < candidates.length; ci++) {
              if (String(candidates[ci]) === String(ap2.id)) {
                ok = true;
                break;
              }
            }
            if (!ok) continue;
          }
          buttons +=
            '<button class="primary voteBtn" data-to="' +
            escapeHtml(ap2.id) +
            '" style="width:100%">' +
            escapeHtml(ap2.name) +
            '</button>';
        }

        votingHtml =
          '<div class="stack">' +
          '<div class="big">投票</div>' +
          (candidates
            ? '<div class="muted">同票のため再投票（対象者のみ）</div>'
            : '<div class="muted">少数側だと思う人をタップしてください。</div>') +
          '<div class="stack" id="voteButtons">' +
          buttons +
          '</div>' +
          voteStatusHtml +
          '</div>';
      }
    }

    var voteResultHtml = '';
    var canShowVoteResult = !!(room && room.reveal && room.reveal.revealedAt) || !!votedOutId;
    if (canShowVoteResult && (phase === 'guess' || phase === 'judge' || phase === 'finished')) {
      var rows = '';
      for (var ti = 0; ti < tally.length; ti++) {
        var r = tally[ti];
        rows += '<div class="kv"><span class="muted">' + escapeHtml(r.name) + '</span><b>' + r.count + '</b></div>';
      }
      voteResultHtml = '<hr /><div class="big">投票結果</div><div class="stack">' + rows + '</div>';
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
      var myGuess = room && room.guess && room.guess.guesses && room.guess.guesses[playerId] ? room.guess.guesses[playerId].text : '';
      guessHtml =
        '<div class="stack">' +
        '<div class="big">推理</div>' +
        (votedOutLine
          ? '<div class="kv"><span class="muted">追放</span><b>' + escapeHtml(votedOutLine) + '</b></div>'
          : '') +
        '<div class="muted">少数側が多数側ワードを予想します。</div>' +
        (role === 'minority'
          ? myGuess
            ? '<div class="muted">送信済み：' + escapeHtml(myGuess) + '</div>'
            : '<div class="stack"><input id="guessText" placeholder="多数側ワード" />' +
              '<button id="submitGuess" class="primary">送信</button></div>'
          : '<div class="muted">待機中：少数側の送信を待っています。</div>') +
        '</div>';
    }

    var judgeHtml = '';
    if (phase === 'judge') {
      var guessesObj = (room && room.guess && room.guess.guesses) || {};
      var gKeys = Object.keys(guessesObj);
      var lines = '';
      for (var gi = 0; gi < gKeys.length; gi++) {
        var gpid = gKeys[gi];
        var entry = guessesObj[gpid];
        var pname = room && room.players && room.players[gpid] ? formatPlayerDisplayName(room.players[gpid]) : gpid;
        lines += '<div class="kv"><span class="muted">' + escapeHtml(pname) + '</span><b>' + escapeHtml((entry && entry.text) || '') + '</b></div>';
      }

      judgeHtml =
        '<div class="stack">' +
        '<div class="big">予想一覧</div>' +
        (votedOutLine
          ? '<div class="kv"><span class="muted">追放</span><b>' + escapeHtml(votedOutLine) + '</b></div>'
          : '') +
        '<div class="muted">少数側が入力した予想です。</div>' +
        '<div class="stack">' +
        (lines || '<div class="muted">（まだありません）</div>') +
        '</div>' +
        (isHost
          ? '<hr /><div class="muted">ゲームマスターが勝敗を決定します。</div><div class="row">' +
            '<button id="decideMinority" class="primary">少数側の勝ち</button>' +
            '<button id="decideMajority" class="danger">多数側の勝ち</button>' +
            '</div>'
          : '<div class="muted">待機中：ゲームマスターの判定を待っています。</div>') +
        '</div>';
    }

    var finishedHtml = '';
    if (phase === 'finished') {
      var mj = (room && room.words && room.words.majority) || '';
      var mn = (room && room.words && room.words.minority) || '';
      var winner = (room && room.result && room.result.winner) || '';
      var winnerLabel = winner === 'minority' ? '少数側の勝ち' : winner === 'majority' ? '多数側の勝ち' : '未確定';

      finishedHtml =
        '<div class="stack">' +
        '<div class="big">結果</div>' +
        '<div class="card" style="padding:12px">' +
        '<div class="muted">勝者</div>' +
        '<div class="big">' +
        escapeHtml(winnerLabel) +
        '</div>' +
        '</div>' +
        '<div class="kv"><span class="muted">少数側</span><b>' +
        escapeHtml(minorityLine) +
        '</b></div>' +
        (votedOutLine
          ? '<div class="kv"><span class="muted">追放</span><b>' + escapeHtml(votedOutLine) + '</b></div>'
          : '') +
        '<div class="kv"><span class="muted">多数側ワード</span><b>' +
        escapeHtml(mj) +
        '</b></div>' +
        '<div class="kv"><span class="muted">少数側ワード</span><b>' +
        escapeHtml(mn) +
        '</b></div>' +
        (isHost
          ? ui && ui.showContinueForm
            ? '<hr />' +
              '<div class="big">ゲーム継続</div>' +
              '<div class="muted">同じメンバーで設定を変えてすぐ始めます。</div>' +
              '<div class="field"><label>少数側の人数（最大5）</label>' +
              '<input id="cMinorityCount" type="range" min="1" max="5" step="1" value="' +
              escapeHtml(String((room && room.settings && room.settings.minorityCount) || 1)) +
              '" />' +
              '<div class="kv"><span class="muted">現在</span><b id="cMinorityCountLabel">' +
              escapeHtml(String((room && room.settings && room.settings.minorityCount) || 1)) +
              '</b></div></div>' +
              '<div class="field"><label>トーク時間（分・最大5分）</label>' +
              '<input id="cTalkMinutes" type="range" min="1" max="5" step="1" value="' +
              escapeHtml(String(Math.max(1, Math.min(5, Math.round(((room && room.settings && room.settings.talkSeconds) || 180) / 60))))) +
              '" />' +
              '<div class="kv"><span class="muted">現在</span><b id="cTalkMinutesLabel">' +
              escapeHtml(String(Math.max(1, Math.min(5, Math.round(((room && room.settings && room.settings.talkSeconds) || 180) / 60)))) + '分') +
              '</b></div></div>' +
              '<div class="field"><label>逆転あり（少数側が最後に多数側ワードを当てたら勝ち）</label>' +
              '<select id="cReversal">' +
              '<option value="1"' +
              ((room && room.settings && room.settings.reversal) ? ' selected' : '') +
              '>あり</option>' +
              '<option value="0"' +
              (!(room && room.settings && room.settings.reversal) ? ' selected' : '') +
              '>なし</option>' +
              '</select></div>' +
              '<div class="field"><label>お題カテゴリ</label>' +
              '<select id="cTopicCategory"></select>' +
              '<div class="muted">※ 開始時にワードを確定してDBに保持します。</div></div>' +
              '<div class="row">' +
              '<button id="startContinue" class="primary">この設定で開始</button>' +
              '<button id="cancelContinue" class="ghost">キャンセル</button>' +
              '</div>'
            : '<hr />' +
              '<div class="row">' +
              '<button id="continueGame" class="primary">ゲーム継続</button>' +
              '<button id="changePlayers" class="ghost">参加者変更</button>' +
              '</div>'
          : '') +
        '</div>';
    }

    var selfName = formatPlayerDisplayName(player) || '';
    if (player && player.isHost && (phase === 'lobby' || phase === 'finished')) {
      selfName = formatPlayerMenuName(player);
    }

    var statusCardHtml = '';
    if (phase === 'discussion') {
      statusCardHtml =
        '<div class="card center" style="padding:12px">' +
        '<div class="timer" id="timer">' +
        escapeHtml(formatMMSS(remain)) +
        '</div>' +
        '<div class="big">' +
        escapeHtml(statusText) +
        '</div>' +
        '</div>';
    } else {
      statusCardHtml =
        '<div class="card center" style="padding:12px">' +
        '<div class="big">' +
        escapeHtml(statusText) +
        '</div>' +
        '</div>';
    }

    // Winner/loser background on finished (winner=red, loser=blue)
    try {
      if (viewEl && viewEl.classList) {
        viewEl.classList.remove('result-win');
        viewEl.classList.remove('result-lose');
        if (phase === 'finished') {
          var w = room && room.result && room.result.winner ? String(room.result.winner) : '';
          if ((role === 'minority' || role === 'majority') && (w === 'minority' || w === 'majority')) {
            viewEl.classList.add(role === w ? 'result-win' : 'result-lose');
          }
        }
      }
    } catch (e) {
      // ignore
    }

    render(
      viewEl,
      '\n    <div class="stack">\n      <div class="big">' +
        escapeHtml(selfName) +
        '</div>\n\n      <div class="card" style="padding:12px">\n        <div class="muted">あなたのワード</div>\n        ' +
        wordHtml +
        '\n      </div>\n\n      ' +
        statusCardHtml +
        '\n\n      ' +
        votingHtml +
        guessHtml +
        judgeHtml +
        finishedHtml +
        voteResultHtml +
        '\n\n      <div class="row">' +
        (isHost && phase === 'voting' && isVotingComplete(room) ? '<button id="revealNext" class="primary">結果発表</button>' : '') +
        '</div>\n    </div>\n  '
    );
  }

  // -------------------- main (router) --------------------
  var viewEl = null;

  function makeJoinUrl(roomId) {
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
  }

  var HISTORY_KEY = 'ww_history_v1';
  var HISTORY_LAST_SAVED_KEY = 'ww_history_last_saved_v1';

  function formatDateTime(ms) {
    var d = new Date(ms);
    var y = d.getFullYear();
    var mo = pad2(d.getMonth() + 1);
    var da = pad2(d.getDate());
    var hh = pad2(d.getHours());
    var mm = pad2(d.getMinutes());
    return y + '-' + mo + '-' + da + ' ' + hh + ':' + mm;
  }

  function winnerLabelJa(winner) {
    if (winner === 'minority') return '少数側';
    if (winner === 'majority') return '多数側';
    return '-';
  }

  function loadHistory() {
    var raw = null;
    try {
      raw = localStorage.getItem(HISTORY_KEY);
    } catch (e) {
      raw = null;
    }
    if (!raw) return [];
    try {
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e2) {
      return [];
    }
  }

  function saveHistory(items) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(items || []));
    } catch (e) {
      // ignore
    }
  }

  function loadLastSavedMap() {
    try {
      var raw = localStorage.getItem(HISTORY_LAST_SAVED_KEY);
      if (!raw) return {};
      var obj = JSON.parse(raw);
      return obj && typeof obj === 'object' ? obj : {};
    } catch (e) {
      return {};
    }
  }

  function saveLastSavedMap(map) {
    try {
      localStorage.setItem(HISTORY_LAST_SAVED_KEY, JSON.stringify(map || {}));
    } catch (e) {
      // ignore
    }
  }

  function maybeAppendHistory(roomId, room) {
    if (!room || room.phase !== 'finished') return;
    if (!room.result || !room.result.winner || !room.result.decidedAt) return;

    var decidedAt = room.result.decidedAt;
    var map = loadLastSavedMap();
    if (map[roomId] && map[roomId] === decidedAt) return;

    var items = loadHistory();

    var minorityIds = listMinorityPlayerIds(room);
    var names = [];
    for (var i = 0; i < minorityIds.length; i++) {
      var pid = minorityIds[i];
      var p = room.players && room.players[pid];
      if (!p) continue;
      names.push(formatPlayerDisplayName(p));
    }

    var item = {
      when: formatDateTime(decidedAt),
      winner: winnerLabelJa(room.result.winner),
      minorityNames: names.join(' / '),
      words: (room.words && room.words.majority ? room.words.majority : '-') + ' / ' + (room.words && room.words.minority ? room.words.minority : '-')
    };

    items.unshift(item);
    var MAX = 30;
    if (items.length > MAX) items = items.slice(0, MAX);
    saveHistory(items);

    map[roomId] = decidedAt;
    saveLastSavedMap(map);
  }

  function routeHistory() {
    renderHistory(viewEl, loadHistory());
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
            return joinPlayerInRoom(roomId, playerId, settings.gmName, true).then(function (room) {
              if (!room || !room.players || !room.players[playerId]) {
                throw new Error('ゲームマスターの参加に失敗しました');
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
          return joinPlayerInRoom(roomId, playerId, form.name, false).then(function (room) {
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
          if (errEl) errEl.textContent = 'QRの生成に失敗しました（ライブラリ未読込）。';
          return resolve();
        }

        function showAsImage() {
          if (!qr.toDataURL || !wrapEl) return;
          try {
            qr.toDataURL(joinUrl, { margin: 1, width: 240 }, function (err, url) {
              if (err || !url) {
                if (errEl) errEl.textContent = 'QRの生成に失敗しました。';
                return resolve();
              }
              wrapEl.innerHTML = '<img id="qrImg" alt="QR" src="' + escapeHtml(url) + '" />';
              if (errEl) errEl.textContent = '（QRは画像で表示しています）';
              return resolve();
            });
          } catch (e) {
            if (errEl) errEl.textContent = 'QRの生成に失敗しました。';
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
              if (errEl) errEl.textContent = 'QRの生成に失敗しました。';
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
          if (errEl) errEl.textContent = 'QRの生成に失敗しました。';
          showAsImage();
        }
      });
    }

    function renderWithRoom(room) {
      renderHostQr(viewEl, { roomId: roomId, joinUrl: joinUrl, room: room });
      drawQr();

      var copyBtn = document.getElementById('copyJoinUrl');
      if (copyBtn) {
        copyBtn.addEventListener('click', function () {
          var st = document.getElementById('copyStatus');
          if (st) st.textContent = 'コピー中...';
          copyTextToClipboard(joinUrl)
            .then(function (ok) {
              if (!st) return;
              st.textContent = ok ? 'コピーしました' : 'コピーできませんでした（長押しで選択してコピーしてください）';
            })
            .catch(function () {
              if (st) st.textContent = 'コピーできませんでした（長押しで選択してコピーしてください）';
            });
        });
      }

      var startGameBtn = document.getElementById('startGame');
      if (startGameBtn)
        startGameBtn.addEventListener('click', function () {
          startGame(roomId)
            .then(function () {
              var q = {};
              var v = getCacheBusterParam();
              if (v) q.v = v;
              q.room = roomId;
              q.player = '1';
              q.host = '1';
              setQuery(q);
              route();
            })
            .catch(function (e) {
              alert((e && e.message) || '失敗');
            });
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
    var ui = { showContinueForm: false };

    function rerenderTimer(room) {
      var el = document.getElementById('timer');
      if (!el) return;
      if (!room || room.phase !== 'discussion') return;
      var endAt = room && room.discussion && room.discussion.endsAt ? room.discussion.endsAt : 0;
      var remain = Math.max(0, Math.floor((endAt - serverNowMs()) / 1000));
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
          renderPlayer(viewEl, { roomId: roomId, playerId: playerId, player: player, room: room, isHost: isHost, ui: ui });

          if (isHost) {
            maybeAppendHistory(roomId, room);
          }

          if ((room && room.phase) !== 'discussion') autoVoteRequested = false;

          if (timerHandle) clearInterval(timerHandle);
          timerHandle = setInterval(function () {
            rerenderTimer(room);
            if (!autoVoteRequested && room && room.phase === 'discussion') {
              var endAt = room.discussion && room.discussion.endsAt ? room.discussion.endsAt : 0;
              if (endAt && serverNowMs() >= endAt) {
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

          var voteBtns = document.querySelectorAll('.voteBtn');
          for (var i = 0; i < voteBtns.length; i++) {
            (function (btn) {
              btn.addEventListener('click', function () {
                var toPlayerId = String(btn.getAttribute('data-to') || '').trim();
                if (!toPlayerId) return;
                submitVote(roomId, playerId, toPlayerId).catch(function (e) {
                  alert((e && e.message) || '失敗');
                });
              });
            })(voteBtns[i]);
          }

          var decideMinorityBtn = document.getElementById('decideMinority');
          if (decideMinorityBtn) {
            decideMinorityBtn.addEventListener('click', function () {
              decideWinner(roomId, 'minority').catch(function (e) {
                alert((e && e.message) || '失敗');
              });
            });
          }

          var decideMajorityBtn = document.getElementById('decideMajority');
          if (decideMajorityBtn) {
            decideMajorityBtn.addEventListener('click', function () {
              decideWinner(roomId, 'majority').catch(function (e) {
                alert((e && e.message) || '失敗');
              });
            });
          }

          var revealNextBtn = document.getElementById('revealNext');
          if (revealNextBtn) {
            revealNextBtn.addEventListener('click', function () {
              revealAfterVoting(roomId).catch(function (e) {
                alert((e && e.message) || '失敗');
              });
            });
          }

          var continueBtn = document.getElementById('continueGame');
          if (continueBtn) {
            continueBtn.addEventListener('click', function () {
              ui.showContinueForm = true;
              renderPlayer(viewEl, { roomId: roomId, playerId: playerId, player: player, room: room, isHost: isHost, ui: ui });

              var sel = document.getElementById('cTopicCategory');
              if (sel) {
                var html = '<option value="random">ランダム</option>';
                for (var i = 0; i < TOPIC_CATEGORIES.length; i++) {
                  html += '<option value="' + escapeHtml(TOPIC_CATEGORIES[i].id) + '">' + escapeHtml(TOPIC_CATEGORIES[i].name) + '</option>';
                }
                sel.innerHTML = html;
                var current = room && room.topic && room.topic.categoryId ? String(room.topic.categoryId) : 'random';
                sel.value = current || 'random';
              }

              function updateLabels() {
                var mc = document.getElementById('cMinorityCount');
                var mcl = document.getElementById('cMinorityCountLabel');
                if (mc && mcl) mcl.textContent = String(mc.value);
                var tm = document.getElementById('cTalkMinutes');
                var tml = document.getElementById('cTalkMinutesLabel');
                if (tm && tml) tml.textContent = String(tm.value) + '分';
              }

              var mcEl = document.getElementById('cMinorityCount');
              if (mcEl) mcEl.addEventListener('input', updateLabels);
              var tmEl = document.getElementById('cTalkMinutes');
              if (tmEl) tmEl.addEventListener('input', updateLabels);
              updateLabels();

              var cancelBtn = document.getElementById('cancelContinue');
              if (cancelBtn) {
                cancelBtn.addEventListener('click', function () {
                  ui.showContinueForm = false;
                  renderPlayer(viewEl, { roomId: roomId, playerId: playerId, player: player, room: room, isHost: isHost, ui: ui });
                });
              }

              var startBtn = document.getElementById('startContinue');
              if (startBtn) {
                startBtn.addEventListener('click', function () {
                  var mc2 = document.getElementById('cMinorityCount');
                  var tm2 = document.getElementById('cTalkMinutes');
                  var rv2 = document.getElementById('cReversal');
                  var tc2 = document.getElementById('cTopicCategory');
                  var minorityCount = clamp(parseIntSafe(mc2 && mc2.value, 1), 1, 5);
                  var talkMinutes = clamp(parseIntSafe(tm2 && tm2.value, 3), 1, 5);
                  var talkSeconds = talkMinutes * 60;
                  var reversal = ((rv2 && rv2.value) || '1') === '1';
                  var topicCategoryId = String((tc2 && tc2.value) || 'random');

                  startBtn.disabled = true;
                  restartGameWithSettings(roomId, {
                    minorityCount: minorityCount,
                    talkSeconds: talkSeconds,
                    reversal: reversal,
                    topicCategoryId: topicCategoryId
                  })
                    .then(function () {
                      ui.showContinueForm = false;
                    })
                    .catch(function (e) {
                      alert((e && e.message) || '失敗');
                    })
                    .finally(function () {
                      startBtn.disabled = false;
                    });
                });
              }
            });
          }

          var changePlayersBtn = document.getElementById('changePlayers');
          if (changePlayersBtn) {
            changePlayersBtn.addEventListener('click', function () {
              changePlayersBtn.disabled = true;
              resetRoomForPlayerChange(roomId, playerId)
                .then(function () {
                  var q = {};
                  var v = getCacheBusterParam();
                  if (v) q.v = v;
                  setQuery(q);
                  route();
                })
                .catch(function (e) {
                  alert((e && e.message) || '失敗');
                })
                .finally(function () {
                  changePlayersBtn.disabled = false;
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

    if (screen === 'codenames_create') return routeCodenamesCreate();

    if (screen === 'setup') return routeSetup();
    if (screen === 'history') return routeHistory();
    if (screen === 'create') return routeCreate();

    if (screen === 'codenames_join') {
      if (!roomId) return routeHome();
      return routeCodenamesJoin(roomId, isHost);
    }
    if (screen === 'codenames_host') {
      if (!roomId) return routeHome();
      return routeCodenamesHost(roomId);
    }
    if (screen === 'codenames_player') {
      if (!roomId) return routeHome();
      return routeCodenamesPlayer(roomId, isHost);
    }

    if (!roomId) return routeHome();

    if (screen === 'join') return routeJoin(roomId, isHost);
    if (isPlayer) return routePlayer(roomId, isHost);
    if (isHost) return routeHost(roomId);

    return routeJoin(roomId, false);
  }

  function routeCodenamesCreate() {
    renderCodenamesCreate(viewEl);
    var btn = document.getElementById('cnCreateRoom');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var settings;
      try {
        settings = readCodenamesCreateForm();
      } catch (e) {
        renderError(viewEl, (e && e.message) || '作成に失敗しました');
        return;
      }

      var roomId = makeRoomId();
      firebaseReady()
        .then(function () {
          return createCodenamesRoom(roomId, settings);
        })
        .then(function () {
          var playerId = getOrCreateCodenamesPlayerId(roomId);
          return joinPlayerInCodenamesRoom(roomId, playerId, settings.name, true);
        })
        .then(function () {
          var q = {};
          var v = getCacheBusterParam();
          if (v) q.v = v;
          q.room = roomId;
          q.host = '1';
          q.screen = 'codenames_host';
          setQuery(q);
          route();
        })
        .catch(function (e) {
          renderError(viewEl, (e && e.message) || '作成に失敗しました');
        });
    });
  }

  function routeCodenamesJoin(roomId, isHost) {
    renderCodenamesJoin(viewEl, roomId);
    var btn = document.getElementById('cnJoin');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var form;
      try {
        form = readCodenamesJoinForm();
      } catch (e) {
        renderError(viewEl, (e && e.message) || '参加に失敗しました');
        return;
      }

      firebaseReady()
        .then(function () {
          var playerId = getOrCreateCodenamesPlayerId(roomId);
          return joinPlayerInCodenamesRoom(roomId, playerId, form.name, false).then(function (room) {
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
          q.screen = 'codenames_player';
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

  function routeCodenamesHost(roomId) {
    var unsub = null;
    var joinUrl = makeCodenamesJoinUrl(roomId);
    var hostPlayerId = getOrCreateCodenamesPlayerId(roomId);

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
          if (errEl) errEl.textContent = 'QRの生成に失敗しました（ライブラリ未読込）。';
          return resolve();
        }

        function showAsImage() {
          if (!qr.toDataURL || !wrapEl) return;
          try {
            qr.toDataURL(joinUrl, { margin: 1, width: 240 }, function (err, url) {
              if (err || !url) {
                if (errEl) errEl.textContent = 'QRの生成に失敗しました。';
                return resolve();
              }
              wrapEl.innerHTML = '<img id="qrImg" alt="QR" src="' + escapeHtml(url) + '" />';
              if (errEl) errEl.textContent = '（QRは画像で表示しています）';
              return resolve();
            });
          } catch (e) {
            if (errEl) errEl.textContent = 'QRの生成に失敗しました。';
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
            return false;
          }
        }

        try {
          qr.toCanvas(canvas, joinUrl, { margin: 1, width: 240 }, function (err) {
            if (err) {
              if (errEl) errEl.textContent = 'QRの生成に失敗しました。';
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
          if (errEl) errEl.textContent = 'QRの生成に失敗しました。';
          showAsImage();
        }
      });
    }

    function renderWithRoom(room) {
      renderCodenamesHost(viewEl, { roomId: roomId, joinUrl: joinUrl, room: room, hostPlayerId: hostPlayerId });
      drawQr();

      var copyBtn = document.getElementById('copyJoinUrl');
      if (copyBtn) {
        copyBtn.addEventListener('click', function () {
          var st = document.getElementById('copyStatus');
          if (st) st.textContent = 'コピー中...';
          copyTextToClipboard(joinUrl)
            .then(function (ok) {
              if (!st) return;
              st.textContent = ok ? 'コピーしました' : 'コピーできませんでした（長押しで選択してコピーしてください）';
            })
            .catch(function () {
              if (st) st.textContent = 'コピーできませんでした（長押しで選択してコピーしてください）';
            });
        });
      }

      var startBtn = document.getElementById('cnStart');
      if (startBtn) {
        startBtn.addEventListener('click', function () {
          startCodenamesGame(roomId)
            .then(function () {
              var q = {};
              var v = getCacheBusterParam();
              if (v) q.v = v;
              q.room = roomId;
              q.host = '1';
              q.player = '1';
              q.screen = 'codenames_player';
              setQuery(q);
              route();
            })
            .catch(function (e) {
              alert((e && e.message) || '失敗');
            });
        });
      }

      var gmSave = document.getElementById('cnGmSave');
      if (gmSave && !gmSave.__cn_bound) {
        gmSave.__cn_bound = true;
        gmSave.addEventListener('click', function () {
          var st = document.getElementById('cnGmStatus');
          if (st) st.textContent = '保存中...';
          var nameEl = document.getElementById('cnGmName');
          var teamEl = document.getElementById('cnGmTeam');
          var roleEl = document.getElementById('cnGmRole');
          var nm = String((nameEl && nameEl.value) || '').trim();
          var tm = String((teamEl && teamEl.value) || '');
          var rl = String((roleEl && roleEl.value) || '');
          setCodenamesPlayerProfile(roomId, hostPlayerId, nm, tm, rl)
            .then(function () {
              if (st) st.textContent = '保存しました';
            })
            .catch(function (e) {
              if (st) st.textContent = '保存できませんでした';
              alert((e && e.message) || '失敗');
            });
        });
      }
    }

    firebaseReady()
      .then(function () {
        return subscribeCodenamesRoom(roomId, function (room) {
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

  function routeCodenamesPlayer(roomId, isHost) {
    var playerId = getOrCreateCodenamesPlayerId(roomId);
    var unsub = null;

    firebaseReady()
      .then(function () {
        return subscribeCodenamesRoom(roomId, function (room) {
          if (!room) {
            renderError(viewEl, '部屋が見つかりません');
            return;
          }

          var player = room.players ? room.players[playerId] : null;
          renderCodenamesPlayer(viewEl, { roomId: roomId, playerId: playerId, room: room, player: player, isHost: isHost });

          var saveBtn = document.getElementById('cnSavePrefs');
          if (saveBtn && !saveBtn.__cn_bound) {
            saveBtn.__cn_bound = true;
            saveBtn.addEventListener('click', function () {
              var teamSel = document.getElementById('cnTeam');
              var roleSel = document.getElementById('cnRole');
              var team = String((teamSel && teamSel.value) || '');
              var role = String((roleSel && roleSel.value) || '');
              setCodenamesPlayerPrefs(roomId, playerId, team, role).catch(function (e) {
                alert((e && e.message) || '失敗');
              });
            });
          }

          var startFromPlayerBtn = document.getElementById('cnStartFromPlayer');
          if (startFromPlayerBtn && !startFromPlayerBtn.__cn_bound) {
            startFromPlayerBtn.__cn_bound = true;
            startFromPlayerBtn.addEventListener('click', function () {
              startCodenamesGame(roomId).catch(function (e) {
                alert((e && e.message) || '失敗');
              });
            });
          }

          var contBtn = document.getElementById('cnContinue');
          if (contBtn && !contBtn.__cn_bound) {
            contBtn.__cn_bound = true;
            contBtn.addEventListener('click', function () {
              resetCodenamesToLobby(roomId).catch(function (e) {
                alert((e && e.message) || '失敗');
              });
            });
          }

          var changeBtn = document.getElementById('cnChangePlayers');
          if (changeBtn && !changeBtn.__cn_bound) {
            changeBtn.__cn_bound = true;
            changeBtn.addEventListener('click', function () {
              resetCodenamesForNewPlayers(roomId, playerId)
                .then(function () {
                  var q = {};
                  var v = getCacheBusterParam();
                  if (v) q.v = v;
                  q.room = roomId;
                  q.host = '1';
                  q.screen = 'codenames_host';
                  setQuery(q);
                  route();
                })
                .catch(function (e) {
                  alert((e && e.message) || '失敗');
                });
            });
          }

          var clueBtn = document.getElementById('cnSubmitClue');
          if (clueBtn && !clueBtn.__cn_bound) {
            clueBtn.__cn_bound = true;
            clueBtn.addEventListener('click', function () {
              var wEl = document.getElementById('cnClueWord');
              var nEl = document.getElementById('cnClueNum');
              var w = String((wEl && wEl.value) || '');
              var n = parseIntSafe(nEl && nEl.value, 0);
              submitCodenamesClue(roomId, playerId, w, n).catch(function (e) {
                alert((e && e.message) || '失敗');
              });
            });
          }

          var endBtn = document.getElementById('cnEndTurn');
          if (endBtn && !endBtn.__cn_bound) {
            endBtn.__cn_bound = true;
            endBtn.addEventListener('click', function () {
              endCodenamesTurn(roomId).catch(function (e) {
                alert((e && e.message) || '失敗');
              });
            });
          }

          function confirmPick(idx) {
            if (idx == null) return;
            revealCodenamesCard(roomId, playerId, idx).catch(function (e) {
              alert((e && e.message) || '失敗');
            });
          }

          var pickBtns = document.querySelectorAll('.cnPick');
          for (var i = 0; i < pickBtns.length; i++) {
            var b = pickBtns[i];
            if (b.__cn_bound) continue;
            b.__cn_bound = true;

            (function (btn) {
              var holdMs = CN_LONG_PRESS_MS;
              var timer = null;
              var longFired = false;

              function clearTimer() {
                if (timer) {
                  clearTimeout(timer);
                  timer = null;
                }
              }

              function getIdxFromEvent(ev) {
                var el = ev && ev.currentTarget ? ev.currentTarget : btn;
                if (!el) return null;
                return el.getAttribute('data-idx');
              }

              btn.addEventListener('click', function (ev) {
                // Short tap: pending toggle. If long-press fired, ignore the click.
                if (longFired) {
                  longFired = false;
                  if (ev && ev.preventDefault) ev.preventDefault();
                  if (ev && ev.stopPropagation) ev.stopPropagation();
                  return;
                }
                if (ev && ev.preventDefault) ev.preventDefault();
                var idx = getIdxFromEvent(ev);
                toggleCodenamesPending(roomId, playerId, idx).catch(function (e) {
                  alert((e && e.message) || '失敗');
                });
              });

              if (typeof PointerEvent !== 'undefined') {
                btn.addEventListener('pointerdown', function (ev) {
                  // Only primary button / touch
                  if (ev && ev.button != null && ev.button !== 0) return;
                  if (ev && ev.preventDefault) ev.preventDefault();
                  clearTimer();
                  longFired = false;
                  var idx = getIdxFromEvent(ev);
                  timer = setTimeout(function () {
                    longFired = true;
                    clearTimer();
                    confirmPick(idx);
                  }, holdMs);
                });
                btn.addEventListener('pointerup', clearTimer);
                btn.addEventListener('pointercancel', clearTimer);
                btn.addEventListener('pointerleave', clearTimer);
              } else {
                btn.addEventListener('touchstart', function (ev) {
                  if (ev && ev.preventDefault) ev.preventDefault();
                  clearTimer();
                  longFired = false;
                  var idx = getIdxFromEvent(ev);
                  timer = setTimeout(function () {
                    longFired = true;
                    clearTimer();
                    confirmPick(idx);
                  }, holdMs);
                });
                btn.addEventListener('touchend', clearTimer);
                btn.addEventListener('touchcancel', clearTimer);

                btn.addEventListener('mousedown', function (ev) {
                  if (ev && ev.button != null && ev.button !== 0) return;
                  clearTimer();
                  longFired = false;
                  var idx = getIdxFromEvent(ev);
                  timer = setTimeout(function () {
                    longFired = true;
                    clearTimer();
                    confirmPick(idx);
                  }, holdMs);
                });
                btn.addEventListener('mouseup', clearTimer);
                btn.addEventListener('mouseleave', clearTimer);
              }

              btn.addEventListener('contextmenu', function (ev) {
                if (ev && ev.preventDefault) ev.preventDefault();
              });
            })(b);
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
    });
  }

  function setupRulesButton() {
    var btn = null;
    try {
      btn = document.getElementById('rulesBtn');
    } catch (e) {
      btn = null;
    }
    if (!btn) return;
    if (btn.__ww_bound) return;
    btn.__ww_bound = true;

    btn.addEventListener('click', function () {
      var q = parseQuery();
      var s = q && q.screen ? String(q.screen) : '';
      if (s.indexOf('codenames_') === 0) {
        var cl = [];
        cl.push('【コードネーム ルール】');
        cl.push('1) 部屋を作成 → QRで参加');
        cl.push('2) 各自でチーム（赤/青）と役職（スパイマスター/諜報員）を選ぶ');
        cl.push('3) 各チーム「スパイマスター1人 + 諜報員1人以上」が揃ったらスタート');
        cl.push('4) 手番チームのスパイマスターがヒント（単語・数）を出す');
        cl.push('5) 諜報員がカードをめくる（自分の色なら続行、違う色/中立なら手番交代）');
        cl.push('6) 暗殺者をめくると、そのチームの負け');
        cl.push('7) 自分の色を全てめくったチームの勝ち');
        alert(cl.join('\n'));
        return;
      }

      var lines = [];
      lines.push('【ワードウルフ ルール】');
      lines.push('1) ゲームマスターが部屋を作成し、QRを配布');
      lines.push('2) スタート → トーク（少数側を探す）');
      lines.push('3) 投票（同票なら同票者で再投票）');
      lines.push('   ※ 再投票でも同票なら少数側の勝ち');
      lines.push('4) 結果発表');
      lines.push('   - 多数側が追放されたら少数側の勝ち');
      lines.push('   - 少数側が追放され、逆転ありの場合：少数側が多数側ワードを入力 → 予想一覧 → ゲームマスターが判定');
      lines.push('   - 逆転なしの場合：多数側の勝ち');
      alert(lines.join('\n'));
    });
  }

  // boot
  try {
    viewEl = qs('#view');
    setupRulesButton();
    var buildInfoEl = document.querySelector('#buildInfo');
    if (buildInfoEl) {
      var assetV = getCacheBusterParam();
      buildInfoEl.textContent = 'v0.14 (B_BoardGames + codenames)' + (assetV ? ' / assets ' + assetV : '');
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

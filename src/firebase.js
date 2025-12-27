// Firebase v9 compat (UMD) を動的に読み込んで、静的ホスティングのみで動かす。
// ※ npm不要。GitHub Pages でも動作。

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load: ${src}`));
    document.head.appendChild(s);
  });
}

let _ready;

const LS_KEY = 'ww_firebase_config_v1';

async function loadFirebaseConfig() {
  // 1) `src/config.js` が存在する場合はそれを優先
  try {
    const mod = await import('./config.js');
    if (mod?.firebaseConfig?.apiKey) return mod.firebaseConfig;
  } catch {
    // ignore
  }

  // 2) セットアップ画面で保存した設定
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return null;
  }
}

export function saveFirebaseConfigToLocalStorage(config) {
  localStorage.setItem(LS_KEY, JSON.stringify(config));
}

export function loadFirebaseConfigFromLocalStorage() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function firebaseReady() {
  if (_ready) return _ready;

  _ready = (async () => {
    const firebaseConfig = await loadFirebaseConfig();
    if (!firebaseConfig || !firebaseConfig.apiKey) {
      throw new Error('Firebase設定がありません。?screen=setup で設定してください。');
    }

    // firebase-app-compat + firebase-database-compat
    await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js');

    // global firebase
    firebase.initializeApp(firebaseConfig);
    return firebase.database();
  })();

  return _ready;
}

export async function dbRef(path) {
  const db = await firebaseReady();
  return db.ref(path);
}

export async function onValue(path, cb) {
  const ref = await dbRef(path);
  const handler = (snap) => cb(snap.val());
  ref.on('value', handler);
  return () => ref.off('value', handler);
}

export async function setValue(path, value) {
  const ref = await dbRef(path);
  await ref.set(value);
}

export async function updateValue(path, patch) {
  const ref = await dbRef(path);
  await ref.update(patch);
}

export async function pushValue(path, value) {
  const ref = await dbRef(path);
  const child = ref.push();
  await child.set(value);
  return child.key;
}

export async function runTxn(path, updateFn) {
  const ref = await dbRef(path);
  const res = await ref.transaction((current) => updateFn(current));
  return res.snapshot.val();
}

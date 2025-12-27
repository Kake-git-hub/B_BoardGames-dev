import { escapeHtml, formatMMSS, parseIntSafe, clamp } from './utils.js';

export function render(viewEl, html) {
  viewEl.innerHTML = html;
}

export function renderError(viewEl, message) {
  render(
    viewEl,
    `
    <div class="stack">
      <div class="badge">エラー</div>
      <div class="big">${escapeHtml(message)}</div>
      <div class="muted">設定やURLを確認してください。</div>
    </div>
  `
  );
}

export function renderHome(viewEl) {
  render(
    viewEl,
    `
    <div class="stack">
      <div class="big">はじめる</div>
      <div class="muted">ゲームマスターが部屋を作り、QRを配布します。</div>

      <hr />

      <div class="stack">
        <a class="btn primary" id="goCreate" href="?screen=create">部屋を作る（ゲームマスター）</a>
        <a class="btn ghost" id="goSetup" href="?screen=setup">セットアップ（Firebase設定）</a>

        <div class="field">
          <label>ルームIDがある場合（参加者）</label>
          <div class="row">
            <input id="joinRoomId" placeholder="例: a1b2c3d4" inputmode="latin" />
            <button id="goJoin" class="ghost">参加</button>
          </div>
          <div class="muted">QRが読めない時の手入力用です。</div>
        </div>
      </div>
    </div>
  `
  );
}

export function renderSetup(viewEl) {
  render(
    viewEl,
    `
    <div class="stack">
      <div class="big">セットアップ</div>
      <div class="muted">Firebase（Realtime Database）のWeb設定JSONを貼り付けて保存します。</div>

      <div class="field">
        <label>Firebase config（JSON）</label>
        <textarea id="firebaseConfigJson" placeholder='{"apiKey":"...","authDomain":"...","databaseURL":"...","projectId":"...","appId":"..."}'></textarea>
        <div class="muted">※ `databaseURL` が入っていることを確認してください。</div>
      </div>

      <div class="row">
        <button id="saveSetup" class="primary">保存</button>
        <button id="backHome" class="ghost">戻る</button>
      </div>

      <hr />

      <div class="muted">
        Database Rules（開発用・最低限）:
        <div class="code">{ "rules": { "rooms": { "$roomId": { ".read": true, ".write": true } } } }</div>
      </div>
    </div>
  `
  );
}

export function readSetupForm() {
  const raw = String(document.getElementById('firebaseConfigJson')?.value || '').trim();
  if (!raw) throw new Error('Firebase config JSON を貼り付けてください。');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('JSONとして解釈できません。');
  }
  if (!parsed || !parsed.apiKey) throw new Error('apiKey が見つかりません。');
  if (!parsed.databaseURL) throw new Error('databaseURL が見つかりません。');
  return parsed;
}

export function renderCreate(viewEl) {
  render(
    viewEl,
    `
    <div class="stack">
      <div class="big">部屋を作成</div>

      <div class="field">
        <label>参加人数（ゲームマスター含む）</label>
        <input id="playerLimit" type="number" min="3" max="30" value="6" />
      </div>

      <div class="field">
        <label>少数側の人数</label>
        <input id="minorityCount" type="number" min="1" max="10" value="1" />
      </div>

      <div class="field">
        <label>トーク時間（秒）</label>
        <input id="talkSeconds" type="number" min="30" max="1800" value="180" />
      </div>

      <div class="field">
        <label>逆転あり（少数側が最後に多数側ワードを当てたら勝ち）</label>
        <select id="reversal">
          <option value="1" selected>あり</option>
          <option value="0">なし</option>
        </select>
      </div>

      <hr />

      <div class="field">
        <label>お題カテゴリ（ランダム出題）</label>
        <div class="row">
          <select id="topicCategory"></select>
          <button id="pickRandom" class="ghost">ランダム出題</button>
        </div>
        <div class="muted">※ 手入力でもOKです。</div>
      </div>

      <div class="field">
        <label>多数側ワード</label>
        <input id="majorityWord" placeholder="例: カレー" />
      </div>

      <div class="field">
        <label>少数側ワード</label>
        <input id="minorityWord" placeholder="例: シチュー" />
        <div class="muted">※ まずは一般的ルールとして、ワードはゲームマスターが手入力。</div>
      </div>

      <hr />

      <div class="row">
        <button id="createRoom" class="primary">作成してQRを表示</button>
        <button id="backHome" class="ghost">戻る</button>
      </div>

      <div class="muted">
        入力を最小限にしています。難しければワードだけ決めてください。
      </div>
    </div>
  `
  );
}

export function readCreateForm() {
  const playerLimit = clamp(parseIntSafe(document.getElementById('playerLimit')?.value, 6), 3, 30);
  const minorityCount = clamp(parseIntSafe(document.getElementById('minorityCount')?.value, 1), 1, 10);
  const talkSeconds = clamp(parseIntSafe(document.getElementById('talkSeconds')?.value, 180), 30, 1800);
  const reversal = (document.getElementById('reversal')?.value || '1') === '1';

  const majorityWord = String(document.getElementById('majorityWord')?.value || '').trim();
  const minorityWord = String(document.getElementById('minorityWord')?.value || '').trim();

  if (minorityCount >= playerLimit) throw new Error('少数側人数は参加人数より小さくしてください。');
  if (!majorityWord) throw new Error('多数側ワードを入力してください。');
  if (!minorityWord) throw new Error('少数側ワードを入力してください。');

  return { playerLimit, minorityCount, talkSeconds, reversal, majorityWord, minorityWord };
}

export function initTopicCategorySelect(categories) {
  const sel = document.getElementById('topicCategory');
  if (!sel) return;
  sel.innerHTML = categories
    .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`)
    .join('');
}

export function setWords(majority, minority) {
  const mj = document.getElementById('majorityWord');
  const mn = document.getElementById('minorityWord');
  if (mj) mj.value = majority;
  if (mn) mn.value = minority;
}

export function renderJoin(viewEl, roomId) {
  render(
    viewEl,
    `
    <div class="stack">
      <div class="big">参加</div>
      <div class="kv"><span class="muted">ルームID</span><b>${escapeHtml(roomId)}</b></div>

      <div class="field">
        <label>名前（表示用）</label>
        <input id="playerName" placeholder="例: たろう" />
      </div>

      <div class="row">
        <button id="join" class="primary">参加する</button>
        <button id="backHome" class="ghost">戻る</button>
      </div>

      <div class="muted">参加後は、この端末だけに役職とワードが表示されます。</div>
    </div>
  `
  );
}

export function readJoinForm() {
  const name = String(document.getElementById('playerName')?.value || '').trim();
  if (!name) throw new Error('名前を入力してください。');
  return { name };
}

export function renderHostQr(viewEl, { roomId, joinUrl, hostUrl, room }) {
  const playerCount = room?.players ? Object.keys(room.players).length : 0;
  const limit = room?.settings?.playerLimit ?? 0;

  render(
    viewEl,
    `
    <div class="stack">
      <div class="big">QR配布</div>
      <div class="muted">参加者はこのQRを読み取って参加します。</div>

      <div class="field">
        <label>参加者用URL</label>
        <div class="code" id="joinUrl">${escapeHtml(joinUrl)}</div>
      </div>

      <div class="center">
        <canvas id="qr"></canvas>
      </div>

      <div class="kv"><span class="muted">参加状況</span><b>${playerCount} / ${limit}</b></div>
      <div class="kv"><span class="muted">フェーズ</span><b>${escapeHtml(room?.phase || '-') }</b></div>

      <hr />

      <div class="stack">
        <div class="row">
          <button id="copyJoin" class="ghost">URLコピー</button>
          <a class="badge" href="${escapeHtml(hostUrl)}">この端末をGMモードで開く</a>
        </div>

        <div class="row">
          <button id="hostJoin" class="primary">GMも参加（名前入力へ）</button>
          <button id="startAssign" class="ghost">役職配布（全員揃ったら）</button>
        </div>

        <div class="row">
          <button id="startDiscussion" class="ghost">トーク開始</button>
          <button id="reveal" class="danger">開示（少数側発表）</button>
        </div>

        <div class="row">
          <button id="startVoting" class="ghost">投票開始</button>
          <button id="revealVotes" class="ghost">集計して開示</button>
        </div>
      </div>

      <div class="muted">※ 役職配布→トーク開始→開示 の順に進めます。</div>
    </div>
  `
  );
}

export function renderPlayer(viewEl, { roomId, playerId, player, room, isHost }) {
  const role = player?.role || 'unknown';
  const phase = room?.phase || 'lobby';

  const players = room?.players || {};
  const activePlayers = Object.entries(players)
    .filter(([, p]) => p && p.role !== 'spectator')
    .map(([id, p]) => ({ id, name: p.name || '' }));

  const votedTo = room?.votes?.[playerId]?.to || '';

  const tally = (() => {
    const votes = room?.votes || {};
    const counts = new Map();
    for (const v of Object.values(votes)) {
      if (!v?.to) continue;
      counts.set(v.to, (counts.get(v.to) || 0) + 1);
    }
    const rows = activePlayers
      .map((p) => ({ ...p, count: counts.get(p.id) || 0 }))
      .sort((a, b) => b.count - a.count);
    return rows;
  })();

  const word =
    role === 'minority'
      ? room?.words?.minority
      : role === 'majority'
        ? room?.words?.majority
        : '';

  const roleLabel =
    role === 'minority'
      ? '少数側'
      : role === 'majority'
        ? '多数側'
        : role === 'spectator'
          ? '観戦'
          : '未確定';

  const endAt = room?.discussion?.endsAt || 0;
  const now = Date.now();
  const remain = Math.max(0, Math.floor((endAt - now) / 1000));

  render(
    viewEl,
    `
    <div class="stack">
      <div class="row" style="justify-content:space-between">
        <div>
          <div class="badge">ルーム ${escapeHtml(roomId)}</div>
          <div class="big">${escapeHtml(player?.name || '')}</div>
        </div>
        <div class="badge">${escapeHtml(phase)}</div>
      </div>

      <div class="card" style="padding:12px">
        <div class="muted">あなたの役職</div>
        <div class="big">${escapeHtml(roleLabel)}</div>
        <hr />
        <div class="muted">あなたのワード</div>
        <div class="big">${escapeHtml(word || '（未配布）')}</div>
      </div>

      <div class="card center" style="padding:12px">
        <div class="muted">残り時間</div>
        <div class="timer" id="timer">${formatMMSS(remain)}</div>
      </div>

      ${room?.phase === 'voting' ? `
        <div class="stack">
          <div class="big">投票</div>
          <div class="muted">少数側だと思う人を選んで投票します。</div>
          <div class="row">
            <select id="voteTo">
              <option value="">選択…</option>
              ${activePlayers
                .filter((p) => p.id !== playerId)
                .map((p) => `<option value="${escapeHtml(p.id)}" ${p.id === votedTo ? 'selected' : ''}>${escapeHtml(p.name)}</option>`)
                .join('')}
            </select>
            <button id="submitVote" class="primary">投票</button>
          </div>
          ${votedTo ? `<div class="muted">投票済み</div>` : `<div class="muted">未投票</div>`}
        </div>
      ` : ''}

      ${room?.phase === 'voteResult' ? `
        <div class="stack">
          <div class="big">投票結果</div>
          <div class="muted">得票数（多い順）</div>
          <div class="stack">
            ${tally
              .map((r) => `<div class="kv"><span class="muted">${escapeHtml(r.name)}</span><b>${r.count}</b></div>`)
              .join('')}
          </div>
          <div class="muted">GMが次に「開示（少数側発表）」を押すと最終結果に進みます。</div>
        </div>
      ` : ''}

      ${room?.phase === 'guess' ? `
        <div class="stack">
          <div class="muted">逆転あり: 少数側は多数側ワードを入力</div>
          <div class="row">
            <input id="guessText" placeholder="多数側ワード" />
            <button id="submitGuess" class="primary">確定</button>
          </div>
          <div class="muted">※ 入力した内容は確定後に全員に表示されます。</div>
        </div>
      ` : ''}

      ${room?.phase === 'finished' ? `
        <div class="stack">
          <div class="big">結果</div>
          <div class="muted">少数側: 多数側ワードを当てれば勝ち（逆転あり時）</div>
          <div class="kv"><span class="muted">多数側ワード</span><b>${escapeHtml(room?.words?.majority || '')}</b></div>
          <div class="kv"><span class="muted">少数側ワード</span><b>${escapeHtml(room?.words?.minority || '')}</b></div>
          ${room?.settings?.reversal ? `
            <hr />
            <div class="kv"><span class="muted">少数側の回答</span><b>${escapeHtml(room?.guess?.guessText || '（未回答）')}</b></div>
            <div class="kv"><span class="muted">正誤</span><b>${room?.guess?.correct === true ? '正解（少数側勝ち）' : room?.guess?.correct === false ? '不正解（多数側勝ち）' : '未確定'}</b></div>
          ` : ''}

          <hr />
          <div class="muted">投票結果（得票数）</div>
          <div class="stack">
            ${tally
              .map((r) => `<div class="kv"><span class="muted">${escapeHtml(r.name)}</span><b>${r.count}</b></div>`)
              .join('')}
          </div>
        </div>
      ` : ''}

      <div class="row">
        <button id="leave" class="ghost">ホームへ</button>
        ${isHost ? `<span class="badge">GM端末</span>` : ``}
      </div>
    </div>
  `
  );
}

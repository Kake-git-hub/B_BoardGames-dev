import { qs } from './utils.js';
import {
  getUrlState,
  makeRoomId,
  createRoom,
  getOrCreatePlayerId,
  upsertPlayer,
  startGameAssignRoles,
  startDiscussion,
  startVoting,
  revealVoteResult,
  reveal,
  submitVote,
  submitGuess,
  subscribeRoom,
} from './state.js';
import {
  renderHome,
  renderSetup,
  readSetupForm,
  renderCreate,
  readCreateForm,
  initTopicCategorySelect,
  setWords,
  renderJoin,
  readJoinForm,
  renderHostQr,
  renderPlayer,
  renderError,
} from './ui.js';
import { firebaseReady, saveFirebaseConfigToLocalStorage } from './firebase.js';
import { formatMMSS } from './utils.js';
import { TOPIC_CATEGORIES, pickRandomPair } from './topics.js';

const viewEl = qs('#view');
const buildInfoEl = qs('#buildInfo');
buildInfoEl.textContent = `v0.1 (static)`;

function setSearch(params) {
  const url = new URL(location.href);
  url.search = params.toString();
  history.pushState(null, '', url.toString());
}

function makeJoinUrl(roomId) {
  const url = new URL(location.href);
  url.searchParams.set('room', roomId);
  url.searchParams.delete('host');
  return url.toString();
}

function makeHostUrl(roomId) {
  const url = new URL(location.href);
  url.searchParams.set('room', roomId);
  url.searchParams.set('host', '1');
  return url.toString();
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    return false;
  }
}

function routeHome() {
  renderHome(viewEl);

  qs('#goCreate').addEventListener('click', () => {
    setSearch(new URLSearchParams({ screen: 'create' }));
    route();
  });

  qs('#goSetup').addEventListener('click', () => {
    setSearch(new URLSearchParams({ screen: 'setup' }));
    route();
  });

  qs('#goJoin').addEventListener('click', () => {
    const rid = String(qs('#joinRoomId').value || '').trim();
    if (!rid) return;
    setSearch(new URLSearchParams({ room: rid }));
    route();
  });
}

function routeSetup() {
  renderSetup(viewEl);

  qs('#backHome').addEventListener('click', () => {
    setSearch(new URLSearchParams());
    route();
  });

  qs('#saveSetup').addEventListener('click', async () => {
    try {
      const cfg = readSetupForm();
      saveFirebaseConfigToLocalStorage(cfg);
      // 接続確認
      await firebaseReady();
      alert('保存しました。');
      setSearch(new URLSearchParams());
      route();
    } catch (e) {
      renderError(viewEl, (e && e.message) || '保存に失敗しました');
    }
  });
}

function routeCreate() {
  renderCreate(viewEl);
  initTopicCategorySelect(TOPIC_CATEGORIES);

  qs('#backHome').addEventListener('click', () => {
    setSearch(new URLSearchParams());
    route();
  });

  qs('#pickRandom').addEventListener('click', () => {
    const el = document.getElementById('topicCategory');
    const catId = String((el && el.value) || TOPIC_CATEGORIES[0].id);
    try {
      const picked = pickRandomPair(catId);
      setWords(picked.majority, picked.minority);
    } catch (e) {
      alert((e && e.message) || '出題に失敗しました');
    }
  });

  qs('#createRoom').addEventListener('click', async () => {
    try {
      await firebaseReady();
      const settings = readCreateForm();
      const roomId = makeRoomId();
      await createRoom(roomId, settings);
      setSearch(new URLSearchParams({ room: roomId, host: '1' }));
      route();
    } catch (e) {
      renderError(viewEl, (e && e.message) || '作成に失敗しました');
    }
  });
}

function routeJoin(roomId, isHost) {
  renderJoin(viewEl, roomId);

  qs('#backHome').addEventListener('click', () => {
    setSearch(new URLSearchParams());
    route();
  });

  qs('#join').addEventListener('click', async () => {
    try {
      await firebaseReady();
      const { name } = readJoinForm();
      const playerId = getOrCreatePlayerId(roomId);
      await upsertPlayer(roomId, playerId, name);
      setSearch(new URLSearchParams({ room: roomId, player: '1', ...(isHost ? { host: '1' } : {}) }));
      route();
    } catch (e) {
      renderError(viewEl, (e && e.message) || '参加に失敗しました');
    }
  });
}

function routeHost(roomId) {
  let unsub = null;

  const joinUrl = makeJoinUrl(roomId);
  const hostUrl = makeHostUrl(roomId);

  const drawQr = async () => {
    const canvas = document.getElementById('qr');
    if (!canvas || !window.QRCode) return;
    await window.QRCode.toCanvas(canvas, joinUrl, { margin: 1, width: 220 });
  };

  const renderWithRoom = (room) => {
    renderHostQr(viewEl, { roomId, joinUrl, hostUrl, room });

    drawQr();

    qs('#copyJoin').addEventListener('click', async () => {
      const ok = await copyToClipboard(joinUrl);
      if (!ok) alert('コピーできませんでした');
    });

    qs('#hostJoin').addEventListener('click', () => {
      setSearch(new URLSearchParams({ room: roomId, host: '1', screen: 'join' }));
      if (unsub) unsub();
      route();
    });

    qs('#startAssign').addEventListener('click', async () => {
      try {
        await startGameAssignRoles(roomId);
      } catch (e) {
        alert((e && e.message) || '失敗');
      }
    });

    qs('#startDiscussion').addEventListener('click', async () => {
      try {
        await startDiscussion(roomId);
      } catch (e) {
        alert((e && e.message) || '失敗');
      }
    });

    qs('#startVoting').addEventListener('click', async () => {
      try {
        await startVoting(roomId);
      } catch (e) {
        alert((e && e.message) || '失敗');
      }
    });

    qs('#revealVotes').addEventListener('click', async () => {
      try {
        await revealVoteResult(roomId);
      } catch (e) {
        alert((e && e.message) || '失敗');
      }
    });

    qs('#reveal').addEventListener('click', async () => {
      if (!confirm('少数側を開示します。よいですか？')) return;
      try {
        await reveal(roomId);
      } catch (e) {
        alert((e && e.message) || '失敗');
      }
    });
  };

  (async () => {
    try {
      await firebaseReady();
      unsub = await subscribeRoom(roomId, (room) => {
        if (!room) {
          renderError(viewEl, '部屋が見つかりません');
          return;
        }
        renderWithRoom(room);
      });
    } catch (e) {
      renderError(viewEl, (e && e.message) || 'Firebase接続に失敗しました');
    }
  })();

  window.addEventListener(
    'popstate',
    () => {
      if (unsub) unsub();
    },
    { once: true }
  );
}

function routePlayer(roomId, isHost) {
  const playerId = getOrCreatePlayerId(roomId);
  let unsub = null;
  let timerHandle = null;

  const rerenderTimer = (room) => {
    const el = document.getElementById('timer');
    if (!el) return;
    const endAt = room && room.discussion && room.discussion.endsAt ? room.discussion.endsAt : 0;
    const remain = Math.max(0, Math.floor((endAt - Date.now()) / 1000));
    el.textContent = formatMMSS(remain);
  };

  (async () => {
    try {
      await firebaseReady();
      unsub = await subscribeRoom(roomId, (room) => {
        if (!room) {
          renderError(viewEl, '部屋が見つかりません');
          return;
        }
        const player = room.players ? room.players[playerId] : null;
        renderPlayer(viewEl, { roomId, playerId, player, room, isHost });

        if (timerHandle) clearInterval(timerHandle);
        timerHandle = setInterval(() => rerenderTimer(room), 250);

        const leaveBtn = document.getElementById('leave');
        if (leaveBtn) {
          leaveBtn.addEventListener('click', () => {
            if (unsub) unsub();
            if (timerHandle) clearInterval(timerHandle);
            setSearch(new URLSearchParams());
            route();
          });
        }

        const submitBtn = document.getElementById('submitGuess');
        if (submitBtn) {
          submitBtn.addEventListener('click', async () => {
            const el = document.getElementById('guessText');
            const guessText = String((el && el.value) || '').trim();
            if (!guessText) return;
            try {
              await submitGuess(roomId, guessText);
            } catch (e) {
              alert((e && e.message) || '失敗');
            }
          });
        }

        const voteBtn = document.getElementById('submitVote');
        if (voteBtn) {
          voteBtn.addEventListener('click', async () => {
            const el = document.getElementById('voteTo');
            const toPlayerId = String((el && el.value) || '').trim();
            if (!toPlayerId) return;
            try {
              await submitVote(roomId, playerId, toPlayerId);
            } catch (e) {
              alert((e && e.message) || '失敗');
            }
          });
        }
      });
    } catch (e) {
      renderError(viewEl, (e && e.message) || 'Firebase接続に失敗しました');
    }
  })();

  window.addEventListener(
    'popstate',
    () => {
      if (unsub) unsub();
      if (timerHandle) clearInterval(timerHandle);
    },
    { once: true }
  );
}

function route() {
  const url = new URL(location.href);
  const screen = url.searchParams.get('screen') || '';
  const { roomId, isHost } = getUrlState();
  const isPlayer = url.searchParams.get('player') === '1';

  if (screen === 'setup') return routeSetup();
  if (screen === 'create') return routeCreate();

  if (!roomId) return routeHome();

  if (screen === 'join') return routeJoin(roomId, isHost);

  if (isPlayer) return routePlayer(roomId, isHost);

  // デフォルト: host=1 ならGM表示 / そうでなければ参加へ
  if (isHost) return routeHost(roomId);
  return routeJoin(roomId, false);
}

window.addEventListener('popstate', () => route());
route();

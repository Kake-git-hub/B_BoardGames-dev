import { onValue, setValue, updateValue, runTxn } from './firebase.js';
import { nowMs, randomId } from './utils.js';

export function getUrlState() {
  const url = new URL(location.href);
  const roomId = url.searchParams.get('room') || '';
  const isHost = url.searchParams.get('host') === '1';
  return { roomId, isHost };
}

export function makeRoomId() {
  return randomId(8);
}

export function getOrCreatePlayerId(roomId) {
  const key = `ww_player_${roomId}`;
  let id = localStorage.getItem(key);
  if (!id) {
    id = randomId(12);
    localStorage.setItem(key, id);
  }
  return id;
}

export function roomPath(roomId) {
  return `rooms/${roomId}`;
}

export function playerPath(roomId, playerId) {
  return `rooms/${roomId}/players/${playerId}`;
}

export async function createRoom(roomId, settings) {
  const base = roomPath(roomId);
  const room = {
    createdAt: nowMs(),
    phase: 'lobby',
    settings: {
      playerLimit: settings.playerLimit,
      minorityCount: settings.minorityCount,
      talkSeconds: settings.talkSeconds,
      reversal: settings.reversal,
    },
    words: {
      majority: settings.majorityWord,
      minority: settings.minorityWord,
    },
    discussion: {
      startedAt: 0,
      endsAt: 0,
    },
    reveal: {
      revealedAt: 0,
    },
    guess: {
      enabled: !!settings.reversal,
      submittedAt: 0,
      guessText: '',
      correct: null,
    },
    voting: {
      startedAt: 0,
      revealedAt: 0,
    },
    votes: {},
    players: {},
  };
  await setValue(base, room);
}

export async function upsertPlayer(roomId, playerId, name) {
  const path = playerPath(roomId, playerId);
  await runTxn(path, (current) => {
    const base = current || {};
    return {
      ...base,
      name,
      joinedAt: base.joinedAt || nowMs(),
      lastSeenAt: nowMs(),
    };
  });
}

export async function touchPlayer(roomId, playerId) {
  await updateValue(playerPath(roomId, playerId), { lastSeenAt: nowMs() });
}

export async function startGameAssignRoles(roomId) {
  const base = roomPath(roomId);

  await runTxn(base, (room) => {
    if (!room) return room;
    if (room.phase !== 'lobby') return room;

    const playersObj = room.players || {};
    const playerIds = Object.keys(playersObj);
    const limit = (room.settings && room.settings.playerLimit) || 0;
    const minorityCount = (room.settings && room.settings.minorityCount) || 1;

    if (limit <= 0 || playerIds.length < limit) {
      // 全員揃っていない
      return room;
    }

    // シャッフル（全参加者から抽選）
    const shuffled = playerIds.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const ids = shuffled.slice(0, limit);

    const minoritySet = new Set(ids.slice(0, minorityCount));
    const nextPlayers = { ...playersObj };

    for (const id of Object.keys(nextPlayers)) {
      const p = nextPlayers[id] || {};
      if (!ids.includes(id)) {
        nextPlayers[id] = { ...p, role: 'spectator' };
      } else {
        nextPlayers[id] = {
          ...p,
          role: minoritySet.has(id) ? 'minority' : 'majority',
        };
      }
    }

    return {
      ...room,
      phase: 'assigned',
      players: nextPlayers,
    };
  });
}

export async function startDiscussion(roomId) {
  const base = roomPath(roomId);
  await runTxn(base, (room) => {
    if (!room) return room;
    if (room.phase !== 'assigned') return room;
    const talkSeconds = room.settings && room.settings.talkSeconds != null ? room.settings.talkSeconds : 180;
    const startedAt = nowMs();
    return {
      ...room,
      phase: 'discussion',
      discussion: {
        startedAt,
        endsAt: startedAt + talkSeconds * 1000,
      },
    };
  });
}

export async function reveal(roomId) {
  const base = roomPath(roomId);
  await runTxn(base, (room) => {
    if (!room) return room;
    if (room.phase !== 'discussion' && room.phase !== 'assigned' && room.phase !== 'voteResult') return room;
    return {
      ...room,
      phase: room.settings && room.settings.reversal ? 'guess' : 'finished',
      reveal: { revealedAt: nowMs() },
    };
  });
}

export async function startVoting(roomId) {
  const base = roomPath(roomId);
  await runTxn(base, (room) => {
    if (!room) return room;
    if (room.phase !== 'discussion') return room;
    return {
      ...room,
      phase: 'voting',
      voting: { startedAt: nowMs(), revealedAt: 0 },
      votes: {},
    };
  });
}

export async function submitVote(roomId, voterId, toPlayerId) {
  const base = roomPath(roomId);
  await runTxn(base, (room) => {
    if (!room) return room;
    if (room.phase !== 'voting') return room;
    const playersObj = room.players || {};
    const voter = playersObj[voterId];
    const to = playersObj[toPlayerId];
    if (!voter || voter.role === 'spectator') return room;
    if (!to || to.role === 'spectator') return room;
    const nextVotes = { ...(room.votes || {}) };
    nextVotes[voterId] = { to: toPlayerId, at: nowMs() };
    return { ...room, votes: nextVotes };
  });
}

export async function revealVoteResult(roomId) {
  const base = roomPath(roomId);
  await runTxn(base, (room) => {
    if (!room) return room;
    if (room.phase !== 'voting') return room;
    return {
      ...room,
      phase: 'voteResult',
      voting: { ...(room.voting || {}), revealedAt: nowMs() },
    };
  });
}

export async function submitGuess(roomId, guessText) {
  const base = roomPath(roomId);
  await runTxn(base, (room) => {
    if (!room) return room;
    if (room.phase !== 'guess') return room;

    const majorityWord = String((room.words && room.words.majority) || '').trim();
    const gt = String(guessText || '').trim();
    const correct = gt.length > 0 && majorityWord.length > 0 && gt === majorityWord;

    return {
      ...room,
      phase: 'finished',
      guess: {
        ...room.guess,
        submittedAt: nowMs(),
        guessText: gt,
        correct,
      },
    };
  });
}

export function subscribeRoom(roomId, cb) {
  return onValue(roomPath(roomId), cb);
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  update,
  get,
  onValue,
  remove,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

import { firebaseConfig } from "./firebase-config.js";
import {
  phases,
  generateCharacterCards,
  generateStory,
  generateRoundEvent,
  generateBunker,
  randomBaggageCard
} from "./data.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const setupView = $("#setupView");
const gameView = $("#gameView");
const firebaseWarning = $("#firebaseWarning");
const playerNameInput = $("#playerNameInput");
const roomCodeInput = $("#roomCodeInput");
const createRoomBtn = $("#createRoomBtn");
const confirmCreateRoomBtn = $("#confirmCreateRoomBtn");
const closeSettingsBtn = $("#closeSettingsBtn");
const settingsModal = $("#settingsModal");
const maxPlayersInput = $("#maxPlayersInput");
const bunkerSeatsInput = $("#bunkerSeatsInput");
const revealLimitInput = $("#revealLimitInput");
const memeModeSelect = $("#memeModeSelect");
const joinRoomBtn = $("#joinRoomBtn");
const copyRoomBtn = $("#copyRoomBtn");
const leaveRoomBtn = $("#leaveRoomBtn");
const hostPanel = $("#hostPanel");
const generateCardsBtn = $("#generateCardsBtn");
const nextRevealRoundBtn = $("#nextRevealRoundBtn");
const generateStoryBtn = $("#generateStoryBtn");
const generateBunkerBtn = $("#generateBunkerBtn");
const generateEventBtn = $("#generateEventBtn");
const resetVotesBtn = $("#resetVotesBtn");
const eliminateTopBtn = $("#eliminateTopBtn");
const copyStoryBtn = $("#copyStoryBtn");
const copyBunkerBtn = $("#copyBunkerBtn");

const roomCodeTitle = $("#roomCodeTitle");
const roomStatus = $("#roomStatus");
const revealRoundText = $("#revealRoundText");
const myRevealState = $("#myRevealState");
const aliveCountText = $("#aliveCountText");
const cardsStateText = $("#cardsStateText");
const oneRevealHint = $("#oneRevealHint");

const myCards = $("#myCards");
const playersList = $("#playersList");
const statsTableHead = $("#statsTableHead");
const statsTableBody = $("#statsTableBody");
const voteTargets = $("#voteTargets");
const voteResults = $("#voteResults");
const voteDetails = $("#voteDetails");
const roomLog = $("#roomLog");
const storyBox = $("#storyBox");
const eventBox = $("#eventBox");
const bunkerBox = $("#bunkerBox");
const activeEffectsBox = $("#activeEffectsBox");
const noticeToast = $("#noticeToast");
const cardTemplate = $("#cardTemplate");

let app = null;
let db = null;
let roomCode = null;
let unsubscribeRoom = null;
let roomState = null;
let lastNoticeToken = null;

const playerId = getOrCreatePlayerId();
let playerName = localStorage.getItem("vz_player_name") || "";
playerNameInput.value = playerName;

function getOrCreatePlayerId() {
  const existing = localStorage.getItem("vz_player_id");
  if (existing) return existing;
  const id = `p_${crypto.randomUUID ? crypto.randomUUID() : Date.now() + "_" + Math.random().toString(16).slice(2)}`;
  localStorage.setItem("vz_player_id", id);
  return id;
}

function isFirebaseConfigured() {
  return firebaseConfig.apiKey
    && !firebaseConfig.apiKey.includes("PASTE")
    && !firebaseConfig.apiKey.includes("ВСТАВ")
    && firebaseConfig.databaseURL
    && !firebaseConfig.databaseURL.includes("PASTE")
    && !firebaseConfig.databaseURL.includes("ВСТАВ")
    && firebaseConfig.projectId
    && !firebaseConfig.projectId.includes("PASTE")
    && !firebaseConfig.projectId.includes("ВСТАВ");
}

function initFirebase() {
  if (!isFirebaseConfigured()) {
    firebaseWarning.classList.remove("hidden");
    firebaseWarning.innerHTML = "Firebase ещё не настроен. Открой <b>firebase-config.js</b> и вставь apiKey + databaseURL. Без этого онлайн-комнаты не запустятся.";
    createRoomBtn.disabled = true;
    joinRoomBtn.disabled = true;
    return false;
  }

  try {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    return true;
  } catch (error) {
    firebaseWarning.classList.remove("hidden");
    firebaseWarning.textContent = `Ошибка Firebase: ${error.message}`;
    createRoomBtn.disabled = true;
    joinRoomBtn.disabled = true;
    return false;
  }
}

function cleanName(value) {
  const name = value.trim().replace(/\s+/g, " ").slice(0, 22);
  return name || "Безымянный";
}

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "Z";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function nowTime() {
  return new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function roomRef(path = "") {
  return ref(db, `rooms/${roomCode}${path ? "/" + path : ""}`);
}

async function pushLog(text) {
  if (!roomCode || !db) return;
  const log = Array.isArray(roomState?.log) ? roomState.log.slice(-140) : [];
  log.push(`[${nowTime()}] ${text}`);
  await update(roomRef(), { log });
}

function readSettings() {
  const maxPlayers = clamp(Number(maxPlayersInput.value) || 8, 2, 30);
  const bunkerSeats = clamp(Number(bunkerSeatsInput.value) || Math.max(2, Math.floor(maxPlayers / 2)), 1, maxPlayers);
  const revealLimit = clamp(Number(revealLimitInput.value) || 1, 1, 3);
  return { maxPlayers, bunkerSeats, revealLimit, memeMode: memeModeSelect.value || "meme" };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function currentMemeMode() {
  return roomState?.settings?.memeMode || memeModeSelect?.value || "meme";
}

function showSettingsModal() {
  playerName = cleanName(playerNameInput.value);
  localStorage.setItem("vz_player_name", playerName);
  const suggestedMax = Number(maxPlayersInput.value) || 8;
  maxPlayersInput.value = suggestedMax;
  bunkerSeatsInput.value = Number(bunkerSeatsInput.value) || Math.max(2, Math.floor(suggestedMax / 2));
  settingsModal.classList.remove("hidden");
}

function hideSettingsModal() {
  settingsModal.classList.add("hidden");
}

function emptyEffects(round = 1, keep = {}) {
  return {
    round,
    protected: {},
    noVoteAgainst: {},
    frozen: {},
    voteSteal: {},
    forcedFollow: {},
    appealOwner: null,
    speakerOrder: null,
    charm: keep.charm || {},
    antiTheft: keep.antiTheft || {},
    blockPomidors: {},
    eventBuffs: {},
    extraReveal: null,
    doubleEliminateNext: !!keep.doubleEliminateNext,
    lastPomidor: keep.lastPomidor || null
  };
}

async function createRoom() {
  hideSettingsModal();
  playerName = cleanName(playerNameInput.value);
  localStorage.setItem("vz_player_name", playerName);
  roomCode = makeRoomCode();
  const settings = readSettings();
  const initialStory = generateStory();
  const initialBunker = generateBunker(settings);

  const room = {
    code: roomCode,
    hostId: playerId,
    createdAt: serverTimestamp(),
    revealRound: 1,
    cardsGenerated: false,
    settings,
    story: initialStory,
    bunker: initialBunker,
    currentEvent: null,
    nextEventPreview: null,
    effects: emptyEffects(1),
    players: {
      [playerId]: {
        id: playerId,
        name: playerName,
        alive: true,
        joinedAt: Date.now(),
        cards: null,
        lastRevealRound: 0,
        revealCountThisRound: 0,
        privatePreview: null
      }
    },
    votes: {},
    log: [
      `[${nowTime()}] ${playerName} создал комнату.`,
      `[${nowTime()}] Настройки: максимум игроков ${settings.maxPlayers}, мест в бункере ${settings.bunkerSeats}, раскрытий за круг ${settings.revealLimit}.`,
      `[${nowTime()}] Катастрофа: ${initialStory.title}.`,
      `[${nowTime()}] Бункер создан: ${initialBunker.title}.`
    ]
  };

  await set(roomRef(), room);
  enterRoom(roomCode);
}

async function joinRoom() {
  playerName = cleanName(playerNameInput.value);
  localStorage.setItem("vz_player_name", playerName);
  const code = roomCodeInput.value.trim().toUpperCase();
  if (!code) return alert("Введи код комнаты.");

  roomCode = code;
  const snapshot = await get(roomRef());
  if (!snapshot.exists()) {
    roomCode = null;
    return alert("Комната не найдена. Проверь код.");
  }

  const room = snapshot.val();
  const players = room.players || {};
  const existingPlayer = players[playerId];
  const playerCount = Object.keys(players).length;
  const maxPlayers = room.settings?.maxPlayers || 8;
  if (!existingPlayer && playerCount >= maxPlayers) {
    roomCode = null;
    return alert(`Лобби заполнено: ${playerCount}/${maxPlayers}.`);
  }

  await update(roomRef(`players/${playerId}`), {
    id: playerId,
    name: playerName,
    alive: existingPlayer?.alive ?? true,
    joinedAt: existingPlayer?.joinedAt || Date.now(),
    cards: existingPlayer?.cards || null,
    lastRevealRound: existingPlayer?.lastRevealRound || 0,
    revealCountThisRound: existingPlayer?.revealCountThisRound || 0,
    privatePreview: existingPlayer?.privatePreview || null
  });

  enterRoom(code);
  setTimeout(() => pushLog(`${playerName} вошёл в комнату.`), 300);
}

function enterRoom(code) {
  roomCode = code;
  roomCodeInput.value = code;
  setupView.classList.add("hidden");
  gameView.classList.remove("hidden");
  roomCodeTitle.textContent = code;

  if (unsubscribeRoom) unsubscribeRoom();
  unsubscribeRoom = onValue(roomRef(), (snapshot) => {
    roomState = snapshot.val();
    if (!roomState) {
      alert("Комната удалена или недоступна.");
      leaveRoomLocal();
      return;
    }
    render();
  }, (error) => {
    alert(`Ошибка чтения комнаты: ${error.message}`);
  });
}

function leaveRoomLocal() {
  if (unsubscribeRoom) unsubscribeRoom();
  unsubscribeRoom = null;
  roomCode = null;
  roomState = null;
  gameView.classList.add("hidden");
  setupView.classList.remove("hidden");
}

async function leaveRoom() {
  if (roomCode && roomState?.players?.[playerId]) {
    await pushLog(`${playerName} вышел из комнаты.`);
    await remove(roomRef(`players/${playerId}`));
  }
  leaveRoomLocal();
}

function isHost() {
  return roomState?.hostId === playerId;
}

async function generateCardsForAll() {
  if (!isHost()) return;
  const players = roomState.players || {};
  const mode = currentMemeMode();
  const event = generateRoundEvent(1, mode);
  const updates = {
    cardsGenerated: true,
    revealRound: 1,
    votes: {},
    effects: emptyEffects(1),
    currentEvent: event,
    nextEventPreview: null,
    lastNotice: makeNotice(`Карты выданы. Событие добавлено: ${event.title}`)
  };

  Object.keys(players).forEach((id) => {
    updates[`players/${id}/cards`] = generateCharacterCards(mode);
    updates[`players/${id}/alive`] = true;
    updates[`players/${id}/lastRevealRound`] = 0;
    updates[`players/${id}/revealCountThisRound`] = 0;
    updates[`players/${id}/privatePreview`] = null;
  });

  await update(roomRef(), updates);
  await pushLog("Ведущий сгенерировал карты всем игрокам. Свои карты теперь видны каждому игроку лично.");
  await pushLog(`Событие круга 1 добавлено: ${event.title}. ${event.impact || event.description}`);
}

async function startNextRevealRound() {
  if (!isHost()) return;
  const next = (roomState.revealRound || 1) + 1;
  const event = roomState.nextEventPreview || generateRoundEvent(next, currentMemeMode());
  const keep = {
    charm: roomState.effects?.charm || {},
    antiTheft: roomState.effects?.antiTheft || {},
    doubleEliminateNext: roomState.effects?.doubleEliminateNext || false,
    lastPomidor: roomState.effects?.lastPomidor || null
  };
  const updates = {
    revealRound: next,
    currentEvent: event,
    nextEventPreview: null,
    votes: {},
    effects: emptyEffects(next, keep),
    lastNotice: makeNotice(`Новый круг ${next}. Событие обновлено: ${event.title}`)
  };
  getPlayers().forEach((p) => {
    updates[`players/${p.id}/revealCountThisRound`] = 0;
  });
  const eventLogs = applyRoundEvent(event, updates, next);
  await update(roomRef(), updates);
  await pushLog(`Начался круг раскрытия ${next}. Событие: ${event.title}. Голоса и эффекты раунда сброшены.`);
  for (const line of eventLogs) await pushLog(line);
}

async function generateNewStory() {
  if (!isHost()) return;
  const story = generateStory();
  await update(roomRef(), { story });
  await pushLog(`Ведущий сгенерировал новую катастрофу: ${story.title}.`);
}

async function generateNewBunker() {
  if (!isHost()) return;
  const bunker = generateBunker(roomState.settings || {});
  await update(roomRef(), { bunker });
  await pushLog(`Ведущий сгенерировал новый бункер: ${bunker.title}.`);
}

async function generateNewEvent() {
  if (!isHost()) return;
  const round = roomState.revealRound || 1;
  const event = generateRoundEvent(round, currentMemeMode());
  const updates = {
    currentEvent: event,
    lastNotice: makeNotice(`Событие обновлено: ${event.title}`)
  };
  const eventLogs = applyRoundEvent(event, updates, round);
  await update(roomRef(), updates);
  await pushLog(`Событие круга ${round} обновлено: ${event.title}. ${event.impact || event.description}`);
  for (const line of eventLogs) await pushLog(line);
}

function revealLimit() {
  const base = roomState?.settings?.revealLimit || 1;
  const bonus = Number(roomState?.effects?.extraReveal) === Number(roomState?.revealRound || 1) ? 1 : 0;
  return base + bonus;
}

function revealCount(player = getMe()) {
  if (!player) return 0;
  if ((player.lastRevealRound || 0) !== (roomState?.revealRound || 1)) return 0;
  return player.revealCountThisRound || (player.lastRevealRound ? 1 : 0);
}

async function revealCard(key) {
  const me = roomState?.players?.[playerId];
  const round = roomState?.revealRound || 1;
  if (!me?.cards?.[key]) return alert("Карты ещё не сгенерированы.");
  if (!me.alive) return alert("Выгнанный игрок не раскрывает карты.");
  if (isFrozen(playerId)) return alert("Ты заморожен до конца раунда.");
  if (me.cards[key].revealed) return alert("Эта карта уже раскрыта.");
  if (revealCount(me) >= revealLimit()) return alert(`В этом круге ты уже раскрыл максимум карт: ${revealLimit()}. Жди новый круг от ведущего.`);

  const card = me.cards[key];
  await update(roomRef(`players/${playerId}`), {
    [`cards/${key}/revealed`]: true,
    lastRevealRound: round,
    revealCountThisRound: revealCount(me) + 1
  });
  await pushLog(`${playerName} раскрыл карту: ${card.type}.`);
}

function isFrozen(id) {
  return Number(roomState?.effects?.frozen?.[id]) === Number(roomState?.revealRound || 1);
}

function isProtected(id) {
  return Number(roomState?.effects?.protected?.[id]) === Number(roomState?.revealRound || 1);
}

function hasNoVoteAgainst(id) {
  return Number(roomState?.effects?.noVoteAgainst?.[id]) === Number(roomState?.revealRound || 1);
}

function nameOf(id) {
  return roomState?.players?.[id]?.name || "Игрок";
}

async function voteFor(targetId) {
  const me = roomState?.players?.[playerId];
  if (!me?.alive) return alert("Выгнанный игрок не голосует.");
  if (isFrozen(playerId)) return alert("Ты заморожен и не можешь голосовать.");
  if (targetId === playerId) return alert("Против себя голосовать нельзя.");
  if (hasNoVoteAgainst(targetId)) return alert("Против этого игрока сейчас нельзя голосовать.");
  if (roomState.effects?.charm?.[playerId] === targetId) return alert("Ты очарован этим игроком и больше не можешь голосовать против него.");
  if (roomState.effects?.voteSteal?.[playerId]) return alert("Твой голос украден в этом раунде.");
  const forcedCaster = roomState.effects?.forcedFollow?.[playerId];
  if (forcedCaster && roomState.votes?.[forcedCaster]?.target && roomState.votes[forcedCaster].target !== targetId) {
    return alert(`Ты под внушением и должен голосовать как ${nameOf(forcedCaster)}.`);
  }

  const updates = {};
  updates[`votes/${playerId}`] = { from: playerId, target: targetId, at: Date.now() };
  Object.entries(roomState.effects?.forcedFollow || {}).forEach(([followerId, casterId]) => {
    if (casterId === playerId && roomState.players?.[followerId]?.alive) {
      updates[`votes/${followerId}`] = { from: followerId, target: targetId, at: Date.now(), forcedBy: playerId };
    }
  });
  await update(roomRef(), updates);
  await pushLog(`${playerName} проголосовал против: ${nameOf(targetId)}.`);
}

async function resetVotes() {
  if (!isHost()) return;
  await update(roomRef(), { votes: {} });
  await pushLog("Ведущий сбросил голоса.");
}

function getVoteCounts() {
  const counts = {};
  const votes = roomState?.votes || {};
  const steals = roomState?.effects?.voteSteal || {};
  Object.values(votes).forEach((vote) => {
    if (!vote?.target) return;
    if (steals[vote.from]) return;
    if (hasNoVoteAgainst(vote.target)) return;
    let weight = 1;
    Object.entries(steals).forEach(([stolenId, casterId]) => {
      if (casterId === vote.from && roomState.players?.[stolenId]?.alive) weight += 1;
    });
    counts[vote.target] = (counts[vote.target] || 0) + weight;
  });
  return counts;
}

async function eliminateTop() {
  if (!isHost()) return;
  const counts = getVoteCounts();
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return alert("Пока нет голосов.");
  const [targetId, count] = sorted[0];
  const sameTop = sorted.filter(([, c]) => c === count);
  if (sameTop.length > 1) return alert("Ничья. Нужен переголос или решение ведущего.");

  if (isProtected(targetId) || hasNoVoteAgainst(targetId)) {
    await update(roomRef(), { votes: {} });
    await pushLog(`${nameOf(targetId)} должен был вылететь, но защита раунда спасла игрока. Голоса сброшены.`);
    return;
  }

  const targetPomidor = roomState.players?.[targetId]?.cards?.pomidor;
  if (targetPomidor?.effectId === "fire_escape" && !targetPomidor.used) {
    await update(roomRef(), {
      [`players/${targetId}/cards/pomidor/used`]: true,
      [`players/${targetId}/cards/pomidor/revealed`]: true,
      votes: {}
    });
    await pushLog(`${nameOf(targetId)} должен был вылететь, но Помидор “Огненный пердёж” сработал автоматически. Голосование переигрывается без вылета.`);
    return;
  }

  if (roomState.effects?.appealOwner) {
    await update(roomRef(), {
      votes: {},
      "effects/appealOwner": null,
      "effects/doubleEliminateNext": true
    });
    await pushLog(`${nameOf(roomState.effects.appealOwner)} отменил вылет через “Адвокат-адвокат”. В следующем успешном вылете уйдут двое.`);
    return;
  }

  const updates = { votes: {} };
  const eliminated = [];
  const needTwo = !!roomState.effects?.doubleEliminateNext;
  for (const [id] of sorted) {
    if (eliminated.length >= (needTwo ? 2 : 1)) break;
    if (!roomState.players?.[id]?.alive) continue;
    if (isProtected(id) || hasNoVoteAgainst(id)) continue;
    updates[`players/${id}/alive`] = false;
    eliminated.push(nameOf(id));
  }
  updates["effects/doubleEliminateNext"] = false;
  if (!eliminated.length) return alert("Все лидеры защищены. Нужен переголос.");
  await update(roomRef(), updates);
  await pushLog(`${eliminated.join(" и ")} выгнан${eliminated.length > 1 ? "ы" : ""} из бункера голосованием (${count} голос. у лидера).`);
}

function pomidorCard() {
  return getMe()?.cards?.pomidor;
}

function pomidorTargets(mode) {
  const players = getPlayers();
  if (mode === "none" || mode === "self" || mode === "auto") return [];
  if (mode === "dead") return players.filter((p) => !p.alive);
  if (mode === "otherAlive") return players.filter((p) => p.alive && p.id !== playerId);
  if (mode === "anyAlive") return players.filter((p) => p.alive);
  return players.filter((p) => p.alive);
}

function cardPatch(path, card) {
  const result = {};
  Object.entries(card).forEach(([key, value]) => result[`${path}/${key}`] = value);
  return result;
}

async function markPomidorUsed(updates, reveal = true) {
  updates[`players/${playerId}/cards/pomidor/used`] = true;
  if (reveal) updates[`players/${playerId}/cards/pomidor/revealed`] = true;
}

async function usePomidor(targetId = null) {
  const me = getMe();
  const card = pomidorCard();
  if (!me?.alive) return alert("Выгнанный игрок не использует Помидоры.");
  if (isFrozen(playerId)) return alert("Ты заморожен и не можешь использовать Помидор.");
  if (Number(roomState?.effects?.blockPomidors?.round) === Number(roomState?.revealRound || 1)) return alert("Антипомидорный купол: Помидоры заблокированы до конца раунда.");
  if (!card) return alert("Помидор ещё не выдан.");
  if (card.used) return alert("Этот Помидор уже использован.");
  if (card.targetMode === "auto") return alert("Этот Помидор срабатывает автоматически в нужный момент.");
  const mode = card.targetMode || "none";
  if (!["none", "self"].includes(mode) && !targetId) return alert("Выбери цель.");
  const actualTarget = mode === "self" ? playerId : targetId;
  const round = roomState.revealRound || 1;
  const updates = { "effects/lastPomidor": card.title };
  let logText = `${playerName} применил Помидор “${card.title}”.`;

  switch (card.effectId) {
    case "ginger":
      updates[`effects/forcedFollow/${actualTarget}`] = playerId;
      if (roomState.votes?.[playerId]?.target) {
        updates[`votes/${actualTarget}`] = { from: actualTarget, target: roomState.votes[playerId].target, at: Date.now(), forcedBy: playerId };
      }
      logText += ` ${nameOf(actualTarget)} теперь голосует как ${playerName} в этом раунде.`;
      break;
    case "coin":
      if (roomState.effects?.antiTheft?.[actualTarget]) return alert("У цели защита от кражи/обмена карт и голосов.");
      updates[`effects/voteSteal/${actualTarget}`] = playerId;
      logText += ` Голос игрока ${nameOf(actualTarget)} украден.`;
      break;
    case "muscle":
      updates[`effects/protected/${actualTarget}`] = round;
      logText += ` ${nameOf(actualTarget)} защищён от вылета на этот раунд.`;
      break;
    case "ice_water": {
      const keep = { charm: roomState.effects?.charm || {}, antiTheft: roomState.effects?.antiTheft || {}, doubleEliminateNext: roomState.effects?.doubleEliminateNext || false, lastPomidor: card.title };
      updates.effects = emptyEffects(round, keep);
      logText += " Все активные Помидор-эффекты этого раунда очищены.";
      break;
    }
    case "height_mutator": {
      const target = roomState.players?.[actualTarget];
      const oldBody = target?.cards?.body;
      if (!oldBody) return alert("У цели ещё нет карты телосложения.");
      const grow = Math.random() < 0.5;
      const body = { ...oldBody };
      body.title = `${oldBody.title} ${grow ? "+30% роста" : "-30% роста"}`;
      body.description = `${oldBody.description} Помидор “Хой-хой” ${grow ? "увеличил" : "уменьшил"} рост примерно на 30%.`;
      Object.assign(updates, cardPatch(`players/${actualTarget}/cards/body`, body));
      logText += ` Рост игрока ${nameOf(actualTarget)} ${grow ? "увеличен" : "уменьшен"}.`;
      break;
    }
    case "flesh": {
      const oldHealth = roomState.players?.[actualTarget]?.cards?.health;
      if (!oldHealth) return alert("У цели ещё нет карты здоровья.");
      const health = { ...oldHealth, title: `Некроз: ${oldHealth.title}`, description: `${oldHealth.description} Помидор “Плоть-плоть” ухудшил состояние: ткани начинают гнить, нужен врач, Пульс-пульс или экзорцизм.` };
      Object.assign(updates, cardPatch(`players/${actualTarget}/cards/health`, health));
      logText += ` Здоровье игрока ${nameOf(actualTarget)} ухудшено.`;
      break;
    }
    case "kids": {
      const oldIdentity = roomState.players?.[actualTarget]?.cards?.identity;
      const identity = { ...oldIdentity, title: `${oldIdentity.title} / омоложение`, description: `${oldIdentity.description} Помидор “Детишки-детишки” омолодил биологический возраст примерно на 30%, но не ниже взрослого возраста.` };
      Object.assign(updates, cardPatch(`players/${actualTarget}/cards/identity`, identity));
      logText += ` ${nameOf(actualTarget)} омоложен.`;
      break;
    }
    case "speed":
      updates[`effects/antiTheft/${playerId}`] = true;
      logText += " Теперь у него нельзя красть/обменивать карты и голосовые эффекты.";
      break;
    case "pulse": {
      const oldHealth = roomState.players?.[actualTarget]?.cards?.health;
      if (!oldHealth) return alert("У цели ещё нет карты здоровья.");
      const health = { ...oldHealth, title: `Стабилизирован: ${oldHealth.title}`, description: `${oldHealth.description} Помидор “Пульс-пульс” стабилизировал смертельные/тяжёлые эффекты, но не вернул потерянные конечности.` };
      Object.assign(updates, cardPatch(`players/${actualTarget}/cards/health`, health));
      logText += ` ${nameOf(actualTarget)} стабилизирован.`;
      break;
    }
    case "dizz": {
      const alive = getPlayers().filter((p) => p.alive && p.cards?.baggage);
      const baggages = alive.map((p) => p.cards.baggage);
      if (baggages.length > 1) {
        const shifted = baggages.slice(1).concat(baggages[0]);
        alive.forEach((p, index) => Object.assign(updates, cardPatch(`players/${p.id}/cards/baggage`, shifted[index])));
      }
      logText += " Багаж живых игроков перемешан.";
      break;
    }
    case "cringe":
      updates[`effects/noVoteAgainst/${playerId}`] = round;
      logText += " В этом раунде против него нельзя голосовать.";
      break;
    case "samurai": {
      const meRoll = Math.ceil(Math.random() * 6);
      const targetRoll = Math.ceil(Math.random() * 6);
      const target = roomState.players?.[actualTarget];
      if (!target?.cards?.baggage || !me.cards?.baggage) return alert("У кого-то нет багажа.");
      if (meRoll > targetRoll) {
        const trophy = { ...target.cards.baggage, title: `Трофей дуэли: ${target.cards.baggage.title}`, description: `${target.cards.baggage.description} Забрано у ${target.name} после дуэли.` };
        Object.assign(updates, cardPatch(`players/${playerId}/cards/baggage`, trophy));
        logText += ` Дуэль ${meRoll}:${targetRoll}. ${playerName} победил и забрал багаж ${target.name}.`;
      } else if (targetRoll > meRoll) {
        const trophy = { ...me.cards.baggage, title: `Трофей дуэли: ${me.cards.baggage.title}`, description: `${me.cards.baggage.description} Забрано у ${playerName} после дуэли.` };
        Object.assign(updates, cardPatch(`players/${actualTarget}/cards/baggage`, trophy));
        logText += ` Дуэль ${meRoll}:${targetRoll}. ${target.name} победил и забрал багаж ${playerName}.`;
      } else {
        logText += ` Дуэль ${meRoll}:${targetRoll}. Ничья, багаж остался у владельцев.`;
      }
      break;
    }
    case "moustache":
      updates["effects/speakerOrder"] = `${nameOf(actualTarget)} говорит первым, ${playerName} говорит последним.`;
      logText += ` Порядок речи: ${nameOf(actualTarget)} первым, ${playerName} последним.`;
      break;
    case "lawyer":
      updates["effects/appealOwner"] = playerId;
      logText += " Следующий вылет будет отменён, но потом вылетят двое.";
      break;
    case "chess": {
      if (roomState.effects?.antiTheft?.[actualTarget]) return alert("У цели защита от обмена карт.");
      const target = roomState.players?.[actualTarget];
      const swapKey = phases.map((p) => p.key).find((key) => !["identity", "pomidor"].includes(key) && me.cards?.[key]?.revealed && target?.cards?.[key]?.revealed);
      if (!swapKey) return alert("Нет одинаковой публично раскрытой карты для рокировки. Нужно, чтобы у обоих была открыта одна категория, кроме расы и Помидора.");
      const myCard = me.cards[swapKey];
      const targetCard = target.cards[swapKey];
      Object.assign(updates, cardPatch(`players/${playerId}/cards/${swapKey}`, targetCard));
      Object.assign(updates, cardPatch(`players/${actualTarget}/cards/${swapKey}`, myCard));
      logText += ` Рокировка карт “${myCard.type}” между ${playerName} и ${target.name}.`;
      break;
    }
    case "pocket":
    case "printer": {
      const extra = randomBaggageCard(currentMemeMode());
      const oldBag = me.cards?.baggage || extra;
      const bag = { ...oldBag, title: `${oldBag.title} + ${extra.title}`, description: `${oldBag.description} Дополнительная заначка: ${extra.title}. ${extra.description}` };
      Object.assign(updates, cardPatch(`players/${playerId}/cards/baggage`, bag));
      logText += ` Получена заначка: ${extra.title}.`;
      break;
    }
    case "holy": {
      const oldHealth = roomState.players?.[actualTarget]?.cards?.health;
      if (oldHealth) {
        const health = { ...oldHealth, title: oldHealth.title.replace("Некроз: ", "Очищено: "), description: `${oldHealth.description} Экзорцизм снял активные проклятые/замораживающие эффекты.` };
        Object.assign(updates, cardPatch(`players/${actualTarget}/cards/health`, health));
      }
      updates[`effects/frozen/${actualTarget}`] = null;
      updates[`effects/forcedFollow/${actualTarget}`] = null;
      updates[`effects/voteSteal/${actualTarget}`] = null;
      updates[`effects/noVoteAgainst/${actualTarget}`] = null;
      logText += ` ${nameOf(actualTarget)} очищен от части плохих эффектов.`;
      break;
    }
    case "charisma":
      updates[`effects/charm/${actualTarget}`] = playerId;
      logText += ` ${nameOf(actualTarget)} больше не может голосовать против ${playerName}.`;
      break;
    case "shabalduy": {
      const identity = generateCharacterCards(currentMemeMode()).identity;
      identity.revealed = me.cards.identity?.revealed || false;
      Object.assign(updates, cardPatch(`players/${playerId}/cards/identity`, identity));
      logText += ` Раса ${playerName} переписана: ${identity.title}.`;
      break;
    }
    case "navigator": {
      const future = generateRoundEvent((roomState.revealRound || 1) + 1, currentMemeMode());
      updates[`players/${playerId}/privatePreview`] = future;
      updates.nextEventPreview = future;
      logText += " Он увидел событие следующего раунда. Ведущий может использовать это как будущий ивент.";
      break;
    }
    case "cold":
      updates[`effects/frozen/${actualTarget}`] = round;
      logText += ` ${nameOf(actualTarget)} заморожен до конца раунда.`;
      break;
    case "genius": {
      const newText = prompt("Напиши новую выгодную, но не сломанную строку для своей фобии/багажа:", "Теперь это выглядит полезнее, чем казалось.");
      if (!newText) return;
      const key = me.cards?.phobia?.revealed ? "phobia" : "baggage";
      const oldCard = me.cards?.[key];
      const edited = { ...oldCard, description: `${oldCard.description} Редактор Гений-гений: ${newText.slice(0, 180)}` };
      Object.assign(updates, cardPatch(`players/${playerId}/cards/${key}`, edited));
      logText += ` Отредактирована карта “${oldCard.type}”.`;
      break;
    }
    case "toilet":
      updates[`effects/voteSteal/${actualTarget}`] = playerId;
      logText += ` Репутация ${nameOf(actualTarget)} смыта. Его голос в этом раунде не считается.`;
      break;
    case "banana":
      updates[`effects/speakerOrder`] = `${nameOf(actualTarget)} поскользнулся на банане и не может говорить первым. Ведущий решает новый порядок.`;
      logText += ` ${nameOf(actualTarget)} теряет право говорить первым.`;
      break;
    case "echo":
      logText += ` Эхо повторяет последний хаос: ${roomState.effects?.lastPomidor || "ничего не было, но все напряглись"}.`;
      break;
    default:
      logText += " Эффект записан в лог, ведущий решает последствия.";
      break;
  }

  await markPomidorUsed(updates, true);
  await update(roomRef(), updates);
  await pushLog(logText);
}

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getPlayers() {
  return Object.values(roomState?.players || {}).sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
}

function getMe() {
  return roomState?.players?.[playerId];
}

function hasRevealedThisRound(player = getMe()) {
  return revealCount(player) >= revealLimit();
}

function makeNotice(message) {
  return { message, at: Date.now(), id: `${Date.now()}_${Math.random().toString(16).slice(2)}` };
}

function livingPlayersWithCards() {
  return getPlayers().filter((p) => p.alive && p.cards);
}

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomNormalCardKey(player) {
  const blocked = new Set(["identity", "pomidor"]);
  const keys = phases.map((p) => p.key).filter((key) => !blocked.has(key) && player?.cards?.[key]);
  return keys.length ? randomFrom(keys) : null;
}

function applyRoundEvent(event, updates, round) {
  const logs = [];
  if (!event?.effectType || !roomState?.cardsGenerated) return logs;
  const alive = livingPlayersWithCards();
  const mode = currentMemeMode();
  const patchCard = (id, key, card) => Object.assign(updates, cardPatch(`players/${id}/cards/${key}`, card));

  switch (event.effectType) {
    case "force_random_reveal": {
      const candidates = alive.map((p) => ({ p, keys: phases.map((phase) => phase.key).filter((key) => p.cards?.[key] && !p.cards[key].revealed) })).filter((item) => item.keys.length);
      if (!candidates.length) break;
      const item = randomFrom(candidates);
      const key = randomFrom(item.keys);
      updates[`players/${item.p.id}/cards/${key}/revealed`] = true;
      logs.push(`Эффект события: ${nameOf(item.p.id)} вынужден раскрыть карту “${item.p.cards[key].type}”.`);
      break;
    }
    case "force_pomidor_reveal": {
      const candidates = alive.filter((p) => p.cards?.pomidor && !p.cards.pomidor.revealed);
      if (!candidates.length) break;
      const p = randomFrom(candidates);
      updates[`players/${p.id}/cards/pomidor/revealed`] = true;
      logs.push(`Эффект события: Помидор игрока ${p.name} раскрылся публично.`);
      break;
    }
    case "underground_cover": {
      alive.filter((p) => p.cards.identity?.raceId === "underground").forEach((p) => updates[`effects/protected/${p.id}`] = round);
      updates[`effects/eventBuffs/underground_${round}`] = "Событие: Подземельники защищены от вылета в темноте.";
      logs.push("Эффект события: все Подземельники защищены от вылета на этот раунд.");
      break;
    }
    case "fishfolk_cover": {
      alive.filter((p) => p.cards.identity?.raceId === "fishfolk").forEach((p) => updates[`effects/protected/${p.id}`] = round);
      updates[`effects/eventBuffs/fishfolk_${round}`] = "Событие: Рыболюды защищены от вылета из-за воды.";
      logs.push("Эффект события: все Рыболюды защищены от вылета на этот раунд.");
      break;
    }
    case "extra_reveal": {
      updates["effects/extraReveal"] = round;
      logs.push("Эффект события: каждый игрок может раскрыть на 1 карту больше в этом круге.");
      break;
    }
    case "mosquito_pressure": {
      const candidates = alive.filter((p) => p.cards.identity?.raceId !== "mosquito");
      if (!candidates.length) break;
      const p = randomFrom(candidates);
      updates[`effects/frozen/${p.id}`] = round;
      logs.push(`Эффект события: ${p.name} заморожен комариным давлением до конца раунда.`);
      break;
    }
    case "potato_suspicion": {
      const potatoes = alive.filter((p) => p.cards.identity?.raceId === "potato");
      potatoes.forEach((p) => updates[`players/${p.id}/cards/identity/revealed`] = true);
      logs.push(potatoes.length ? `Эффект события: все Картошки раскрыли расу публично.` : "Эффект события: Картошек в игре не найдено. Бункер разочарован.");
      break;
    }
    case "minor_health_debuff": {
      if (!alive.length) break;
      const p = randomFrom(alive);
      const old = p.cards.health;
      const health = { ...old, title: `Плесень: ${old.title}`, description: `${old.description} Событие добавило плесневый дебафф: кашель, слабость и минус к доверию санитаров.` };
      patchCard(p.id, "health", health);
      logs.push(`Эффект события: здоровье игрока ${p.name} ухудшено плесенью.`);
      break;
    }
    case "bunker_capacity_minus": {
      const current = Number(roomState.bunker?.capacity || roomState.settings?.bunkerSeats || 2);
      const amount = Number(event.amount || 1);
      const next = Math.max(1, current - amount);
      updates["bunker/capacity"] = next;
      logs.push(`Эффект события: вместимость бункера уменьшилась с ${current} до ${next}.`);
      break;
    }
    case "bunker_capacity_to_two": {
      const current = Number(roomState.bunker?.capacity || roomState.settings?.bunkerSeats || 2);
      const next = Math.min(current, 2);
      updates["bunker/capacity"] = next;
      logs.push(`Легендарный эффект: вместимость бункера теперь ${next} места. Игра резко стала жёстче.`);
      break;
    }
    case "random_mutation": {
      if (!alive.length) break;
      const p = randomFrom(alive);
      const identity = generateCharacterCards(mode).identity;
      identity.revealed = p.cards.identity?.revealed || false;
      patchCard(p.id, "identity", identity);
      logs.push(`Эффект события: раса игрока ${p.name} переписана на “${identity.title}”.`);
      break;
    }
    case "mass_mutation": {
      const targets = [...alive].sort(() => Math.random() - 0.5).slice(0, Math.min(2, alive.length));
      targets.forEach((p) => {
        const identity = generateCharacterCards(mode).identity;
        identity.revealed = p.cards.identity?.revealed || false;
        patchCard(p.id, "identity", identity);
      });
      if (targets.length) logs.push(`Эффект события: расы переписаны у ${targets.map((p) => p.name).join(" и ")}.`);
      break;
    }
    case "potato_buff": {
      const potatoes = alive.filter((p) => p.cards.identity?.raceId === "potato");
      potatoes.forEach((p) => {
        const old = p.cards.body;
        const body = { ...old, title: `Суперкартофельный качок, ${old.height || "???"} см`, description: `${old.description} Событие “Суперкартофельный режим” переписало тело: теперь это картошка-качок с огромным авторитетом, силой и правом смотреть на всех как на гарнир.` };
        patchCard(p.id, "body", body);
      });
      updates[`effects/eventBuffs/potato_${round}`] = "Событие: все Картошки стали супернакачанными до конца обсуждения и в своих картах тела.";
      logs.push(potatoes.length ? `Эффект события: ${potatoes.map((p) => p.name).join(", ")} получили суперкартофельное телосложение.` : "Эффект события: Картошек нет, поэтому качалка пустует.");
      break;
    }
    case "global_health_debuff": {
      alive.forEach((p) => {
        const old = p.cards.health;
        const health = { ...old, title: `Лихорадка: ${old.title}`, description: `${old.description} Глобальная лихорадка дала общий дебафф: слабость, жар и риск споров из-за лекарств.` };
        patchCard(p.id, "health", health);
      });
      logs.push("Эффект события: здоровье всех живых игроков ухудшено глобальной лихорадкой.");
      break;
    }
    case "swap_random_card": {
      if (alive.length < 2) break;
      const shuffled = [...alive].sort(() => Math.random() - 0.5);
      const a = shuffled[0];
      const b = shuffled[1];
      const key = randomNormalCardKey(a);
      if (!key || !b.cards?.[key]) break;
      patchCard(a.id, key, b.cards[key]);
      patchCard(b.id, key, a.cards[key]);
      logs.push(`Эффект события: ${a.name} и ${b.name} поменялись картой “${a.cards[key].type}”.`);
      break;
    }
    case "chaos_swap_all": {
      const keys = ["body", "character", "profession", "health", "skill", "phobia", "baggage", "artifact", "faction"];
      alive.forEach((p) => {
        const key = randomFrom(keys.filter((k) => p.cards?.[k]));
        const newCards = generateCharacterCards(mode);
        const card = newCards[key];
        card.revealed = p.cards[key]?.revealed || false;
        patchCard(p.id, key, card);
      });
      logs.push("Легендарный эффект: у всех живых игроков переписана случайная обычная характеристика.");
      break;
    }
    case "block_pomidors": {
      updates["effects/blockPomidors"] = { round, reason: event.title };
      logs.push("Эффект события: Помидоры заблокированы до конца раунда.");
      break;
    }
    case "double_eliminate": {
      updates["effects/doubleEliminateNext"] = true;
      logs.push("Эффект события: следующий успешный вылет будет двойным.");
      break;
    }
    case "bunker_items_change": {
      const oldItems = roomState.bunker?.items || [];
      const additions = [randomBaggageCard(mode).title, randomBaggageCard(mode).title, randomBaggageCard(mode).title];
      updates["bunker/items"] = [...new Set(oldItems.concat(additions))];
      logs.push(`Эффект события: склад добавил предметы: ${additions.join(", ")}.`);
      break;
    }
    default:
      break;
  }
  return logs;
}

function renderNotice() {
  if (!noticeToast) return;
  const notice = roomState?.lastNotice;
  if (!notice?.id || notice.id === lastNoticeToken) return;
  lastNoticeToken = notice.id;
  noticeToast.textContent = notice.message || "Событие обновлено";
  noticeToast.classList.add("show");
  setTimeout(() => noticeToast.classList.remove("show"), 3800);
}

function render() {
  const players = getPlayers();
  const alivePlayers = players.filter((p) => p.alive);
  const hostName = roomState.players?.[roomState.hostId]?.name || "ведущий";
  const me = getMe();
  const settings = roomState.settings || {};
  const bunker = roomState.bunker || {};

  roomStatus.textContent = `Игроков: ${players.length}/${settings.maxPlayers || "?"}. Живых: ${alivePlayers.length}. Мест в бункере: ${bunker.capacity || settings.bunkerSeats || "?"}. Ведущий: ${hostName}.`;
  hostPanel.classList.toggle("hidden", !isHost());
  eliminateTopBtn.classList.toggle("hidden", !isHost());

  revealRoundText.textContent = `№${roomState.revealRound || 1}`;
  myRevealState.textContent = !roomState.cardsGenerated
    ? "ждём карты"
    : isFrozen(playerId)
      ? "заморожен"
      : hasRevealedThisRound(me)
        ? `лимит ${revealLimit()}/${revealLimit()}`
        : `можно ${revealCount(me)}/${revealLimit()}`;
  aliveCountText.textContent = `${alivePlayers.length}/${players.length}`;
  cardsStateText.textContent = roomState.cardsGenerated ? "выданы" : "не выданы";
  oneRevealHint.textContent = hasRevealedThisRound(me) ? "лимит раскрытия на круг" : `можно выбрать ${revealLimit() - revealCount(me)} карт.`;

  renderMyCards();
  renderPlayers(players);
  renderStatsTable(players);
  renderStory();
  renderBunker();
  renderNotice();
  renderEffects();
  renderVoting(players);
  renderLog();
}

function renderMyCards() {
  myCards.innerHTML = "";
  const me = getMe();
  if (!me?.cards) {
    myCards.innerHTML = `<p class="muted">Карты ещё не сгенерированы. Ведущий должен нажать “Сгенерировать карты всем”.</p>`;
    return;
  }

  if (me.privatePreview) {
    const preview = document.createElement("div");
    preview.className = "private-preview";
    preview.innerHTML = `<strong>Твоё предвидение:</strong> следующий ивент может быть “${escapeHtml(me.privatePreview.title)}” — ${escapeHtml(me.privatePreview.description)}`;
    myCards.appendChild(preview);
  }

  const alreadyRevealedRound = hasRevealedThisRound(me);
  phases.forEach((phase) => {
    const card = me.cards[phase.key];
    if (!card) return;

    const node = cardTemplate.content.cloneNode(true);
    const article = node.querySelector(".game-card");
    const type = node.querySelector(".card-type");
    const state = node.querySelector(".card-state");
    const title = node.querySelector("h4");
    const description = node.querySelector("p");
    const button = node.querySelector(".reveal-card-btn");

    article.classList.toggle("open", !!card.revealed);
    article.classList.toggle("closed", !card.revealed);
    article.classList.toggle("used", !!card.used);
    type.textContent = card.type || phase.title;
    state.textContent = card.revealed ? (card.used ? "открыто, использовано" : "публично открыто") : "видно только тебе";
    state.className = `card-state ${card.revealed ? "open" : "closed"}`;
    title.textContent = card.title;
    description.textContent = card.description;

    button.disabled = card.revealed || alreadyRevealedRound || !me.alive || !roomState.cardsGenerated || isFrozen(playerId);
    if (card.revealed) button.textContent = "Уже открыто всем";
    else if (!me.alive) button.textContent = "Ты выгнан";
    else if (isFrozen(playerId)) button.textContent = "Заморожен";
    else if (alreadyRevealedRound) button.textContent = "Лимит круга";
    else button.textContent = "Раскрыть публично";
    button.addEventListener("click", () => revealCard(phase.key));

    if (phase.key === "pomidor") {
      const controls = renderPomidorControls(card);
      if (controls) article.appendChild(controls);
    }

    myCards.appendChild(node);
  });
}

function renderPomidorControls(card) {
  const me = getMe();
  const wrapper = document.createElement("div");
  wrapper.className = "ability-controls";
  if (card.used) {
    wrapper.innerHTML = `<span class="small-note">Помидор уже использован.</span>`;
    return wrapper;
  }
  if (Number(roomState?.effects?.blockPomidors?.round) === Number(roomState?.revealRound || 1)) {
    wrapper.innerHTML = `<span class="small-note">Антипомидорный купол: Помидоры заблокированы событием раунда.</span>`;
    return wrapper;
  }
  if (card.targetMode === "auto") {
    wrapper.innerHTML = `<span class="small-note">Авто-эффект: сработает сам при нужном условии.</span>`;
    return wrapper;
  }
  if (!me.alive) {
    wrapper.innerHTML = `<span class="small-note">Выгнанный игрок не применяет Помидоры.</span>`;
    return wrapper;
  }
  if (isFrozen(playerId)) {
    wrapper.innerHTML = `<span class="small-note">Ты заморожен и не можешь применить Помидор.</span>`;
    return wrapper;
  }

  const mode = card.targetMode || "none";
  let select = null;
  if (!["none", "self"].includes(mode)) {
    select = document.createElement("select");
    const targets = pomidorTargets(mode);
    if (!targets.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Нет целей";
      select.appendChild(opt);
    } else {
      targets.forEach((target) => {
        const opt = document.createElement("option");
        opt.value = target.id;
        opt.textContent = `${target.name}${target.id === playerId ? " (ты)" : ""}`;
        select.appendChild(opt);
      });
    }
    wrapper.appendChild(select);
  }

  const btn = document.createElement("button");
  btn.className = "primary ability-btn";
  btn.textContent = card.button || "Применить Помидор";
  btn.disabled = !roomState.cardsGenerated || (select && !select.value);
  btn.addEventListener("click", () => usePomidor(select?.value || null));
  wrapper.appendChild(btn);
  return wrapper;
}

function renderPlayers(players) {
  playersList.innerHTML = "";
  if (!players.length) {
    playersList.innerHTML = `<p class="muted">Пока никого нет.</p>`;
    return;
  }

  players.forEach((player) => {
    const box = document.createElement("article");
    box.className = `player-box ${player.alive ? "" : "dead"}`;
    const isMe = player.id === playerId;
    const badges = [];
    if (player.id === roomState.hostId) badges.push("ведущий");
    if (isMe) badges.push("ты");
    if (!player.alive) badges.push("выгнан");
    if (isFrozen(player.id)) badges.push("заморожен");
    if (isProtected(player.id)) badges.push("защищён");
    if (hasNoVoteAgainst(player.id)) badges.push("нельзя голосовать");
    if (roomState.effects?.antiTheft?.[player.id]) badges.push("анти-кража");
    if (player.cards) badges.push(hasRevealedThisRound(player) ? "лимит раскрытия" : "может раскрыть");

    let miniCards = "";
    if (player.cards) {
      const opened = phases.filter((phase) => player.cards?.[phase.key]?.revealed).length;
      const pom = player.cards.pomidor;
      miniCards = `
        <div class="mini-card"><strong>Открыто:</strong> ${opened}/${phases.length}</div>
        <div class="mini-card"><strong>Статус:</strong> ${player.alive ? "в игре" : "выгнан"}</div>
        <div class="mini-card"><strong>Помидор:</strong> ${pom?.revealed ? `${escapeHtml(pom.title)}${pom.used ? " — использован" : ""}` : "закрыт"}</div>
      `;
    } else {
      miniCards = `<div class="mini-card">Карты ещё не выданы.</div>`;
    }

    box.innerHTML = `
      <div class="player-head">
        <span class="player-name">${escapeHtml(player.name)}</span>
        <span>${badges.map((b) => `<span class="badge">${escapeHtml(b)}</span>`).join("")}</span>
      </div>
      <div class="mini-cards">${miniCards}</div>
    `;
    playersList.appendChild(box);
  });
}

function renderStatsTable(players) {
  statsTableHead.innerHTML = `
    <tr>
      <th>Игрок</th>
      <th>Статус</th>
      ${phases.map((phase) => `<th>${escapeHtml(phase.title)}</th>`).join("")}
    </tr>
  `;

  if (!players.length) {
    statsTableBody.innerHTML = `<tr><td colspan="${phases.length + 2}">Пока игроков нет.</td></tr>`;
    return;
  }

  statsTableBody.innerHTML = players.map((player) => {
    const isMe = player.id === playerId;
    const badges = [
      player.id === roomState.hostId ? "ведущий" : "",
      isMe ? "ты" : "",
      !player.alive ? "выгнан" : "",
      isFrozen(player.id) ? "заморожен" : ""
    ].filter(Boolean).join(", ");

    const cells = phases.map((phase) => {
      const card = player.cards?.[phase.key];
      if (!card) return `<td class="cell-hidden">не выдано</td>`;
      const used = card.used ? `<br><span class="cell-used">использовано</span>` : "";
      if (card.revealed) return `<td class="cell-open"><strong>${escapeHtml(card.title)}</strong>${used}<br><span>${escapeHtml(card.description)}</span></td>`;
      if (isMe) return `<td class="cell-own-hidden"><strong>${escapeHtml(card.title)}</strong><br><span>не раскрыто публично</span></td>`;
      return `<td class="cell-hidden">закрыто</td>`;
    }).join("");

    return `
      <tr>
        <td><strong>${escapeHtml(player.name)}</strong><br><span class="muted">${escapeHtml(badges || "игрок")}</span></td>
        <td>${player.alive ? "в игре" : "выгнан"}<br>${hasRevealedThisRound(player) ? "лимит раскрытия" : "ещё может раскрыть"}</td>
        ${cells}
      </tr>
    `;
  }).join("");
}

function renderStory() {
  const story = roomState.story;
  if (!story) {
    storyBox.innerHTML = `<p class="muted">Катастрофа ещё не создана. Ведущий может нажать “Сгенерировать катастрофу”.</p>`;
  } else {
    storyBox.innerHTML = `
      <h4 class="story-title">${escapeHtml(story.title)}</h4>
      <p class="story-line">${escapeHtml(story.intro)}</p>
      <p class="story-line"><strong>Почему надо прятаться:</strong> ${escapeHtml(story.outside || "Снаружи слишком опасно для долгого выживания.")}</p>
      <p class="story-line"><strong>Где бункер:</strong> ${escapeHtml(story.place)}</p>
      <p class="story-line"><strong>Проблема внутри:</strong> ${escapeHtml(story.problem)}</p>
      <p class="story-line"><strong>Цель:</strong> ${escapeHtml(story.goal)}</p>
    `;
  }

  const event = roomState.currentEvent;
  if (!event) {
    eventBox.innerHTML = `<p class="muted">Событие раунда ещё не создано. Оно появится после генерации карт или кнопки ведущего.</p>`;
  } else {
    eventBox.innerHTML = `
      <h4 class="story-title">${escapeHtml(event.title)} <span class="rarity-pill rarity-${escapeHtml(event.rarity || "common")}">${escapeHtml(event.rarity || "common")}</span></h4>
      <p class="story-line"><strong>Круг ${escapeHtml(event.round)}:</strong> ${escapeHtml(event.description)}</p>
      <p class="story-line event-impact"><strong>Влияние на игру:</strong> ${escapeHtml(event.impact || "Ведущий решает последствия.")}</p>
    `;
  }
}

function renderBunker() {
  const bunker = roomState.bunker;
  if (!bunker) {
    bunkerBox.innerHTML = `<p class="muted">Бункер ещё не создан.</p>`;
    return;
  }
  bunkerBox.innerHTML = `
    <h4 class="story-title">${escapeHtml(bunker.title)}</h4>
    <p class="story-line"><strong>Размер:</strong> ${escapeHtml(bunker.size)} — ${escapeHtml(bunker.description)}</p>
    <p class="story-line"><strong>Вместимость:</strong> ${escapeHtml(bunker.capacity)} мест. Максимум игроков в лобби: ${escapeHtml(bunker.maxPlayers)}.</p>
    <p class="story-line"><strong>Комнаты:</strong></p>
    <ul>${(bunker.rooms || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    <p class="story-line"><strong>Предметы в бункере:</strong></p>
    <ul>${(bunker.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    <p class="story-line"><strong>Проблемы:</strong></p>
    <ul>${(bunker.defects || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
  `;
}

function renderEffects() {
  const effects = roomState.effects || {};
  const lines = [];
  Object.entries(effects.protected || {}).forEach(([id, round]) => Number(round) === Number(roomState.revealRound) && lines.push(`${nameOf(id)} защищён от вылета.`));
  Object.entries(effects.noVoteAgainst || {}).forEach(([id, round]) => Number(round) === Number(roomState.revealRound) && lines.push(`Против ${nameOf(id)} нельзя голосовать.`));
  Object.entries(effects.frozen || {}).forEach(([id, round]) => Number(round) === Number(roomState.revealRound) && lines.push(`${nameOf(id)} заморожен.`));
  Object.entries(effects.voteSteal || {}).forEach(([id, caster]) => lines.push(`${nameOf(caster)} украл голос у ${nameOf(id)}.`));
  Object.entries(effects.forcedFollow || {}).forEach(([id, caster]) => lines.push(`${nameOf(id)} голосует как ${nameOf(caster)}.`));
  Object.entries(effects.charm || {}).forEach(([id, caster]) => lines.push(`${nameOf(id)} очарован ${nameOf(caster)} и не может голосовать против него.`));
  if (Number(effects.blockPomidors?.round) === Number(roomState.revealRound || 1)) lines.push("Антипомидорный купол: Помидоры нельзя применять до конца раунда.");
  if (Number(effects.extraReveal) === Number(roomState.revealRound || 1)) lines.push("Событие даёт +1 раскрытие карты каждому игроку в этом круге.");
  Object.values(effects.eventBuffs || {}).forEach((text) => lines.push(text));
  if (effects.appealOwner) lines.push(`${nameOf(effects.appealOwner)} держит активную апелляцию.`);
  if (effects.doubleEliminateNext) lines.push("Следующий успешный вылет уберёт двух игроков.");
  if (effects.speakerOrder) lines.push(`Порядок речи: ${effects.speakerOrder}`);
  activeEffectsBox.innerHTML = lines.length
    ? lines.map((line) => `<div class="effect-line">${escapeHtml(line)}</div>`).join("")
    : `<p class="muted">Активных эффектов сейчас нет.</p>`;
}

function renderVoting(players) {
  voteTargets.innerHTML = "";
  voteResults.innerHTML = "";
  voteDetails.innerHTML = "";
  const me = getMe();
  const alivePlayers = players.filter((p) => p.alive);
  const votes = roomState.votes || {};
  const myVote = votes[playerId]?.target;

  alivePlayers
    .filter((p) => p.id !== playerId)
    .forEach((target) => {
      const btn = document.createElement("button");
      const protectedText = isProtected(target.id) ? " 🛡" : "";
      const noVoteText = hasNoVoteAgainst(target.id) ? " 🚫" : "";
      btn.textContent = myVote === target.id ? `✓ ${target.name}${protectedText}${noVoteText}` : `Голосовать против ${target.name}${protectedText}${noVoteText}`;
      btn.disabled = !me?.alive || isFrozen(playerId) || hasNoVoteAgainst(target.id) || roomState.effects?.charm?.[playerId] === target.id || !!roomState.effects?.voteSteal?.[playerId];
      btn.addEventListener("click", () => voteFor(target.id));
      voteTargets.appendChild(btn);
    });

  if (!alivePlayers.length || !me?.alive) {
    voteTargets.innerHTML = `<p class="muted">Ты не можешь голосовать сейчас.</p>`;
  } else if (alivePlayers.length <= 1) {
    voteTargets.innerHTML = `<p class="muted">Некого выгонять: живой игрок только один.</p>`;
  } else if (isFrozen(playerId)) {
    voteTargets.innerHTML = `<p class="muted">Ты заморожен и не можешь голосовать в этом раунде.</p>`;
  }

  const counts = getVoteCounts();
  if (!Object.keys(counts).length) {
    voteResults.innerHTML = `<p class="muted">Голосов пока нет.</p>`;
  } else {
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([targetId, count]) => {
        const row = document.createElement("div");
        row.className = "vote-row";
        row.innerHTML = `<strong>${escapeHtml(nameOf(targetId))}</strong><span>${count} голос.</span>`;
        voteResults.appendChild(row);
      });
  }

  const details = Object.values(votes).map((vote) => {
    const stolen = roomState.effects?.voteSteal?.[vote.from] ? " — голос украден и не считается" : "";
    const forced = vote.forcedBy ? ` — под внушением ${nameOf(vote.forcedBy)}` : "";
    return `${nameOf(vote.from)} → ${nameOf(vote.target)}${forced}${stolen}`;
  });
  voteDetails.innerHTML = details.length
    ? details.map((line) => `<div class="vote-detail">${escapeHtml(line)}</div>`).join("")
    : `<p class="muted">Пока никто не проголосовал.</p>`;
}

function renderLog() {
  const entries = Array.isArray(roomState.log) ? roomState.log : [];
  roomLog.innerHTML = entries.slice(-140).reverse().map((entry) => `<div class="log-entry">${escapeHtml(entry)}</div>`).join("");
}

$$('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tabId = btn.dataset.tab;
    $$('.tab-btn').forEach((item) => item.classList.toggle('active', item === btn));
    $$('.tab-view').forEach((view) => view.classList.toggle('active', view.id === tabId));
  });
});

createRoomBtn.addEventListener("click", showSettingsModal);
confirmCreateRoomBtn.addEventListener("click", createRoom);
closeSettingsBtn.addEventListener("click", hideSettingsModal);
settingsModal.addEventListener("click", (event) => {
  if (event.target === settingsModal) hideSettingsModal();
});
joinRoomBtn.addEventListener("click", joinRoom);
leaveRoomBtn.addEventListener("click", leaveRoom);
copyRoomBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(roomCode || "");
  copyRoomBtn.textContent = "Скопировано";
  setTimeout(() => copyRoomBtn.textContent = "Скопировать код", 1100);
});
copyStoryBtn.addEventListener("click", async () => {
  const text = roomState?.story?.text || "Катастрофа ещё не создана.";
  await navigator.clipboard.writeText(text);
  copyStoryBtn.textContent = "Скопировано";
  setTimeout(() => copyStoryBtn.textContent = "Скопировать катастрофу", 1100);
});
copyBunkerBtn.addEventListener("click", async () => {
  const text = roomState?.bunker?.text || "Бункер ещё не создан.";
  await navigator.clipboard.writeText(text);
  copyBunkerBtn.textContent = "Скопировано";
  setTimeout(() => copyBunkerBtn.textContent = "Скопировать бункер", 1100);
});
generateCardsBtn.addEventListener("click", generateCardsForAll);
nextRevealRoundBtn.addEventListener("click", startNextRevealRound);
generateStoryBtn.addEventListener("click", generateNewStory);
generateBunkerBtn.addEventListener("click", generateNewBunker);
generateEventBtn.addEventListener("click", generateNewEvent);
resetVotesBtn.addEventListener("click", resetVotes);
eliminateTopBtn.addEventListener("click", eliminateTop);

initFirebase();

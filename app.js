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
const votingStartsAfterInput = $("#votingStartsAfterInput");
const earlyVotePercentInput = $("#earlyVotePercentInput");
const eventChanceInput = $("#eventChanceInput");
const eventCommonInput = $("#eventCommonInput");
const eventRareInput = $("#eventRareInput");
const eventSuperInput = $("#eventSuperInput");
const eventLegendaryInput = $("#eventLegendaryInput");
const memeModeSelect = $("#memeModeSelect");
const addPositiveCardsInput = $("#addPositiveCardsInput");
const addNegativeCardsInput = $("#addNegativeCardsInput");
const addInactiveCardsInput = $("#addInactiveCardsInput");
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
const requestStartVoteBtn = $("#requestStartVoteBtn");
const forceStartVoteBtn = $("#forceStartVoteBtn");
const closeVotingBtn = $("#closeVotingBtn");
const copyStoryBtn = $("#copyStoryBtn");
const copyBunkerBtn = $("#copyBunkerBtn");
const ageGateModal = $("#ageGateModal");
const ageGateAgeInput = $("#ageGateAgeInput");
const ageGateQuestion = $("#ageGateQuestion");
const ageGateAnswerInput = $("#ageGateAnswerInput");
const ageGateConfirmBtn = $("#ageGateConfirmBtn");
const ageGateCancelBtn = $("#ageGateCancelBtn");
const personalizationBtn = $("#personalizationBtn");
const profileModal = $("#profileModal");
const closeProfileBtn = $("#closeProfileBtn");
const saveProfileBtn = $("#saveProfileBtn");
const avatarGrid = $("#avatarGrid");
const themeSelect = $("#themeSelect");
const accentSelect = $("#accentSelect");
const sfxToggleInput = $("#sfxToggleInput");
const musicToggleInput = $("#musicToggleInput");
const musicToggleBtn = $("#musicToggleBtn");
const profilePreview = $("#profilePreview");

const roomCodeTitle = $("#roomCodeTitle");
const roomStatus = $("#roomStatus");
const revealRoundText = $("#revealRoundText");
const myRevealState = $("#myRevealState");
const aliveCountText = $("#aliveCountText");
const cardsStateText = $("#cardsStateText");
const votePhaseText = $("#votePhaseText");
const oneRevealHint = $("#oneRevealHint");

const myCards = $("#myCards");
const playersList = $("#playersList");
const statsTableHead = $("#statsTableHead");
const statsTableBody = $("#statsTableBody");
const voteControlBox = $("#voteControlBox");
const voteTargets = $("#voteTargets");
const voteResults = $("#voteResults");
const voteDetails = $("#voteDetails");
const roomLog = $("#roomLog");
const storyBox = $("#storyBox");
const eventBox = $("#eventBox");
const bunkerBox = $("#bunkerBox");
const activeEffectsBox = $("#activeEffectsBox");
const survivalBox = $("#survivalBox");
const analyzeSurvivalBtn = $("#analyzeSurvivalBtn");
const noticeToast = $("#noticeToast");
const cardTemplate = $("#cardTemplate");

let app = null;
let db = null;
let roomCode = null;
let unsubscribeRoom = null;
let roomState = null;
let lastNoticeToken = null;
let pendingAdultGateResolve = null;
let currentAgeGateAnswer = 5;
let userProfile = loadProfile();
let audioCtx = null;
let musicTimer = null;
let musicStep = 0;

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
  const votingStartsAfter = clamp(Number(votingStartsAfterInput.value) || 3, 1, 10);
  const earlyVotePercent = clamp(Number(earlyVotePercentInput.value) || 70, 50, 100);
  const eventChanceValue = eventChanceInput?.value === "" || eventChanceInput?.value == null ? 30 : Number(eventChanceInput.value);
  const eventChance = clamp(Number.isFinite(eventChanceValue) ? eventChanceValue : 30, 0, 100);
  const eventWeights = {
    common: clamp(Number(eventCommonInput?.value) || 0, 0, 100),
    rare: clamp(Number(eventRareInput?.value) || 0, 0, 100),
    super_rare: clamp(Number(eventSuperInput?.value) || 0, 0, 100),
    legendary: clamp(Number(eventLegendaryInput?.value) || 0, 0, 100)
  };
  return {
    maxPlayers,
    bunkerSeats,
    revealLimit,
    votingStartsAfter,
    earlyVotePercent,
    eventChance,
    eventWeights,
    memeMode: memeModeSelect.value || "meme",
    addPositiveCards: !!addPositiveCardsInput?.checked,
    addNegativeCards: !!addNegativeCardsInput?.checked,
    addInactiveCards: !!addInactiveCardsInput?.checked
  };
}

function currentPhases() {
  const settings = roomState?.settings || readSettings();
  return phases.filter((phase) => !phase.optional || settings?.[phase.setting]);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function currentMemeMode() {
  return roomState?.settings?.memeMode || memeModeSelect?.value || "meme";
}

const AVATAR_PRESETS = [
  { id: "stream-eyes", src: "./assets/avatars/stream-eyes.webp", title: "Персонаж стрима с глазами", desc: "смотрит так, будто уже видел твои карты" },
  { id: "braid-viking", src: "./assets/avatars/braid-viking.webp", title: "Мужик-викинг", desc: "строгий взгляд, мощная борода и ноль компромиссов" },
  { id: "hooded-cleric", src: "./assets/avatars/hooded-cleric.webp", title: "Культист в капюшоне", desc: "всегда знает лишний ритуал и план Б" },
  { id: "medic-boy", src: "./assets/avatars/medic-boy.webp", title: "Парень-медик", desc: "выглядит серьёзно и будто реально может перевязать" },
  { id: "funny-woman", src: "./assets/avatars/funny-woman.webp", title: "Женщина с мемным взглядом", desc: "смотрит так, будто ты уже проиграл спор" },
  { id: "horned-demoness", src: "./assets/avatars/horned-demoness.webp", title: "Рогатая демонесса", desc: "харизма высокая, доверие — по ситуации" },
  { id: "cowboy-mem", src: "./assets/avatars/cowboy-mem.webp", title: "Ковбой с рп бутылкой", desc: "выглядит так, будто видел слишком много" },
  { id: "mustache-mask", src: "./assets/avatars/mustache-mask.webp", title: "Усатый кошмар", desc: "лицо, которое не хочется встретить ночью" },
  { id: "boy-shirt", src: "./assets/avatars/boy-shirt.webp", title: "Парень в вышиванке", desc: "обычный добрый вид, но это ещё ничего не значит" },
  { id: "plague-claw", src: "./assets/avatars/plague-claw.webp", title: "Чумной коготь", desc: "птицемаска, красные глаза и очень плохая аура" },
  { id: "iluhandro", src: "./assets/avatars/iluhandro.webp", title: "ILUHANDRO", desc: "качок с самоуверенной рожей и готовым кулаком" },
  { id: "weird-face", src: "./assets/avatars/weird-face.webp", title: "Странная рожа", desc: "абсолютно мемный взгляд вне контекста" },
  { id: "old-bw", src: "./assets/avatars/old-bw.webp", title: "Старик в чёрно-белом", desc: "будто знает все спойлеры этой партии" },
  { id: "alvin", src: "./assets/avatars/alvin.webp", title: "Элвин в худи", desc: "мультяшный умник, который уже что-то вычислил" },
  { id: "thinking-guy", src: "./assets/avatars/thinking-guy.webp", title: "Задумчивый мужик", desc: "сидит так, будто оценил все твои шансы" },
  { id: "smile-suit", src: "./assets/avatars/smile-suit.webp", title: "Улыбающийся тип в костюме", desc: "слишком довольный, чтобы ему верить" },
  { id: "v1-robot", src: "./assets/avatars/v1-robot.webp", title: "V1", desc: "машина с ультранасилием и банкой в руке" },
  { id: "pink-girl", src: "./assets/avatars/pink-girl.webp", title: "Розовая магическая девочка", desc: "выглядит мило, но явно пережила слишком многое" },
  { id: "white-beard", src: "./assets/avatars/white-beard.webp", title: "Белобородый аниме-старик", desc: "лицо человека, который смеётся над хаосом" },
  { id: "laughing-guy", src: "./assets/avatars/laughing-guy.webp", title: "Смеющийся чел", desc: "веселье настолько сильное, что пугает" }
];

function defaultProfile() {
  return {
    avatarId: "stream-eyes",
    theme: "dark",
    accent: "pink",
    music: false,
    sfx: true
  };
}

function loadProfile() {
  try {
    return { ...defaultProfile(), ...(JSON.parse(localStorage.getItem("vz_profile") || "{}")) };
  } catch {
    return defaultProfile();
  }
}

function saveProfileLocal() {
  localStorage.setItem("vz_profile", JSON.stringify(userProfile));
}

function getAvatar(id = userProfile.avatarId) {
  return AVATAR_PRESETS.find((item) => item.id === id) || AVATAR_PRESETS[0];
}

function avatarVisualHtml(avatar, extraClass = "") {
  if (!avatar) return `<span class="avatar-fallback ${extraClass}">👤</span>`;
  if (avatar.src) return `<img class="avatar-img ${extraClass}" src="${avatar.src}" alt="${escapeHtml(avatar.title || "Аватар")}" loading="lazy" />`;
  return `<span class="avatar-fallback ${extraClass}">${escapeHtml(avatar.icon || "👤")}</span>`;
}

function getPublicProfile() {
  const avatar = getAvatar(userProfile.avatarId);
  return {
    avatarId: avatar.id,
    avatarTitle: avatar.title,
    theme: userProfile.theme,
    accent: userProfile.accent
  };
}

function applyProfile() {
  document.body.classList.toggle("theme-light", userProfile.theme === "light");
  document.body.dataset.accent = userProfile.accent || "pink";
  if (themeSelect) themeSelect.value = userProfile.theme || "dark";
  if (accentSelect) accentSelect.value = userProfile.accent || "pink";
  if (sfxToggleInput) sfxToggleInput.checked = userProfile.sfx !== false;
  if (musicToggleInput) musicToggleInput.checked = !!userProfile.music;
  if (musicToggleBtn) musicToggleBtn.textContent = `♫ Музыка: ${userProfile.music ? "вкл" : "выкл"}`;
  renderProfilePreview();
  if (userProfile.music) startMenuMusic();
  else stopMenuMusic();
}

function renderProfilePreview() {
  if (!profilePreview) return;
  const avatar = getAvatar();
  profilePreview.innerHTML = `
    <div class="profile-preview-avatar">${avatarVisualHtml(avatar)}</div>
    <div>
      <strong>${escapeHtml(avatar.title)}</strong>
      <span>${escapeHtml(avatar.desc)}</span>
    </div>
  `;
}

function renderAvatarPicker() {
  if (!avatarGrid) return;
  avatarGrid.innerHTML = "";
  AVATAR_PRESETS.forEach((avatar) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `avatar-option ${userProfile.avatarId === avatar.id ? "selected" : ""}`;
    btn.dataset.avatarId = avatar.id;
    btn.innerHTML = `
      <span class="avatar-icon avatar-thumb">${avatarVisualHtml(avatar)}</span>
      <strong>${escapeHtml(avatar.title)}</strong>
      <small>${escapeHtml(avatar.desc)}</small>
    `;
    btn.addEventListener("click", () => {
      userProfile.avatarId = avatar.id;
      renderAvatarPicker();
      playUiSound("select");
    });
    avatarGrid.appendChild(btn);
  });
}

function openProfileModal() {
  renderAvatarPicker();
  applyProfile();
  profileModal?.classList.remove("hidden");
}

function closeProfileModal() {
  profileModal?.classList.add("hidden");
}

async function saveProfile() {
  userProfile.theme = themeSelect?.value || "dark";
  userProfile.accent = accentSelect?.value || "pink";
  userProfile.sfx = !!sfxToggleInput?.checked;
  userProfile.music = !!musicToggleInput?.checked;
  saveProfileLocal();
  applyProfile();
  playUiSound("save");
  if (roomCode && roomState?.players?.[playerId]) {
    await update(roomRef(`players/${playerId}/profile`), getPublicProfile());
    await pushLog(`${playerName || "Игрок"} обновил персонализацию.`);
  }
  closeProfileModal();
}

function playerAvatarHtml(player, size = "normal") {
  const profile = player?.profile || {};
  const avatar = getAvatar(profile.avatarId);
  const title = profile.avatarTitle || avatar.title || "Игрок";
  const visual = avatarVisualHtml(avatar, size === "small" ? "small" : "");
  return `<span class="player-avatar ${size}" title="${escapeHtml(title)}">${visual}</span>`;
}

function getAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playTone(freq, duration = 0.08, type = "sine", volume = 0.035) {
  if (!userProfile.sfx && type !== "triangle") return;
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  } catch {}
}

function playUiSound(kind = "click") {
  if (userProfile.sfx === false) return;
  const map = {
    click: 420,
    select: 560,
    save: 660,
    danger: 180
  };
  playTone(map[kind] || 420, 0.07, "square", 0.025);
}

function playMusicNote(freq, duration = 0.3, type = "triangle", volume = 0.04) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.04);
  } catch {}
}

function unlockAudio() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") ctx.resume();
  } catch {}
}

function startMenuMusic() {
  unlockAudio();
  if (musicTimer) return;
  const melody = [
    { note: 261.63, length: 0.34 },
    { note: 329.63, length: 0.34 },
    { note: 392.0, length: 0.34 },
    { note: 523.25, length: 0.56 },
    { note: 392.0, length: 0.34 },
    { note: 349.23, length: 0.34 },
    { note: 293.66, length: 0.34 },
    { note: 329.63, length: 0.56 }
  ];
  musicStep = 0;
  const tick = () => {
    if (!userProfile.music || !setupView || setupView.classList.contains("hidden")) {
      musicTimer = setTimeout(tick, 900);
      return;
    }
    const part = melody[musicStep % melody.length];
    playMusicNote(part.note, part.length, "triangle", 0.045);
    if (musicStep % 2 === 0) playMusicNote(part.note / 2, Math.max(0.24, part.length - 0.05), "sine", 0.018);
    musicStep += 1;
    musicTimer = setTimeout(tick, part.length * 1000 + 200);
  };
  tick();
}

function stopMenuMusic() {
  if (musicTimer) clearTimeout(musicTimer);
  musicTimer = null;
}

function toggleMenuMusic() {
  unlockAudio();
  userProfile.music = !userProfile.music;
  if (musicToggleInput) musicToggleInput.checked = userProfile.music;
  saveProfileLocal();
  applyProfile();
  if (userProfile.music) playMusicNote(392.0, 0.22, "triangle", 0.055);
  playUiSound(userProfile.music ? "save" : "click");
}


function adultGateIsConfirmed() {
  return sessionStorage.getItem("vz_adult_confirmed") === "yes";
}

function makeAdultGateQuestion() {
  const tasks = [
    ["55 - 50", 5],
    ["2 + 3", 5],
    ["7 - 2", 5],
    ["10 / 2", 5],
    ["1 + 1 + 3", 5],
    ["25 - 20", 5],
    ["100 - 95", 5]
  ];
  const [question, answer] = tasks[Math.floor(Math.random() * tasks.length)];
  currentAgeGateAnswer = answer;
  if (ageGateQuestion) ageGateQuestion.textContent = question;
  if (ageGateAnswerInput) ageGateAnswerInput.value = "";
}

function askAdultGate() {
  if (adultGateIsConfirmed()) return Promise.resolve(true);
  makeAdultGateQuestion();
  if (ageGateAgeInput) ageGateAgeInput.value = "";
  ageGateModal?.classList.remove("hidden");
  return new Promise((resolve) => {
    pendingAdultGateResolve = resolve;
  });
}

async function ensureAdultGateForMode(mode) {
  if (mode !== "adult") return true;
  return await askAdultGate();
}

function resolveAdultGate(value) {
  ageGateModal?.classList.add("hidden");
  const resolve = pendingAdultGateResolve;
  pendingAdultGateResolve = null;
  if (resolve) resolve(value);
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
  playerName = cleanName(playerNameInput.value);
  localStorage.setItem("vz_player_name", playerName);
  const settings = readSettings();
  if (!(await ensureAdultGateForMode(settings.memeMode))) return;
  hideSettingsModal();
  roomCode = makeRoomCode();
  const initialStory = generateStory(settings.memeMode);
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
    votePhase: "closed",
    voteStartVotes: {},
    effects: emptyEffects(1),
    players: {
      [playerId]: {
        id: playerId,
        name: playerName,
        profile: getPublicProfile(),
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
      `[${nowTime()}] Настройки: максимум игроков ${settings.maxPlayers}, мест в бункере ${settings.bunkerSeats}, раскрытий за круг ${settings.revealLimit}. Доп. карты: ${[settings.addPositiveCards ? "плюс" : "", settings.addNegativeCards ? "минус" : "", settings.addInactiveCards ? "неактив" : ""].filter(Boolean).join(", ") || "нет"}.`,
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
  if (room.settings?.memeMode === "adult" && !(await ensureAdultGateForMode("adult"))) {
    roomCode = null;
    return;
  }
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
    profile: getPublicProfile(),
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
  stopMenuMusic();
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
  if (userProfile.music) startMenuMusic();
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
  const event = generateRoundEvent(1, mode, roomState?.settings || readSettings());
  const updates = {
    cardsGenerated: true,
    revealRound: 1,
    votePhase: "closed",
    votes: {},
    voteStartVotes: {},
    effects: emptyEffects(1),
    currentEvent: event,
    nextEventPreview: null,
    lastNotice: makeNotice(`Карты выданы. Событие добавлено: ${event.title}`)
  };

  Object.keys(players).forEach((id) => {
    updates[`players/${id}/cards`] = generateCharacterCards(mode, roomState?.settings || readSettings());
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
  const event = roomState.nextEventPreview || generateRoundEvent(next, currentMemeMode(), roomState?.settings || readSettings());
  const keep = {
    charm: roomState.effects?.charm || {},
    antiTheft: roomState.effects?.antiTheft || {},
    doubleEliminateNext: roomState.effects?.doubleEliminateNext || false,
    lastPomidor: roomState.effects?.lastPomidor || null
  };
  const autoOpenVoting = next >= votingStartsAfter();
  const updates = {
    revealRound: next,
    currentEvent: event,
    nextEventPreview: null,
    votes: {},
    voteStartVotes: {},
    votePhase: autoOpenVoting ? "open" : "closed",
    effects: emptyEffects(next, keep),
    lastNotice: makeNotice(autoOpenVoting ? `Новый круг ${next}. Голосование открыто. Событие: ${event.title}` : `Новый круг ${next}. Событие обновлено: ${event.title}`)
  };
  getPlayers().forEach((p) => {
    updates[`players/${p.id}/revealCountThisRound`] = 0;
  });
  const eventLogs = applyRoundEvent(event, updates, next);
  await update(roomRef(), updates);
  await pushLog(`Начался круг раскрытия ${next}. Событие: ${event.title}. Голоса и эффекты раунда сброшены.${autoOpenVoting ? " Голосование открыто автоматически." : ""}`);
  if (autoOpenVoting) await pushLog(`Система голосования: с ${votingStartsAfter()} круга совет бункера открыт. Теперь можно голосовать за вылет.`);
  for (const line of eventLogs) await pushLog(line);
}

async function generateNewStory() {
  if (!isHost()) return;
  const story = generateStory(currentMemeMode());
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
  const event = generateRoundEvent(round, currentMemeMode(), roomState?.settings || readSettings());
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

function votingStartsAfter() {
  return Number(roomState?.settings?.votingStartsAfter || 3);
}

function earlyVotePercent() {
  return Number(roomState?.settings?.earlyVotePercent || 70);
}

function isVotingOpen() {
  return roomState?.votePhase === "open";
}

function alivePlayersList() {
  return getPlayers().filter((p) => p.alive);
}

function voteStartYesIds() {
  const alive = new Set(alivePlayersList().map((p) => p.id));
  return Object.keys(roomState?.voteStartVotes || {}).filter((id) => alive.has(id) && roomState.voteStartVotes[id]);
}

function requiredStartVotes() {
  const aliveCount = Math.max(1, alivePlayersList().length);
  return Math.ceil(aliveCount * earlyVotePercent() / 100);
}

async function requestStartVoting() {
  const me = getMe();
  if (!roomState?.cardsGenerated) return alert("Сначала нужно сгенерировать карты.");
  if (!me?.alive) return alert("Выгнанный игрок не может запускать совет.");
  if (isVotingOpen()) return alert("Голосование уже открыто.");

  const yesIds = new Set(voteStartYesIds());
  yesIds.add(playerId);
  const needed = requiredStartVotes();
  const aliveCount = alivePlayersList().length;
  const updates = {
    [`voteStartVotes/${playerId}`]: true,
    lastNotice: makeNotice(`${playerName} хочет начать голосование сейчас (${yesIds.size}/${needed})`)
  };

  if (yesIds.size >= needed) {
    updates.votePhase = "open";
    updates.votes = {};
    updates.voteStartVotes = {};
    updates.lastNotice = makeNotice(`Порог ${earlyVotePercent()}% достигнут. Голосование открыто!`);
  }

  await update(roomRef(), updates);
  if (yesIds.size >= needed) {
    await pushLog(`Досрочное голосование открыто: ${yesIds.size}/${aliveCount} игроков за, нужно было ${needed} (${earlyVotePercent()}%).`);
  } else {
    await pushLog(`${playerName} предложил начать голосование сейчас: ${yesIds.size}/${needed} голосов за запуск.`);
  }
}

async function hostOpenVoting() {
  if (!isHost()) return;
  if (!roomState?.cardsGenerated) return alert("Сначала нужно сгенерировать карты.");
  await update(roomRef(), {
    votePhase: "open",
    voteStartVotes: {},
    votes: {},
    lastNotice: makeNotice("Ведущий открыл голосование")
  });
  await pushLog("Ведущий принудительно открыл голосование за вылет.");
}

async function hostCloseVoting() {
  if (!isHost()) return;
  await update(roomRef(), {
    votePhase: "closed",
    voteStartVotes: {},
    votes: {},
    lastNotice: makeNotice("Голосование закрыто")
  });
  await pushLog("Ведущий закрыл голосование и сбросил голоса.");
}

async function voteFor(targetId) {
  if (!isVotingOpen()) return alert("Голосование сейчас закрыто. Оно откроется автоматически после нужного круга или если 70% игроков попросят начать раньше.");
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
  if (!isVotingOpen()) return alert("Голосование закрыто. Сначала открой голосование.");
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

  const updates = { votes: {}, votePhase: "closed", voteStartVotes: {}, lastNotice: makeNotice("Голосование завершено") };
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
  await pushLog(`${eliminated.join(" и ")} выгнан${eliminated.length > 1 ? "ы" : ""} из бункера голосованием (${count} голос. у лидера). Голосование закрыто до следующего круга или досрочного запуска.`);
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
      const swapKey = currentPhases().map((p) => p.key).find((key) => !["identity", "pomidor"].includes(key) && me.cards?.[key]?.revealed && target?.cards?.[key]?.revealed);
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
      const identity = generateCharacterCards(currentMemeMode(), roomState?.settings || {}).identity;
      identity.revealed = me.cards.identity?.revealed || false;
      Object.assign(updates, cardPatch(`players/${playerId}/cards/identity`, identity));
      logText += ` Раса ${playerName} переписана: ${identity.title}.`;
      break;
    }
    case "navigator": {
      const future = generateRoundEvent((roomState.revealRound || 1) + 1, currentMemeMode(), roomState?.settings || readSettings());
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
  const keys = currentPhases().map((p) => p.key).filter((key) => !blocked.has(key) && player?.cards?.[key]);
  return keys.length ? randomFrom(keys) : null;
}

function applyRoundEvent(event, updates, round) {
  const logs = [];
  if (!event?.effectType || !roomState?.cardsGenerated) return logs;
  const alive = livingPlayersWithCards();
  const mode = currentMemeMode();
  const patchCard = (id, key, card) => Object.assign(updates, cardPatch(`players/${id}/cards/${key}`, card));

  switch (event.effectType) {
    case "none": {
      break;
    }
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
      const identity = generateCharacterCards(mode, roomState?.settings || readSettings()).identity;
      identity.revealed = p.cards.identity?.revealed || false;
      patchCard(p.id, "identity", identity);
      logs.push(`Эффект события: раса игрока ${p.name} переписана на “${identity.title}”.`);
      break;
    }
    case "mass_mutation": {
      const targets = [...alive].sort(() => Math.random() - 0.5).slice(0, Math.min(2, alive.length));
      targets.forEach((p) => {
        const identity = generateCharacterCards(mode, roomState?.settings || readSettings()).identity;
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
      const keys = currentPhases().map((p) => p.key).filter((k) => !["identity", "pomidor"].includes(k));
      alive.forEach((p) => {
        const key = randomFrom(keys.filter((k) => p.cards?.[k]));
        const newCards = generateCharacterCards(mode, roomState?.settings || readSettings());
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
    case "family_reveal": {
      const candidates = alive.filter((p) => p.cards?.sexFamily && !p.cards.sexFamily.revealed);
      if (!candidates.length) break;
      const p = randomFrom(candidates);
      updates[`players/${p.id}/cards/sexFamily/revealed`] = true;
      logs.push(`Эффект события: карта пола и потомства игрока ${p.name} раскрыта публично.`);
      break;
    }
    case "profession_reveal_all": {
      alive.forEach((p) => { if (p.cards?.profession) updates[`players/${p.id}/cards/profession/revealed`] = true; });
      logs.push("Эффект события: профессии всех живых игроков раскрыты публично.");
      break;
    }
    case "phobia_reveal_all": {
      alive.forEach((p) => { if (p.cards?.phobia) updates[`players/${p.id}/cards/phobia/revealed`] = true; });
      logs.push("Эффект события: фобии всех живых игроков раскрыты публично.");
      break;
    }
    case "global_bad_health": {
      alive.forEach((p) => {
        const old = p.cards.health;
        const health = { ...old, title: `Критическое ухудшение: ${old.title}`, description: `${old.description} Медицинский обвал добавил тяжёлый минус: слабость, риск заражения и потребность в ресурсах.` };
        patchCard(p.id, "health", health);
      });
      logs.push("Эффект события: здоровье всех живых игроков критически ухудшено.");
      break;
    }
    case "freeze_sick": {
      const candidates = alive.filter((p) => /гни|инфек|плес|лихорад|темпера|паразит|печать/i.test(`${p.cards?.health?.title} ${p.cards?.health?.description}`));
      const p = randomFrom(candidates.length ? candidates : alive);
      updates[`effects/frozen/${p.id}`] = round;
      logs.push(`Эффект события: ${p.name} отправлен в карантин и заморожен до конца раунда.`);
      break;
    }
    case "phobia_reveal_one": {
      const candidates = alive.filter((p) => p.cards?.phobia && !p.cards.phobia.revealed);
      if (!candidates.length) break;
      const p = randomFrom(candidates);
      updates[`players/${p.id}/cards/phobia/revealed`] = true;
      logs.push(`Эффект события: фобия игрока ${p.name} раскрыта публично.`);
      break;
    }
    case "family_reveal_all": {
      alive.forEach((p) => { if (p.cards?.sexFamily) updates[`players/${p.id}/cards/sexFamily/revealed`] = true; });
      logs.push("Эффект события: карты пола и потомства всех живых игроков раскрыты публично.");
      break;
    }
    case "all_women": {
      alive.forEach((p) => {
        const old = p.cards.sexFamily || { revealed: false };
        const card = {
          type: "Пол и потомство",
          title: "Женский пол, репродуктивный статус переписан событием",
          description: "Событие раунда изменило половой профиль. Для долгого бункера это становится важным аргументом, но не гарантирует победу.",
          revealed: old.revealed || false
        };
        patchCard(p.id, "sexFamily", card);
      });
      logs.push("Эффект события: все живые игроки получили женский вариант карты пола и потомства.");
      break;
    }
    case "all_men": {
      alive.forEach((p) => {
        const old = p.cards.sexFamily || { revealed: false };
        const card = {
          type: "Пол и потомство",
          title: "Мужской пол, репродуктивный статус переписан событием",
          description: "Событие раунда изменило половой профиль. Для восстановления общества это может быть как плюсом, так и проблемой.",
          revealed: old.revealed || false
        };
        patchCard(p.id, "sexFamily", card);
      });
      logs.push("Эффект события: все живые игроки получили мужской вариант карты пола и потомства.");
      break;
    }
    case "potato_nerf": {
      const potatoes = alive.filter((p) => p.cards.identity?.raceId === "potato");
      potatoes.forEach((p) => {
        const old = p.cards.body;
        const body = { ...old, title: `Вялая проросшая картошка, ${old.height || "???"} см`, description: `${old.description} Событие “Картофельная вялость” переписало тело: мышцы ушли в ростки, авторитет упал, а еда начала смотреть подозрительно.` };
        patchCard(p.id, "body", body);
      });
      updates[`effects/eventBuffs/potato_nerf_${round}`] = "Событие: все Картошки временно стали вялыми и менее убедительными.";
      logs.push(potatoes.length ? `Эффект события: ${potatoes.map((p) => p.name).join(", ")} получили картофельный дебафф.` : "Эффект события: Картошек нет, поэтому вялость прошла мимо.");
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

  roomStatus.textContent = `Игроков: ${players.length}/${settings.maxPlayers || "?"}. Живых: ${alivePlayers.length}. Мест в бункере: ${bunker.capacity || settings.bunkerSeats || "?"}. Ведущий: ${hostName}. Голосование: ${isVotingOpen() ? "открыто" : "закрыто"}.`;
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
  if (votePhaseText) votePhaseText.textContent = isVotingOpen() ? "открыто" : `закрыто до круга ${votingStartsAfter()}`;
  oneRevealHint.textContent = hasRevealedThisRound(me) ? "лимит раскрытия на круг" : `можно выбрать ${revealLimit() - revealCount(me)} карт.`;

  renderMyCards();
  renderPlayers(players);
  renderStatsTable(players);
  renderStory();
  renderBunker();
  renderNotice();
  renderEffects();
  renderVoting(players);
  renderSurvivalAnalysis(players);
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
  currentPhases().forEach((phase) => {
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
      const opened = currentPhases().filter((phase) => player.cards?.[phase.key]?.revealed).length;
      const pom = player.cards.pomidor;
      miniCards = `
        <div class="mini-card"><strong>Открыто:</strong> ${opened}/${currentPhases().length}</div>
        <div class="mini-card"><strong>Статус:</strong> ${player.alive ? "в игре" : "выгнан"}</div>
        <div class="mini-card"><strong>Помидор:</strong> ${pom?.revealed ? `${escapeHtml(pom.title)}${pom.used ? " — использован" : ""}` : "закрыт"}</div>
      `;
    } else {
      miniCards = `<div class="mini-card">Карты ещё не выданы.</div>`;
    }

    box.innerHTML = `
      <div class="player-head">
        <span class="player-name">${playerAvatarHtml(player)} ${escapeHtml(player.name)}</span>
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
      ${currentPhases().map((phase) => `<th>${escapeHtml(phase.title)}</th>`).join("")}
    </tr>
  `;

  if (!players.length) {
    statsTableBody.innerHTML = `<tr><td colspan="${currentPhases().length + 2}">Пока игроков нет.</td></tr>`;
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

    const cells = currentPhases().map((phase) => {
      const card = player.cards?.[phase.key];
      if (!card) return `<td class="cell-hidden">не выдано</td>`;
      const used = card.used ? `<br><span class="cell-used">использовано</span>` : "";
      if (card.revealed) return `<td class="cell-open"><strong>${escapeHtml(card.title)}</strong>${used}<br><span>${escapeHtml(card.description)}</span></td>`;
      if (isMe) return `<td class="cell-own-hidden"><strong>${escapeHtml(card.title)}</strong><br><span>не раскрыто публично</span></td>`;
      return `<td class="cell-hidden">закрыто</td>`;
    }).join("");

    return `
      <tr>
        <td><strong>${playerAvatarHtml(player, "small")} ${escapeHtml(player.name)}</strong><br><span class="muted">${escapeHtml(badges || "игрок")}</span></td>
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
      <p class="story-line"><strong>Сколько сидеть в бункере:</strong> ${escapeHtml(story.duration || "от 3 до 30 лет, зависит от катастрофы")}</p>
      <p class="story-line"><strong>После выхода:</strong> ${escapeHtml(story.afterExit || "апокалипсис может продолжаться, нужен план выживания снаружи")}</p>
      <p class="story-line"><strong>Кого ценить при этой катастрофе:</strong> ${(story.survivalFocus || []).map(escapeHtml).join(", ")}</p>
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
  if (voteControlBox) voteControlBox.innerHTML = "";

  const me = getMe();
  const alivePlayers = players.filter((p) => p.alive);
  const votes = roomState.votes || {};
  const myVote = votes[playerId]?.target;
  const yesIds = voteStartYesIds();
  const needed = requiredStartVotes();
  const percent = earlyVotePercent();
  const opensAt = votingStartsAfter();
  const open = isVotingOpen();

  if (forceStartVoteBtn) forceStartVoteBtn.classList.toggle("hidden", !isHost());
  if (closeVotingBtn) closeVotingBtn.classList.toggle("hidden", !isHost());
  if (forceStartVoteBtn) forceStartVoteBtn.disabled = open || !roomState.cardsGenerated;
  if (closeVotingBtn) closeVotingBtn.disabled = !open;
  if (requestStartVoteBtn) {
    requestStartVoteBtn.disabled = open || !me?.alive || !!roomState.voteStartVotes?.[playerId] || !roomState.cardsGenerated;
    requestStartVoteBtn.textContent = roomState.voteStartVotes?.[playerId] ? "Ты уже за досрочное голосование" : "Предложить голосование сейчас";
  }

  if (voteControlBox) {
    voteControlBox.innerHTML = `
      <div class="vote-status ${open ? "open" : "closed"}">
        <strong>${open ? "Голосование открыто" : "Голосование закрыто"}</strong>
        <span>${open ? "Можно голосовать за вылет." : `Откроется автоматически с круга ${opensAt}, либо раньше при ${percent}% голосов за запуск.`}</span>
      </div>
      <div class="vote-progress">
        <span>Досрочный запуск: ${yesIds.length}/${needed} голосов за</span>
        <div class="progress-bar"><i style="width:${Math.min(100, Math.round((yesIds.length / Math.max(1, needed)) * 100))}%"></i></div>
      </div>
      ${yesIds.length ? `<p class="small-note">За старт сейчас: ${yesIds.map(nameOf).join(", ")}</p>` : `<p class="small-note">Пока никто не просил досрочное голосование.</p>`}
    `;
  }

  if (!open) {
    voteTargets.innerHTML = `<p class="muted">Совет бункера ещё закрыт. Сейчас игроки раскрывают карты и спорят. Можно нажать “Предложить голосование сейчас”; если наберётся ${percent}% живых игроков, голосование откроется автоматически.</p>`;
    renderVoteResultsAndDetails(votes);
    return;
  }

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

  renderVoteResultsAndDetails(votes);
}

function renderVoteResultsAndDetails(votes) {
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


function scoreText(text, storyText = "") {
  const t = String(text || "").toLowerCase();
  const s = String(storyText || "").toLowerCase();
  let score = 0;
  const plus = [
    ["врач", 12], ["мед", 10], ["леч", 8], ["инжен", 12], ["ремонт", 10], ["фильтр", 12], ["вода", 6], ["еда", 8], ["агроном", 10], ["картош", 4], ["навига", 7], ["охот", 8], ["стро", 7], ["дисцип", 6], ["псих", 6], ["холодная голова", 8], ["иммунитет", 8], ["потомство возможно", 9], ["учить детей", 8], ["долгоср", 8]
  ];
  const minus = [
    ["гни", -12], ["плесень", -9], ["смерт", -14], ["паралич", -9], ["слеп", -8], ["перелом", -8], ["лихорад", -10], ["инфек", -12], ["зависимость", -10], ["предатель", -10], ["ломает технику", -11], ["потомство невозможно", -7], ["боится", -4], ["страх", -4], ["не переносит детей", -8], ["хруп", -6], ["пани", -7]
  ];
  plus.forEach(([k, v]) => { if (t.includes(k)) score += v; });
  minus.forEach(([k, v]) => { if (t.includes(k)) score += v; });
  if (s.includes("вода") || s.includes("потоп") || s.includes("рыб")) {
    if (t.includes("рыболюд") || t.includes("фильтр") || t.includes("вода") || t.includes("плав")) score += 10;
    if (t.includes("страх воды")) score -= 14;
  }
  if (s.includes("темн") || s.includes("подзем")) {
    if (t.includes("подземельник") || t.includes("ноч") || t.includes("темно")) score += 10;
    if (t.includes("страх темноты")) score -= 14;
  }
  if (s.includes("контроль") || s.includes("экзам")) {
    if (t.includes("учитель") || t.includes("память") || t.includes("дисцип")) score += 10;
    if (t.includes("страх контроль")) score -= 14;
  }
  if (s.includes("плесень") || s.includes("лихорад")) {
    if (t.includes("иммунитет") || t.includes("врач") || t.includes("санитар")) score += 10;
    if (t.includes("лёг") || t.includes("инфек")) score -= 10;
  }
  return score;
}

function analyzeTeamSurvival(players) {
  const alive = players.filter((p) => p.alive && p.cards);
  const bunker = roomState.bunker || {};
  const story = roomState.story || {};
  const capacity = Number(bunker.capacity || roomState.settings?.bunkerSeats || alive.length || 1);
  const storyText = [story.title, story.intro, story.outside, story.afterExit, ...(story.survivalFocus || [])].join(" ");
  let base = 42;
  const reasons = [];
  const warnings = [];
  if (!alive.length) return { percent: 0, reasons: ["Нет живых игроков с картами."], warnings: [], playerScores: [] };
  if (alive.length > capacity) {
    const penalty = Math.min(25, (alive.length - capacity) * 8);
    base -= penalty;
    warnings.push(`Живых ${alive.length}, мест ${capacity}. Лишние люди режут шанс на ${penalty}%.`);
  } else {
    base += 8;
    reasons.push(`Команда помещается в бункер: ${alive.length}/${capacity}.`);
  }
  if (/30|20|лет/i.test(story.duration || "")) {
    base -= 5;
    warnings.push("Долгий срок бункера: важнее потомство, психика, еда и медицина.");
  }
  const playerScores = alive.map((p) => {
    const text = Object.values(p.cards || {}).map((c) => `${c.title} ${c.description}`).join(" ");
    const score = scoreText(text, storyText);
    return { id: p.id, name: p.name, score };
  });
  const totalCardScore = playerScores.reduce((sum, p) => sum + p.score, 0);
  base += Math.round(totalCardScore / Math.max(1, alive.length));
  const allText = alive.map((p) => Object.values(p.cards || {}).map((c) => `${c.title} ${c.description}`).join(" ")).join(" ").toLowerCase();
  const checks = [
    ["медицина", ["врач", "мед", "леч", "уход за больными"], 10],
    ["ремонт/инженерия", ["инжен", "ремонт", "генератор", "скотч", "стро"], 10],
    ["еда", ["еда", "повар", "агроном", "семена", "картош", "охот"], 8],
    ["вода/фильтрация", ["фильтр", "вода", "рыболюд"], 8],
    ["психика", ["псих", "холодная голова", "сильная воля", "не конфликтует"], 8],
    ["будущее/потомство", ["потомство возможно", "учить детей", "демограф"], 8]
  ];
  checks.forEach(([name, keys, value]) => {
    if (keys.some((k) => allText.includes(k))) {
      base += value;
      reasons.push(`Есть важный блок: ${name}.`);
    } else {
      base -= Math.round(value / 1.5);
      warnings.push(`Не хватает блока: ${name}.`);
    }
  });
  const badSignals = ["гни", "инфек", "предатель", "ломает технику", "потомство невозможно", "не переносит детей", "страх воды", "страх темноты", "страх врачей"];
  const badCount = badSignals.filter((k) => allText.includes(k)).length;
  if (badCount) {
    base -= badCount * 4;
    warnings.push(`Опасных минусов в команде: ${badCount}.`);
  }
  const percent = clamp(base, 3, 97);
  return { percent, reasons: reasons.slice(0, 8), warnings: warnings.slice(0, 8), playerScores };
}

async function calculateSurvivalAnalysis() {
  if (!roomState?.cardsGenerated) return alert("Сначала сгенерируйте карты.");
  const analysis = analyzeTeamSurvival(getPlayers());
  await update(roomRef(), { survivalAnalysis: { ...analysis, at: Date.now() } });
  await pushLog(`Анализ выживания пересчитан: шанс команды ${analysis.percent}%.`);
}

function renderSurvivalAnalysis(players) {
  if (!survivalBox) return;
  const analysis = roomState.survivalAnalysis || analyzeTeamSurvival(players);
  const date = analysis.at ? new Date(analysis.at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "предпросчёт";
  survivalBox.innerHTML = `
    <div class="survival-score">
      <span>Шанс выжить выбранной живой команде</span>
      <strong>${escapeHtml(analysis.percent || 0)}%</strong>
      <em>${escapeHtml(date)}</em>
    </div>
    <h4>Почему шанс такой</h4>
    <ul>${(analysis.reasons || []).map((x) => `<li>${escapeHtml(x)}</li>`).join("") || "<li>Сильных плюсов пока мало или карты не выданы.</li>"}</ul>
    <h4>Что ломает выживание</h4>
    <ul>${(analysis.warnings || []).map((x) => `<li>${escapeHtml(x)}</li>`).join("") || "<li>Критичных минусов анализ не увидел.</li>"}</ul>
    <h4>Вклад игроков</h4>
    <div class="vote-results">${(analysis.playerScores || []).sort((a,b)=>b.score-a.score).map((p) => { const pl = (roomState.players || {})[p.id]; return `<div class="vote-row"><strong>${playerAvatarHtml(pl, "small")} ${escapeHtml(p.name)}</strong><span>${p.score > 0 ? "+" : ""}${escapeHtml(p.score)} к шансу</span></div>`; }).join("") || "<p class='muted'>Нет данных по игрокам.</p>"}</div>
    <p class="muted">Это не абсолютная истина, а игровой анализ по ключевым словам карт, катастрофе, вместимости бункера и проблемам команды. Его можно использовать как аргумент в споре.</p>
  `;
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
if (requestStartVoteBtn) requestStartVoteBtn.addEventListener("click", requestStartVoting);
if (forceStartVoteBtn) forceStartVoteBtn.addEventListener("click", hostOpenVoting);
if (closeVotingBtn) closeVotingBtn.addEventListener("click", hostCloseVoting);
if (analyzeSurvivalBtn) analyzeSurvivalBtn.addEventListener("click", calculateSurvivalAnalysis);
if (ageGateConfirmBtn) ageGateConfirmBtn.addEventListener("click", () => {
  const age = Number(ageGateAgeInput?.value || 0);
  const answer = Number(ageGateAnswerInput?.value || NaN);
  if (age < 18) return alert("Для 18+ режима нужно подтвердить возраст 18+.");
  if (answer !== currentAgeGateAnswer) return alert("Ван Зошит не принял ответ. Подсказка: результат всегда 5.");
  sessionStorage.setItem("vz_adult_confirmed", "yes");
  resolveAdultGate(true);
});
if (ageGateCancelBtn) ageGateCancelBtn.addEventListener("click", () => resolveAdultGate(false));
if (ageGateModal) ageGateModal.addEventListener("click", (event) => {
  if (event.target === ageGateModal) resolveAdultGate(false);
});
if (personalizationBtn) personalizationBtn.addEventListener("click", openProfileModal);
if (closeProfileBtn) closeProfileBtn.addEventListener("click", closeProfileModal);
if (saveProfileBtn) saveProfileBtn.addEventListener("click", saveProfile);
if (profileModal) profileModal.addEventListener("click", (event) => {
  if (event.target === profileModal) closeProfileModal();
});
if (themeSelect) themeSelect.addEventListener("change", () => { userProfile.theme = themeSelect.value; applyProfile(); });
if (accentSelect) accentSelect.addEventListener("change", () => { userProfile.accent = accentSelect.value; applyProfile(); });
if (sfxToggleInput) sfxToggleInput.addEventListener("change", () => { userProfile.sfx = sfxToggleInput.checked; saveProfileLocal(); applyProfile(); });
if (musicToggleInput) musicToggleInput.addEventListener("change", () => { userProfile.music = musicToggleInput.checked; saveProfileLocal(); applyProfile(); });
if (musicToggleBtn) musicToggleBtn.addEventListener("click", toggleMenuMusic);
document.addEventListener("click", (event) => {
  if (event.target?.closest?.("button")) playUiSound("click");
}, true);

applyProfile();

initFirebase();

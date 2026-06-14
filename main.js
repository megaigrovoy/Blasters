import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

const MEDIAPIPE_TASKS_VISION_WASM_VER = '0.10.34';

const STORAGE_SFX_OFF = 'blasters-sfx-off';
const STORAGE_MUSIC_OFF = 'blasters-music-off';
const STORAGE_SFX_VOL = 'blasters-sfx-vol';
const STORAGE_MUSIC_VOL = 'blasters-music-vol';
const STORAGE_LANG = 'blasters-lang';
const STORAGE_PLAYER_COUNT = 'blasters-player-count';
const STORAGE_LEADERBOARD = 'blasters-leaderboard-top10';

const FINAL_LEVEL = 5;
const LEADERBOARD_MAX = 10;
const SHOOT_TUTORIAL_MS = 5000;
const SHOOT_TUTORIAL_IMG_URL = new URL('./src/assets/img/tut.webp', import.meta.url).href;

const DEBUG_FRAME_PERF =
    typeof location !== 'undefined' && new URLSearchParams(location.search).get('perf') === '1';
/** Android: GPU-делегат MediaPipe часто даёт нестабильные landmarks (см. mobile-tracking-fix.md). */
function isAndroidBrowser() {
    return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
}

const trackTuning = {
    /** На Android сначала CPU; на ПК/iPad — GPU (быстрее и стабилен). */
    preferCpuPose: isAndroidBrowser(),
    handMinVisibility: isAndroidBrowser() ? 0.3 : 0.55,
    minPoseConfidence: isAndroidBrowser() ? 0.3 : 0.5
};

/** 0…1 — громкость эффектов и музыки (ползунки) */
let sfxVolume01 = 1;
let musicVolume01 = 1;
/** 'ru' | 'en' */
let uiLang = 'ru';

function loadPlayerCountPreference() {
    const raw = localStorage.getItem(STORAGE_PLAYER_COUNT);
    return raw === '1' ? 1 : 2;
}

/** 1 или 2 — совпадает с numPoses у PoseLandmarker */
let playerModeCount = loadPlayerCountPreference();

const I18N_STRINGS = {
    ru: {
        playerLabel: 'Игроков на камере',
        cornerLangTitle: 'Язык',
        cornerPlayersTitle: 'Игроки',
        playerOne: 'Один',
        playerTwo: 'Два',
        playerHint:
            'Переключатель сохраняется. После смены режима модель поз перезапускается автоматически.',
        btnStart: 'Играть',
        optionsTitle: 'Звук и музыка',
        volSfx: 'Громкость эффектов',
        volMusic: 'Громкость музыки',
        btnBackMenu: 'Меню',
        fullscreen: 'На весь экран',
        fullscreenExit: 'Свернуть',
        gameOver: 'ИГРА ОКОНЧЕНА',
        victory: 'Победа!',
        youWon: 'Ты победил!',
        leaderboardTitle: 'Топ-10 на этом устройстве',
        campaignScore: 'Итоговый счёт',
        leaderboardRank: 'Место в рейтинге',
        leaderboardNewRecord: 'Новый рекорд!',
        leaderboardNoTop: 'Не попал в топ-10',
        leaderboardEmpty: 'Пока нет результатов',
        tutShootUp: 'Подними руки вверх — стрельба',
        tutShootDown: 'Опусти руки — остановка стрельбы',
        levelLabel: 'Уровень',
        loadingModels: 'Загрузка моделей…',
        players1ok: 'Режим: 1 игрок',
        players1wait: 'Режим: 1 игрок · встаньте в кадр',
        players2ok: 'Режим: 2 игрока · общий счёт',
        players2wait1: 'Режим: 2 игрока · позовите второго',
        players2wait0: 'Режим: 2 игрока · встаньте в кадр',
        errTitle: 'Не удалось запустить игру.',
        errHintDefault:
            'Откройте консоль браузера (F12 → Console) и при необходимости пришлите текст ошибки.',
        errHintPermission:
            'Браузер заблокировал камеру для этого сайта. Нажмите на значок замка слева от адреса → разрешите камеру, обновите страницу.',
        errHintNotFound: 'Камера не найдена. Проверьте, что она подключена и не занята другим приложением.',
        errHintAbort:
            'Камера не успела запуститься. Отключите режим эмуляции устройства в DevTools (или выберите реальное устройство с камерой), закройте другие программы, использующие камеру, и обновите страницу.'
    },
    en: {
        playerLabel: 'Players in frame',
        cornerLangTitle: 'Language',
        cornerPlayersTitle: 'Players',
        playerOne: 'One',
        playerTwo: 'Two',
        playerHint: 'This choice is saved. Changing it restarts the pose model.',
        btnStart: 'Play',
        optionsTitle: 'Sound & music',
        volSfx: 'Sound effects volume',
        volMusic: 'Music volume',
        btnBackMenu: 'Menu',
        fullscreen: 'Fullscreen',
        fullscreenExit: 'Exit fullscreen',
        gameOver: 'GAME OVER',
        victory: 'Victory!',
        youWon: 'You won!',
        leaderboardTitle: 'Top 10 on this device',
        campaignScore: 'Final score',
        leaderboardRank: 'Leaderboard rank',
        leaderboardNewRecord: 'New record!',
        leaderboardNoTop: 'Not in top 10',
        leaderboardEmpty: 'No scores yet',
        tutShootUp: 'Raise your hands to shoot',
        tutShootDown: 'Lower your hands to stop shooting',
        levelLabel: 'Level',
        loadingModels: 'Loading models…',
        players1ok: 'Mode: 1 player',
        players1wait: 'Mode: 1 player · step into frame',
        players2ok: 'Mode: 2 players · shared score',
        players2wait1: 'Mode: 2 players · bring in second player',
        players2wait0: 'Mode: 2 players · step into frame',
        errTitle: 'Could not start the game.',
        errHintDefault:
            'Open the browser console (F12 → Console) and share the error text if you need help.',
        errHintPermission:
            'The browser blocked camera access for this site. Use the lock icon in the address bar → allow camera, then reload.',
        errHintNotFound: 'No camera found. Check it is plugged in and not in use by another app.',
        errHintAbort:
            'The camera did not start in time. Turn off device emulation in DevTools (or pick a real device with a camera), close other apps using the camera, and reload.'
    }
};

function t(key) {
    const pack = I18N_STRINGS[uiLang] || I18N_STRINGS.ru;
    const v = pack[key];
    return v != null ? v : I18N_STRINGS.en[key] ?? key;
}

function formatScore(n) {
    return uiLang === 'ru' ? `Счёт: ${n}` : `Score: ${n}`;
}

function formatLevel(n = currentLevel) {
    return uiLang === 'ru' ? `${t('levelLabel')}: ${n}` : `${t('levelLabel')}: ${n}`;
}

function updateLevelDisplay() {
    if (levelDisplay) levelDisplay.textContent = formatLevel();
}

function loadLangPreference() {
    const raw = localStorage.getItem(STORAGE_LANG);
    if (raw === 'en' || raw === 'ru') return raw;
    if (typeof navigator !== 'undefined' && navigator.language && /^en/i.test(navigator.language)) return 'en';
    return 'ru';
}

function applyI18n() {
    document.documentElement.lang = uiLang === 'en' ? 'en' : 'ru';
    for (const el of document.querySelectorAll('[data-i18n]')) {
        const key = el.getAttribute('data-i18n');
        if (key) el.textContent = t(key);
    }
    syncFullscreenButton();
    const loadEl = document.getElementById('loading');
    const ld = document.getElementById('loading-text');
    if (ld && loadEl?.classList.contains('visible')) {
        ld.textContent = t('loadingModels');
    }
    if (scoreDisplay && isPlaying) scoreDisplay.innerText = formatScore(score);
    if (isPlaying) updateLevelDisplay();
    document.getElementById('players-count-group')?.setAttribute('aria-label', t('playerLabel'));
}

function loadPersistedSettings() {
    let sVol = parseFloat(localStorage.getItem(STORAGE_SFX_VOL));
    if (!Number.isFinite(sVol)) {
        sVol = localStorage.getItem(STORAGE_SFX_OFF) === '1' ? 0 : 1;
    }
    sfxVolume01 = Math.max(0, Math.min(1, sVol));

    let mVol = parseFloat(localStorage.getItem(STORAGE_MUSIC_VOL));
    if (!Number.isFinite(mVol)) {
        mVol = localStorage.getItem(STORAGE_MUSIC_OFF) === '1' ? 0 : 1;
    }
    musicVolume01 = Math.max(0, Math.min(1, mVol));

    uiLang = loadLangPreference();

    const volSfxEl = document.getElementById('vol-sfx');
    const volMusicEl = document.getElementById('vol-music');
    const volSfxVal = document.getElementById('vol-sfx-val');
    const volMusicVal = document.getElementById('vol-music-val');
    if (volSfxEl) volSfxEl.value = String(Math.round(sfxVolume01 * 100));
    if (volMusicEl) volMusicEl.value = String(Math.round(musicVolume01 * 100));
    if (volSfxVal) volSfxVal.textContent = `${Math.round(sfxVolume01 * 100)}%`;
    if (volMusicVal) volMusicVal.textContent = `${Math.round(musicVolume01 * 100)}%`;

    const optRu = document.getElementById('opt-lang-ru');
    const optEn = document.getElementById('opt-lang-en');
    if (optRu && optEn) {
        optRu.checked = uiLang === 'ru';
        optEn.checked = uiLang === 'en';
    }
    applyI18n();
    applyMusicOutputVolumes();
}

const SFX_SHOOT_URLS = [
    new URL('./src/assets/sounds/blaster/blaster1.MP3', import.meta.url).href
];

const SFX_HIT_URLS = [
    new URL('./src/assets/sounds/Sound Of Meat Slice.mp3', import.meta.url).href,
    new URL('./src/assets/sounds/Sound Of Meat Slice2.mp3', import.meta.url).href,
    new URL('./src/assets/sounds/Sound Of Fruit Slice.mp3', import.meta.url).href,
    new URL('./src/assets/sounds/Sound Of Fruit Slice 3.mp3', import.meta.url).href
];

let shootSfxRot = 0;
let hitSfxRot = 0;

function playShootSound() {
    if (sfxVolume01 <= 0) return;
    const url = SFX_SHOOT_URLS[shootSfxRot++ % SFX_SHOOT_URLS.length];
    playOneShotSfx(url, 0.52);
}

function playHitSound() {
    if (sfxVolume01 <= 0) return;
    const url = SFX_HIT_URLS[hitSfxRot++ % SFX_HIT_URLS.length];
    playOneShotSfx(url, 0.82);
}

const MENU_MUSIC_URL = new URL('./src/assets/sounds/menu.mp3', import.meta.url).href;
const GAME_BG_GLOB = import.meta.glob('./src/assets/sounds/OST/*.mp3', {
    eager: true,
    query: '?url',
    import: 'default'
});
const GAME_BG_TRACKS = Object.values(GAME_BG_GLOB);

const sfxAudioBufferByUrl = new Map();
const sfxAudioBufferPromiseByUrl = new Map();

function getOrCreateSfxContext() {
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        if (!window.__blastersAudioCtx) {
            const ctx = new AC();
            window.__blastersAudioCtx = ctx;
            // На iOS первая resume() на свежем контексте может «дозреть» позже — ловим переход в running.
            try {
                ctx.onstatechange = () => {
                    if (ctx.state === 'running') webAudioUnlocked = true;
                };
            } catch (_) {}
        }
        return window.__blastersAudioCtx;
    } catch (_) {
        return null;
    }
}

function ensureSfxAudioBuffer(ctx, url) {
    if (!url || !ctx) return Promise.reject(new Error('no ctx/url'));
    const hit = sfxAudioBufferByUrl.get(url);
    if (hit) return Promise.resolve(hit);
    const inflight = sfxAudioBufferPromiseByUrl.get(url);
    if (inflight) return inflight;
    const p = fetch(url)
        .then((r) => r.arrayBuffer())
        .then((ab) => ctx.decodeAudioData(ab))
        .then((buf) => {
            sfxAudioBufferByUrl.set(url, buf);
            sfxAudioBufferPromiseByUrl.delete(url);
            return buf;
        })
        .catch((e) => {
            sfxAudioBufferPromiseByUrl.delete(url);
            throw e;
        });
    sfxAudioBufferPromiseByUrl.set(url, p);
    return p;
}

/** @returns {boolean} true — звук ушёл в Web Audio; false — контекст не звучит (нужен fallback). */
function playDecodedSfx(ctx, buffer, volume) {
    if (ctx.state !== 'running') {
        if (ctx.state === 'suspended') {
            try {
                void ctx.resume();
            } catch (_) {}
        }
        return false;
    }
    const v = Math.max(0, volume);
    if (v <= 0) return true;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = v;
    src.buffer = buffer;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(0);
    return true;
}

function playOneShotSfx(url, volume) {
    if (sfxVolume01 <= 0 || !url) return;
    const effectiveVol = volume * sfxVolume01;
    if (effectiveVol <= 0) return;
    const ctx = window.__blastersAudioCtx || getOrCreateSfxContext();
    // Пока Web Audio контекст не «running» (типично на iOS до жеста/в первые мгновения) —
    // звук из него уходит в тишину. Играем через HTML Audio (он уже разблокирован в жесте).
    if (!ctx || ctx.state !== 'running') {
        if (ctx && ctx.state === 'suspended') {
            try {
                void ctx.resume();
            } catch (_) {}
        }
        fallbackHtmlOneShot(url, effectiveVol);
        return;
    }
    const ready = sfxAudioBufferByUrl.get(url);
    if (ready) {
        try {
            if (!playDecodedSfx(ctx, ready, effectiveVol)) fallbackHtmlOneShot(url, effectiveVol);
        } catch (_) {
            fallbackHtmlOneShot(url, effectiveVol);
        }
        return;
    }
    void ensureSfxAudioBuffer(ctx, url)
        .then((buf) => {
            if (sfxVolume01 <= 0) return;
            const ev = volume * sfxVolume01;
            if (ev <= 0) return;
            try {
                if (!playDecodedSfx(ctx, buf, ev)) fallbackHtmlOneShot(url, ev);
            } catch (_) {
                fallbackHtmlOneShot(url, ev);
            }
        })
        .catch(() => fallbackHtmlOneShot(url, effectiveVol));
}

function fallbackHtmlOneShot(url, volume) {
    const a = new Audio(url);
    a.volume = volume;
    void a.play().catch(() => {});
}

function preloadHtmlAudioUrl(url) {
    if (!url) return;
    const a = new Audio();
    a.preload = 'auto';
    a.src = url;
    void a.load();
}

function scheduleStaggeredOstPreload() {
    const tracks = GAME_BG_TRACKS.filter(Boolean);
    if (!tracks.length) return;
    let i = 0;
    const step = () => {
        if (i >= tracks.length) return;
        preloadHtmlAudioUrl(tracks[i++]);
        setTimeout(step, 120);
    };
    const kick = () => step();
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(kick, { timeout: 1800 });
    } else {
        setTimeout(kick, 400);
    }
}

/**
 * Быстрый параллельный прогрев SFX. Вызывается в пользовательском жесте: на iOS
 * decodeAudioData надёжно отрабатывает только при резюмированном контексте,
 * поэтому декодируем сразу после разблокировки — к началу стрельбы буферы готовы.
 */
function warmSfxAudioBuffersNow() {
    const ctx = getOrCreateSfxContext();
    if (!ctx) return;
    const sfxOnly = [...new Set([...SFX_SHOOT_URLS, ...SFX_HIT_URLS])].filter(Boolean);
    for (const u of sfxOnly) {
        if (!sfxAudioBufferByUrl.has(u)) void ensureSfxAudioBuffer(ctx, u).catch(() => {});
    }
}

function preloadGameAudio() {
    // ВАЖНО: AudioContext НЕ создаём при загрузке. На iOS контекст, созданный вне
    // пользовательского жеста, может остаться «немым» даже после resume(). Поэтому здесь
    // только прогреваем сетевой кэш через HTML Audio; декод в буферы — уже в жесте (warmSfxAudioBuffersNow).
    if (sfxVolume01 > 0) {
        const sfxUrls = [...new Set([...SFX_SHOOT_URLS, ...SFX_HIT_URLS])].filter(Boolean);
        for (const u of sfxUrls) preloadHtmlAudioUrl(u);
    }
    if (musicVolume01 > 0) {
        preloadHtmlAudioUrl(MENU_MUSIC_URL);
        scheduleStaggeredOstPreload();
    }
}

function getMediapipeWasmUrl() {
    let base = import.meta.env.BASE_URL || '/';
    if (!base.endsWith('/')) base += '/';
    return new URL('mediapipe-wasm', window.location.origin + base).href;
}

let htmlAudioUnlocked = false;
let audioUnlockBusy = false;
let webAudioUnlocked = false;

/** Мгновенный «тихий» WAV (без сети) — надёжно разблокирует HTML-аудио на iOS внутри жеста. */
const SILENT_AUDIO_DATA_URI =
    'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

/**
 * iOS/iPadOS Safari запускает AudioContext в состоянии suspended, если он создан вне
 * пользовательского жеста. Один лишь resume() (он асинхронный) не делает контекст звучащим
 * к моменту первого src.start(). Канонический разблок — проиграть пустой буфер внутри жеста.
 * Должна вызываться синхронно из обработчика клика/тача.
 */
function unlockWebAudioInGesture() {
    const ctx = getOrCreateSfxContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
        try {
            const p = ctx.resume();
            if (p && typeof p.then === 'function') p.catch(() => {});
        } catch (_) {}
    }
    try {
        const buffer = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);
        src.start(0);
    } catch (_) {}
    if (ctx.state === 'running') webAudioUnlocked = true;
}

function tryUnlockAudioOnUserGesture() {
    // Web Audio разблокируем на КАЖДОМ жесте, пока контекст не зазвучит (дёшево, синхронно).
    if (!webAudioUnlocked) unlockWebAudioInGesture();
    // Декодируем SFX в жесте (резюмированный контекст), чтобы не было задержки первых выстрелов.
    if (sfxVolume01 > 0) warmSfxAudioBuffersNow();
    if (htmlAudioUnlocked || audioUnlockBusy) return;
    audioUnlockBusy = true;
    // Тихий data-URI первым: играет мгновенно в жесте и разблокирует HTML-аудио уже в первой игре.
    const srcs = [SILENT_AUDIO_DATA_URI, SFX_SHOOT_URLS[0], SFX_HIT_URLS[0], MENU_MUSIC_URL];
    const playSrcAt = (i) => {
        if (i >= srcs.length) return Promise.reject(new Error('no unlock src'));
        const a = new Audio();
        a.preload = 'auto';
        a.src = srcs[i];
        a.volume = 0.04;
        try {
            a.load();
        } catch (_) {}
        return a
            .play()
            .then(() => {
                try {
                    a.pause();
                    a.src = '';
                } catch (_) {}
            })
            .catch(() => playSrcAt(i + 1));
    };
    const busyTimer = setTimeout(() => {
        audioUnlockBusy = false;
    }, 3000);
    void playSrcAt(0)
        .then(() => {
            htmlAudioUnlocked = true;
        })
        .catch(() => {})
        .finally(() => {
            clearTimeout(busyTimer);
            audioUnlockBusy = false;
        });
}

let menuMusicAudio = null;
let gameMusicAudio = null;
let gameMusicOnEnded = null;
let gameMusicPlaylist = [];
let gameMusicPlaylistIndex = 0;

function shuffleArrayInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

function applyMusicOutputVolumes() {
    const m = Math.max(0, Math.min(1, musicVolume01));
    if (menuMusicAudio) menuMusicAudio.volume = 0.52 * m;
    if (gameMusicAudio) gameMusicAudio.volume = 0.46 * m;
}

function getMenuMusicAudio() {
    if (!menuMusicAudio) {
        menuMusicAudio = new Audio(MENU_MUSIC_URL);
        menuMusicAudio.loop = true;
    }
    menuMusicAudio.volume = 0.52 * Math.max(0, Math.min(1, musicVolume01));
    return menuMusicAudio;
}

function playMenuMusic() {
    if (musicVolume01 <= 0) return;
    void getMenuMusicAudio().play().catch(() => {});
}

function pauseMenuMusic() {
    if (menuMusicAudio) {
        menuMusicAudio.pause();
        menuMusicAudio.currentTime = 0;
    }
}

function stopGameMusic() {
    if (gameMusicAudio && gameMusicOnEnded) {
        gameMusicAudio.removeEventListener('ended', gameMusicOnEnded);
    }
    if (gameMusicAudio) {
        gameMusicAudio.pause();
        gameMusicAudio = null;
    }
    gameMusicOnEnded = null;
}

function playGameMusicTrackAt(index) {
    if (musicVolume01 <= 0) {
        stopGameMusic();
        return;
    }
    stopGameMusic();
    if (!gameMusicPlaylist.length) return;
    gameMusicPlaylistIndex = ((index % gameMusicPlaylist.length) + gameMusicPlaylist.length) % gameMusicPlaylist.length;
    const url = gameMusicPlaylist[gameMusicPlaylistIndex];
    const a = new Audio(url);
    a.volume = 0.46 * Math.max(0, Math.min(1, musicVolume01));
    gameMusicOnEnded = () => {
        gameMusicPlaylistIndex = (gameMusicPlaylistIndex + 1) % gameMusicPlaylist.length;
        playGameMusicTrackAt(gameMusicPlaylistIndex);
    };
    a.addEventListener('ended', gameMusicOnEnded);
    gameMusicAudio = a;
    void a.play().catch(() => {});
}

function startGameMusicPlaylist() {
    pauseMenuMusic();
    if (musicVolume01 <= 0 || !GAME_BG_TRACKS.length) return;
    gameMusicPlaylist = [...GAME_BG_TRACKS];
    shuffleArrayInPlace(gameMusicPlaylist);
    gameMusicPlaylistIndex = 0;
    playGameMusicTrackAt(0);
}

const video = document.getElementById('webcam');
const canvasElement = document.getElementById('game-canvas');
const canvasCtx = canvasElement.getContext('2d');
const scoreDisplay = document.getElementById('score-display');
const gameOverOverlay = document.getElementById('game-over-overlay');
const victoryOverlay = document.getElementById('victory-overlay');
const shootTutorialOverlay = document.getElementById('shoot-tutorial-overlay');
const shootTutorialImg = document.getElementById('shoot-tutorial-img');
const shootTutorialCountdown = document.getElementById('shoot-tutorial-countdown');
const campaignCompleteOverlay = document.getElementById('campaign-complete-overlay');
const campaignScoreLine = document.getElementById('campaign-score-line');
const campaignRankLine = document.getElementById('campaign-rank-line');
const leaderboardList = document.getElementById('leaderboard-list');
const btnCampaignMenu = document.getElementById('btn-campaign-menu');
const levelDisplay = document.getElementById('level-display');
const loadingElement = document.getElementById('loading');
const mainMenu = document.getElementById('main-menu');
const hudGame = document.getElementById('hud-game');
const btnBackMenu = document.getElementById('btn-back-menu');
const btnStart = document.getElementById('btn-start');
const playersDisplay = document.getElementById('players-display');
const menuPosterImg = document.getElementById('menu-poster');
if (menuPosterImg) {
    menuPosterImg.src = new URL('./src/assets/img/menu-poster.png', import.meta.url).href;
}
if (shootTutorialImg) {
    shootTutorialImg.src = SHOOT_TUTORIAL_IMG_URL;
}

let poseLandmarker;
let visionTasksResolver = null;
let mediapipePoseDelegate = 'CPU';
let lastVideoTime = -1;
/** Монотонный timestamp для detectForVideo (Android иногда откатывает video.currentTime). */
let poseDetectTsMs = 0;
/** Сглаженные landmarks — обновляются только на новом кадре камеры (не на каждом rAF). */
const cachedSmoothedLmByPoseKey = new Map();
/** Цели и интерполированный вывод для плавной отрисовки между кадрами камеры (~30 fps → 120 Hz). */
const posePrevTargetLmByPoseKey = new Map();
const poseTargetLmByPoseKey = new Map();
const poseDisplayLmByPoseKey = new Map();
let poseFrameStartMs = 0;
let poseFrameIntervalMs = 33.33;
let prevVideoTimeForInterval = -1;
let score = 0;
let currentLevel = 1;
let victoryTransitionActive = false;
let victoryTimeoutId = null;
let shootTutorialActive = false;
let shootTutorialTimeoutId = null;
let shootTutorialCountdownId = null;
const VICTORY_DISPLAY_MS = 2600;
let targets = [];
let powerUpDrops = [];
let enemySlowUntil = 0;
const ENEMY_SLOW_MUL = 0.38;
const POWERUP_DURATION_MS = 10000;
/** Шанс выпадения бонуса по типу ряда (лёгкий / средний / танк). */
const POWERUP_DROP_BY_TIER = {
    light: 0.05,
    medium: 0.1,
    tank: 0.15
};
const POWERUP_BOSS_DROP_CHANCE = 0.106;
const POWERUP_TYPES = ['invincible', 'spread', 'homing'];
const POWERUP_COLORS = {
    invincible: '#18ffff',
    spread: '#ff1744',
    homing: '#ffd740'
};
const POWERUP_SPRITE_URLS = {
    invincible: new URL('./src/assets/img/star bon.png', import.meta.url).href,
    spread: new URL('./src/assets/img/s bon.png', import.meta.url).href,
    homing: new URL('./src/assets/img/R bon.png', import.meta.url).href
};
const powerUpSprites = Object.fromEntries(POWERUP_TYPES.map((t) => [t, new Image()]));
const WEAPON_SHOT_COLORS = {
    spread: '#ff1744',
    homing: '#ffd740'
};
const handWeaponByKey = new Map();
const playerBuffByPoseKey = new Map();
let projectiles = [];
let particles = [];
let isPlaying = false;

const GAME_CFG = {
    maxTargets: 160,
    spawnIntervalMs: 3000,
    projectileSpeed: 28,
    fireCooldownMs: 260,
    /** Минимальный модуль «вверх» по нормированному вектору запястье→указательный (0…1). Стрельба только если dy ≤ −этого. */
    aimUpMinAbsDy: 0.18,
    aimMinSpanPx: 14,
    scoreTarget: 10
};

/** Формация: ступени «N шагов вправо, M влево, один вниз» с паузой между шагами (аркадный ритм). */
const INVADER_FORMATION = {
    /** Горизонтальная ступень (доля minSide за один шаг). */
    stepHMul: 0.0095,
    /** Вертикальная ступень вниз (доля minSide). */
    stepVMul: 0.006,
    /** Интервал между ступеньками, мс — больше значение, медленнее рой. */
    stepIntervalMs: 580,
    stepsRight: 2,
    stepsLeft: 2
};

let invaderFormationKinematics = {
    xOff: 0,
    yOff: 0,
    marchFlip: 0,
    stairPhase: 0,
    nextStairAtMs: 0
};

let invaderNextDiveAtMs = 0;

/** formation — ряды инопланетян; boss — босс(ы) после очистки рядов. */
let gamePhase = 'formation';
let bossesDefeatedThisLevel = 0;

function getLevelWaveSpec(level = currentLevel) {
    if (level <= 1) {
        return {
            rowLayout: ['medium', 'light'],
            bossCount: 1,
            dualBoss: false,
            bossFullWidth: true,
            bossKind: 'normal'
        };
    }
    if (level === 2) {
        return {
            rowLayout: ['tank', 'medium', 'light'],
            bossCount: 2,
            dualBoss: true,
            bossFullWidth: false,
            bossKind: 'normal'
        };
    }
    if (level === 3) {
        return {
            rowLayout: ['tank', 'tank'],
            bossCount: 1,
            dualBoss: false,
            bossFullWidth: true,
            bossKind: 'mega'
        };
    }
    if (level === 4) {
        return {
            rowLayout: ['tank', 'tank', 'light', 'light'],
            bossCount: 2,
            dualBoss: true,
            bossFullWidth: false,
            bossKind: 'mega'
        };
    }
    return {
        rowLayout: ['tank', 'medium', 'medium', 'light'],
        bossCount: 1,
        dualBoss: false,
        bossFullWidth: true,
        bossKind: 'ultra'
    };
}

function getRowDefsForLevel(level = currentLevel) {
    const spec = getLevelWaveSpec(level);
    return spec.rowLayout.map((t) => INVADER_ROW_DEFINITIONS.find((r) => r.tier === t));
}

const BOSS_PHASES = [
    { spawnIntervalMs: 3000, moveSpeedMul: 0.2625, minionsPerBurst: 1 },
    { spawnIntervalMs: 1950, moveSpeedMul: 0.4025, minionsPerBurst: 2 },
    { spawnIntervalMs: 1150, moveSpeedMul: 0.595, minionsPerBurst: 3 }
];

const BOSS_PHASES_MEGA = [
    { spawnIntervalMs: 3400, moveSpeedMul: 0.21, minionsPerBurst: 1 },
    { spawnIntervalMs: 2550, moveSpeedMul: 0.31, minionsPerBurst: 2 },
    { spawnIntervalMs: 1700, moveSpeedMul: 0.46, minionsPerBurst: 3 },
    { spawnIntervalMs: 950, moveSpeedMul: 0.62, minionsPerBurst: 4 }
];

const BOSS_PHASES_ULTRA = [
    { spawnIntervalMs: 3600, moveSpeedMul: 0.19, minionsPerBurst: 1 },
    { spawnIntervalMs: 2800, moveSpeedMul: 0.28, minionsPerBurst: 2 },
    { spawnIntervalMs: 2000, moveSpeedMul: 0.38, minionsPerBurst: 3 },
    { spawnIntervalMs: 1300, moveSpeedMul: 0.52, minionsPerBurst: 4 },
    { spawnIntervalMs: 850, moveSpeedMul: 0.66, minionsPerBurst: 5 }
];

const BOSS_LASER_HALF_WIDTH = 50;
const BOSS_LASER_CHARGE_MS = 1000;
const BOSS_LASER_FIRE_MS = 2000;
/** Пауза между лазерами по стадии урона (2–5 этап). */
const BOSS_LASER_COOLDOWN_BY_STAGE = { 1: 7000, 2: 5200, 3: 3800, 4: 2400 };

const BOSS_ARMOR_BASE = 54;

function resetInvaderFormation() {
    invaderFormationKinematics.xOff = 0;
    invaderFormationKinematics.yOff = 0;
    invaderFormationKinematics.marchFlip = 0;
    invaderFormationKinematics.stairPhase = 0;
    invaderFormationKinematics.nextStairAtMs = 0;
    invaderNextDiveAtMs = 0;
    gamePhase = 'formation';
    bossesDefeatedThisLevel = 0;
}

/** Сброс только смещения роя (новая волна), таймер нырка задаётся отдельно */
function resetInvaderFormationPosition() {
    invaderFormationKinematics.xOff = 0;
    invaderFormationKinematics.yOff = 0;
    invaderFormationKinematics.marchFlip = 0;
    invaderFormationKinematics.stairPhase = 0;
    invaderFormationKinematics.nextStairAtMs = 0;
}

function updateInvaderFormation() {
    if (gamePhase !== 'formation') return;
    const { minSide } = gameLayout;
    const aliveForm = targets.filter((t) => !t.destroyed && !t.isDiving && !t.isBoss && !t.isMinion);
    if (!aliveForm.length) return;

    const now = performance.now();
    if (!invaderFormationKinematics.nextStairAtMs) {
        invaderFormationKinematics.nextStairAtMs = now + formationStepIntervalMs();
    }
    if (now < invaderFormationKinematics.nextStairAtMs) return;

    const dH = minSide * INVADER_FORMATION.stepHMul;
    const dV = minSide * INVADER_FORMATION.stepVMul;
    const sr = INVADER_FORMATION.stepsRight;
    const sl = INVADER_FORMATION.stepsLeft;
    const cycle = sr + sl + 1;
    const p = invaderFormationKinematics.stairPhase;

    if (p < sr) {
        invaderFormationKinematics.xOff += dH;
    } else if (p < sr + sl) {
        invaderFormationKinematics.xOff -= dH;
    } else {
        invaderFormationKinematics.yOff += dV;
        invaderFormationKinematics.marchFlip ^= 1;
    }

    invaderFormationKinematics.stairPhase = (p + 1) % cycle;
    invaderFormationKinematics.nextStairAtMs = now + formationStepIntervalMs();
}

function tryInvaderDive(nowMs) {
    if (gamePhase !== 'formation') return;
    if (nowMs < invaderNextDiveAtMs) return;
    const formAlive = targets.filter((t) => !t.destroyed && !t.isDiving && !t.isBoss && !t.isMinion);
    if (formAlive.length < 1) {
        invaderNextDiveAtMs = nowMs + 900;
        return;
    }
    const { w, minSide } = gameLayout;
    const yoffs = formAlive.map((t) => t.baseY + invaderFormationKinematics.yOff);
    const maxY = Math.max(...yoffs);
    const rowBand = minSide * 0.055;
    const bottom = formAlive.filter((t) => t.baseY + invaderFormationKinematics.yOff >= maxY - rowBand);
    const pool = bottom.length ? bottom : formAlive;
    const pick = pool[(Math.random() * pool.length) | 0];

    const wx = pick.baseX + invaderFormationKinematics.xOff;
    const wy = pick.baseY + invaderFormationKinematics.yOff;
    pick.isDiving = true;
    pick.x = wx;
    pick.y = wy;
    const cx = w * (0.42 + Math.random() * 0.16);
    pick.diveVx = (cx - wx) * 0.00125;
    pick.diveVy = minSide * 0.00315;
    pick.diveAy = minSide * 0.000045;
    invaderNextDiveAtMs = nowMs + 2000 + Math.random() * 2200;
}

/** Тиры рядов; порядок сверху вниз задаётся rowLayout в getLevelWaveSpec. */
const INVADER_ROW_DEFINITIONS = [
    { tier: 'light', kind: 'bug', armorMax: 1, score: 14, color: '#69f0ae', sizeMul: 0.044 },
    { tier: 'medium', kind: 'crab', armorMax: 2, score: 28, color: '#00e5ff', sizeMul: 0.05 },
    { tier: 'tank', kind: 'tank', armorMax: 4, score: 55, color: '#ff1744', sizeMul: 0.058 }
];

const INVADER_COLS_MIN = 9;
const INVADER_COLS_CAP = 32;
/** Шаг между центрами в долях minSide (меньше — больше колонок на ту же ширину). */
const INVADER_COL_PITCH_MUL = 0.051;
const INVADER_ROW_GAP_MUL = 0.074;
/** Боковой зазор сетки от края кадра; меньше — ряд почти на всю ширину. */
const INVADER_GRID_PAD_MUL = 0.016;
/** Все ряды текущего уровня видны с начала волны. */
const INVADER_START_VISIBLE_ROWS = 3;

const INVADER_DEFS = {
    bug: {
        armorMax: 1,
        color: '#7fff00',
        score: 10,
        sizeMul: 0.044,
        init() {}
    },
    crab: {
        armorMax: 2,
        color: '#ff4b9f',
        score: 22,
        sizeMul: 0.05,
        init() {}
    },
    squid: {
        armorMax: 3,
        color: '#18ffff',
        score: 34,
        sizeMul: 0.053,
        init() {}
    },
    tank: {
        armorMax: 4,
        color: '#ffc107',
        score: 48,
        sizeMul: 0.058,
        init() {}
    }
};

function invaderPaintPixels(ctx, color, s, kind, march) {
    const u = s / 13;
    const px = (gx, gy, gw, gh) => {
        ctx.fillRect(gx * u, gy * u, gw * u, gh * u);
    };
    ctx.fillStyle = color;

    if (kind === 'bug') {
        px(-2, -5, 4, 2);
        px(-4, -3, 8, 2);
        px(-5, -1, 10, 3);
        px(-6, 2, 12, 2);
        px(-3, 4, 6, 2);
        if (march > 0.5) px(-5, 1, 2, 2);
        else px(3, 1, 2, 2);
    } else if (kind === 'crab') {
        px(-6, 0, 3, 2);
        px(3, 0, 3, 2);
        px(-5, -3, 10, 2);
        px(-4, -1, 8, 2);
        px(-5, 1, 10, 3);
        px(-3, 4, 6, 2);
        px(-7, -1, 2, 3);
        px(5, -1, 2, 3);
    } else if (kind === 'squid') {
        px(-2, -6, 4, 3);
        px(-4, -3, 8, 2);
        px(-5, -1, 10, 2);
        px(-4, 1, 8, 2);
        px(-6, 3, 3, 2);
        px(3, 3, 3, 2);
        const leg = march > 0.5;
        if (leg) {
            px(-7, 1, 2, 3);
            px(5, 1, 2, 3);
        } else {
            px(-7, 2, 2, 2);
            px(5, 2, 2, 2);
        }
    } else {
        px(-5, -4, 10, 3);
        px(-4, -1, 8, 3);
        px(-5, 2, 10, 2);
        px(-3, 4, 6, 2);
        px(-7, 0, 2, 4);
        px(5, 0, 2, 4);
    }
}

class Invader {
    /** overrides: { armorMax?, color?, score?, sizeMul? } — ряд формации поверх базового вида kind */
    constructor(kind, overrides = null) {
        const def = INVADER_DEFS[kind];
        if (!def) {
            throw new Error(`invader kind: ${kind}`);
        }
        const layout = gameLayout;
        const ov = overrides && typeof overrides === 'object' ? overrides : null;
        this.kind = kind;
        this.armorMax = ov?.armorMax ?? def.armorMax;
        this.armor = this.armorMax;
        this.color = ov?.color ?? def.color;
        this.scoreValue = ov?.score ?? def.score;
        const sizeMul = ov?.sizeMul ?? def.sizeMul;
        this.s = Math.min(80, Math.max(30, layout.minSide * sizeMul));
        this.hitR = this.s * 0.48;
        this.baseX = 0;
        this.baseY = 0;
        this.x = 0;
        this.y = 0;
        this.isDiving = false;
        this.diveVx = 0;
        this.diveVy = 0;
        this.diveAy = 0;
        this.destroyed = false;
        this.hitFlash = 0;
        this.marchT = Math.random() * 4;
        this.isBoss = false;
        this.isMinion = false;
        this.tier = ov?.tier ?? null;
        def.init(this, layout);
    }

    update(dt = 1) {
        if (this.destroyed) return;
        const es = enemySlowFactor();
        this.marchT += dt * 0.12;
        if (this.isDiving) {
            this.x += this.diveVx * dt * es;
            this.y += this.diveVy * dt * es;
            this.diveVy += this.diveAy * dt * es;
            this.diveVx += (this.kind === 'squid' ? 0.15 : 0.08) * Math.sin(this.marchT * 0.7) * dt * es;
        } else {
            this.x = this.baseX + invaderFormationKinematics.xOff;
            this.y = this.baseY + invaderFormationKinematics.yOff;
        }

        if (this.hitFlash > 0) this.hitFlash -= 0.16 * dt;
    }

    draw(ctx) {
        if (this.destroyed) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        const flash = this.hitFlash > 0;
        if (flash) {
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 22;
        } else {
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 10;
        }
        const march = this.isDiving
            ? (Math.sin(this.marchT) + 1) * 0.5
            : invaderFormationKinematics.marchFlip;
        invaderPaintPixels(ctx, this.color, this.s, this.kind, march);
        ctx.restore();
    }
}

function bossStageCount(boss) {
    if (boss?.isUltra) return 5;
    if (boss?.isMega) return 4;
    return 3;
}

function bossDamageStage(armor, armorMax, stageCount = 3) {
    const r = armor / armorMax;
    if (stageCount === 5) {
        if (r > 0.8) return 0;
        if (r > 0.6) return 1;
        if (r > 0.4) return 2;
        if (r > 0.2) return 3;
        return 4;
    }
    if (stageCount === 4) {
        if (r > 0.75) return 0;
        if (r > 0.5) return 1;
        if (r > 0.25) return 2;
        return 3;
    }
    if (r > 2 / 3) return 0;
    if (r > 1 / 3) return 1;
    return 2;
}

function bossPaintPixels(ctx, s, stage, march, hitFlash) {
    const u = s / 22;
    const px = (gx, gy, gw, gh, col) => {
        ctx.fillStyle = col;
        ctx.fillRect(gx * u, gy * u, gw * u, gh * u);
    };
    const pulse = (Math.sin(march * 2.4) + 1) * 0.5;
    const core =
        stage === 0 ? '#e040fb' : stage === 1 ? '#ff6d00' : stage === 2 ? '#ff1744' : '#d500f9';
    const hull =
        stage === 0 ? '#7c4dff' : stage === 1 ? '#5e35b1' : stage === 2 ? '#4a148c' : '#311b92';
    const trim =
        stage === 0 ? '#18ffff' : stage === 1 ? '#ffd740' : stage === 2 ? '#ff8a80' : '#ff5252';
    const glow = hitFlash > 0 ? '#ffffff' : core;

    px(-8, -2, 16, 4, hull);
    px(-6, -6, 12, 4, hull);
    px(-4, -9, 8, 3, hull);
    px(-10, 0, 4, 5, hull);
    px(6, 0, 4, 5, hull);
    if (stage < 2) {
        px(-10, -3, 3, 3, trim);
        px(7, -3, 3, 3, trim);
    } else {
        px(-9, -1, 2, 2, '#ff5252');
        px(7, -2, 2, 3, '#ff5252');
    }
    px(-3, -4, 6, 5, glow);
    px(-2, -2, 4, 3, stage >= 2 ? '#ffeb3b' : '#00e5ff');
    if (stage >= 1) {
        px(-1, 1, 2, 3, '#263238');
        px(3, -5, 2, 2, '#263238');
    }
    if (stage >= 2) {
        px(-5, 2, 3, 2, '#263238');
        px(2, 3, 4, 2, '#263238');
        px(-1, -7, 2, 2, '#ff1744');
    }
    if (stage >= 3) {
        px(-6, -8, 12, 2, '#ff1744');
        px(-2, -10, 4, 2, '#ffeb3b');
        px(4, 1, 3, 4, '#263238');
    }
    if (stage >= 4) {
        px(-7, -11, 14, 3, '#ff1744');
        px(-3, -12, 6, 2, '#ffffff');
    }
    const podY = 4 + (march > 0.5 ? 1 : 0);
    px(-7, podY, 3, 3, trim);
    px(4, podY, 3, 3, trim);
    if (stage === 0) {
        px(-2, 6, 4, 2, '#18ffff');
    } else if (stage === 1) {
        px(-3, 6, 2, 2, '#ffd740');
        px(1, 6, 3, 2, '#ffd740');
    } else if (stage === 2) {
        px(-4, 5, 8, 3, '#ff1744');
        px(-2 + pulse, 7, 4, 2, '#ffeb3b');
    } else {
        px(-5, 4, 10, 4, '#ff1744');
        px(-3 + pulse * 2, 8, 6, 2, '#ffeb3b');
        px(-1, -11, 2, 2, '#ffffff');
    }
}

class Boss {
    constructor(opts = {}) {
        const layout = gameLayout;
        this.isBoss = true;
        this.isUltra = !!opts.isUltra;
        this.isMega = !this.isUltra && !!opts.isMega;
        this.isMinion = false;
        this.isDiving = false;
        this.kind = this.isUltra ? 'ultraBoss' : this.isMega ? 'megaBoss' : 'boss';
        const baseArmor = this.isUltra
            ? BOSS_ARMOR_BASE * 3
            : this.isMega
              ? BOSS_ARMOR_BASE * 2
              : BOSS_ARMOR_BASE;
        this.armorMax = baseArmor;
        this.armor = baseArmor;
        this.color = this.isUltra ? '#b71c1c' : this.isMega ? '#d500f9' : '#e040fb';
        this.scoreValue = this.isUltra ? 1280 : this.isMega ? 920 : 520;
        const sizeMul = this.isUltra ? 0.27 : this.isMega ? 0.21 : 0.155;
        const sizeCap = this.isUltra ? 340 : this.isMega ? 280 : 220;
        const sizeMin = this.isUltra ? 130 : this.isMega ? 110 : 90;
        this.s = Math.min(sizeCap, Math.max(sizeMin, layout.minSide * sizeMul));
        this.hitR = this.s * (this.isUltra ? 0.44 : this.isMega ? 0.42 : 0.4);
        this.patrolFullWidth = !!opts.patrolFullWidth;
        const xFrac = opts.xFrac ?? 0.5;
        this.baseX = layout.w * xFrac;
        this.baseY = layout.minSide * (this.isUltra ? 0.1 : this.isMega ? 0.11 : 0.13);
        this.x = this.baseX;
        this.y = this.baseY;
        this.destroyed = false;
        this.hitFlash = 0;
        this.marchT = 0;
        this.moveT = Math.random() * 6;
        this.vertT = this.isMega ? Math.random() * Math.PI * 2 : 0;
        this.nextSpawnAtMs = performance.now() + 1400;
        this._lastDamageStage = 0;
        this.hasBossLaser =
            this.isUltra || (this.isMega && currentLevel >= 3 && currentLevel <= 4);
        this.laserLastStageOnly = this.hasBossLaser && !this.isUltra;
        if (this.hasBossLaser) {
            this.laserState = 'idle';
            this.laserNextAttackAtMs = this.laserLastStageOnly ? 0 : performance.now() + 4500;
            this.laserStateUntilMs = 0;
            this.laserChargeGlow = 0;
            this.laserLockX = this.x;
            this.laserLockY = this.y;
            this.laserHitCooldownByPoseKey = new Map();
        }
    }

    get damageStage() {
        return bossDamageStage(this.armor, this.armorMax, bossStageCount(this));
    }

    get phaseCfg() {
        if (this.isUltra) return BOSS_PHASES_ULTRA[this.damageStage];
        if (this.isMega) return BOSS_PHASES_MEGA[this.damageStage];
        return BOSS_PHASES[this.damageStage];
    }

    spawnMinions() {
        const cfg = this.phaseCfg;
        const { minSide } = gameLayout;
        const stage = this.damageStage;
        for (let i = 0; i < cfg.minionsPerBurst; i++) {
            const m = new Invader('bug', {
                armorMax: 1,
                score: 12 + stage * 4,
                sizeMul: 0.034 + stage * 0.004,
                color: stage >= 2 ? '#ff5252' : stage === 1 ? '#ffea00' : '#69f0ae'
            });
            m.isMinion = true;
            const spread = (i - (cfg.minionsPerBurst - 1) * 0.5) * 0.42;
            m.x = this.x + Math.sin(spread) * this.s * 0.22;
            m.y = this.y + this.s * 0.18;
            m.baseX = m.x;
            m.baseY = m.y;
            m.isDiving = true;
            const ang = Math.PI * 0.55 + spread * 0.35 + (Math.random() - 0.5) * 0.25;
            const spd = minSide * (0.002 + stage * 0.00065);
            m.diveVx = Math.cos(ang) * spd;
            m.diveVy = Math.abs(Math.sin(ang)) * spd + minSide * 0.0016;
            m.diveAy = minSide * 0.000038;
            targets.push(m);
        }
    }

    updateBossLaser(nowMs) {
        const stage = this.damageStage;
        const lastStage = bossStageCount(this) - 1;
        if (this.laserLastStageOnly) {
            if (stage < lastStage) return;
            if (this.laserState === 'idle' && !this.laserNextAttackAtMs) {
                this.laserNextAttackAtMs = nowMs + 2000 + Math.random() * 1000;
            }
        } else if (stage < 1) {
            return;
        }

        if (this.laserState === 'idle') {
            if (nowMs >= this.laserNextAttackAtMs) {
                this.laserState = 'charging';
                this.laserStateUntilMs = nowMs + BOSS_LASER_CHARGE_MS;
                this.laserLockX = this.x;
                this.laserLockY = this.y;
                this.laserChargeGlow = 0;
            }
            return;
        }

        this.x = this.laserLockX;
        this.y = this.laserLockY;

        if (this.laserState === 'charging') {
            const chargeStart = this.laserStateUntilMs - BOSS_LASER_CHARGE_MS;
            this.laserChargeGlow = Math.min(1, (nowMs - chargeStart) / BOSS_LASER_CHARGE_MS);
            if (nowMs >= this.laserStateUntilMs) {
                this.laserState = 'firing';
                this.laserStateUntilMs = nowMs + BOSS_LASER_FIRE_MS;
                this.laserHitCooldownByPoseKey.clear();
            }
            return;
        }

        if (this.laserState === 'firing' && nowMs >= this.laserStateUntilMs) {
            this.laserState = 'idle';
            const cooldown = BOSS_LASER_COOLDOWN_BY_STAGE[stage] ?? 7000;
            this.laserNextAttackAtMs = nowMs + cooldown * (0.85 + Math.random() * 0.3);
        }
    }

    isLaserBusy() {
        return (
            this.hasBossLaser && (this.laserState === 'charging' || this.laserState === 'firing')
        );
    }

    drawBossLaser(ctx) {
        if (!this.hasBossLaser) return;
        const cx = this.laserLockX;
        const cy = this.laserLockY;

        if (this.laserState === 'charging') {
            const pulse = this.laserChargeGlow;
            ctx.save();
            ctx.globalAlpha = 0.3 + pulse * 0.5;
            ctx.shadowColor = '#ff1744';
            ctx.shadowBlur = 20 + pulse * 36;
            ctx.fillStyle = `rgba(255, 23, 68, ${0.2 + pulse * 0.55})`;
            ctx.beginPath();
            ctx.arc(cx, cy, this.s * (0.42 + pulse * 0.28), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        if (this.laserState !== 'firing') return;

        const top = cy + this.s * 0.34;
        const h = Math.max(0, gameLayout.h - top);
        const hw = BOSS_LASER_HALF_WIDTH;
        const grad = ctx.createLinearGradient(cx, top, cx, gameLayout.h);
        grad.addColorStop(0, 'rgba(255, 120, 160, 0.95)');
        grad.addColorStop(0.35, 'rgba(255, 23, 68, 0.82)');
        grad.addColorStop(1, 'rgba(255, 23, 68, 0.12)');
        ctx.save();
        ctx.fillStyle = grad;
        ctx.shadowColor = '#ff1744';
        ctx.shadowBlur = 32;
        ctx.fillRect(cx - hw, top, hw * 2, h);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(cx - hw * 0.1, top, hw * 0.2, h);
        ctx.restore();
    }

    update(dt = 1, nowMs = performance.now()) {
        if (this.destroyed) return;
        if (this.hasBossLaser) this.updateBossLaser(nowMs);

        const laserBusy = this.isLaserBusy();
        const es = enemySlowFactor();
        this.marchT += dt * 0.14;

        if (!laserBusy) {
            this.moveT += dt * 0.055 * this.phaseCfg.moveSpeedMul * es;
            if (this.patrolFullWidth) {
                const margin = this.s * 0.42 + gameLayout.minSide * 0.035;
                const amp = Math.max(40, gameLayout.w * 0.5 - margin);
                this.x = gameLayout.w * 0.5 + Math.sin(this.moveT) * amp;
                this.baseX = this.x;
            } else {
                const sway = gameLayout.w * 0.06 * this.phaseCfg.moveSpeedMul * es;
                this.x = this.baseX + Math.sin(this.moveT) * sway;
            }
            if (this.isMega) {
                this.vertT += dt * 0.014;
                const vertDepth = gameLayout.minSide * 0.135;
                const vertOff = (Math.sin(this.vertT) * 0.5 + 0.5) * vertDepth;
                this.y = this.baseY + vertOff;
            } else {
                this.y = this.baseY + Math.sin(this.moveT * 0.65) * gameLayout.minSide * 0.01;
            }
        }

        if (this.hitFlash > 0) this.hitFlash -= 0.13 * dt;
        if (!laserBusy && nowMs >= this.nextSpawnAtMs) {
            this.spawnMinions();
            this.nextSpawnAtMs = nowMs + this.phaseCfg.spawnIntervalMs * (0.82 + Math.random() * 0.36);
        }
    }

    draw(ctx) {
        if (this.destroyed) return;
        this.drawBossLaser(ctx);
        const stage = this.damageStage;
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.hitFlash > 0) {
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 28;
        } else if (this.hasBossLaser && this.laserState === 'charging') {
            ctx.shadowColor = '#ff1744';
            ctx.shadowBlur = 24 + this.laserChargeGlow * 28;
        } else {
            const glowColors = this.isUltra
                ? ['#b71c1c', '#ff6d00', '#ff1744', '#ff5252', '#ffeb3b']
                : this.isMega
                  ? ['#d500f9', '#ff6d00', '#ff1744', '#ff5252']
                  : ['#e040fb', '#ff6d00', '#ff1744'];
            ctx.shadowColor = glowColors[stage] ?? glowColors[glowColors.length - 1];
            ctx.shadowBlur = (this.isUltra ? 22 : this.isMega ? 20 : 16) + stage * 4;
        }
        const march = (Math.sin(this.marchT) + 1) * 0.5;
        bossPaintPixels(ctx, this.s, stage, march, this.hitFlash);
        ctx.restore();
    }
}

function spawnSingleBoss(xFrac, opts = {}) {
    const isUltra = opts.isUltra ?? false;
    const isMega = opts.isMega ?? false;
    const boss = new Boss({ xFrac, patrolFullWidth: opts.patrolFullWidth ?? false, isUltra, isMega });
    const armorBonus = Math.max(0, currentLevel - 1) * 6;
    boss.armorMax += armorBonus;
    boss.armor = boss.armorMax;
    targets.push(boss);
}

function spawnBosses() {
    if (targets.some((t) => !t.destroyed)) return;
    const spec = getLevelWaveSpec();
    const isUltra = spec.bossKind === 'ultra';
    const isMega = spec.bossKind === 'mega';
    if (spec.bossCount <= 1) {
        spawnSingleBoss(0.5, { patrolFullWidth: spec.bossFullWidth, isUltra, isMega });
    } else {
        spawnSingleBoss(0.28, { isUltra, isMega });
        spawnSingleBoss(0.72, { isUltra, isMega });
    }
}

function loadLeaderboard() {
    try {
        const raw = localStorage.getItem(STORAGE_LEADERBOARD);
        const parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((e) => e && Number.isFinite(e.score))
            .sort((a, b) => b.score - a.score)
            .slice(0, LEADERBOARD_MAX);
    } catch {
        return [];
    }
}

function formatLeaderboardDate(ts) {
    try {
        return new Date(ts).toLocaleDateString(uiLang === 'en' ? 'en-US' : 'ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
        });
    } catch {
        return '';
    }
}

function renderLeaderboardList(entries, highlightId = null) {
    if (!leaderboardList) return;
    leaderboardList.innerHTML = '';
    if (!entries.length) {
        const li = document.createElement('li');
        li.className = 'leaderboard-empty';
        li.textContent = t('leaderboardEmpty');
        leaderboardList.appendChild(li);
        return;
    }
    entries.forEach((entry, i) => {
        const li = document.createElement('li');
        if (entry.id === highlightId) li.classList.add('is-highlight');
        const rank = document.createElement('span');
        rank.className = 'leaderboard-rank';
        rank.textContent = `${i + 1}.`;
        const sc = document.createElement('span');
        sc.className = 'leaderboard-score';
        sc.textContent = String(entry.score);
        const dt = document.createElement('span');
        dt.className = 'leaderboard-date';
        dt.textContent = formatLeaderboardDate(entry.at);
        li.append(rank, sc, dt);
        leaderboardList.appendChild(li);
    });
}

/** @returns {{ saved: boolean, rank: number|null, entries: object[], entryId: string|null }} */
function saveScoreToLeaderboard(finalScore) {
    const entries = loadLeaderboard();
    const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        score: finalScore,
        at: Date.now()
    };
    const merged = [...entries, entry].sort((a, b) => b.score - a.score);
    const top = merged.slice(0, LEADERBOARD_MAX);
    const saved = top.some((e) => e.id === entry.id);
    if (saved) {
        localStorage.setItem(STORAGE_LEADERBOARD, JSON.stringify(top));
    }
    const rank = saved ? top.findIndex((e) => e.id === entry.id) + 1 : null;
    return { saved, rank, entries: loadLeaderboard(), entryId: saved ? entry.id : null };
}

function clearVictoryTransition() {
    if (victoryTimeoutId != null) {
        clearTimeout(victoryTimeoutId);
        victoryTimeoutId = null;
    }
    victoryTransitionActive = false;
    victoryOverlay?.classList.add('is-hidden');
    campaignCompleteOverlay?.classList.add('is-hidden');
}

function triggerCampaignComplete() {
    if (victoryTransitionActive) return;
    victoryTransitionActive = true;
    gamePhase = 'campaignComplete';
    projectiles.length = 0;
    isPlaying = false;
    stopGameMusic();

    const result = saveScoreToLeaderboard(score);
    if (campaignScoreLine) {
        campaignScoreLine.textContent = `${t('campaignScore')}: ${score}`;
    }
    if (campaignRankLine) {
        if (result.saved && result.rank === 1) {
            campaignRankLine.textContent = `${t('leaderboardNewRecord')} #${result.rank}`;
        } else if (result.saved && result.rank) {
            campaignRankLine.textContent = `${t('leaderboardRank')}: #${result.rank}`;
        } else {
            campaignRankLine.textContent = t('leaderboardNoTop');
        }
    }
    renderLeaderboardList(result.entries, result.entryId);
    campaignCompleteOverlay?.classList.remove('is-hidden');
}

function triggerVictoryAndNextLevel() {
    if (victoryTransitionActive) return;
    victoryTransitionActive = true;
    gamePhase = 'victory';
    projectiles.length = 0;
    victoryOverlay?.classList.remove('is-hidden');
    victoryTimeoutId = setTimeout(() => {
        victoryTimeoutId = null;
        victoryTransitionActive = false;
        victoryOverlay?.classList.add('is-hidden');
        currentLevel += 1;
        updateLevelDisplay();
        bossesDefeatedThisLevel = 0;
        gamePhase = 'formation';
        resetInvaderFormationPosition();
        invaderNextDiveAtMs = performance.now() + 2800 + Math.random() * 1600;
        spawnInvaderWave();
    }, VICTORY_DISPLAY_MS);
}

function checkWaveProgress() {
    if (!isPlaying || victoryTransitionActive) return;
    const alive = targets.some((t) => !t.destroyed);
    if (alive) return;
    if (gamePhase === 'formation') {
        gamePhase = 'boss';
        spawnBosses();
    } else if (gamePhase === 'boss') {
        if (currentLevel >= FINAL_LEVEL) {
            triggerCampaignComplete();
        } else {
            triggerVictoryAndNextLevel();
        }
    }
}

function spawnInvaderWave() {
    if (gamePhase !== 'formation') return;
    const alive = targets.filter((t) => !t.destroyed).length;
    /** Как в оригинале: следующая волна только после уничтожения текущей (иначе те же baseX/baseY — полное наслоение). */
    if (alive > 0) return;

    const { w, minSide } = gameLayout;
    const rowDefs = getRowDefsForLevel();
    const nRows = rowDefs.length;
    const padX = minSide * INVADER_GRID_PAD_MUL;
    const interiorW = Math.max(minSide * 0.2, w - 2 * padX);
    const pitch = minSide * INVADER_COL_PITCH_MUL;
    let cols = Math.floor(interiorW / pitch);
    cols = Math.min(INVADER_COLS_CAP, Math.max(INVADER_COLS_MIN, cols));
    if (nRows * cols > GAME_CFG.maxTargets) {
        cols = Math.max(INVADER_COLS_MIN, Math.floor(GAME_CFG.maxTargets / nRows));
    }

    resetInvaderFormationPosition();
    invaderNextDiveAtMs = performance.now() + 2800 + Math.random() * 1800;

    const spread = cols <= 1 ? 0 : (cols - 1) * pitch;
    const xRow = padX + (interiorW - spread) * 0.5;
    const rowGap = minSide * INVADER_ROW_GAP_MUL;
    const row0FromTop = minSide * 0.058;
    const rowsAboveClip = Math.max(0, nRows - Math.min(nRows, INVADER_START_VISIBLE_ROWS));
    const shiftUp = rowsAboveClip * rowGap;

    const levelHpBonus = currentLevel >= 3 ? 1 : 0;
    bossesDefeatedThisLevel = 0;

    for (let r = 0; r < nRows; r++) {
        const tierDef = rowDefs[r];
        const tier =
            levelHpBonus > 0
                ? { ...tierDef, armorMax: tierDef.armorMax + levelHpBonus }
                : tierDef;
        const worldY = row0FromTop + r * rowGap - shiftUp;
        for (let c = 0; c < cols; c++) {
            const inv = new Invader(tier.kind, tier);
            inv.tier = tier.tier;
            inv.baseX = xRow + (cols === 1 ? spread * 0.5 : (c / (cols - 1)) * spread);
            inv.baseY = worldY - invaderFormationKinematics.yOff;
            inv.isDiving = false;
            inv.x = inv.baseX + invaderFormationKinematics.xOff;
            inv.y = inv.baseY + invaderFormationKinematics.yOff;
            targets.push(inv);
        }
    }
}

let lastFrameTime = performance.now();

const lastFireByHandKey = new Map();

function triggerGameOver() {
    if (!isPlaying) return;
    clearVictoryTransition();
    stopGameMusic();
    isPlaying = false;
    gameOverOverlay?.classList.remove('is-hidden');
}

/** Обе перчатки игрока сломаны — он больше не может стрелять. */
function playerGlovesDestroyed(poseKey) {
    const a = getOrCreatePlayerArmor(poseKey);
    return a.gloveLHits >= GLOVE_HITS_TO_BREAK && a.gloveRHits >= GLOVE_HITS_TO_BREAK;
}

function clearShootTutorial() {
    if (shootTutorialTimeoutId != null) {
        clearTimeout(shootTutorialTimeoutId);
        shootTutorialTimeoutId = null;
    }
    if (shootTutorialCountdownId != null) {
        clearInterval(shootTutorialCountdownId);
        shootTutorialCountdownId = null;
    }
    shootTutorialActive = false;
    shootTutorialOverlay?.classList.add('is-hidden');
}

function showShootTutorial(onDone) {
    clearShootTutorial();
    shootTutorialActive = true;
    const totalSec = Math.ceil(SHOOT_TUTORIAL_MS / 1000);
    let secLeft = totalSec;
    if (shootTutorialCountdown) shootTutorialCountdown.textContent = String(secLeft);
    shootTutorialOverlay?.classList.remove('is-hidden');
    shootTutorialCountdownId = setInterval(() => {
        secLeft -= 1;
        if (shootTutorialCountdown) {
            shootTutorialCountdown.textContent = secLeft > 0 ? String(secLeft) : '';
        }
        if (secLeft <= 0) {
            clearInterval(shootTutorialCountdownId);
            shootTutorialCountdownId = null;
        }
    }, 1000);
    shootTutorialTimeoutId = setTimeout(() => {
        if (shootTutorialCountdownId != null) {
            clearInterval(shootTutorialCountdownId);
            shootTutorialCountdownId = null;
        }
        shootTutorialTimeoutId = null;
        shootTutorialActive = false;
        shootTutorialOverlay?.classList.add('is-hidden');
        onDone?.();
    }, SHOOT_TUTORIAL_MS);
}

function showMainMenu() {
    isPlaying = false;
    clearShootTutorial();
    clearVictoryTransition();
    stopGameMusic();
    gameOverOverlay?.classList.add('is-hidden');
    mainMenu.classList.remove('is-hidden');
    hudGame.classList.add('is-hidden');
    targets.length = 0;
    projectiles.length = 0;
    particles.length = 0;
    powerUpDrops.length = 0;
    handWeaponByKey.clear();
    playerBuffByPoseKey.clear();
    enemySlowUntil = 0;
    lastFireByHandKey.clear();
    gauntletOverlayByHandKey.clear();
    gauntletShoulderByPoseKey.clear();
    playerArmorByPoseKey.clear();
    stablePoseShoulderMid = [];
    resetInvaderFormation();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasElement.style.visibility = 'hidden';
    void video.pause();
    playMenuMusic();
}

function startGame(startLevel = 1) {
    tryUnlockAudioOnUserGesture();
    clearVictoryTransition();
    gameOverOverlay?.classList.add('is-hidden');
    currentLevel = Math.max(1, Math.min(FINAL_LEVEL, startLevel));
    bossesDefeatedThisLevel = 0;
    updateLevelDisplay();
    score = 0;
    scoreDisplay.innerText = formatScore(score);
    targets.length = 0;
    projectiles.length = 0;
    particles.length = 0;
    powerUpDrops.length = 0;
    handWeaponByKey.clear();
    playerBuffByPoseKey.clear();
    enemySlowUntil = 0;
    lastFrameTime = performance.now();
    lastFireByHandKey.clear();
    gauntletOverlayByHandKey.clear();
    gauntletShoulderByPoseKey.clear();
    playerArmorByPoseKey.clear();
    stablePoseShoulderMid = [];
    lastVideoTime = -1;
    poseDetectTsMs = 0;
    cachedSmoothedLmByPoseKey.clear();
    posePrevTargetLmByPoseKey.clear();
    poseTargetLmByPoseKey.clear();
    poseDisplayLmByPoseKey.clear();
    poseFrameStartMs = 0;
    poseFrameIntervalMs = 33.33;
    prevVideoTimeForInterval = -1;
    currentPoseResults = null;
    resetInvaderFormation();
    invaderNextDiveAtMs = performance.now() + 3400;
    mainMenu.classList.add('is-hidden');
    hudGame.classList.remove('is-hidden');
    canvasElement.style.visibility = 'visible';
    isPlaying = true;
    void video.play().catch(() => {});
    showShootTutorial(() => {
        startGameMusicPlaylist();
        spawnInvaderWave();
    });
    queueMicrotask(() => {
        requestAnimationFrame(gameLoop);
    });
}

btnStart?.addEventListener('click', () => startGame(1));
btnBackMenu?.addEventListener('click', () => showMainMenu());
btnCampaignMenu?.addEventListener('click', () => showMainMenu());

const gameContainer = document.getElementById('game-container');
const btnFullscreen = document.getElementById('btn-fullscreen');
const btnFullscreenLabel = btnFullscreen?.querySelector('.btn-fullscreen-label');

function isFullscreenSupported() {
    const el = gameContainer || document.documentElement;
    return !!(
        document.fullscreenEnabled ||
        document.webkitFullscreenEnabled ||
        el.requestFullscreen ||
        el.webkitRequestFullscreen
    );
}

function getCurrentFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
}

async function enterFullscreen() {
    const el = gameContainer || document.documentElement;
    try {
        if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } catch (_) {}
}

async function exitFullscreen() {
    try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch (_) {}
}

function syncFullscreenButton() {
    if (!btnFullscreen) return;
    const isFs = !!getCurrentFullscreenElement();
    btnFullscreen.classList.toggle('is-active', isFs);
    if (btnFullscreenLabel) btnFullscreenLabel.textContent = isFs ? t('fullscreenExit') : t('fullscreen');
}

if (btnFullscreen) {
    if (isFullscreenSupported()) btnFullscreen.hidden = false;
    btnFullscreen.addEventListener('click', () => {
        if (getCurrentFullscreenElement()) void exitFullscreen();
        else void enterFullscreen();
    });
    document.addEventListener('fullscreenchange', syncFullscreenButton);
    document.addEventListener('webkitfullscreenchange', syncFullscreenButton);
    syncFullscreenButton();
}

mainMenu.addEventListener(
    'pointerdown',
    (e) => {
        if (isPlaying) return;
        tryUnlockAudioOnUserGesture();
        if (e.target?.closest?.('#btn-start')) return;
        if (e.target?.closest?.('.menu-player-row')) return;
        if (e.target?.closest?.('.menu-options')) return;
        if (e.target?.closest?.('.menu-top-bar')) return;
        playMenuMusic();
    },
    { capture: true }
);

mainMenu.addEventListener(
    'touchstart',
    () => {
        if (!isPlaying) tryUnlockAudioOnUserGesture();
    },
    { capture: true, passive: true }
);
mainMenu.addEventListener(
    'touchend',
    () => {
        if (!isPlaying) tryUnlockAudioOnUserGesture();
    },
    { capture: true, passive: true }
);

// Страховка: любой первый жест на странице (loading-экран, кнопки в углах и т.п.) — разблокировать аудио.
for (const evt of ['pointerdown', 'touchend', 'click']) {
    document.addEventListener(evt, () => tryUnlockAudioOnUserGesture(), { capture: true, passive: true });
}

const volSfxEl = document.getElementById('vol-sfx');
const volMusicEl = document.getElementById('vol-music');
const volSfxVal = document.getElementById('vol-sfx-val');
const volMusicVal = document.getElementById('vol-music-val');

volSfxEl?.addEventListener('input', () => {
    sfxVolume01 = Math.max(0, Math.min(1, Number(volSfxEl.value) / 100));
    localStorage.setItem(STORAGE_SFX_VOL, String(sfxVolume01));
    if (volSfxVal) volSfxVal.textContent = `${Math.round(sfxVolume01 * 100)}%`;
});

volMusicEl?.addEventListener('input', () => {
    musicVolume01 = Math.max(0, Math.min(1, Number(volMusicEl.value) / 100));
    localStorage.setItem(STORAGE_MUSIC_VOL, String(musicVolume01));
    if (volMusicVal) volMusicVal.textContent = `${Math.round(musicVolume01 * 100)}%`;
    applyMusicOutputVolumes();
    if (musicVolume01 <= 0) {
        pauseMenuMusic();
        stopGameMusic();
    } else if (!isPlaying) {
        playMenuMusic();
    } else if (!gameMusicAudio) {
        startGameMusicPlaylist();
    }
});

for (const radio of document.querySelectorAll('input[name="blasters-lang"]')) {
    radio.addEventListener('change', () => {
        if (!radio.checked) return;
        uiLang = radio.value === 'en' ? 'en' : 'ru';
        localStorage.setItem(STORAGE_LANG, uiLang);
        applyI18n();
        applyMusicOutputVolumes();
    });
}

const btnPlayers1 = document.getElementById('btn-players-1');
const btnPlayers2 = document.getElementById('btn-players-2');

function syncPlayerCountButtons() {
    if (!btnPlayers1 || !btnPlayers2) return;
    btnPlayers1.classList.toggle('is-selected', playerModeCount === 1);
    btnPlayers2.classList.toggle('is-selected', playerModeCount === 2);
    btnPlayers1.setAttribute('aria-pressed', String(playerModeCount === 1));
    btnPlayers2.setAttribute('aria-pressed', String(playerModeCount === 2));
}

function setPlayerMode(next, userInitiated) {
    if (next !== 1 && next !== 2) return;
    if (next === playerModeCount && userInitiated) return;
    playerModeCount = next;
    localStorage.setItem(STORAGE_PLAYER_COUNT, String(playerModeCount));
    syncPlayerCountButtons();
    if (userInitiated) void recreatePoseLandmarker();
}

btnPlayers1?.addEventListener('click', () => setPlayerMode(1, true));
btnPlayers2?.addEventListener('click', () => setPlayerMode(2, true));

async function createPoseLandmarkerInstance() {
    const vision = visionTasksResolver;
    if (!vision) {
        console.warn('[Blasters] createPoseLandmarkerInstance: vision resolver not ready');
        return;
    }
    const np = playerModeCount === 1 ? 1 : 2;
    const conf = trackTuning.minPoseConfidence;
    const poseOpts = (delegate) => ({
        baseOptions: {
            modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
            delegate
        },
        runningMode: 'VIDEO',
        numPoses: np,
        minPoseDetectionConfidence: conf,
        minPosePresenceConfidence: conf,
        minTrackingConfidence: conf
    });

    const delegateOrder = trackTuning.preferCpuPose ? ['CPU', 'GPU'] : ['GPU', 'CPU'];
    let lastErr;
    for (const delegate of delegateOrder) {
        try {
            poseLandmarker = await PoseLandmarker.createFromOptions(vision, poseOpts(delegate));
            mediapipePoseDelegate = delegate;
            console.info(
                `[Blasters] pose delegate: ${mediapipePoseDelegate}, numPoses=${np}, androidCpuFirst=${trackTuning.preferCpuPose}`
            );
            return;
        } catch (e) {
            lastErr = e;
            console.warn(`PoseLandmarker ${delegate} failed:`, e);
        }
    }
    throw lastErr ?? new Error('PoseLandmarker init failed');
}

async function recreatePoseLandmarker() {
    if (!visionTasksResolver) return;
    if (poseLandmarker) {
        try {
            poseLandmarker.close();
        } catch (_) {}
        poseLandmarker = null;
    }
    lastVideoTime = -1;
    poseDetectTsMs = 0;
    cachedSmoothedLmByPoseKey.clear();
    posePrevTargetLmByPoseKey.clear();
    poseTargetLmByPoseKey.clear();
    poseDisplayLmByPoseKey.clear();
    poseFrameStartMs = 0;
    poseFrameIntervalMs = 33.33;
    prevVideoTimeForInterval = -1;
    currentPoseResults = null;
    await createPoseLandmarkerInstance();
}

loadPersistedSettings();
syncPlayerCountButtons();

const POSE_CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS;

let gameLayout = { w: 800, h: 600, minSide: 600 };

const MAX_CANVAS_LONG_EDGE_PX = 1280;
let loggedCanvasBufferCap = false;

function readViewportSize() {
    const vv = window.visualViewport;
    const w = Math.max(1, Math.floor(vv?.width ?? window.innerWidth));
    const h = Math.max(1, Math.floor(vv?.height ?? window.innerHeight));
    return { w, h };
}

let lastResizeW = 0;
let lastResizeH = 0;

function resizeCanvas() {
    const { w: vw, h: vh } = readViewportSize();
    if (vw === lastResizeW && vh === lastResizeH) return;
    lastResizeW = vw;
    lastResizeH = vh;

    let iw = vw;
    let ih = vh;
    const longEdge = Math.max(iw, ih);
    if (longEdge > MAX_CANVAS_LONG_EDGE_PX) {
        const s = MAX_CANVAS_LONG_EDGE_PX / longEdge;
        iw = Math.max(1, Math.floor(vw * s));
        ih = Math.max(1, Math.floor(vh * s));
    }

    if ((iw < vw || ih < vh) && !loggedCanvasBufferCap) {
        loggedCanvasBufferCap = true;
        console.info(
            `[Blasters] canvas buffer capped ${iw}×${ih} px (window ${vw}×${vh}) — saves GPU/CPU on large displays`
        );
    }

    gameLayout.w = iw;
    gameLayout.h = ih;
    gameLayout.minSide = Math.min(iw, ih);

    canvasElement.width = iw;
    canvasElement.height = ih;
    canvasElement.style.width = `${vw}px`;
    canvasElement.style.height = `${vh}px`;

    const gc = document.getElementById('game-container');
    if (gc) {
        gc.style.width = `${vw}px`;
        gc.style.height = `${vh}px`;
    }
    document.documentElement.style.height = `${vh}px`;
    document.body.style.height = `${vh}px`;
    document.documentElement.style.width = `${vw}px`;
    document.body.style.width = `${vw}px`;
}

let resizeCanvasDebounce = 0;
function scheduleResizeCanvas() {
    if (isPlaying) {
        clearTimeout(resizeCanvasDebounce);
        resizeCanvasDebounce = 0;
        resizeCanvas();
        return;
    }
    clearTimeout(resizeCanvasDebounce);
    resizeCanvasDebounce = setTimeout(() => {
        resizeCanvasDebounce = 0;
        resizeCanvas();
    }, 110);
}

window.addEventListener('resize', scheduleResizeCanvas);
window.visualViewport?.addEventListener('resize', scheduleResizeCanvas);
resizeCanvas();

function stopVideoTracks() {
    const s = video.srcObject;
    if (s && typeof s.getTracks === 'function') {
        s.getTracks().forEach((t) => t.stop());
    }
    video.srcObject = null;
}

function waitForVideoReady(el, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
        if (el.readyState >= 2 && el.videoWidth > 0) {
            resolve();
            return;
        }
        let done = false;
        const finish = (ok) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            el.removeEventListener('loadedmetadata', onMeta);
            el.removeEventListener('loadeddata', onData);
            el.removeEventListener('canplay', onPlay);
            if (ok) resolve();
            else reject(new Error('Video metadata timeout'));
        };
        const onMeta = () => {
            if (el.videoWidth > 0) finish(true);
        };
        const onData = () => finish(true);
        const onPlay = () => finish(true);
        const timer = setTimeout(() => finish(false), timeoutMs);
        el.addEventListener('loadedmetadata', onMeta);
        el.addEventListener('loadeddata', onData);
        el.addEventListener('canplay', onPlay);
    });
}

async function setupWebcam() {
    const nav = window.navigator;
    if (!nav.mediaDevices?.getUserMedia) {
        throw new Error('Webcam not supported.');
    }

    video.muted = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');

    const constraintSets = isAndroidBrowser()
        ? [
              {
                  video: {
                      width: { ideal: 640 },
                      height: { ideal: 480 },
                      facingMode: 'user',
                      frameRate: { ideal: 30, max: 30 }
                  }
              },
              { video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } },
              { video: { facingMode: 'user' } },
              { video: true }
          ]
        : [
              { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } },
              { video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } },
              { video: { facingMode: 'user' } },
              { video: true }
          ];

    let lastErr;
    for (const constraints of constraintSets) {
        try {
            stopVideoTracks();
            const stream = await nav.mediaDevices.getUserMedia(constraints);
            video.srcObject = stream;
            await waitForVideoReady(video, 25000);
            await video.play();
            return;
        } catch (e) {
            lastErr = e;
            console.warn('Webcam attempt failed:', constraints, e);
            stopVideoTracks();
        }
    }
    throw lastErr ?? new Error('Could not open webcam');
}

async function initializeModels() {
    let vision;
    const wasmLocal = getMediapipeWasmUrl();
    let visionWasmSource = 'same-origin';
    try {
        vision = await FilesetResolver.forVisionTasks(wasmLocal);
    } catch (e) {
        console.warn('MediaPipe wasm failed locally, CDN fallback:', e);
        visionWasmSource = 'jsdelivr-fallback';
        vision = await FilesetResolver.forVisionTasks(
            `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VISION_WASM_VER}/wasm`
        );
    }
    console.info(`[Blasters] MediaPipe WASM: ${visionWasmSource}`);

    visionTasksResolver = vision;
    await createPoseLandmarkerInstance();

    preloadGameAudio();
}

class Projectile {
    constructor(x, y, vx, vy, color, damage = 1) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.damage = damage;
        this.life = 1;
        this.r = damage > 1 ? 10 : 8;
        this.maxDist = 920;
        this.dist = 0;
        this.dead = false;
        const spd = Math.hypot(vx, vy);
        this.nx = spd > 0.01 ? vx / spd : 1;
        this.ny = spd > 0.01 ? vy / spd : 0;
        this.isHoming = false;
    }

    update(dt = 1) {
        const step = Math.hypot(this.vx, this.vy) * dt;
        this.dist += step;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= 0.038 * dt;
        if (this.dist > this.maxDist || this.life <= 0) this.dead = true;
        if (this.x < -80 || this.y < -80 || this.x > gameLayout.w + 80 || this.y > gameLayout.h + 80) {
            this.dead = true;
        }
    }

    draw(ctx) {
        const a = Math.max(0, this.life);
        const ang = Math.atan2(this.ny, this.nx);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(ang);
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = this.isHoming ? 18 : 14;
        ctx.globalAlpha = 0.9 * a;
        if (this.isHoming) {
            ctx.beginPath();
            ctx.moveTo(16, 0);
            ctx.lineTo(-10, 7);
            ctx.lineTo(-6, 0);
            ctx.lineTo(-10, -7);
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.beginPath();
            const tipX = 23;
            const tailX = -14;
            ctx.moveTo(tipX, 0);
            ctx.bezierCurveTo(6, 8.5, tailX + 5, 9, tailX, 0);
            ctx.bezierCurveTo(tailX + 5, -9, 6, -8.5, tipX, 0);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 0.55 * a;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(tailX + 3, -1.8, 3.4, 2.2, -0.35, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

class HomingProjectile extends Projectile {
    constructor(x, y, vx, vy, color, damage = 2) {
        super(x, y, vx, vy, color, damage);
        this.isHoming = true;
        this.turnRate = 0.16;
    }

    update(dt = 1) {
        let best = null;
        let bestD = Infinity;
        for (const t of targets) {
            if (t.destroyed) continue;
            const d = Math.hypot(t.x - this.x, t.y - this.y);
            if (d < bestD) {
                bestD = d;
                best = t;
            }
        }
        if (best) {
            const desired = Math.atan2(best.y - this.y, best.x - this.x);
            let cur = Math.atan2(this.vy, this.vx);
            let diff = desired - cur;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const turn = Math.max(-this.turnRate * dt, Math.min(this.turnRate * dt, diff));
            cur += turn;
            const spd = Math.hypot(this.vx, this.vy);
            this.vx = Math.cos(cur) * spd;
            this.vy = Math.sin(cur) * spd;
            this.nx = Math.cos(cur);
            this.ny = Math.sin(cur);
        }
        super.update(dt);
    }
}

class PowerUpDrop {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.color = POWERUP_COLORS[type] ?? '#ffffff';
        this.vy = gameLayout.minSide * 0.00165;
        this.r = 53;
        this.dead = false;
        this.bobT = Math.random() * 6;
    }

    update(dt = 1) {
        this.y += this.vy * dt;
        this.bobT += dt * 0.14;
        if (this.y > gameLayout.h + 40) this.dead = true;
    }

    draw(ctx) {
        if (this.dead) return;
        const bob = Math.sin(this.bobT) * 4;
        const pulse = 1 + Math.sin(this.bobT * 1.35) * 0.05;
        const img = powerUpSprites[this.type];
        const hasSprite = img?.complete && img.naturalWidth > 0;

        ctx.save();
        ctx.translate(this.x, this.y + bob);
        ctx.shadowColor = this.color;
        ctx.shadowBlur = hasSprite ? 18 : 14;

        if (hasSprite) {
            const side = this.r * 2.2 * pulse;
            ctx.scale(-1, 1);
            ctx.drawImage(img, -side * 0.5, -side * 0.5, side, side);
        } else {
            ctx.strokeStyle = this.color;
            ctx.fillStyle = 'rgba(8, 5, 16, 0.55)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(0, 0, this.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = this.color;
            ctx.font = `bold ${Math.max(11, this.r * 0.9)}px Outfit, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const glyph = { invincible: '★', spread: 'S', homing: 'R' }[this.type] ?? '?';
            ctx.fillText(glyph, 0, 1);
        }
        ctx.restore();
    }
}

function enemySlowFactor() {
    return performance.now() < enemySlowUntil ? ENEMY_SLOW_MUL : 1;
}

function formationStepIntervalMs() {
    return INVADER_FORMATION.stepIntervalMs / enemySlowFactor();
}

function isPlayerInvincible(poseKey) {
    const b = playerBuffByPoseKey.get(poseKey);
    return !!(b && performance.now() < b.invincibleUntil);
}

function getInvincibleGlow(poseKey) {
    if (!isPlayerInvincible(poseKey)) return null;
    const pulse = (Math.sin(performance.now() * 0.009) + 1) * 0.5;
    return { color: '#ffd740', blur: 16 + pulse * 18 };
}

function applyPowerUp(type, poseKey, handKey) {
    const now = performance.now();
    switch (type) {
        case 'invincible': {
            const b = playerBuffByPoseKey.get(poseKey) ?? {};
            b.invincibleUntil = now + POWERUP_DURATION_MS;
            b.invincibleRestoreDone = true;
            playerBuffByPoseKey.set(poseKey, b);
            restorePlayerArmor(poseKey);
            particles.push(new HitBurst(gameLayout.w * 0.5, gameLayout.minSide * 0.35, '#ffd740'));
            break;
        }
        case 'spread': {
            if (!handKey || isGloveBroken(poseKey, handKey)) break;
            const w = getHandWeapon(handKey);
            w.mode = 'spread';
            w.savedMode = 'spread';
            w.homingUntil = 0;
            break;
        }
        case 'homing': {
            if (!handKey || isGloveBroken(poseKey, handKey)) break;
            const w = getHandWeapon(handKey);
            w.savedMode = w.mode === 'spread' ? 'spread' : 'normal';
            w.mode = 'homing';
            w.homingUntil = now + POWERUP_DURATION_MS;
            break;
        }
        default:
            break;
    }
}

function getHandWeapon(handKey) {
    let w = handWeaponByKey.get(handKey);
    if (!w) {
        w = { mode: 'normal', homingUntil: 0, savedMode: 'normal' };
        handWeaponByKey.set(handKey, w);
    }
    const now = performance.now();
    if (w.homingUntil > 0 && now >= w.homingUntil) {
        w.homingUntil = 0;
        w.mode = w.savedMode === 'spread' ? 'spread' : 'normal';
    }
    return w;
}

function resetHandWeapon(handKey) {
    handWeaponByKey.delete(handKey);
}

function restorePlayerArmor(poseKey) {
    const a = getOrCreatePlayerArmor(poseKey);
    a.helmetHits = 0;
    a.vestHits = 0;
    a.gloveLHits = 0;
    a.gloveRHits = 0;
}

function handKeysForPose(poseKey) {
    const idx = playerIndexFromPoseKey(poseKey);
    const suffix = playerModeCount > 1 ? `#${idx}` : '';
    return [`PoseLeft${suffix}`, `PoseRight${suffix}`];
}

function trySpawnPowerUpDrop(x, y, enemy) {
    let chance = 0;
    if (enemy?.isBoss) {
        chance = POWERUP_BOSS_DROP_CHANCE;
    } else if (enemy?.tier && POWERUP_DROP_BY_TIER[enemy.tier] != null) {
        chance = POWERUP_DROP_BY_TIER[enemy.tier];
    }
    if (chance <= 0 || Math.random() > chance) return;
    const type = POWERUP_TYPES[(Math.random() * POWERUP_TYPES.length) | 0];
    powerUpDrops.push(new PowerUpDrop(x, y, type));
}

function shotColorForHand(handKey, playerColor) {
    const w = getHandWeapon(handKey);
    const now = performance.now();
    if (w.mode === 'homing' && w.homingUntil > 0 && now < w.homingUntil) {
        return WEAPON_SHOT_COLORS.homing;
    }
    if (w.mode === 'spread') return WEAPON_SHOT_COLORS.spread;
    return playerColor;
}

function fireFromHand(handKey, ox, oy, dx, dy, color) {
    const w = getHandWeapon(handKey);
    const now = performance.now();
    const spd = GAME_CFG.projectileSpeed;

    if (w.mode === 'homing' && w.homingUntil > 0 && now < w.homingUntil) {
        projectiles.push(new HomingProjectile(ox, oy, dx * spd, dy * spd, color, 2));
        return;
    }

    if (w.mode === 'spread') {
        const baseAng = Math.atan2(dy, dx);
        const spreadAng = 0.21;
        for (let i = -1; i <= 1; i++) {
            const a = baseAng + i * spreadAng;
            projectiles.push(new Projectile(ox, oy, Math.cos(a) * spd, Math.sin(a) * spd, color, 1));
        }
        return;
    }

    projectiles.push(new Projectile(ox, oy, dx * spd, dy * spd, color, 1));
}

function tickPlayerBuffs(orderedPersons) {
    const now = performance.now();
    for (const { key: poseKey } of orderedPersons) {
        const b = playerBuffByPoseKey.get(poseKey);
        if (!b || b.invincibleRestoreDone) continue;
        if (b.invincibleUntil > 0 && now >= b.invincibleUntil) {
            b.invincibleRestoreDone = true;
            restorePlayerArmor(poseKey);
            const lm = poseDisplayLmByPoseKey.get(poseKey);
            if (lm) {
                particles.push(new HitBurst(
                    gameLayout.w * 0.5,
                    gameLayout.minSide * 0.35,
                    '#ffd740'
                ));
            }
        }
    }
}

class HitBurst {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.life = 1;
        this.rot = Math.random() * Math.PI * 2;
    }
    update(dt = 1) {
        this.life -= 0.11 * dt;
    }
    draw(ctx) {
        const t = Math.max(0, this.life);
        if (t <= 0) return;
        const u = 1 - t;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rot);
        ctx.globalAlpha = t * 0.95;
        const rays = 14;
        for (let r = 0; r < rays; r++) {
            const ang = (r / rays) * Math.PI * 2;
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2.2;
            ctx.shadowBlur = 14;
            ctx.shadowColor = '#00f3ff';
            ctx.beginPath();
            const inner = 10 + u * 28;
            const outer = 32 + u * 110;
            ctx.moveTo(Math.cos(ang) * inner, Math.sin(ang) * inner);
            ctx.lineTo(Math.cos(ang) * outer, Math.sin(ang) * outer);
            ctx.stroke();
        }
        ctx.shadowBlur = 0;
        ctx.globalAlpha = t * 0.55;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 12 + u * 80, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color, kind = 'dot') {
        this.x = x;
        this.y = y;
        this.color = color;
        this.kind = kind;
        this.life = 1;
        const ang = Math.random() * Math.PI * 2;
        if (kind === 'spark') {
            const spd = 16 + Math.random() * 22;
            this.vx = Math.cos(ang) * spd;
            this.vy = Math.sin(ang) * spd;
            this.sparkAngle = ang;
            this.sparkLen = 14 + Math.random() * 20;
            this.drag = 0.9;
        } else {
            this.vx = Math.cos(ang) * (3 + Math.random() * 10);
            this.vy = Math.sin(ang) * (3 + Math.random() * 10);
            this.r = 3.5 + Math.random() * 6;
            this.drag = 0.985;
        }
    }
    update(dt = 1) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= this.drag;
        this.vy *= this.drag;
        this.life -= (this.kind === 'spark' ? 0.07 : 0.042) * dt;
    }
    draw(ctx) {
        const a = Math.max(0, this.life);
        if (a <= 0) return;
        ctx.save();
        if (this.kind === 'spark') {
            ctx.globalAlpha = a;
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2.8;
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#ffffff';
            const L = this.sparkLen * (0.4 + 0.6 * a);
            ctx.beginPath();
            ctx.moveTo(
                this.x - Math.cos(this.sparkAngle) * L * 0.35,
                this.y - Math.sin(this.sparkAngle) * L * 0.35
            );
            ctx.lineTo(this.x + Math.cos(this.sparkAngle) * L, this.y + Math.sin(this.sparkAngle) * L);
            ctx.stroke();
            ctx.restore();
            return;
        }
        const rad = this.r * (0.55 + 0.45 * a);
        const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, rad);
        g.addColorStop(0, 'rgba(255,255,255,0.95)');
        g.addColorStop(0.25, this.color);
        g.addColorStop(0.7, this.color);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = a;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(this.x, this.y, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

const POSE_BODY_HANDS = [
    { key: 'PoseLeft', wristIdx: 15, indexIdx: 19, pinkyIdx: 17, thumbIdx: 21 },
    { key: 'PoseRight', wristIdx: 16, indexIdx: 20, pinkyIdx: 18, thumbIdx: 22 }
];

const POSE_HAND_MIN_VISIBILITY = trackTuning.handMinVisibility;

/** Доли длины запястье→кончик для MCP/PIP/DIP (угловато, но ближе к реальной кисти и к линиям трекера). */
const SYNTH_FINGER_FRACS = { mcp: 0.14, pip: 0.42, dip: 0.72 };
const SYNTH_THUMB_FRACS = { mcp: 0.18, pip: 0.46, dip: 0.74 };

function midpoint(a, b) {
    return { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5, z: ((a.z ?? 0) + (b.z ?? 0)) * 0.5 };
}

function synthVecSub(a, b) {
    return { x: a.x - b.x, y: a.y - b.y, z: (a.z ?? 0) - (b.z ?? 0) };
}

function synthVecLen(v) {
    return Math.hypot(v.x, v.y, v.z ?? 0);
}

function synthVecNorm(v) {
    const L = synthVecLen(v) || 1e-8;
    return { x: v.x / L, y: v.y / L, z: (v.z ?? 0) / L };
}

function synthVis(a, b) {
    return Math.min(a.visibility ?? 1, b.visibility ?? 1);
}

function synthAlong(wrist, dirN, dist, vis) {
    if (dist <= 0) return { ...wrist };
    return {
        x: wrist.x + dirN.x * dist,
        y: wrist.y + dirN.y * dist,
        z: (wrist.z ?? 0) + (dirN.z ?? 0) * dist,
        visibility: vis
    };
}

/** Цепочка 5→6→7→8 (и аналоги) вдоль направления запястье→кончик трекера. */
function synthFillFingerChain(lm, wrist, tip, iMcp, iPip, iDip, iTip, fracs) {
    const dN = synthVecNorm(synthVecSub(tip, wrist));
    const L = synthVecLen(synthVecSub(tip, wrist));
    const vis = synthVis(wrist, tip);
    const { mcp, pip, dip } = fracs;
    lm[iMcp] = synthAlong(wrist, dN, L * mcp, vis);
    lm[iPip] = synthAlong(wrist, dN, L * pip, vis);
    lm[iDip] = synthAlong(wrist, dN, L * dip, vis);
    lm[iTip] = { x: tip.x, y: tip.y, z: tip.z, visibility: tip.visibility ?? vis };
}

function buildSyntheticHandFromPose(poseLandmarks, def) {
    const wrist = poseLandmarks[def.wristIdx];
    const indexT = poseLandmarks[def.indexIdx];
    const pinkyT = poseLandmarks[def.pinkyIdx];
    const thumbT = poseLandmarks[def.thumbIdx];
    if (!wrist || !indexT || !pinkyT) return null;
    const vis = wrist.visibility ?? 1;
    if (vis < POSE_HAND_MIN_VISIBILITY) return null;

    const thumb = thumbT || midpoint(wrist, indexT);

    const lvI = synthVecSub(indexT, wrist);
    const lvP = synthVecSub(pinkyT, wrist);
    const lenI = synthVecLen(lvI);
    const lenP = synthVecLen(lvP);
    const uI = lenI > 1e-8 ? synthVecNorm(lvI) : { x: 1, y: 0, z: 0 };
    const uP = lenP > 1e-8 ? synthVecNorm(lvP) : uI;
    const bis = synthVecNorm({ x: uI.x + uP.x, y: uI.y + uP.y, z: (uI.z ?? 0) + (uP.z ?? 0) });
    const Lmid = Math.max(lenI, lenP) * 1.07;
    const middleTip = synthAlong(wrist, bis, Lmid, synthVis(wrist, synthVis(indexT, pinkyT)));

    const midIP = midpoint(indexT, pinkyT);
    const towardRing = synthVecNorm(synthVecSub(midIP, wrist));
    const Lring = synthVecLen(synthVecSub(midIP, wrist)) * 0.96;
    const ringTip = synthAlong(wrist, towardRing, Math.max(Lring, Math.min(lenI, lenP) * 0.45), synthVis(wrist, pinkyT));

    const lm = new Array(21);
    lm[0] = wrist;

    synthFillFingerChain(lm, wrist, thumb, 1, 2, 3, 4, SYNTH_THUMB_FRACS);
    synthFillFingerChain(lm, wrist, indexT, 5, 6, 7, 8, SYNTH_FINGER_FRACS);
    synthFillFingerChain(lm, wrist, middleTip, 9, 10, 11, 12, SYNTH_FINGER_FRACS);
    synthFillFingerChain(lm, wrist, ringTip, 13, 14, 15, 16, SYNTH_FINGER_FRACS);
    synthFillFingerChain(lm, wrist, pinkyT, 17, 18, 19, 20, SYNTH_FINGER_FRACS);

    return lm;
}

function getOrderedPersons(poseResults) {
    const persons = poseResults?.landmarks;
    if (!persons?.length) return [];
    return persons
        .map((lm, idx) => {
            const lw = lm[15];
            const rw = lm[16];
            const xs = [];
            if (lw) xs.push(lw.x);
            if (rw) xs.push(rw.x);
            return { lm, idx, sortX: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : idx };
        })
        .sort((a, b) => a.sortX - b.sortX)
        .map((p, i) => ({ lm: p.lm, key: `Pose#${i}` }));
}

/** Центр плеч в экранных координатах — не даём Pose#0/#1 перепрыгивать между людьми при перекрёстке. */
let stablePoseShoulderMid = [];

function otherPoseKey(k) {
    return k === 'Pose#0' ? 'Pose#1' : 'Pose#0';
}

function shoulderMidScreen(lm, getScreenPoint) {
    const ls = lm[11];
    const rs = lm[12];
    if (!ls || !rs) return null;
    const a = getScreenPoint(ls);
    const b = getScreenPoint(rs);
    return { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
}

/**
 * Сохраняет poseKey за «слотом» по близости центра плеч к прошлому кадру.
 * Пустой кадр не трогает stable (см. prunePlayerArmorState).
 */
function bindStablePoseKeys(sortedPersons, getScreenPoint) {
    const items = [];
    for (const { lm } of sortedPersons) {
        const mid = shoulderMidScreen(lm, getScreenPoint);
        if (!mid) continue;
        items.push({ lm, mid });
    }
    if (items.length === 0) return [];

    if (items.length >= 3) {
        stablePoseShoulderMid = items.map((it, i) => ({
            key: `Pose#${i}`,
            x: it.mid.x,
            y: it.mid.y
        }));
        return items.map((it, i) => ({ lm: it.lm, key: `Pose#${i}` }));
    }

    if (items.length === 1) {
        if (stablePoseShoulderMid.length >= 2) {
            let bestKey = stablePoseShoulderMid[0].key;
            let bestD = Infinity;
            for (const s of stablePoseShoulderMid) {
                const d = Math.hypot(items[0].mid.x - s.x, items[0].mid.y - s.y);
                if (d < bestD) {
                    bestD = d;
                    bestKey = s.key;
                }
            }
            stablePoseShoulderMid = [{ key: bestKey, x: items[0].mid.x, y: items[0].mid.y }];
            return [{ lm: items[0].lm, key: bestKey }];
        }
        if (stablePoseShoulderMid.length === 1) {
            stablePoseShoulderMid[0].x = items[0].mid.x;
            stablePoseShoulderMid[0].y = items[0].mid.y;
            return [{ lm: items[0].lm, key: stablePoseShoulderMid[0].key }];
        }
        stablePoseShoulderMid = [{ key: 'Pose#0', x: items[0].mid.x, y: items[0].mid.y }];
        return [{ lm: items[0].lm, key: 'Pose#0' }];
    }

    const t0 = items[0];
    const t1 = items[1];

    if (stablePoseShoulderMid.length === 1) {
        const old = stablePoseShoulderMid[0];
        const d0 = Math.hypot(t0.mid.x - old.x, t0.mid.y - old.y);
        const d1 = Math.hypot(t1.mid.x - old.x, t1.mid.y - old.y);
        if (d0 <= d1) {
            stablePoseShoulderMid = [
                { key: old.key, x: t0.mid.x, y: t0.mid.y },
                { key: otherPoseKey(old.key), x: t1.mid.x, y: t1.mid.y }
            ];
            return [
                { lm: t0.lm, key: old.key },
                { lm: t1.lm, key: otherPoseKey(old.key) }
            ];
        }
        stablePoseShoulderMid = [
            { key: otherPoseKey(old.key), x: t0.mid.x, y: t0.mid.y },
            { key: old.key, x: t1.mid.x, y: t1.mid.y }
        ];
        return [
            { lm: t0.lm, key: otherPoseKey(old.key) },
            { lm: t1.lm, key: old.key }
        ];
    }

    if (stablePoseShoulderMid.length !== 2) {
        stablePoseShoulderMid = [
            { key: 'Pose#0', x: t0.mid.x, y: t0.mid.y },
            { key: 'Pose#1', x: t1.mid.x, y: t1.mid.y }
        ];
        return [
            { lm: t0.lm, key: 'Pose#0' },
            { lm: t1.lm, key: 'Pose#1' }
        ];
    }

    const s0 = stablePoseShoulderMid[0];
    const s1 = stablePoseShoulderMid[1];
    const d00 = Math.hypot(t0.mid.x - s0.x, t0.mid.y - s0.y);
    const d10 = Math.hypot(t1.mid.x - s0.x, t1.mid.y - s0.y);
    const d01 = Math.hypot(t0.mid.x - s1.x, t0.mid.y - s1.y);
    const d11 = Math.hypot(t1.mid.x - s1.x, t1.mid.y - s1.y);
    const straight = d00 + d11;
    const crossed = d01 + d10;
    let itemForS0 = 0;
    let itemForS1 = 1;
    if (crossed + 12 < straight) {
        itemForS0 = 1;
        itemForS1 = 0;
    }
    const mS0 = items[itemForS0];
    const mS1 = items[itemForS1];
    s0.x = mS0.mid.x;
    s0.y = mS0.mid.y;
    s1.x = mS1.mid.x;
    s1.y = mS1.mid.y;
    return [
        { lm: mS0.lm, key: s0.key },
        { lm: mS1.lm, key: s1.key }
    ];
}

const HAND_INPUT_INDICES = [15, 16, 17, 18, 19, 20, 21, 22];
const HAND_INPUT_ALPHA = 0.55;
const HAND_INPUT_TELEPORT = 0.2;
const HAND_INPUT_TTL_MS = 600;
const handInputSmoothByKey = new Map();

function smoothHandInputLm(personKey, rawLm, nowMs) {
    let state = handInputSmoothByKey.get(personKey);
    if (!state) {
        state = { lm: {}, lastSeenMs: nowMs };
        handInputSmoothByKey.set(personKey, state);
    }
    state.lastSeenMs = nowMs;
    const out = rawLm.slice();
    for (const i of HAND_INPUT_INDICES) {
        const r = rawLm[i];
        if (!r) continue;
        const prev = state.lm[i];
        if (!prev || Math.hypot(r.x - prev.x, r.y - prev.y) > HAND_INPUT_TELEPORT) {
            state.lm[i] = { x: r.x, y: r.y, z: r.z, visibility: r.visibility };
        } else {
            const a = HAND_INPUT_ALPHA;
            state.lm[i] = {
                x: prev.x * (1 - a) + r.x * a,
                y: prev.y * (1 - a) + r.y * a,
                z: (prev.z ?? 0) * (1 - a) + (r.z ?? 0) * a,
                visibility: r.visibility
            };
        }
        out[i] = state.lm[i];
    }
    return out;
}

function pruneHandInputSmoothState(activeKeys, nowMs) {
    for (const k of [...handInputSmoothByKey.keys()]) {
        if (activeKeys.has(k)) continue;
        const s = handInputSmoothByKey.get(k);
        if (!s || nowMs - s.lastSeenMs > HAND_INPUT_TTL_MS) {
            handInputSmoothByKey.delete(k);
        }
    }
}

function buildKeyedHandsFromPose(orderedPersons, lmByPoseKey) {
    if (!orderedPersons.length) return [];
    const nowMs = performance.now();
    const activeKeys = new Set(orderedPersons.map((p) => p.key));
    pruneHandInputSmoothState(activeKeys, nowMs);
    const out = [];
    for (let p = 0; p < orderedPersons.length; p++) {
        const pkMatch = orderedPersons[p].key.match(/^Pose#(\d+)$/);
        const playerSuffix = pkMatch ? parseInt(pkMatch[1], 10) : p;
        const suffix = orderedPersons.length > 1 ? `#${playerSuffix}` : '';
        const poseLm =
            lmByPoseKey?.get(orderedPersons[p].key) ??
            cachedSmoothedLmByPoseKey.get(orderedPersons[p].key) ??
            orderedPersons[p].lm;
        const stableLm = smoothHandInputLm(orderedPersons[p].key, poseLm, nowMs);
        for (const def of POSE_BODY_HANDS) {
            const lm = buildSyntheticHandFromPose(stableLm, def);
            if (!lm) continue;
            out.push({ key: `${def.key}${suffix}`, landmarks: lm });
        }
    }
    return out;
}

const FACE_LM_INDICES = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
const POSE_HAND_LM_INDICES = new Set([11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]);
const POSE_FACE_ALPHA = 0.28;
const POSE_BODY_ALPHA = 0.4;
/** Кисти/плечи — выше, чтобы перчатки не отставали от линий трекера. */
const POSE_HAND_ALPHA = isAndroidBrowser() ? 0.58 : 0.72;
const POSE_TELEPORT_THRESHOLD = 0.22;
const POSE_STATE_TTL_MS = 600;
const poseSmoothByKey = new Map();

function smoothPoseLandmarks(personKey, rawLm, nowMs) {
    let state = poseSmoothByKey.get(personKey);
    if (!state) {
        state = { lm: {}, lastSeenMs: nowMs };
        poseSmoothByKey.set(personKey, state);
    }
    state.lastSeenMs = nowMs;
    const out = new Array(rawLm.length);
    for (let i = 0; i < rawLm.length; i++) {
        const r = rawLm[i];
        if (!r) {
            out[i] = r;
            continue;
        }
        const prev = state.lm[i];
        const alpha = FACE_LM_INDICES.has(i)
            ? POSE_FACE_ALPHA
            : POSE_HAND_LM_INDICES.has(i)
              ? POSE_HAND_ALPHA
              : POSE_BODY_ALPHA;
        if (!prev || Math.hypot(r.x - prev.x, r.y - prev.y) > POSE_TELEPORT_THRESHOLD) {
            state.lm[i] = { x: r.x, y: r.y, z: r.z, visibility: r.visibility };
        } else {
            state.lm[i] = {
                x: prev.x * (1 - alpha) + r.x * alpha,
                y: prev.y * (1 - alpha) + r.y * alpha,
                z: (prev.z ?? 0) * (1 - alpha) + (r.z ?? 0) * alpha,
                visibility: r.visibility
            };
        }
        out[i] = state.lm[i];
    }
    return out;
}

function prunePoseSmoothState(activeKeys, nowMs) {
    for (const k of [...poseSmoothByKey.keys()]) {
        if (activeKeys.has(k)) continue;
        const s = poseSmoothByKey.get(k);
        if (!s || nowMs - s.lastSeenMs > POSE_STATE_TTL_MS) {
            poseSmoothByKey.delete(k);
        }
    }
}

function cloneLandmarksArray(lm) {
    return lm.map((p) => (p ? { x: p.x, y: p.y, z: p.z, visibility: p.visibility } : p));
}

function lerpLandmarksInto(fromLm, toLm, t, outLm) {
    const n = toLm.length;
    for (let i = 0; i < n; i++) {
        const a = fromLm[i];
        const b = toLm[i];
        if (!b) {
            outLm[i] = b;
            continue;
        }
        if (!a) {
            outLm[i] = { x: b.x, y: b.y, z: b.z, visibility: b.visibility };
            continue;
        }
        outLm[i] = {
            x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t,
            z: (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * t,
            visibility: b.visibility
        };
    }
}

function prunePoseDisplayState(activeKeys) {
    for (const k of [...poseTargetLmByPoseKey.keys()]) {
        if (activeKeys.has(k)) continue;
        poseTargetLmByPoseKey.delete(k);
        posePrevTargetLmByPoseKey.delete(k);
        poseDisplayLmByPoseKey.delete(k);
    }
}

/** Между кадрами камеры плавно интерполируем prev→target по времени (120 Hz экран, ~30 fps камера). */
function updatePoseDisplayLandmarks(activeKeys, nowMs) {
    const interval = Math.max(16, poseFrameIntervalMs);
    let t = (nowMs - poseFrameStartMs) / interval;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    t = t * t * (3 - 2 * t);

    for (const key of activeKeys) {
        const target = poseTargetLmByPoseKey.get(key);
        if (!target) continue;
        const prev = posePrevTargetLmByPoseKey.get(key);
        if (!prev || t <= 0) {
            poseDisplayLmByPoseKey.set(key, cloneLandmarksArray(target));
            continue;
        }
        let out = poseDisplayLmByPoseKey.get(key);
        if (!out || out.length !== target.length) {
            out = cloneLandmarksArray(target);
            poseDisplayLmByPoseKey.set(key, out);
        }
        lerpLandmarksInto(prev, target, t, out);
    }
}

function commitPoseTargetsFromFrame(orderedPersons, nowMs) {
    for (const { lm: rawLm, key: poseKey } of orderedPersons) {
        const smoothed = smoothPoseLandmarks(poseKey, rawLm, nowMs);
        cachedSmoothedLmByPoseKey.set(poseKey, smoothed);
        const prevTarget = poseTargetLmByPoseKey.get(poseKey);
        if (prevTarget) {
            posePrevTargetLmByPoseKey.set(poseKey, cloneLandmarksArray(prevTarget));
        } else {
            posePrevTargetLmByPoseKey.set(poseKey, cloneLandmarksArray(smoothed));
        }
        poseTargetLmByPoseKey.set(poseKey, smoothed);
    }
    poseFrameStartMs = nowMs;
}

function poseKeyFromHandKey(handKey) {
    const m = handKey.match(/#(\d+)$/);
    const idx = m ? parseInt(m[1], 10) : 0;
    return `Pose#${idx}`;
}

function playerIndexFromPoseKey(poseKey) {
    const m = poseKey.match(/^Pose#(\d+)$/);
    return m ? parseInt(m[1], 10) : 0;
}

function playerIndexFromHandKey(handKey) {
    const m = handKey.match(/#(\d+)$/);
    return m ? parseInt(m[1], 10) : 0;
}

function handKeyFromPoseAndGlove(poseKey, gloveKind) {
    const idx = playerIndexFromPoseKey(poseKey);
    const suffix = playerModeCount > 1 ? `#${idx}` : '';
    return gloveKind === 'gloveL' ? `PoseLeft${suffix}` : `PoseRight${suffix}`;
}

function circleHit(ax, ay, ar, bx, by, br) {
    const dx = ax - bx;
    const dy = ay - by;
    const rr = ar + br;
    return dx * dx + dy * dy <= rr * rr;
}

/** Руки, кисти и ноги — не рисуем голубыми сегментами. Остаются лицо, плечи, торс 11–23–24–12, таз 23–24. */
const SKIP_POSE_LIMB_SEGMENTS = new Set([
    '11-13',
    '13-15',
    '12-14',
    '14-16',
    '15-17',
    '15-19',
    '15-21',
    '16-18',
    '16-20',
    '16-22',
    '17-19',
    '18-20',
    '23-25',
    '25-27',
    '27-29',
    '29-31',
    '27-31',
    '24-26',
    '26-28',
    '28-30',
    '30-32',
    '28-32'
]);

function shouldSkipPoseLimbConnection(connection) {
    const a = Math.min(connection.start, connection.end);
    const b = Math.max(connection.start, connection.end);
    return SKIP_POSE_LIMB_SEGMENTS.has(`${a}-${b}`);
}

/** Голубой скелет MediaPipe (лицо/торс) — отключён, чтобы не мешал оверлею. */
const DRAW_POSE_SKELETON_LINES = false;

function makeFourGauntletImages() {
    return [new Image(), new Image(), new Image(), new Image()];
}

const gauntletSpritesByKey = {
    lu: makeFourGauntletImages(),
    ld: makeFourGauntletImages(),
    ru: makeFourGauntletImages(),
    rd: makeFourGauntletImages()
};

const GAUNTLET_URLS_BY_KEY = {
    lu: [
        new URL('./src/assets/img/L up.png', import.meta.url).href,
        new URL('./src/assets/img/L up 1d.png', import.meta.url).href,
        new URL('./src/assets/img/L up 2d.png', import.meta.url).href,
        new URL('./src/assets/img/L up 3d.png', import.meta.url).href
    ],
    ld: [
        new URL('./src/assets/img/L down.png', import.meta.url).href,
        new URL('./src/assets/img/L down 1d.png', import.meta.url).href,
        new URL('./src/assets/img/L down 2d.png', import.meta.url).href,
        new URL('./src/assets/img/L down 3d.png', import.meta.url).href
    ],
    ru: [
        new URL('./src/assets/img/R up.png', import.meta.url).href,
        new URL('./src/assets/img/R up 1d.png', import.meta.url).href,
        new URL('./src/assets/img/R up 2d.png', import.meta.url).href,
        new URL('./src/assets/img/R up 3d.png', import.meta.url).href
    ],
    rd: [
        new URL('./src/assets/img/R down.png', import.meta.url).href,
        new URL('./src/assets/img/R down 1d.png', import.meta.url).href,
        new URL('./src/assets/img/R down 2d.png', import.meta.url).href,
        new URL('./src/assets/img/R down 3d.png', import.meta.url).href
    ]
};

const HELMET_HITS_TO_BREAK = 3;
const VEST_HITS_TO_BREAK = 4;
const GLOVE_HITS_TO_BREAK = 4;
const HELMET_HIT_R_MUL = 0.42;
const VEST_HIT_R_MUL = 0.52;
const GLOVE_HIT_R_MUL = 0.2;

/** По игроку (poseKey): урон жилета и шлема от столкновения с захватчиком. */
const playerArmorByPoseKey = new Map();

function prunePlayerArmorState(activePoseKeys) {
    if (activePoseKeys.size === 0) return;
    for (const k of [...playerArmorByPoseKey.keys()]) {
        if (!activePoseKeys.has(k)) playerArmorByPoseKey.delete(k);
    }
}

function getOrCreatePlayerArmor(poseKey) {
    let a = playerArmorByPoseKey.get(poseKey);
    if (!a) {
        a = { vestHits: 0, helmetHits: 0, gloveLHits: 0, gloveRHits: 0 };
        playerArmorByPoseKey.set(poseKey, a);
    }
    return a;
}

function getHelmetHitDisc(poseKey) {
    const st = helmetPoseOverlayByKey.get(poseKey);
    if (!st) return null;
    const earSpan = Math.hypot(st.rx - st.lx, st.ry - st.ly);
    if (earSpan < 10) return null;
    const cx = (st.lx + st.rx) * 0.5;
    const cy = (st.ly + st.ry) * 0.5 - earSpan * HELMET_CENTER_Y_OFF_FRAC;
    return { x: cx, y: cy, r: earSpan * HELMET_HIT_R_MUL };
}

function getVestHitDisc(lm, getScreenPoint) {
    const ls = lm[11];
    const rs = lm[12];
    const lh = lm[23];
    const rh = lm[24];
    if (!ls || !rs || !lh || !rh) return null;
    const vis = Math.min(ls.visibility ?? 1, rs.visibility ?? 1, lh.visibility ?? 1, rh.visibility ?? 1);
    if (vis < 0.25) return null;
    const p11 = getScreenPoint(ls);
    const p12 = getScreenPoint(rs);
    const shoulderW = Math.hypot(p12.x - p11.x, p12.y - p11.y);
    if (shoulderW < 14) return null;
    const midS = { x: (p11.x + p12.x) * 0.5, y: (p11.y + p12.y) * 0.5 };
    midS.y += shoulderW * VEST_ANCHOR_DOWN_MUL;
    return { x: midS.x, y: midS.y, r: shoulderW * VEST_HIT_R_MUL };
}

function getGloveHitDisc(lm, getScreenPoint, drawHand, shoulderW) {
    const idx = drawHand === 'right' ? 15 : 16;
    const w = lm[idx];
    if (!w) return null;
    if ((w.visibility ?? 1) < 0.22) return null;
    const p = getScreenPoint(w);
    const r = Math.max(26, shoulderW * GLOVE_HIT_R_MUL);
    return { x: p.x, y: p.y, r };
}

function laserBeamHitsDisc(cx, halfW, y0, y1, disc) {
    if (!disc) return false;
    if (disc.y + disc.r < y0 || disc.y - disc.r > y1) return false;
    return Math.abs(disc.x - cx) <= halfW + disc.r;
}

function damagePlayerArmorPiece(poseKey, kind, hitX, hitY, burstColor) {
    if (isPlayerInvincible(poseKey)) return;

    const a = getOrCreatePlayerArmor(poseKey);
    let pieceBroken = false;
    if (kind === 'helmet') {
        if (a.helmetHits < HELMET_HITS_TO_BREAK) {
            a.helmetHits += 1;
            pieceBroken = a.helmetHits >= HELMET_HITS_TO_BREAK;
        }
    } else if (kind === 'vest') {
        if (a.vestHits < VEST_HITS_TO_BREAK) {
            a.vestHits += 1;
            pieceBroken = a.vestHits >= VEST_HITS_TO_BREAK;
        }
    } else if (kind === 'gloveL') {
        if (a.gloveLHits < GLOVE_HITS_TO_BREAK) {
            a.gloveLHits += 1;
            pieceBroken = a.gloveLHits >= GLOVE_HITS_TO_BREAK;
        }
    } else if (kind === 'gloveR') {
        if (a.gloveRHits < GLOVE_HITS_TO_BREAK) {
            a.gloveRHits += 1;
            pieceBroken = a.gloveRHits >= GLOVE_HITS_TO_BREAK;
        }
    }

    playHitSound();
    particles.push(new HitBurst(hitX, hitY, burstColor));
    for (let p = 0; p < 10; p++) particles.push(new Particle(hitX, hitY, burstColor, 'dot'));
    for (let p = 0; p < 8; p++) particles.push(new Particle(hitX, hitY, burstColor, 'spark'));
    if (pieceBroken) {
        for (let p = 0; p < 22; p++) particles.push(new Particle(hitX, hitY, '#e0e0e0', 'dot'));
        for (let p = 0; p < 16; p++) particles.push(new Particle(hitX, hitY, '#ff1744', 'spark'));
        particles.push(new HitBurst(hitX, hitY, '#ffffff'));
        if (kind === 'gloveL' || kind === 'gloveR') {
            resetHandWeapon(handKeyFromPoseAndGlove(poseKey, kind));
        }
    }
}

function tryBossLaserPlayerCollision(boss, orderedPersons, smoothedLmByPoseKey, getScreenPoint, nowMs) {
    if (!boss.hasBossLaser || boss.laserState !== 'firing') return;

    const cx = boss.laserLockX;
    const y0 = boss.laserLockY + boss.s * 0.34;
    const y1 = gameLayout.h;
    const halfW = BOSS_LASER_HALF_WIDTH;

    for (const { key: poseKey } of orderedPersons) {
        const lastHit = boss.laserHitCooldownByPoseKey.get(poseKey) ?? 0;
        if (nowMs - lastHit < 360) continue;

        const lm = smoothedLmByPoseKey.get(poseKey);
        if (!lm) continue;
        const lmLs = lm[11];
        const lmRs = lm[12];
        if (!lmLs || !lmRs) continue;
        const p11 = getScreenPoint(lmLs);
        const p12 = getScreenPoint(lmRs);
        const shoulderW = Math.hypot(p12.x - p11.x, p12.y - p11.y);
        if (shoulderW < 14) continue;

        const armor = getOrCreatePlayerArmor(poseKey);
        const hc = armor.helmetHits < HELMET_HITS_TO_BREAK ? getHelmetHitDisc(poseKey) : null;
        const vc = armor.vestHits < VEST_HITS_TO_BREAK ? getVestHitDisc(lm, getScreenPoint) : null;
        const gLeft =
            armor.gloveLHits < GLOVE_HITS_TO_BREAK ? getGloveHitDisc(lm, getScreenPoint, 'right', shoulderW) : null;
        const gRight =
            armor.gloveRHits < GLOVE_HITS_TO_BREAK ? getGloveHitDisc(lm, getScreenPoint, 'left', shoulderW) : null;

        let hit = null;
        if (hc && laserBeamHitsDisc(cx, halfW, y0, y1, hc)) hit = { poseKey, kind: 'helmet', cx: hc.x, cy: hc.y };
        else if (vc && laserBeamHitsDisc(cx, halfW, y0, y1, vc)) hit = { poseKey, kind: 'vest', cx: vc.x, cy: vc.y };
        else if (gLeft && laserBeamHitsDisc(cx, halfW, y0, y1, gLeft))
            hit = { poseKey, kind: 'gloveL', cx: gLeft.x, cy: gLeft.y };
        else if (gRight && laserBeamHitsDisc(cx, halfW, y0, y1, gRight))
            hit = { poseKey, kind: 'gloveR', cx: gRight.x, cy: gRight.y };

        if (!hit || isPlayerInvincible(hit.poseKey)) continue;
        boss.laserHitCooldownByPoseKey.set(poseKey, nowMs);
        damagePlayerArmorPiece(hit.poseKey, hit.kind, hit.cx, hit.cy, '#ff1744');
    }
}

function tryInvaderPlayerArmorCollision(inv, orderedPersons, smoothedLmByPoseKey, getScreenPoint) {
    if (inv.destroyed || inv.hitR == null) return;
    let best = null;
    for (const { key: poseKey } of orderedPersons) {
        const lm = smoothedLmByPoseKey.get(poseKey);
        if (!lm) continue;
        const lmLs = lm[11];
        const lmRs = lm[12];
        if (!lmLs || !lmRs) continue;
        const p11 = getScreenPoint(lmLs);
        const p12 = getScreenPoint(lmRs);
        const shoulderW = Math.hypot(p12.x - p11.x, p12.y - p11.y);
        if (shoulderW < 14) continue;

        const armor = getOrCreatePlayerArmor(poseKey);
        const hc = armor.helmetHits < HELMET_HITS_TO_BREAK ? getHelmetHitDisc(poseKey) : null;
        const vc = armor.vestHits < VEST_HITS_TO_BREAK ? getVestHitDisc(lm, getScreenPoint) : null;
        const gLeft =
            armor.gloveLHits < GLOVE_HITS_TO_BREAK ? getGloveHitDisc(lm, getScreenPoint, 'right', shoulderW) : null;
        const gRight =
            armor.gloveRHits < GLOVE_HITS_TO_BREAK ? getGloveHitDisc(lm, getScreenPoint, 'left', shoulderW) : null;

        const ix = inv.x;
        const iy = inv.y;
        const ir = inv.hitR;
        if (hc && circleHit(ix, iy, ir, hc.x, hc.y, hc.r)) {
            const d = Math.hypot(ix - hc.x, iy - hc.y);
            if (!best || d < best.dist) best = { poseKey, kind: 'helmet', cx: hc.x, cy: hc.y, dist: d };
        }
        if (vc && circleHit(ix, iy, ir, vc.x, vc.y, vc.r)) {
            const d = Math.hypot(ix - vc.x, iy - vc.y);
            if (!best || d < best.dist) best = { poseKey, kind: 'vest', cx: vc.x, cy: vc.y, dist: d };
        }
        if (gLeft && circleHit(ix, iy, ir, gLeft.x, gLeft.y, gLeft.r)) {
            const d = Math.hypot(ix - gLeft.x, iy - gLeft.y);
            if (!best || d < best.dist) best = { poseKey, kind: 'gloveL', cx: gLeft.x, cy: gLeft.y, dist: d };
        }
        if (gRight && circleHit(ix, iy, ir, gRight.x, gRight.y, gRight.r)) {
            const d = Math.hypot(ix - gRight.x, iy - gRight.y);
            if (!best || d < best.dist) best = { poseKey, kind: 'gloveR', cx: gRight.x, cy: gRight.y, dist: d };
        }
    }
    if (!best) return;
    if (isPlayerInvincible(best.poseKey)) return;

    inv.destroyed = true;
    particles.push(new HitBurst(inv.x, inv.y, inv.color));
    for (let p = 0; p < 14; p++) particles.push(new Particle(inv.x, inv.y, inv.color, 'dot'));
    for (let p = 0; p < 10; p++) particles.push(new Particle(inv.x, inv.y, inv.color, 'spark'));
    damagePlayerArmorPiece(best.poseKey, best.kind, best.cx, best.cy, inv.color);
}

function makeThreeImages() {
    return [new Image(), new Image(), new Image()];
}

const helmetSpritesByYaw = {
    front: makeThreeImages(),
    left: makeThreeImages(),
    right: makeThreeImages()
};

const HELMET_URLS_BY_YAW = {
    front: [
        new URL('./src/assets/img/helmet front.png', import.meta.url).href,
        new URL('./src/assets/img/helmet front 1D.png', import.meta.url).href,
        new URL('./src/assets/img/helmet front 2d.png', import.meta.url).href
    ],
    left: [
        new URL('./src/assets/img/helmet left.png', import.meta.url).href,
        new URL('./src/assets/img/helmet left 1d.png', import.meta.url).href,
        new URL('./src/assets/img/helmet left 2d.png', import.meta.url).href
    ],
    right: [
        new URL('./src/assets/img/helmet right.png', import.meta.url).href,
        new URL('./src/assets/img/helmet right 1d.png', import.meta.url).href,
        new URL('./src/assets/img/helmet right 2d.png', import.meta.url).href
    ]
};

const vestSpriteUrls = [
    new URL('./src/assets/img/vest.png', import.meta.url).href,
    new URL('./src/assets/img/vest 1d.png', import.meta.url).href,
    new URL('./src/assets/img/vest 2d.png', import.meta.url).href,
    new URL('./src/assets/img/vest 3d.png', import.meta.url).href
];
const vestSprites = vestSpriteUrls.map(() => new Image());

function loadSpriteImage(img, src, label) {
    return new Promise((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => {
            console.warn('[Blasters] нет спрайта:', label);
            resolve();
        };
        img.src = src;
    });
}

async function preloadCharacterSprites() {
    const tasks = [
        ...(['lu', 'ld', 'ru', 'rd']).flatMap((gk) =>
            [0, 1, 2, 3].map((lvl) =>
                loadSpriteImage(gauntletSpritesByKey[gk][lvl], GAUNTLET_URLS_BY_KEY[gk][lvl], `gauntlet ${gk} dmg${lvl}`)
            )
        ),
        ...(['front', 'left', 'right']).flatMap((yaw) =>
            [0, 1, 2].map((lvl) =>
                loadSpriteImage(
                    helmetSpritesByYaw[yaw][lvl],
                    HELMET_URLS_BY_YAW[yaw][lvl],
                    `helmet ${yaw} dmg${lvl}`
                )
            )
        ),
        ...vestSpriteUrls.map((url, i) => loadSpriteImage(vestSprites[i], url, `vest dmg${i}`)),
        ...POWERUP_TYPES.map((t) => loadSpriteImage(powerUpSprites[t], POWERUP_SPRITE_URLS[t], `powerup ${t}`)),
        ...(shootTutorialImg
            ? [loadSpriteImage(shootTutorialImg, SHOOT_TUTORIAL_IMG_URL, 'shoot tutorial')]
            : [])
    ];
    await Promise.all(tasks);
}

const GAUNTLET_PIVOT_X_FRAC = 0.5;
const GAUNTLET_PIVOT_Y_FRAC = 0.72;
const GAUNTLET_SCALE_PER_REACH = 0.00295;
const GAUNTLET_SCALE_MIN = 0.12;
const GAUNTLET_SCALE_MAX = 1.92;
/** Эталонная ширина плеч в пикселях — база для дистанции до камеры. */
const GAUNTLET_SHOULDER_REF_PX = 132;
/** У веб-камеры плечи часто «широкие в px» — низкий потолок не раздувает перчатки на близком плане. */
const GAUNTLET_DISTANCE_SCALE_MAX = 1.72;
/** Шлем/жилет почти линейны от лица/плеч; здесь степень усиливала близкий план слишком сильно. */
const GAUNTLET_DISTANCE_EXP = 1.12;
/** Мин. доля эталона при расчёте дистанции (ниже — ещё мельче на дальнике). */
const GAUNTLET_BODY_RATIO_FLOOR = 0.26;
/**
 * Жёсткий потолок scale от ширины плеч (как у шлема/жилета ~ линейно от размера тела).
 * Подобрано так, чтобы близ/средне оставалось как сейчас, далеко — не раздуваться.
 */
const GAUNTLET_SCALE_CAP_PER_SHOULDER_PX = 0.0128;
/** Не даём «reach» из позы раздувать кулак сильнее пропорций тела. */
const GAUNTLET_MAX_REACH_OVER_SHOULDER = 0.44;
/** Угол направления «вперёд» кисти в PNG до поворота: вверх по картинке = -π/2, вниз = +π/2. */
const GAUNTLET_ART_FORWARD_UP = -Math.PI / 2;
const GAUNTLET_ART_FORWARD_DOWN = Math.PI / 2;
/** Доп. поворот (рад.), если спрайт смещён относительно пальца. */
const GAUNTLET_ANGLE_FUDGE = 0;

/** Гистерезис смены спрайта «кулак вверх/вниз», в долях minSide (уменьшает мигание). */
const GAUNTLET_AIM_HYST_MUL = 0.016;
/** Сглаживание ширины плеч для масштаба перчатки (только на новом кадре камеры). */
const GAUNTLET_SHOULDER_SMOOTH_ALPHA = 0.42;
/** Сдвиг якоря от запястья к кулаку вдоль wrist→index (доля reach), чтобы PNG накрывал кисть. */
const GAUNTLET_ANCHOR_ALONG_AIM_MUL_UP = 0.34;
const GAUNTLET_ANCHOR_ALONG_AIM_MUL_DOWN = 0.52;
/** Чуть крупнее спрайт «кулак вниз» — кисть видна ниже запястья в кадре. */
const GAUNTLET_SCALE_MUL_AIMDOWN = 1.04;

const gauntletOverlayByHandKey = new Map();
const gauntletShoulderByPoseKey = new Map();

function pruneGauntletOverlayState(activePoseKeys) {
    for (const k of [...gauntletOverlayByHandKey.keys()]) {
        const sep = k.lastIndexOf('|');
        const poseKey = sep >= 0 ? k.slice(0, sep) : k;
        if (!activePoseKeys.has(poseKey)) gauntletOverlayByHandKey.delete(k);
    }
    for (const pk of [...gauntletShoulderByPoseKey.keys()]) {
        if (!activePoseKeys.has(pk)) gauntletShoulderByPoseKey.delete(pk);
    }
}

function updateGauntletShoulderSmoothed(poseKey, shoulderWRaw) {
    const a = GAUNTLET_SHOULDER_SMOOTH_ALPHA;
    let s = gauntletShoulderByPoseKey.get(poseKey);
    if (!s) {
        s = { sw: shoulderWRaw };
        gauntletShoulderByPoseKey.set(poseKey, s);
        return shoulderWRaw;
    }
    s.sw = s.sw * (1 - a) + shoulderWRaw * a;
    return s.sw;
}

const HELMET_PIVOT_X_FRAC = 0.5;
const HELMET_PIVOT_Y_FRAC = 0.52;
/** Меньше — шлем ниже к лицу (от позиции между ушами вниз). */
const HELMET_CENTER_Y_OFF_FRAC = 0.08;
const HELMET_SCALE_MUL = 2.68;
const HELMET_SCALE_MIN = 0.22;
const HELMET_SCALE_MAX = 4.4;
/** Сглаживание положения ушей/носа на экране (меньше — плавнее наклон шлема). */
const HELMET_EAR_NOSE_SMOOTH_ALPHA = isAndroidBrowser() ? 0.38 : 0.14;
/** Сглаживание метрики поворота головы влево/вправо (front / left / right PNG). */
const HELMET_YAW_ASYM_SMOOTH_ALPHA = 0.11;
/** |asym| выше — переключаемся с фронта на боковой спрайт. */
const HELMET_YAW_ENTER_THRESH = 0.165;
/** |asym| ниже — возвращаемся на фронт с бокового (гистерезис, меньше дребезга). */
const HELMET_YAW_EXIT_TO_FRONT_THRESH = 0.072;
const HELMET_ANGLE_FUDGE = 0;
/** PNG шлема ориентирован «вниз головой» относительно линии ушей — доп. поворот на 180°. */
const HELMET_SPRITE_ROTATION_FIX = Math.PI;

/** Состояние шлема на игрока: сглаженные точки + устойчивый выбор вида. */
const helmetPoseOverlayByKey = new Map();

function pruneHelmetPoseOverlayState(activePoseKeys) {
    for (const k of [...helmetPoseOverlayByKey.keys()]) {
        if (!activePoseKeys.has(k)) helmetPoseOverlayByKey.delete(k);
    }
}

function tickHelmetOverlayFromLm(poseKey, lm, getScreenPoint) {
    const nose = lm[0];
    const earL = lm[7];
    const earR = lm[8];
    if (!nose || !earL || !earR) return false;
    const vis = Math.min(nose.visibility ?? 1, earL.visibility ?? 1, earR.visibility ?? 1);
    if (vis < 0.28) return false;

    const L = getScreenPoint(earL);
    const R = getScreenPoint(earR);
    const n = getScreenPoint(nose);
    const aPos = HELMET_EAR_NOSE_SMOOTH_ALPHA;
    const aYaw = HELMET_YAW_ASYM_SMOOTH_ALPHA;
    let st = helmetPoseOverlayByKey.get(poseKey);
    if (!st) {
        st = {
            lx: L.x,
            ly: L.y,
            rx: R.x,
            ry: R.y,
            nx: n.x,
            ny: n.y,
            asymF: 0,
            yawKey: 'front'
        };
        helmetPoseOverlayByKey.set(poseKey, st);
    } else {
        st.lx = st.lx * (1 - aPos) + L.x * aPos;
        st.ly = st.ly * (1 - aPos) + L.y * aPos;
        st.rx = st.rx * (1 - aPos) + R.x * aPos;
        st.ry = st.ry * (1 - aPos) + R.y * aPos;
        st.nx = st.nx * (1 - aPos) + n.x * aPos;
        st.ny = st.ny * (1 - aPos) + n.y * aPos;
    }

    const earSpan = Math.hypot(st.rx - st.lx, st.ry - st.ly);
    if (earSpan < 10) return false;

    const leftD = Math.hypot(st.nx - st.lx, st.ny - st.ly);
    const rightD = Math.hypot(st.nx - st.rx, st.ny - st.ry);
    const asym = (rightD - leftD) / earSpan;
    st.asymF = st.asymF * (1 - aYaw) + asym * aYaw;
    const a = st.asymF;

    let cur = st.yawKey;
    if (cur === 'front') {
        if (a > HELMET_YAW_ENTER_THRESH) cur = 'right';
        else if (a < -HELMET_YAW_ENTER_THRESH) cur = 'left';
    } else if (cur === 'right') {
        if (Math.abs(a) < HELMET_YAW_EXIT_TO_FRONT_THRESH) cur = 'front';
        else if (a < -HELMET_YAW_ENTER_THRESH) cur = 'left';
    } else {
        if (Math.abs(a) < HELMET_YAW_EXIT_TO_FRONT_THRESH) cur = 'front';
        else if (a > HELMET_YAW_ENTER_THRESH) cur = 'right';
    }
    st.yawKey = cur;
    return true;
}

function drawHelmetSprite(ctx, _lm, _getScreenPoint, poseKey) {
    const st = helmetPoseOverlayByKey.get(poseKey);
    if (!st) return;
    const earSpan = Math.hypot(st.rx - st.lx, st.ry - st.ly);
    if (earSpan < 10) return;
    const yawKey = st.yawKey;
    const arm = playerArmorByPoseKey.get(poseKey);
    const hHits = arm?.helmetHits ?? 0;
    if (hHits >= HELMET_HITS_TO_BREAK) return;

    const img = helmetSpritesByYaw[yawKey][hHits];
    if (!img.complete || img.naturalWidth === 0) return;

    const ang = Math.atan2(st.ry - st.ly, st.rx - st.lx);
    const cx = (st.lx + st.rx) * 0.5;
    const cy = (st.ly + st.ry) * 0.5 - earSpan * HELMET_CENTER_Y_OFF_FRAC;

    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const pivotX = iw * HELMET_PIVOT_X_FRAC;
    const pivotY = ih * HELMET_PIVOT_Y_FRAC;
    let scale = (earSpan * HELMET_SCALE_MUL) / iw;
    scale = Math.max(HELMET_SCALE_MIN, Math.min(HELMET_SCALE_MAX, scale));

    ctx.save();
    const glow = getInvincibleGlow(poseKey);
    if (glow) {
        ctx.shadowColor = glow.color;
        ctx.shadowBlur = glow.blur;
    }
    ctx.translate(cx, cy);
    ctx.rotate(ang + HELMET_ANGLE_FUDGE + HELMET_SPRITE_ROTATION_FIX);
    ctx.scale(scale, scale);
    ctx.translate(-pivotX, -pivotY);
    ctx.drawImage(img, 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
}

const VEST_PIVOT_X_FRAC = 0.5;
const VEST_PIVOT_Y_FRAC = 0.22;
/** Больше значение — мельче жилет на экране (доля ширины плеч в PNG). */
const VEST_ART_SHOULDER_WIDTH_FRAC = 0.5;
const VEST_SCALE_MIN = 0.15;
const VEST_SCALE_MAX = 2.85;
const VEST_ANGLE_FUDGE = 0;
/** Жилет в PNG перевёрнут относительно плеч — доп. 180° в плоскости тела. */
const VEST_SPRITE_ROTATION_FIX = Math.PI;
const VEST_GLOBAL_SCALE = 0.96;
/** Сдвиг якоря жилета вниз по экрану, доля ширины плеч. */
const VEST_ANCHOR_DOWN_MUL = 0.16;

function drawVestSprite(ctx, lm, getScreenPoint, poseKey) {
    const arm = playerArmorByPoseKey.get(poseKey);
    const vHits = arm?.vestHits ?? 0;
    if (vHits >= VEST_HITS_TO_BREAK) return;

    const ls = lm[11];
    const rs = lm[12];
    const lh = lm[23];
    const rh = lm[24];
    if (!ls || !rs || !lh || !rh) return;
    const vis = Math.min(ls.visibility ?? 1, rs.visibility ?? 1, lh.visibility ?? 1, rh.visibility ?? 1);
    if (vis < 0.25) return;

    const p11 = getScreenPoint(ls);
    const p12 = getScreenPoint(rs);
    const shoulderW = Math.hypot(p12.x - p11.x, p12.y - p11.y);
    if (shoulderW < 14) return;

    const ang = Math.atan2(p12.y - p11.y, p12.x - p11.x);
    const midS = { x: (p11.x + p12.x) * 0.5, y: (p11.y + p12.y) * 0.5 };
    midS.y += shoulderW * VEST_ANCHOR_DOWN_MUL;

    const img = vestSprites[vHits];
    if (!img.complete || img.naturalWidth === 0) return;

    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const pivotX = iw * VEST_PIVOT_X_FRAC;
    const pivotY = ih * VEST_PIVOT_Y_FRAC;
    let scale = (shoulderW / (iw * VEST_ART_SHOULDER_WIDTH_FRAC)) * VEST_GLOBAL_SCALE;
    scale = Math.max(VEST_SCALE_MIN, Math.min(VEST_SCALE_MAX, scale));

    ctx.save();
    const glow = getInvincibleGlow(poseKey);
    if (glow) {
        ctx.shadowColor = glow.color;
        ctx.shadowBlur = glow.blur;
    }
    ctx.translate(midS.x, midS.y);
    ctx.rotate(ang + VEST_ANGLE_FUDGE + VEST_SPRITE_ROTATION_FIX);
    ctx.scale(scale, scale);
    ctx.translate(-pivotX, -pivotY);
    ctx.drawImage(img, 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
}

/** Только гистерезис up/down; позиция берётся из landmarks без доп. EMA (иначе сильно отстаёт от линий). */
function drawGauntletSprite(ctx, wristLm, indexLm, getScreenPoint, poseKey, hand, shoulderW) {
    if (!wristLm || !indexLm) return;
    if ((wristLm.visibility ?? 1) < POSE_HAND_MIN_VISIBILITY) return;

    const W = getScreenPoint(wristLm);
    const I = getScreenPoint(indexLm);
    const reach = Math.hypot(I.x - W.x, I.y - W.y);
    if (reach < 8) return;

    const hystPx = Math.max(10, gameLayout.minSide * GAUNTLET_AIM_HYST_MUL);
    const mapKey = `${poseKey}|${hand}`;
    let st = gauntletOverlayByHandKey.get(mapKey);
    const dy = I.y - W.y;
    if (!st) {
        st = { aimUp: dy <= 0 };
        gauntletOverlayByHandKey.set(mapKey, st);
    } else if (st.aimUp) {
        if (dy > hystPx) st.aimUp = false;
    } else if (dy < -hystPx) {
        st.aimUp = true;
    }
    const aimUp = st.aimUp;

    const key =
        hand === 'left' ? (aimUp ? 'lu' : 'ld') : aimUp ? 'ru' : 'rd';

    const arm = getOrCreatePlayerArmor(poseKey);
    const gh = hand === 'right' ? arm.gloveLHits : arm.gloveRHits;
    if (gh >= GLOVE_HITS_TO_BREAK) return;

    const img = gauntletSpritesByKey[key][gh];
    if (!img.complete || img.naturalWidth === 0) return;

    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const pivotX = iw * GAUNTLET_PIVOT_X_FRAC;
    const pivotY = ih * GAUNTLET_PIVOT_Y_FRAC;
    const sw = Math.max(40, shoulderW);
    const bodyRatio = Math.max(GAUNTLET_BODY_RATIO_FLOOR, sw / GAUNTLET_SHOULDER_REF_PX);
    const bodyRatioCap = Math.min(GAUNTLET_DISTANCE_SCALE_MAX, bodyRatio);
    const distanceMul = Math.pow(bodyRatioCap, GAUNTLET_DISTANCE_EXP);
    const reachEff = Math.min(reach, sw * GAUNTLET_MAX_REACH_OVER_SHOULDER);
    let scale = reachEff * GAUNTLET_SCALE_PER_REACH * distanceMul;
    if (!aimUp) scale *= GAUNTLET_SCALE_MUL_AIMDOWN;
    scale = Math.min(scale, sw * GAUNTLET_SCALE_CAP_PER_SHOULDER_PX);
    scale = Math.max(GAUNTLET_SCALE_MIN, Math.min(GAUNTLET_SCALE_MAX, scale));

    const angAim = Math.atan2(I.y - W.y, I.x - W.x);
    const angImgForward = aimUp ? GAUNTLET_ART_FORWARD_UP : GAUNTLET_ART_FORWARD_DOWN;
    const rotation = angAim - angImgForward + GAUNTLET_ANGLE_FUDGE;

    const alongMul = aimUp ? GAUNTLET_ANCHOR_ALONG_AIM_MUL_UP : GAUNTLET_ANCHOR_ALONG_AIM_MUL_DOWN;
    const ax = W.x + (I.x - W.x) * alongMul;
    const ay = W.y + (I.y - W.y) * alongMul;

    ctx.save();
    const glow = getInvincibleGlow(poseKey);
    if (glow) {
        ctx.shadowColor = glow.color;
        ctx.shadowBlur = glow.blur;
    }
    ctx.translate(ax, ay);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);
    ctx.translate(-pivotX, -pivotY);
    ctx.drawImage(img, 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
}

function drawInvincibleBar(ctx, x, y, w, h, frac, pulse) {
    const radius = Math.min(h * 0.45, w * 0.5);
    const x0 = x - w * 0.5;
    const y0 = y - h * 0.5;

    ctx.beginPath();
    ctx.moveTo(x0 + radius, y0);
    ctx.lineTo(x0 + w - radius, y0);
    ctx.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + radius);
    ctx.lineTo(x0 + w, y0 + h - radius);
    ctx.quadraticCurveTo(x0 + w, y0 + h, x0 + w - radius, y0 + h);
    ctx.lineTo(x0 + radius, y0 + h);
    ctx.quadraticCurveTo(x0, y0 + h, x0, y0 + h - radius);
    ctx.lineTo(x0, y0 + radius);
    ctx.quadraticCurveTo(x0, y0, x0 + radius, y0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(8, 5, 16, 0.78)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 215, 64, 0.75)';
    ctx.lineWidth = Math.max(1.5, h * 0.14);
    ctx.stroke();

    const fillW = Math.max(h, w * frac);
    if (fillW <= h) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, fillW, h);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(x0 + radius, y0);
    ctx.lineTo(x0 + w - radius, y0);
    ctx.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + radius);
    ctx.lineTo(x0 + w, y0 + h - radius);
    ctx.quadraticCurveTo(x0 + w, y0 + h, x0 + w - radius, y0 + h);
    ctx.lineTo(x0 + radius, y0 + h);
    ctx.quadraticCurveTo(x0, y0 + h, x0, y0 + h - radius);
    ctx.lineTo(x0, y0 + radius);
    ctx.quadraticCurveTo(x0, y0, x0 + radius, y0);
    ctx.closePath();
    const grad = ctx.createLinearGradient(x0, y0, x0 + w, y0);
    grad.addColorStop(0, '#fff59d');
    grad.addColorStop(0.55, '#ffd740');
    grad.addColorStop(1, '#ffb300');
    ctx.fillStyle = grad;
    ctx.shadowColor = '#ffd740';
    ctx.shadowBlur = 6 + pulse * 8;
    ctx.fill();
    ctx.restore();
}

function drawInvincibleTimer(ctx, poseKey, lm, getScreenPoint) {
    const b = playerBuffByPoseKey.get(poseKey);
    if (!b || performance.now() >= b.invincibleUntil) return;

    const remain = b.invincibleUntil - performance.now();
    const frac = Math.max(0, Math.min(1, remain / POWERUP_DURATION_MS));
    const st = helmetPoseOverlayByKey.get(poseKey);
    let cx;
    let y;
    if (st) {
        const earSpan = Math.hypot(st.rx - st.lx, st.ry - st.ly);
        if (earSpan < 10) return;
        cx = (st.lx + st.rx) * 0.5;
        y = (st.ly + st.ry) * 0.5 - earSpan * 1.2;
    } else {
        const nose = lm[0];
        if (!nose) return;
        const p = getScreenPoint(nose);
        cx = p.x;
        y = p.y - gameLayout.minSide * 0.1;
    }

    const pulse = (Math.sin(performance.now() * 0.012) + 1) * 0.5;
    const barW = gameLayout.minSide * 0.15;
    const barH = Math.max(6, gameLayout.minSide * 0.016);

    ctx.save();
    ctx.shadowColor = '#ffd740';
    ctx.shadowBlur = 8 + pulse * 6;
    drawInvincibleBar(ctx, cx, y, barW, barH, frac, pulse);
    ctx.restore();
}

function isGloveBroken(poseKey, handKey) {
    const arm = playerArmorByPoseKey.get(poseKey);
    if (!arm) return true;
    return handKey.startsWith('PoseLeft')
        ? arm.gloveLHits >= GLOVE_HITS_TO_BREAK
        : arm.gloveRHits >= GLOVE_HITS_TO_BREAK;
}

function computeGauntletPickupDisc(wristLm, indexLm, getScreenPoint, poseKey, hand, shoulderW, gloveHits) {
    if (gloveHits >= GLOVE_HITS_TO_BREAK) return null;
    if (!wristLm || !indexLm) return null;
    if ((wristLm.visibility ?? 1) < POSE_HAND_MIN_VISIBILITY) return null;

    const W = getScreenPoint(wristLm);
    const I = getScreenPoint(indexLm);
    const reach = Math.hypot(I.x - W.x, I.y - W.y);
    if (reach < 8) return null;

    const hystPx = Math.max(10, gameLayout.minSide * GAUNTLET_AIM_HYST_MUL);
    const mapKey = `${poseKey}|${hand}`;
    let st = gauntletOverlayByHandKey.get(mapKey);
    const dy = I.y - W.y;
    if (!st) {
        st = { aimUp: dy <= 0 };
    } else if (st.aimUp) {
        if (dy > hystPx) st.aimUp = false;
    } else if (dy < -hystPx) {
        st.aimUp = true;
    }
    const aimUp = st.aimUp;
    const gKey = hand === 'left' ? (aimUp ? 'lu' : 'ld') : aimUp ? 'ru' : 'rd';
    const img = gauntletSpritesByKey[gKey][gloveHits];
    if (!img?.complete || !img.naturalWidth) return null;

    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const sw = Math.max(40, shoulderW);
    const bodyRatio = Math.max(GAUNTLET_BODY_RATIO_FLOOR, sw / GAUNTLET_SHOULDER_REF_PX);
    const bodyRatioCap = Math.min(GAUNTLET_DISTANCE_SCALE_MAX, bodyRatio);
    const distanceMul = Math.pow(bodyRatioCap, GAUNTLET_DISTANCE_EXP);
    const reachEff = Math.min(reach, sw * GAUNTLET_MAX_REACH_OVER_SHOULDER);
    let scale = reachEff * GAUNTLET_SCALE_PER_REACH * distanceMul;
    if (!aimUp) scale *= GAUNTLET_SCALE_MUL_AIMDOWN;
    scale = Math.min(scale, sw * GAUNTLET_SCALE_CAP_PER_SHOULDER_PX);
    scale = Math.max(GAUNTLET_SCALE_MIN, Math.min(GAUNTLET_SCALE_MAX, scale));

    const alongMul = aimUp ? GAUNTLET_ANCHOR_ALONG_AIM_MUL_UP : GAUNTLET_ANCHOR_ALONG_AIM_MUL_DOWN;
    const ax = W.x + (I.x - W.x) * alongMul;
    const ay = W.y + (I.y - W.y) * alongMul;
    const r = Math.max(iw, ih) * scale * 0.5;
    return { x: ax, y: ay, r };
}

function getGlovePickupDiscs(poseKey, lm, getScreenPoint) {
    const discs = [];
    const armor = getOrCreatePlayerArmor(poseKey);
    const ls = lm[11];
    const rs = lm[12];
    if (!ls || !rs) return discs;

    const p11 = getScreenPoint(ls);
    const p12 = getScreenPoint(rs);
    const shoulderW = Math.hypot(p12.x - p11.x, p12.y - p11.y);
    if (shoulderW < 14) return discs;

    const shoulderSm = Math.max(40, shoulderW);
    const gLeft = computeGauntletPickupDisc(
        lm[15],
        lm[19],
        getScreenPoint,
        poseKey,
        'right',
        shoulderSm,
        armor.gloveLHits
    );
    const gRight = computeGauntletPickupDisc(
        lm[16],
        lm[20],
        getScreenPoint,
        poseKey,
        'left',
        shoulderSm,
        armor.gloveRHits
    );
    if (gLeft) discs.push({ ...gLeft, handKey: handKeyFromPoseAndGlove(poseKey, 'gloveL') });
    if (gRight) discs.push({ ...gRight, handKey: handKeyFromPoseAndGlove(poseKey, 'gloveR') });
    return discs;
}

function collectPowerUps(orderedPersons, displayLmByPoseKey, getScreenPoint) {
    for (let i = powerUpDrops.length - 1; i >= 0; i--) {
        const drop = powerUpDrops[i];
        if (drop.dead) {
            powerUpDrops.splice(i, 1);
            continue;
        }
        let taken = false;
        for (const { key: poseKey } of orderedPersons) {
            const lm = displayLmByPoseKey.get(poseKey);
            if (!lm) continue;
            const discs = getGlovePickupDiscs(poseKey, lm, getScreenPoint);
            for (const disc of discs) {
                if (!circleHit(drop.x, drop.y, drop.r, disc.x, disc.y, disc.r)) continue;
                applyPowerUp(drop.type, poseKey, disc.handKey);
                particles.push(new HitBurst(drop.x, drop.y, drop.color));
                for (let p = 0; p < 10; p++) particles.push(new Particle(drop.x, drop.y, drop.color, 'spark'));
                drop.dead = true;
                taken = true;
                playHitSound();
                break;
            }
            if (taken) break;
        }
        if (taken) powerUpDrops.splice(i, 1);
    }
}

let currentPoseResults = null;

let perfFrameSumMs = 0;
let perfFrameCount = 0;
let perfLastLogMs = 0;

function gameLoop(nowTime) {
    if (!isPlaying) return;

    if (!nowTime) nowTime = performance.now();
    let dt = (nowTime - lastFrameTime) / (1000 / 60);
    if (dt > 3) dt = 3;
    if (dt < 0) dt = 0;
    lastFrameTime = nowTime;

    const startTimeMs = performance.now();
    let gotNewVideoPoseFrame = false;

    if (lastVideoTime !== video.currentTime) {
        if (prevVideoTimeForInterval >= 0 && video.currentTime > prevVideoTimeForInterval) {
            poseFrameIntervalMs = Math.max(
                20,
                Math.min(50, (video.currentTime - prevVideoTimeForInterval) * 1000)
            );
        }
        prevVideoTimeForInterval = video.currentTime;
        lastVideoTime = video.currentTime;
        gotNewVideoPoseFrame = true;
        let frameTsMs = Number.isFinite(video.currentTime) ? video.currentTime * 1000 : startTimeMs;
        if (frameTsMs <= poseDetectTsMs) frameTsMs = poseDetectTsMs + 1;
        poseDetectTsMs = frameTsMs;
        try {
            const pRes = poseLandmarker.detectForVideo(video, frameTsMs);
            if (pRes) currentPoseResults = pRes;
        } catch (err) {
            console.warn('PoseLandmarker detectForVideo:', err);
        }
    }

    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    const vRatio = canvasElement.width / video.videoWidth;
    const hRatio = canvasElement.height / video.videoHeight;
    const ratio = Math.max(vRatio, hRatio);
    const centerShift_x = (canvasElement.width - video.videoWidth * ratio) / 2;
    const centerShift_y = (canvasElement.height - video.videoHeight * ratio) / 2;

    canvasCtx.drawImage(
        video,
        0,
        0,
        video.videoWidth,
        video.videoHeight,
        centerShift_x,
        centerShift_y,
        video.videoWidth * ratio,
        video.videoHeight * ratio
    );

    canvasCtx.fillStyle = 'rgba(0,0,0,0.58)';
    canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);

    function getScreenPoint(landmark) {
        return {
            x: landmark.x * video.videoWidth * ratio + centerShift_x,
            y: landmark.y * video.videoHeight * ratio + centerShift_y
        };
    }

    const displayLmByPoseKey = poseDisplayLmByPoseKey;
    let orderedPersons = [];

    if (currentPoseResults?.landmarks) {
        orderedPersons = bindStablePoseKeys(getOrderedPersons(currentPoseResults), getScreenPoint);
        const nowPoseMs = performance.now();
        const activePoseKeys = new Set(orderedPersons.map((p) => p.key));

        if (gotNewVideoPoseFrame) {
            prunePoseSmoothState(activePoseKeys, nowPoseMs);
            prunePoseDisplayState(activePoseKeys);
            pruneHelmetPoseOverlayState(activePoseKeys);
            pruneGauntletOverlayState(activePoseKeys);
            prunePlayerArmorState(activePoseKeys);
            commitPoseTargetsFromFrame(orderedPersons, nowPoseMs);
        }

        updatePoseDisplayLandmarks(activePoseKeys, nowPoseMs);

        for (const { key: poseKey } of orderedPersons) {
            const landmarks = displayLmByPoseKey.get(poseKey);
            if (landmarks) tickHelmetOverlayFromLm(poseKey, landmarks, getScreenPoint);
        }

        for (const { key: poseKey } of orderedPersons) {
            const landmarks = displayLmByPoseKey.get(poseKey);
            if (!landmarks) continue;
            const p11g = getScreenPoint(landmarks[11]);
            const p12g = getScreenPoint(landmarks[12]);
            const shoulderWGauntlet = Math.hypot(p12g.x - p11g.x, p12g.y - p11g.y);
            const shoulderSm = Math.max(40, shoulderWGauntlet);
            if (DRAW_POSE_SKELETON_LINES) {
                canvasCtx.strokeStyle = 'rgba(0, 243, 255, 0.78)';
                canvasCtx.lineWidth = 5;
                canvasCtx.shadowColor = 'rgba(0, 243, 255, 0.9)';
                canvasCtx.shadowBlur = 12;

                for (const connection of POSE_CONNECTIONS) {
                    if (shouldSkipPoseLimbConnection(connection)) continue;
                    const a = getScreenPoint(landmarks[connection.start]);
                    const b = getScreenPoint(landmarks[connection.end]);
                    canvasCtx.beginPath();
                    canvasCtx.moveTo(a.x, a.y);
                    canvasCtx.lineTo(b.x, b.y);
                    canvasCtx.stroke();
                }
                canvasCtx.shadowBlur = 0;
            }

            drawVestSprite(canvasCtx, landmarks, getScreenPoint, poseKey);
            drawHelmetSprite(canvasCtx, landmarks, getScreenPoint, poseKey);
            drawGauntletSprite(
                canvasCtx,
                landmarks[15],
                landmarks[19],
                getScreenPoint,
                poseKey,
                'right',
                shoulderSm
            );
            drawGauntletSprite(
                canvasCtx,
                landmarks[16],
                landmarks[20],
                getScreenPoint,
                poseKey,
                'left',
                shoulderSm
            );
            drawInvincibleTimer(canvasCtx, poseKey, landmarks, getScreenPoint);
        }
    }

    if (playersDisplay) {
        const n = orderedPersons.length;
        if (playerModeCount === 1) {
            playersDisplay.textContent = n >= 1 ? t('players1ok') : t('players1wait');
        } else {
            playersDisplay.textContent =
                n >= 2 ? t('players2ok') : n === 1 ? t('players2wait1') : t('players2wait0');
        }
    }

    const keyedHands = buildKeyedHandsFromPose(orderedPersons, displayLmByPoseKey);
    const fireNow = performance.now();

    if (!victoryTransitionActive && !shootTutorialActive) {
        for (const { key, landmarks } of keyedHands) {
        const wrist = getScreenPoint(landmarks[0]);
        const tip = getScreenPoint(landmarks[8]);
        let dx = tip.x - wrist.x;
        let dy = tip.y - wrist.y;
        const span = Math.hypot(dx, dy);
        if (span < GAME_CFG.aimMinSpanPx) continue;
        dx /= span;
        dy /= span;

        if (dy > -GAME_CFG.aimUpMinAbsDy) continue;

        const pk = poseKeyFromHandKey(key);
        const armFire = playerArmorByPoseKey.get(pk);
        const gHits = key.startsWith('PoseLeft') ? (armFire?.gloveLHits ?? 0) : (armFire?.gloveRHits ?? 0);
        if (gHits >= GLOVE_HITS_TO_BREAK) continue;

        const last = lastFireByHandKey.get(key) ?? 0;
        if (fireNow - last < GAME_CFG.fireCooldownMs) continue;

        const pid = playerIndexFromHandKey(key);
        const playerColor = pid === 0 ? '#00f3ff' : '#ff00ea';
        const color = shotColorForHand(key, playerColor);

        const ox = wrist.x + dx * 44;
        const oy = wrist.y + dy * 44;
        fireFromHand(key, ox, oy, dx, dy, color);
        lastFireByHandKey.set(key, fireNow);
        playShootSound();

        canvasCtx.save();
        canvasCtx.strokeStyle = color;
        canvasCtx.globalAlpha = 0.38;
        canvasCtx.lineWidth = 3;
        canvasCtx.beginPath();
        canvasCtx.moveTo(wrist.x, wrist.y);
        canvasCtx.lineTo(wrist.x + dx * 130, wrist.y + dy * 130);
        canvasCtx.stroke();
        canvasCtx.restore();
        }
    }

    tickPlayerBuffs(orderedPersons);

    const nowPerf = performance.now();
    if (!victoryTransitionActive && !shootTutorialActive) {
    for (let i = powerUpDrops.length - 1; i >= 0; i--) {
        const drop = powerUpDrops[i];
        drop.update(dt);
        drop.draw(canvasCtx);
        if (drop.dead) powerUpDrops.splice(i, 1);
    }
    collectPowerUps(orderedPersons, displayLmByPoseKey, getScreenPoint);

    updateInvaderFormation();
    tryInvaderDive(nowPerf);

    for (let i = targets.length - 1; i >= 0; i--) {
        const t = targets[i];
        if (t.isBoss) t.update(dt, nowPerf);
        else t.update(dt);
        if (!t.destroyed && orderedPersons.length) {
            if (t.hasBossLaser && t.laserState === 'firing') {
                tryBossLaserPlayerCollision(t, orderedPersons, displayLmByPoseKey, getScreenPoint, nowPerf);
            }
            if (!t.isBoss) {
                tryInvaderPlayerArmorCollision(t, orderedPersons, displayLmByPoseKey, getScreenPoint);
            }
        }
        t.draw(canvasCtx);
        if (!t.destroyed && t.y > gameLayout.h + 120) {
            targets.splice(i, 1);
        } else if (t.destroyed) {
            targets.splice(i, 1);
        }
    }

    checkWaveProgress();

    for (let i = projectiles.length - 1; i >= 0; i--) {
        const pr = projectiles[i];
        pr.update(dt);

        if (!pr.dead) {
            for (const t of targets) {
                if (t.destroyed) continue;
                if (circleHit(pr.x, pr.y, pr.r, t.x, t.y, t.hitR)) {
                    pr.dead = true;
                    const dmg = pr.damage ?? 1;
                    t.armor -= dmg;
                    t.hitFlash = 1;
                    if (t.armor <= 0) {
                        t.destroyed = true;
                        trySpawnPowerUpDrop(t.x, t.y, t);
                        score += t.scoreValue ?? GAME_CFG.scoreTarget;
                        scoreDisplay.innerText = formatScore(score);
                        playHitSound();
                        particles.push(new HitBurst(t.x, t.y, t.color));
                        const burstN = t.isBoss ? 42 : 18;
                        const sparkN = t.isBoss ? 28 : 12;
                        for (let p = 0; p < burstN; p++) particles.push(new Particle(t.x, t.y, t.color, 'dot'));
                        for (let p = 0; p < sparkN; p++) particles.push(new Particle(t.x, t.y, t.color, 'spark'));
                        if (t.isBoss) {
                            particles.push(new HitBurst(t.x, t.y, '#ffeb3b'));
                            for (let p = 0; p < 24; p++) particles.push(new Particle(t.x, t.y, '#ffffff', 'spark'));
                        }
                    } else {
                        if (t.isBoss) {
                            const stage = bossDamageStage(t.armor, t.armorMax, bossStageCount(t));
                            if (t._lastDamageStage !== undefined && stage > t._lastDamageStage) {
                                t.hitFlash = 1.15;
                                particles.push(new HitBurst(t.x, t.y, '#ffeb3b'));
                            }
                            t._lastDamageStage = stage;
                        }
                        for (let p = 0; p < 4; p++) particles.push(new Particle(t.x, t.y, t.color, 'spark'));
                    }
                    break;
                }
            }
        }

        if (!pr.dead) pr.draw(canvasCtx);
        if (pr.dead) projectiles.splice(i, 1);
    }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update(dt);
        p.draw(canvasCtx);
        if (p.life <= 0) particles.splice(i, 1);
    }

    if (DEBUG_FRAME_PERF) {
        const elapsed = performance.now() - startTimeMs;
        perfFrameSumMs += elapsed;
        perfFrameCount += 1;
        const t = performance.now();
        if (t - perfLastLogMs >= 2500) {
            perfLastLogMs = t;
            const avg = perfFrameSumMs / perfFrameCount;
            console.info(`[perf] среднее за кадр ${avg.toFixed(1)} ms (n=${perfFrameCount})`);
            perfFrameSumMs = 0;
            perfFrameCount = 0;
        }
    }

    if (isPlaying && orderedPersons.length > 0) {
        // 1 игрок: game over, когда у него сломаны обе перчатки.
        // 2 игрока: game over, когда обе перчатки сломаны у всех игроков в кадре.
        if (orderedPersons.every((p) => playerGlovesDestroyed(p.key))) {
            triggerGameOver();
        }
    }

    if (isPlaying) requestAnimationFrame(gameLoop);
}

function showStartError(e) {
    console.error(e);
    mainMenu?.classList.add('is-hidden');
    hudGame?.classList.add('is-hidden');
    canvasElement.style.visibility = 'hidden';
    const name = e?.name || '';
    const msg = e?.message || String(e);
    let hint = t('errHintDefault');
    if (name === 'NotAllowedError' || /Permission/i.test(msg)) {
        hint = t('errHintPermission');
    } else if (name === 'NotFoundError' || /DevicesNotFound/i.test(msg)) {
        hint = t('errHintNotFound');
    } else if (
        name === 'AbortError' ||
        /Timeout starting video source|metadata timeout/i.test(msg)
    ) {
        hint = t('errHintAbort');
    }
    loadingElement.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'max-width:28rem;margin:0 auto;text-align:left;line-height:1.45;font-size:0.95rem;';
    const titleEl = document.createElement('p');
    titleEl.textContent = t('errTitle');
    titleEl.style.fontWeight = '700';
    titleEl.style.marginBottom = '0.5rem';
    wrap.appendChild(titleEl);
    const d = document.createElement('p');
    d.style.opacity = '0.9';
    d.style.fontSize = '0.85rem';
    d.style.wordBreak = 'break-word';
    d.textContent = msg ? `${name ? `[${name}] ` : ''}${msg}` : hint;
    wrap.appendChild(d);
    const h = document.createElement('p');
    h.style.marginTop = '0.75rem';
    h.style.fontSize = '0.82rem';
    h.style.opacity = '0.75';
    h.textContent = hint;
    wrap.appendChild(h);
    loadingElement.appendChild(wrap);
    loadingElement.classList.add('visible');
    const ld = document.getElementById('loading-text');
    if (ld) ld.textContent = '';
}

async function start() {
    try {
        await setupWebcam();
        await initializeModels();
        await preloadCharacterSprites();
        loadingElement.classList.remove('visible');
        showMainMenu();
    } catch (e) {
        showStartError(e);
    }
}

start().catch(showStartError);

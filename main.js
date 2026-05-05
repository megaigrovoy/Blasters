import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

const MEDIAPIPE_TASKS_VISION_WASM_VER = '0.10.34';

const STORAGE_SFX_OFF = 'blasters-sfx-off';
const STORAGE_MUSIC_OFF = 'blasters-music-off';

const DEBUG_FRAME_PERF =
    typeof location !== 'undefined' && new URLSearchParams(location.search).get('perf') === '1';

let soundEffectsEnabled = true;
let musicEnabled = true;

function loadPersistedSettings() {
    soundEffectsEnabled = localStorage.getItem(STORAGE_SFX_OFF) !== '1';
    musicEnabled = localStorage.getItem(STORAGE_MUSIC_OFF) !== '1';
    const sfxCb = document.getElementById('opt-sound-off');
    const musicCb = document.getElementById('opt-music-off');
    if (sfxCb) sfxCb.checked = !soundEffectsEnabled;
    if (musicCb) musicCb.checked = !musicEnabled;
}

const SFX_SHOOT_URLS = [
    new URL('./src/assets/sounds/Sound Of Fruit Slice.mp3', import.meta.url).href,
    new URL('./src/assets/sounds/Sound Of Fruit Slice 2.mp3', import.meta.url).href,
    new URL('./src/assets/sounds/Sound Of Fruit Slice 3.mp3', import.meta.url).href,
    new URL('./src/assets/sounds/Sound Of Fruit Slice 4.mp3', import.meta.url).href
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
    if (!soundEffectsEnabled) return;
    const url = SFX_SHOOT_URLS[shootSfxRot++ % SFX_SHOOT_URLS.length];
    playOneShotSfx(url, 0.52);
}

function playHitSound() {
    if (!soundEffectsEnabled) return;
    const url = SFX_HIT_URLS[hitSfxRot++ % SFX_HIT_URLS.length];
    playOneShotSfx(url, 0.82);
}

const MENU_MUSIC_URL = new URL('./src/assets/sounds/menu.mp3', import.meta.url).href;
const GAME_BG_TRACKS = Object.values(
    import.meta.glob('./src/assets/sounds/OST/*.mp3', { eager: true, query: '?url', import: 'default' })
);

const sfxAudioBufferByUrl = new Map();
const sfxAudioBufferPromiseByUrl = new Map();

function getOrCreateSfxContext() {
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        if (!window.__blastersAudioCtx) window.__blastersAudioCtx = new AC();
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

function playDecodedSfx(ctx, buffer, volume) {
    if (ctx.state === 'suspended') void ctx.resume();
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.buffer = buffer;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(0);
}

function playOneShotSfx(url, volume) {
    if (!soundEffectsEnabled || !url) return;
    const ctx = window.__blastersAudioCtx || getOrCreateSfxContext();
    const ready = ctx && sfxAudioBufferByUrl.get(url);
    if (ctx && ready) {
        try {
            playDecodedSfx(ctx, ready, volume);
        } catch (_) {
            fallbackHtmlOneShot(url, volume);
        }
        return;
    }
    if (ctx) {
        void ensureSfxAudioBuffer(ctx, url)
            .then((buf) => {
                if (!soundEffectsEnabled) return;
                try {
                    playDecodedSfx(ctx, buf, volume);
                } catch (_) {
                    fallbackHtmlOneShot(url, volume);
                }
            })
            .catch(() => fallbackHtmlOneShot(url, volume));
        return;
    }
    fallbackHtmlOneShot(url, volume);
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

function warmSfxAudioBuffersYielding() {
    const ctx = getOrCreateSfxContext();
    if (!ctx) return;
    const sfxOnly = [...new Set([...SFX_SHOOT_URLS, ...SFX_HIT_URLS])].filter(Boolean);
    void (async () => {
        for (const u of sfxOnly) {
            try {
                await ensureSfxAudioBuffer(ctx, u);
            } catch (_) {}
            await new Promise((r) => setTimeout(r, 16));
        }
    })();
}

function preloadGameAudio() {
    if (soundEffectsEnabled) {
        const sfxUrls = [...new Set([...SFX_SHOOT_URLS, ...SFX_HIT_URLS])].filter(Boolean);
        for (const u of sfxUrls) preloadHtmlAudioUrl(u);
        warmSfxAudioBuffersYielding();
    }
    if (musicEnabled) {
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

function resumeSharedAudioContext() {
    const ctx = getOrCreateSfxContext();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
}

function tryUnlockAudioOnUserGesture() {
    if (htmlAudioUnlocked || audioUnlockBusy) return;
    audioUnlockBusy = true;
    resumeSharedAudioContext();
    const srcs = [SFX_SHOOT_URLS[0], SFX_HIT_URLS[0], MENU_MUSIC_URL];
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

function getMenuMusicAudio() {
    if (!menuMusicAudio) {
        menuMusicAudio = new Audio(MENU_MUSIC_URL);
        menuMusicAudio.loop = true;
        menuMusicAudio.volume = 0.52;
    }
    return menuMusicAudio;
}

function playMenuMusic() {
    if (!musicEnabled) return;
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
    if (!musicEnabled) {
        stopGameMusic();
        return;
    }
    stopGameMusic();
    if (!gameMusicPlaylist.length) return;
    gameMusicPlaylistIndex = ((index % gameMusicPlaylist.length) + gameMusicPlaylist.length) % gameMusicPlaylist.length;
    const url = gameMusicPlaylist[gameMusicPlaylistIndex];
    const a = new Audio(url);
    a.volume = 0.46;
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
    if (!musicEnabled || !GAME_BG_TRACKS.length) return;
    gameMusicPlaylist = [...GAME_BG_TRACKS];
    shuffleArrayInPlace(gameMusicPlaylist);
    gameMusicPlaylistIndex = 0;
    playGameMusicTrackAt(0);
}

const video = document.getElementById('webcam');
const canvasElement = document.getElementById('game-canvas');
const canvasCtx = canvasElement.getContext('2d');
const scoreDisplay = document.getElementById('score-display');
const loadingElement = document.getElementById('loading');
const mainMenu = document.getElementById('main-menu');
const hudGame = document.getElementById('hud-game');
const btnBackMenu = document.getElementById('btn-back-menu');
const btnStart = document.getElementById('btn-start');
const playersDisplay = document.getElementById('players-display');

let poseLandmarker;
let lastVideoTime = -1;
let score = 0;
let targets = [];
let projectiles = [];
let particles = [];
let isPlaying = false;

const GAME_CFG = {
    maxTargets: 5,
    spawnIntervalMs: 1580,
    projectileSpeed: 28,
    fireCooldownMs: 180,
    raisedShoulderPx: 58,
    scoreTarget: 10,
    aimMinSpanPx: 14
};

let lastSpawnTime = Date.now();
let lastFrameTime = performance.now();

const lastFireByHandKey = new Map();

function showMainMenu() {
    isPlaying = false;
    stopGameMusic();
    mainMenu.classList.remove('is-hidden');
    hudGame.classList.add('is-hidden');
    targets.length = 0;
    projectiles.length = 0;
    particles.length = 0;
    lastFireByHandKey.clear();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasElement.style.visibility = 'hidden';
    void video.pause();
    playMenuMusic();
}

function startGame() {
    tryUnlockAudioOnUserGesture();
    score = 0;
    scoreDisplay.innerText = `Score: ${score}`;
    targets.length = 0;
    projectiles.length = 0;
    particles.length = 0;
    lastSpawnTime = Date.now();
    lastFrameTime = performance.now();
    lastFireByHandKey.clear();
    mainMenu.classList.add('is-hidden');
    hudGame.classList.remove('is-hidden');
    canvasElement.style.visibility = '';
    isPlaying = true;
    void video.play().catch(() => {});
    queueMicrotask(() => {
        startGameMusicPlaylist();
        requestAnimationFrame(gameLoop);
    });
}

btnStart?.addEventListener('click', () => startGame());
btnBackMenu?.addEventListener('click', () => showMainMenu());

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
    if (btnFullscreenLabel) btnFullscreenLabel.textContent = isFs ? 'Свернуть' : 'На весь экран';
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
        if (e.target?.closest?.('.menu-options')) return;
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

const optSoundOff = document.getElementById('opt-sound-off');
const optMusicOff = document.getElementById('opt-music-off');
if (optSoundOff) {
    optSoundOff.addEventListener('change', () => {
        soundEffectsEnabled = !optSoundOff.checked;
        if (soundEffectsEnabled) localStorage.removeItem(STORAGE_SFX_OFF);
        else localStorage.setItem(STORAGE_SFX_OFF, '1');
    });
}
if (optMusicOff) {
    optMusicOff.addEventListener('change', () => {
        musicEnabled = !optMusicOff.checked;
        if (musicEnabled) {
            localStorage.removeItem(STORAGE_MUSIC_OFF);
            if (!isPlaying) playMenuMusic();
        } else {
            localStorage.setItem(STORAGE_MUSIC_OFF, '1');
            pauseMenuMusic();
            stopGameMusic();
        }
    });
}
loadPersistedSettings();

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

    const constraintSets = [
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

let mediapipePoseDelegate = 'CPU';

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

    const poseOpts = (delegate) => ({
        baseOptions: {
            modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
            delegate
        },
        runningMode: 'VIDEO',
        numPoses: 2
    });

    try {
        poseLandmarker = await PoseLandmarker.createFromOptions(vision, poseOpts('GPU'));
        mediapipePoseDelegate = 'GPU';
    } catch (e) {
        console.warn('PoseLandmarker GPU failed, CPU:', e);
        poseLandmarker = await PoseLandmarker.createFromOptions(vision, poseOpts('CPU'));
        mediapipePoseDelegate = 'CPU';
    }

    console.info(`[Blasters] pose delegate: ${mediapipePoseDelegate}`);

    preloadGameAudio();
    loadingElement.classList.remove('visible');
    showMainMenu();
}

class Target {
    constructor() {
        const { w, h, minSide } = gameLayout;
        this.x = Math.random() * w * 0.85 + w * 0.075;
        this.y = -40 - Math.random() * 90;
        this.vx = (Math.random() - 0.5) * minSide * 0.004;
        this.vy = minSide * (0.002 + Math.random() * 0.0022);
        const palette = ['#ff1744', '#ff9100', '#ffd600', '#76ff03', '#00e5ff', '#651fff', '#ff00ea'];
        this.color = palette[(Math.random() * palette.length) | 0];
        const rLo = minSide * 0.045;
        const rHi = minSide * 0.078;
        this.radius = Math.min(72, Math.max(28, rLo + Math.random() * (rHi - rLo)));
        this.destroyed = false;
        this.hitFlash = 0;
        this.rot = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.04;
    }

    update(dt = 1) {
        if (this.destroyed) return;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.rot += this.rotSpeed * dt;
        if (this.hitFlash > 0) this.hitFlash -= 0.22 * dt;
    }

    draw(ctx) {
        if (this.destroyed) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rot);
        const g = ctx.createRadialGradient(0, 0, 4, 0, 0, this.radius);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.35, this.color);
        g.addColorStop(1, 'rgba(0,0,0,0.35)');
        ctx.fillStyle = g;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = this.hitFlash > 0 ? 28 : 14;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }
}

class Projectile {
    constructor(x, y, vx, vy, color) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.life = 1;
        this.r = 5;
        this.maxDist = 920;
        this.dist = 0;
        this.dead = false;
        const spd = Math.hypot(vx, vy);
        this.nx = spd > 0.01 ? vx / spd : 1;
        this.ny = spd > 0.01 ? vy / spd : 0;
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
        ctx.save();
        ctx.strokeStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 12;
        ctx.globalAlpha = 0.85 * a;
        ctx.lineWidth = 4;
        const len = 24;
        ctx.beginPath();
        ctx.moveTo(this.x - this.nx * len * 0.35, this.y - this.ny * len * 0.35);
        ctx.lineTo(this.x + this.nx * len, this.y + this.ny * len);
        ctx.stroke();
        ctx.restore();
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

const POSE_HAND_MIN_VISIBILITY = 0.55;

function midpoint(a, b) {
    return { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
}

function buildSyntheticHandFromPose(poseLandmarks, def) {
    const wrist = poseLandmarks[def.wristIdx];
    const indexT = poseLandmarks[def.indexIdx];
    const pinkyT = poseLandmarks[def.pinkyIdx];
    const thumbT = poseLandmarks[def.thumbIdx];
    if (!wrist || !indexT || !pinkyT) return null;
    const vis = wrist.visibility ?? 1;
    if (vis < POSE_HAND_MIN_VISIBILITY) return null;

    const indexPip = midpoint(wrist, indexT);
    const pinkyDip = midpoint(wrist, pinkyT);
    const middleT = midpoint(indexT, pinkyT);
    const middlePip = midpoint(wrist, middleT);
    const ringT = midpoint(middleT, pinkyT);
    const ringPip = midpoint(wrist, ringT);
    const thumb = thumbT || midpoint(wrist, indexT);

    const lm = new Array(21);
    for (let i = 0; i < 21; i++) lm[i] = wrist;
    lm[0] = wrist;
    lm[1] = midpoint(wrist, thumb);
    lm[2] = midpoint(wrist, thumb);
    lm[3] = midpoint(wrist, thumb);
    lm[4] = thumb;
    lm[5] = midpoint(wrist, indexT);
    lm[6] = midpoint(wrist, indexT);
    lm[7] = indexPip;
    lm[8] = indexT;
    lm[9] = middlePip;
    lm[10] = middlePip;
    lm[11] = middlePip;
    lm[12] = middleT;
    lm[13] = ringPip;
    lm[14] = ringPip;
    lm[15] = ringPip;
    lm[16] = ringT;
    lm[17] = pinkyDip;
    lm[18] = pinkyDip;
    lm[19] = pinkyDip;
    lm[20] = pinkyT;
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

function buildKeyedHandsFromPose(poseResults) {
    const ordered = getOrderedPersons(poseResults);
    if (!ordered.length) return [];
    const nowMs = performance.now();
    const activeKeys = new Set(ordered.map((p) => p.key));
    pruneHandInputSmoothState(activeKeys, nowMs);
    const out = [];
    for (let p = 0; p < ordered.length; p++) {
        const suffix = ordered.length > 1 ? `#${p}` : '';
        const stableLm = smoothHandInputLm(ordered[p].key, ordered[p].lm, nowMs);
        for (const def of POSE_BODY_HANDS) {
            const lm = buildSyntheticHandFromPose(stableLm, def);
            if (!lm) continue;
            out.push({ key: `${def.key}${suffix}`, landmarks: lm });
        }
    }
    return out;
}

const FACE_LM_INDICES = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
const POSE_FACE_ALPHA = 0.28;
const POSE_BODY_ALPHA = 0.4;
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
        const alpha = FACE_LM_INDICES.has(i) ? POSE_FACE_ALPHA : POSE_BODY_ALPHA;
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

function poseKeyFromHandKey(handKey) {
    const m = handKey.match(/#(\d+)$/);
    const idx = m ? parseInt(m[1], 10) : 0;
    return `Pose#${idx}`;
}

function playerIndexFromHandKey(handKey) {
    const m = handKey.match(/#(\d+)$/);
    return m ? parseInt(m[1], 10) : 0;
}

function getShoulderMidY(plm, getScreenPoint) {
    const a = plm[11];
    const b = plm[12];
    if (!a || !b) return null;
    const p = getScreenPoint(a);
    const q = getScreenPoint(b);
    return (p.y + q.y) * 0.5;
}

function circleHit(ax, ay, ar, bx, by, br) {
    const dx = ax - bx;
    const dy = ay - by;
    const rr = ar + br;
    return dx * dx + dy * dy <= rr * rr;
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

    if (lastVideoTime !== video.currentTime) {
        lastVideoTime = video.currentTime;
        const frameTsMs = Number.isFinite(video.currentTime) ? video.currentTime * 1000 : startTimeMs;
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

    const smoothedLmByPoseKey = new Map();
    let orderedPersons = [];

    if (currentPoseResults?.landmarks) {
        orderedPersons = getOrderedPersons(currentPoseResults);
        const nowPoseMs = performance.now();
        const activePoseKeys = new Set(orderedPersons.map((p) => p.key));
        prunePoseSmoothState(activePoseKeys, nowPoseMs);

        for (const { lm: rawLm, key: poseKey } of orderedPersons) {
            smoothedLmByPoseKey.set(poseKey, smoothPoseLandmarks(poseKey, rawLm, nowPoseMs));
        }

        for (const { key: poseKey } of orderedPersons) {
            const landmarks = smoothedLmByPoseKey.get(poseKey);
            canvasCtx.strokeStyle = 'rgba(0, 243, 255, 0.78)';
            canvasCtx.lineWidth = 5;
            canvasCtx.shadowColor = 'rgba(0, 243, 255, 0.9)';
            canvasCtx.shadowBlur = 12;

            for (const connection of POSE_CONNECTIONS) {
                const a = getScreenPoint(landmarks[connection.start]);
                const b = getScreenPoint(landmarks[connection.end]);
                canvasCtx.beginPath();
                canvasCtx.moveTo(a.x, a.y);
                canvasCtx.lineTo(b.x, b.y);
                canvasCtx.stroke();
            }
            canvasCtx.shadowBlur = 0;
        }
    }

    if (playersDisplay) {
        const n = orderedPersons.length;
        playersDisplay.textContent =
            n >= 2
                ? 'Игроков: 2 · общий счёт'
                : n === 1
                  ? 'Игроков: 1 · позовите второго'
                  : 'Игроков: 0 · встаньте в кадр';
    }

    const keyedHands = buildKeyedHandsFromPose(currentPoseResults);
    const fireNow = performance.now();

    for (const { key, landmarks } of keyedHands) {
        const wrist = getScreenPoint(landmarks[0]);
        const tip = getScreenPoint(landmarks[8]);
        let dx = tip.x - wrist.x;
        let dy = tip.y - wrist.y;
        const span = Math.hypot(dx, dy);
        if (span < GAME_CFG.aimMinSpanPx) continue;
        dx /= span;
        dy /= span;

        const pk = poseKeyFromHandKey(key);
        const plm = smoothedLmByPoseKey.get(pk);
        if (!plm) continue;
        const shoulderY = getShoulderMidY(plm, getScreenPoint);
        if (shoulderY === null) continue;

        const raised = wrist.y < shoulderY + GAME_CFG.raisedShoulderPx;
        if (!raised) continue;

        const last = lastFireByHandKey.get(key) ?? 0;
        if (fireNow - last < GAME_CFG.fireCooldownMs) continue;

        const pid = playerIndexFromHandKey(key);
        const color = pid === 0 ? '#00f3ff' : '#ff00ea';

        const ox = wrist.x + dx * 44;
        const oy = wrist.y + dy * 44;
        projectiles.push(
            new Projectile(ox, oy, dx * GAME_CFG.projectileSpeed, dy * GAME_CFG.projectileSpeed, color)
        );
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

    const now = Date.now();
    const aliveTargets = targets.filter((t) => !t.destroyed).length;
    if (now - lastSpawnTime >= GAME_CFG.spawnIntervalMs && aliveTargets < GAME_CFG.maxTargets) {
        targets.push(new Target());
        lastSpawnTime = now;
    }

    for (let i = targets.length - 1; i >= 0; i--) {
        const t = targets[i];
        t.update(dt);
        t.draw(canvasCtx);
        if (!t.destroyed && t.y > gameLayout.h + 120) {
            targets.splice(i, 1);
        } else if (t.destroyed) {
            targets.splice(i, 1);
        }
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
        const pr = projectiles[i];
        pr.update(dt);

        if (!pr.dead) {
            for (const t of targets) {
                if (t.destroyed) continue;
                if (circleHit(pr.x, pr.y, pr.r, t.x, t.y, t.radius)) {
                    t.destroyed = true;
                    t.hitFlash = 1;
                    pr.dead = true;
                    score += GAME_CFG.scoreTarget;
                    scoreDisplay.innerText = `Score: ${score}`;
                    playHitSound();
                    particles.push(new HitBurst(t.x, t.y, t.color));
                    for (let p = 0; p < 18; p++) particles.push(new Particle(t.x, t.y, t.color, 'dot'));
                    for (let p = 0; p < 12; p++) particles.push(new Particle(t.x, t.y, t.color, 'spark'));
                    break;
                }
            }
        }

        if (!pr.dead) pr.draw(canvasCtx);
        if (pr.dead) projectiles.splice(i, 1);
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

    if (isPlaying) requestAnimationFrame(gameLoop);
}

function showStartError(e) {
    console.error(e);
    const name = e?.name || '';
    const msg = e?.message || String(e);
    let hint =
        'Откройте консоль браузера (F12 → Console) и при необходимости пришлите текст ошибки.';
    if (name === 'NotAllowedError' || /Permission/i.test(msg)) {
        hint =
            'Браузер заблокировал камеру для этого сайта. Нажмите на значок замка слева от адреса → разрешите камеру, обновите страницу.';
    } else if (name === 'NotFoundError' || /DevicesNotFound/i.test(msg)) {
        hint = 'Камера не найдена. Проверьте, что она подключена и не занята другим приложением.';
    } else if (
        name === 'AbortError' ||
        /Timeout starting video source|metadata timeout/i.test(msg)
    ) {
        hint =
            'Камера не успела запуститься. Отключите режим эмуляции устройства в DevTools (или выберите реальное устройство с камерой), закройте другие программы, использующие камеру, и обновите страницу.';
    }
    loadingElement.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'max-width:28rem;margin:0 auto;text-align:left;line-height:1.45;font-size:0.95rem;';
    const t = document.createElement('p');
    t.textContent = 'Не удалось запустить игру.';
    t.style.fontWeight = '700';
    t.style.marginBottom = '0.5rem';
    wrap.appendChild(t);
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
}

async function start() {
    try {
        await setupWebcam();
        await initializeModels();
    } catch (e) {
        showStartError(e);
    }
}

start();

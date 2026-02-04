// src/soundSystem.ts
// Audio system for chess game - supports custom sounds or Web Audio fallback

type SoundType = 'move' | 'capture' | 'check' | 'castle' | 'game-start' | 'game-win' | 'game-lose' | 'game-draw';

// =============================================================================
// STATE
// =============================================================================

let audioContext: AudioContext | null = null;
let soundEnabled = true;
const audioCache = new Map<SoundType, HTMLAudioElement>();
const soundPaths: Record<SoundType, string> = {
    'move': '/sounds/move.mp3',
    'capture': '/sounds/capture.mp3',
    'check': '/sounds/check.mp3',
    'castle': '/sounds/castle.mp3',
    'game-start': '/sounds/game-start.mp3',
    'game-win': '/sounds/game-win.mp3',
    'game-lose': '/sounds/game-lose.mp3',
    'game-draw': '/sounds/game-draw.mp3',
};

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize audio system and preload sounds
 */
export function init(): void {
    // Load user preference
    const saved = localStorage.getItem('chess-sound-enabled');
    soundEnabled = saved !== 'false';

    // Try to preload custom sounds
    preloadSounds();

    console.log('[Sound] Initialized, enabled:', soundEnabled);
}

/**
 * Preload custom sound files if they exist
 */
function preloadSounds(): void {
    Object.entries(soundPaths).forEach(([type, path]) => {
        const audio = new Audio(path);
        audio.preload = 'auto';

        // Only cache if the file loads successfully
        audio.addEventListener('canplaythrough', () => {
            audioCache.set(type as SoundType, audio);
            console.log('[Sound] Loaded:', type);
        });

        audio.addEventListener('error', () => {
            console.log('[Sound] Not found, will use fallback:', type);
        });
    });
}

// =============================================================================
// WEB AUDIO FALLBACK (Basic click tone)
// =============================================================================

function getAudioContext(): AudioContext {
    if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContext;
}

/**
 * Generate a simple click tone using Web Audio API
 */
function playFallbackClick(frequency: number = 800, duration: number = 0.05): void {
    try {
        const ctx = getAudioContext();

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;

        // Quick attack/decay envelope
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.005);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + duration);
    } catch (e) {
        console.warn('[Sound] Web Audio fallback failed:', e);
    }
}

/**
 * Play fallback sound based on type
 */
function playFallbackSound(type: SoundType): void {
    switch (type) {
        case 'move':
            playFallbackClick(600, 0.05);
            break;
        case 'capture':
            playFallbackClick(400, 0.08);
            setTimeout(() => playFallbackClick(300, 0.06), 50);
            break;
        case 'check':
            playFallbackClick(1000, 0.1);
            break;
        case 'castle':
            playFallbackClick(500, 0.05);
            setTimeout(() => playFallbackClick(600, 0.05), 80);
            break;
        case 'game-start':
            playFallbackClick(400, 0.1);
            setTimeout(() => playFallbackClick(600, 0.1), 100);
            setTimeout(() => playFallbackClick(800, 0.15), 200);
            break;
        case 'game-win':
            playFallbackClick(600, 0.1);
            setTimeout(() => playFallbackClick(800, 0.1), 150);
            setTimeout(() => playFallbackClick(1000, 0.2), 300);
            break;
        case 'game-lose':
            playFallbackClick(400, 0.15);
            setTimeout(() => playFallbackClick(300, 0.2), 200);
            break;
        case 'game-draw':
            playFallbackClick(500, 0.1);
            setTimeout(() => playFallbackClick(500, 0.1), 150);
            break;
    }
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Play a sound effect
 */
export function play(type: SoundType): void {
    if (!soundEnabled) return;

    const cached = audioCache.get(type);

    if (cached) {
        // Use custom sound file
        cached.currentTime = 0;
        cached.play().catch(() => {
            // Fallback if custom sound fails to play
            playFallbackSound(type);
        });
    } else {
        // Use Web Audio fallback
        playFallbackSound(type);
    }
}

/**
 * Check if sound is enabled
 */
export function isEnabled(): boolean {
    return soundEnabled;
}

/**
 * Toggle sound on/off
 */
export function toggle(): boolean {
    soundEnabled = !soundEnabled;
    localStorage.setItem('chess-sound-enabled', String(soundEnabled));
    console.log('[Sound] Toggled:', soundEnabled);
    return soundEnabled;
}

/**
 * Set sound enabled state
 */
export function setEnabled(enabled: boolean): void {
    soundEnabled = enabled;
    localStorage.setItem('chess-sound-enabled', String(soundEnabled));
}

// Initialize on module load
init();

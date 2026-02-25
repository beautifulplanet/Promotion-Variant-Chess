/**
 * Classic Mode — chess.com / Lichess-style clean chess UI
 * 
 * Activates: flat orthographic board, 2D pieces, player bars, dark theme,
 * no newspaper chrome, no 3D environment/skybox/particles.
 * 
 * Graphics Quality: 6-tier system covering every device class
 *   potato  → Ultra-budget tablets (Galaxy A7 Lite, Fire 7)
 *   low     → Budget phones / older tablets
 *   med     → Mid-range phones / tablets
 *   high    → Modern phones, older laptops
 *   ultra   → Modern laptops, desktops
 *   extreme → Gaming PCs, high-refresh monitors
 *
 * Classic mode always forces flat + potato-GFX automatically.
 */

import * as Renderer from './renderer3d';

// =============================================================================
// TYPES
// =============================================================================

export type GraphicsQuality = 'potato' | 'low' | 'med' | 'high' | 'ultra' | 'extreme';

/** Human-readable descriptions shown in UI tooltips / settings panel */
export const QUALITY_INFO: Record<GraphicsQuality, { label: string; emoji: string; desc: string; target: string }> = {
    potato:  { label: 'Potato',  emoji: '🥔', desc: 'Bare minimum — flat lighting, no effects',                  target: 'Budget tablets (Galaxy A7 Lite, Fire 7)' },
    low:     { label: 'Low',     emoji: '🔋', desc: 'Skybox + basic lighting, no particles or environment',       target: 'Budget phones, older tablets' },
    med:     { label: 'Medium',  emoji: '⚡', desc: 'Skybox, particles, environment — balanced performance',      target: 'Mid-range phones & tablets' },
    high:    { label: 'High',    emoji: '🔥', desc: 'Full 3D world with animations — no shadows',                 target: 'Modern phones, older laptops' },
    ultra:   { label: 'Ultra',   emoji: '💎', desc: 'Everything enabled including shadows',                       target: 'Modern laptops & desktops' },
    extreme: { label: 'Extreme', emoji: '🚀', desc: 'Max quality + super-sampled rendering for crisp visuals',    target: 'Gaming PCs, high-refresh displays' },
};

export const QUALITY_ORDER: GraphicsQuality[] = ['potato', 'low', 'med', 'high', 'ultra', 'extreme'];

// =============================================================================
// STORAGE KEYS
// =============================================================================

const CLASSIC_KEY = 'chess-classic-mode';
const GFX_KEY = 'chess-graphics-quality';

// =============================================================================
// STATE
// =============================================================================

let classicEnabled = false;
let currentQuality: GraphicsQuality = 'high';
let exploringScene = false;

// =============================================================================
// CLASSIC MODE
// =============================================================================

export function isClassicMode(): boolean {
    return classicEnabled;
}

let previousQuality: GraphicsQuality = 'high';

export function setClassicMode(enabled: boolean): void {
    // Exit explore mode if leaving classic mode
    if (!enabled && exploringScene) {
        exploringScene = false;
        document.body.classList.remove('explore-mode');
    }

    classicEnabled = enabled;
    document.body.classList.toggle('classic-mode', enabled);
    localStorage.setItem(CLASSIC_KEY, enabled ? '1' : '0');

    // Update page title for stealth
    document.title = enabled ? 'Chess' : 'Chess Wars Chronicle';

    // Update meta theme-color
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
        metaTheme.setAttribute('content', enabled ? '#2b2b2b' : '#faf6ed');
    }

    // Toggle flat orthographic board (the main visual difference)
    Renderer.setFlatBoardMode(enabled);

    if (enabled) {
        // Remember quality so we can restore when leaving classic mode
        previousQuality = currentQuality;

        // Force low GFX (no shadows, particles, skybox, etc.)
        Renderer.setShadowsEnabled(false);
        Renderer.setParticlesEnabled(false);
        Renderer.setSkyboxEnabled(false);
        Renderer.setEnvironmentEnabled(false);
        Renderer.setEnvironmentAnimationEnabled(false);
        Renderer.setWormholeEnabled(false);
        Renderer.setMotionScale(0);
        Renderer.setRenderScale(1.0); // Full DPR for crisp 2D
    } else {
        // Restore previous GFX quality
        setGraphicsQuality(previousQuality);
    }

    console.log(`[ClassicMode] ${enabled ? 'ON — flat board + potato GFX' : 'OFF — 3D restored'}`);
}

export function toggleClassicMode(): boolean {
    setClassicMode(!classicEnabled);
    return classicEnabled;
}

// =============================================================================
// EXPLORE MODE — view 3D scenery from classic mode
// =============================================================================

export function isExploreMode(): boolean {
    return exploringScene;
}

export function enterExploreMode(): void {
    if (!classicEnabled || exploringScene) return;
    exploringScene = true;
    document.body.classList.add('explore-mode');

    // Temporarily restore 3D rendering (exit flat mode)
    Renderer.setFlatBoardMode(false);

    // Enable full 3D effects
    Renderer.setSkyboxEnabled(true);
    Renderer.setParticlesEnabled(true);
    Renderer.setEnvironmentEnabled(true);
    Renderer.setEnvironmentAnimationEnabled(true);
    Renderer.setWormholeEnabled(true);
    Renderer.setMotionScale(1.0);
    Renderer.setRenderScale(1.0);

    console.log('[ClassicMode] Explore mode ON — 3D scenery visible');
}

export function exitExploreMode(): void {
    if (!exploringScene) return;
    exploringScene = false;
    document.body.classList.remove('explore-mode');

    // Restore flat board mode + classic low-GFX
    Renderer.setFlatBoardMode(true);
    Renderer.setShadowsEnabled(false);
    Renderer.setParticlesEnabled(false);
    Renderer.setSkyboxEnabled(false);
    Renderer.setEnvironmentEnabled(false);
    Renderer.setEnvironmentAnimationEnabled(false);
    Renderer.setWormholeEnabled(false);
    Renderer.setMotionScale(0);
    Renderer.setRenderScale(1.0);

    console.log('[ClassicMode] Explore mode OFF — flat board restored');
}

// =============================================================================
// GRAPHICS QUALITY
// =============================================================================

/**
 * 6-tier quality presets.
 *
 * KEY FIX: Even on "potato" we keep scene.environment (PBR env map) alive so
 * materials never reflect pure black.  On "low" the skybox is turned ON to
 * provide visible sky reflections — this eliminates the "black glare" issue
 * reported on devices like the Samsung Galaxy A7 Lite.
 */
const QUALITY_PRESETS: Record<GraphicsQuality, () => void> = {
    // ── Potato: Galaxy A7 Lite, Fire 7, ancient phones ─────────────────────
    potato: () => {
        Renderer.setShadowsEnabled(false);
        Renderer.setParticlesEnabled(false);
        Renderer.setSkyboxEnabled(false);
        Renderer.setEnvironmentEnabled(false);
        Renderer.setEnvironmentAnimationEnabled(false);
        Renderer.setWormholeEnabled(false);
        Renderer.setLightingEnabled(true);        // Keep lights ON so pieces aren't black
        Renderer.setRenderScale(0.75);            // Not too blurry (was 0.5 → black artifacts)
        Renderer.setMotionScale(0);
        Renderer.setAssetDensityScale(0);         // No environment objects
        Renderer.setParticleDensityScale(0);
        Renderer.setAnimQuality(1);               // Minimal animation frames
    },
    // ── Low: Budget phones, older tablets ──────────────────────────────────
    low: () => {
        Renderer.setShadowsEnabled(false);
        Renderer.setParticlesEnabled(false);
        Renderer.setSkyboxEnabled(true);           // Skybox ON → pieces reflect sky, not black
        Renderer.setEnvironmentEnabled(false);
        Renderer.setEnvironmentAnimationEnabled(false);
        Renderer.setWormholeEnabled(false);
        Renderer.setLightingEnabled(true);
        Renderer.setRenderScale(0.75);
        Renderer.setMotionScale(0);
        Renderer.setAssetDensityScale(0);
        Renderer.setParticleDensityScale(0);
        Renderer.setAnimQuality(2);
    },
    // ── Medium: Mid-range phones & tablets ─────────────────────────────────
    med: () => {
        Renderer.setShadowsEnabled(false);
        Renderer.setParticlesEnabled(true);
        Renderer.setSkyboxEnabled(true);
        Renderer.setEnvironmentEnabled(true);
        Renderer.setEnvironmentAnimationEnabled(false);  // Save GPU cycles
        Renderer.setWormholeEnabled(false);
        Renderer.setLightingEnabled(true);
        Renderer.setRenderScale(0.85);
        Renderer.setMotionScale(0.4);
        Renderer.setAssetDensityScale(0.5);              // Half-density environments
        Renderer.setParticleDensityScale(0.5);
        Renderer.setAnimQuality(3);
    },
    // ── High: Modern phones, older laptops ─────────────────────────────────
    high: () => {
        Renderer.setShadowsEnabled(false);
        Renderer.setParticlesEnabled(true);
        Renderer.setSkyboxEnabled(true);
        Renderer.setEnvironmentEnabled(true);
        Renderer.setEnvironmentAnimationEnabled(true);
        Renderer.setWormholeEnabled(true);
        Renderer.setLightingEnabled(true);
        Renderer.setRenderScale(1.0);
        Renderer.setMotionScale(1.0);
        Renderer.setAssetDensityScale(1.0);
        Renderer.setParticleDensityScale(1.0);
        Renderer.setAnimQuality(4);
    },
    // ── Ultra: Modern laptops & desktops ───────────────────────────────────
    ultra: () => {
        Renderer.setShadowsEnabled(true);
        Renderer.setParticlesEnabled(true);
        Renderer.setSkyboxEnabled(true);
        Renderer.setEnvironmentEnabled(true);
        Renderer.setEnvironmentAnimationEnabled(true);
        Renderer.setWormholeEnabled(true);
        Renderer.setLightingEnabled(true);
        Renderer.setRenderScale(1.0);
        Renderer.setMotionScale(1.0);
        Renderer.setAssetDensityScale(1.0);
        Renderer.setParticleDensityScale(1.0);
        Renderer.setAnimQuality(5);
    },
    // ── Extreme: Gaming PCs, high-refresh monitors ─────────────────────────
    extreme: () => {
        Renderer.setShadowsEnabled(true);
        Renderer.setParticlesEnabled(true);
        Renderer.setSkyboxEnabled(true);
        Renderer.setEnvironmentEnabled(true);
        Renderer.setEnvironmentAnimationEnabled(true);
        Renderer.setWormholeEnabled(true);
        Renderer.setLightingEnabled(true);
        Renderer.setRenderScale(1.25);            // Super-sampled for maximum clarity
        Renderer.setMotionScale(1.0);
        Renderer.setAssetDensityScale(1.5);       // Extra-dense scenery
        Renderer.setParticleDensityScale(1.5);
        Renderer.setAnimQuality(6);
    },
};

export function getGraphicsQuality(): GraphicsQuality {
    return currentQuality;
}

export function setGraphicsQuality(q: GraphicsQuality): void {
    currentQuality = q;
    QUALITY_PRESETS[q]();
    localStorage.setItem(GFX_KEY, q);
    console.log(`[Graphics] Quality set to: ${q}`);
}

export function cycleGraphicsQuality(): GraphicsQuality {
    const idx = QUALITY_ORDER.indexOf(currentQuality);
    const next = QUALITY_ORDER[(idx + 1) % QUALITY_ORDER.length];
    setGraphicsQuality(next);
    return next;
}

// =============================================================================
// DEVICE CAPABILITY DETECTION
// =============================================================================

export interface DeviceProfile {
    /** Detected GPU renderer string (may be masked on some browsers) */
    gpu: string;
    /** Logical cores (navigator.hardwareConcurrency) */
    cores: number;
    /** Device memory in GB (navigator.deviceMemory, 0 = unknown) */
    memoryGB: number;
    /** Device pixel ratio */
    dpr: number;
    /** Screen width in CSS pixels */
    screenWidth: number;
    /** True if touch-primary device */
    isTouch: boolean;
    /** True if userAgent looks like a mobile/tablet */
    isMobile: boolean;
    /** Max texture size supported by WebGL */
    maxTextureSize: number;
    /** Recommended quality tier */
    recommended: GraphicsQuality;
}

/**
 * Probe the device's GPU, memory, cores, and screen to recommend a quality
 * tier.  Called once on first visit (no saved preference) or when user taps
 * "Auto" in the settings panel.
 */
export function detectDeviceCapabilities(): DeviceProfile {
    // ── GPU renderer string ─────────────────────────────────────────────
    let gpu = 'unknown';
    let maxTextureSize = 4096;
    try {
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl2') || c.getContext('webgl');
        if (gl) {
            const dbg = gl.getExtension('WEBGL_debug_renderer_info');
            if (dbg) gpu = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || 'unknown';
            maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
        }
    } catch { /* swallow */ }

    const cores = navigator.hardwareConcurrency || 2;
    const memoryGB = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 0;
    const dpr = window.devicePixelRatio || 1;
    const screenWidth = window.screen?.width || window.innerWidth;
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (isTouch && screenWidth < 1024);

    // ── Scoring heuristic (higher = more capable) ───────────────────────
    let score = 0;

    // Screen size
    if (screenWidth >= 2560) score += 5;
    else if (screenWidth >= 1920) score += 4;
    else if (screenWidth >= 1280) score += 3;
    else if (screenWidth >= 1024) score += 2;
    else if (screenWidth >= 768) score += 1;

    // Pixel ratio (high-DPI = more GPU work)
    if (dpr >= 3) score -= 1;
    else if (dpr >= 2.5) score += 0;
    else if (dpr >= 2) score += 1;
    else score += 2;

    // Cores
    if (cores >= 8) score += 3;
    else if (cores >= 4) score += 2;
    else if (cores >= 2) score += 1;

    // Memory
    if (memoryGB >= 8) score += 3;
    else if (memoryGB >= 4) score += 2;
    else if (memoryGB >= 2) score += 1;
    else if (memoryGB > 0) score += 0;  // Known but low
    // memoryGB === 0 means API not available — neutral

    // GPU keyword scoring
    const gpuLower = gpu.toLowerCase();
    const WEAK_GPUS = ['mali-g52', 'mali-g51', 'mali-400', 'mali-t', 'adreno 5', 'adreno 4',
                        'powervr', 'vivante', 'videocore', 'sgx'];
    const STRONG_GPUS = ['rtx', 'radeon rx', 'geforce gtx 1[6-9]', 'geforce gtx [2-9]',
                          'radeon pro', 'apple gpu', 'apple m', 'adreno 7', 'mali-g7'];
    if (WEAK_GPUS.some(k => gpuLower.includes(k))) score -= 2;
    if (STRONG_GPUS.some(k => new RegExp(k).test(gpuLower))) score += 3;

    // Mobile penalty (thermal throttling, smaller batteries)
    if (isMobile) score -= 2;

    // Texture size bonus
    if (maxTextureSize >= 16384) score += 2;
    else if (maxTextureSize >= 8192) score += 1;

    // ── Map score → quality tier ────────────────────────────────────────
    let recommended: GraphicsQuality;
    if (score <= 2) recommended = 'potato';
    else if (score <= 4) recommended = 'low';
    else if (score <= 6) recommended = 'med';
    else if (score <= 9) recommended = 'high';
    else if (score <= 12) recommended = 'ultra';
    else recommended = 'extreme';

    console.log(`[DeviceDetect] GPU: ${gpu}, Cores: ${cores}, Mem: ${memoryGB}GB, DPR: ${dpr}, Screen: ${screenWidth}, Touch: ${isTouch}, Score: ${score} → ${recommended}`);

    return { gpu, cores, memoryGB, dpr, screenWidth, isTouch, isMobile, maxTextureSize, recommended };
}

// =============================================================================
// INIT — restore from localStorage or auto-detect
// =============================================================================

export function init(): void {
    // Restore classic mode
    const savedClassic = localStorage.getItem(CLASSIC_KEY);
    if (savedClassic === '1') {
        setClassicMode(true);
    }

    // Restore graphics quality — or auto-detect on first visit
    const savedGfx = localStorage.getItem(GFX_KEY) as GraphicsQuality | null;
    if (savedGfx && QUALITY_ORDER.includes(savedGfx)) {
        setGraphicsQuality(savedGfx);
    } else {
        // First visit: probe hardware and pick the best default
        const profile = detectDeviceCapabilities();
        setGraphicsQuality(profile.recommended);
        console.log(`[ClassicMode] Auto-detected quality: ${profile.recommended}`);
    }

    console.log(`[ClassicMode] Init — classic: ${classicEnabled}, gfx: ${currentQuality}`);
}

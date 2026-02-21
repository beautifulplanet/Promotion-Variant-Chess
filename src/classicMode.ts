/**
 * Classic Mode — chess.com / Lichess-style clean chess UI
 * 
 * Activates: flat orthographic board, 2D pieces, player bars, dark theme,
 * no newspaper chrome, no 3D environment/skybox/particles.
 * 
 * Graphics Quality: Low / Med / High presets for the newspaper (3D) mode.
 * Classic mode always forces flat + low-GFX automatically.
 */

import * as Renderer from './renderer3d';

// =============================================================================
// TYPES
// =============================================================================

export type GraphicsQuality = 'low' | 'med' | 'high';

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

    console.log(`[ClassicMode] ${enabled ? 'ON — flat board + low GFX' : 'OFF — 3D restored'}`);
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

const QUALITY_PRESETS: Record<GraphicsQuality, () => void> = {
    low: () => {
        Renderer.setShadowsEnabled(false);
        Renderer.setParticlesEnabled(false);
        Renderer.setSkyboxEnabled(false);
        Renderer.setEnvironmentEnabled(false);
        Renderer.setEnvironmentAnimationEnabled(false);
        Renderer.setWormholeEnabled(false);
        Renderer.setRenderScale(0.5);
        Renderer.setMotionScale(0);
    },
    med: () => {
        Renderer.setShadowsEnabled(false);
        Renderer.setParticlesEnabled(true);
        Renderer.setSkyboxEnabled(true);
        Renderer.setEnvironmentEnabled(true);
        Renderer.setEnvironmentAnimationEnabled(true);
        Renderer.setWormholeEnabled(true);
        Renderer.setRenderScale(0.75);
        Renderer.setMotionScale(0.5);
    },
    high: () => {
        Renderer.setShadowsEnabled(false); // Shadows stay off by default (perf choice)
        Renderer.setParticlesEnabled(true);
        Renderer.setSkyboxEnabled(true);
        Renderer.setEnvironmentEnabled(true);
        Renderer.setEnvironmentAnimationEnabled(true);
        Renderer.setWormholeEnabled(true);
        Renderer.setRenderScale(1.0);
        Renderer.setMotionScale(1.0);
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
    const order: GraphicsQuality[] = ['low', 'med', 'high'];
    const idx = order.indexOf(currentQuality);
    const next = order[(idx + 1) % order.length];
    setGraphicsQuality(next);
    return next;
}

// =============================================================================
// INIT — restore from localStorage
// =============================================================================

export function init(): void {
    // Restore classic mode
    const savedClassic = localStorage.getItem(CLASSIC_KEY);
    if (savedClassic === '1') {
        setClassicMode(true);
    }

    // Restore graphics quality
    const savedGfx = localStorage.getItem(GFX_KEY) as GraphicsQuality | null;
    if (savedGfx && ['low', 'med', 'high'].includes(savedGfx)) {
        setGraphicsQuality(savedGfx);
    }

    console.log(`[ClassicMode] Init — classic: ${classicEnabled}, gfx: ${currentQuality}`);
}

/**
 * Classic Mode — Clean chess UI toggle + Graphics Quality presets
 * 
 * Classic Mode: strips the newspaper theme down to a clean, standard chess UI
 *   - Mobile: full-screen board, no articles, no masthead, minimal chrome
 *   - Desktop: 50/50 split (articles condensed | board expanded), clean sans-serif
 * 
 * Graphics Quality: Low / Med / High presets that control renderer settings
 *   - Low: no shadows, no particles, no skybox, low DPR, no env, no AA
 *   - Med: particles + skybox, medium DPR, no shadows
 *   - High: everything on (default)
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

// =============================================================================
// CLASSIC MODE
// =============================================================================

export function isClassicMode(): boolean {
    return classicEnabled;
}

export function setClassicMode(enabled: boolean): void {
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

    console.log(`[ClassicMode] ${enabled ? 'ON' : 'OFF'}`);
}

export function toggleClassicMode(): boolean {
    setClassicMode(!classicEnabled);
    return classicEnabled;
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

// src/themeSystem.ts
// Award-winning UI color scheme system
// Inspired by: Monument Valley, Alto's Odyssey, Journey, Hollow Knight
//
// COLOR THEORY APPROACH:
// Each palette uses a triadic harmony: dominant, secondary, accent.
// - Dominant: 60% of visual weight (backgrounds, large surfaces)
// - Secondary: 30% (buttons, panels, borders)
// - Accent: 10% (highlights, interactive elements, calls-to-action)
//
// The newspaper area is UNTOUCHED - it keeps its classic look.
// Only the sidebar chrome + game area background respond to themes.

// =============================================================================
// TYPES
// =============================================================================

export type ThemeName =
    'newspaper' | 'obsidian' | 'arctic' | 'ember' | 'jade' |
    'dusk' | 'ivory' | 'cobalt';

export interface Theme {
    name: string;
    // Sidebar / chrome
    sidebarBg: string;
    sidebarText: string;
    sidebarTextMuted: string;
    sidebarBorder: string;
    sidebarAccent: string;
    // Buttons
    buttonPrimary: string;
    buttonPrimaryText: string;
    buttonSecondary: string;
    buttonSecondaryText: string;
    buttonMuted: string;
    buttonMutedText: string;
    // Game area
    gameAreaBg: string;
    surfaceAlt: string;
    // Scrollbar
    scrollbarTrack: string;
    scrollbarThumb: string;
}

// =============================================================================
// PALETTE DEFINITIONS
// =============================================================================

const themes: Record<ThemeName, Theme> = {

    // ---- DEFAULT: warm old-paper feel matching the newspaper header ----
    newspaper: {
        name: 'Newspaper',
        sidebarBg: '#f5f0e6',
        sidebarText: '#2a2420',
        sidebarTextMuted: '#8a7e6e',
        sidebarBorder: '#d8cebb',
        sidebarAccent: '#8b4513',
        buttonPrimary: '#5a7a4a',
        buttonPrimaryText: '#faf6ed',
        buttonSecondary: '#6a5a48',
        buttonSecondaryText: '#f5f0e6',
        buttonMuted: '#4a4238',
        buttonMutedText: '#ede6d8',
        gameAreaBg: '#f0ead8',
        surfaceAlt: '#f0ebe0',
        scrollbarTrack: '#e8dcc8',
        scrollbarThumb: '#c0a880',
    },

    // ---- OBSIDIAN: deep dark + gold accent (Hollow Knight energy) ----
    obsidian: {
        name: 'Obsidian',
        sidebarBg: '#1c1c22',
        sidebarText: '#e8e4dc',
        sidebarTextMuted: '#7a7670',
        sidebarBorder: '#2e2e38',
        sidebarAccent: '#d4a24e',
        buttonPrimary: '#c49332',
        buttonPrimaryText: '#1c1c22',
        buttonSecondary: '#3a3a48',
        buttonSecondaryText: '#d0ccc4',
        buttonMuted: '#2a2a34',
        buttonMutedText: '#a09a90',
        gameAreaBg: '#141418',
        surfaceAlt: '#24242c',
        scrollbarTrack: '#1c1c22',
        scrollbarThumb: '#3a3a48',
    },

    // ---- ARCTIC: crisp cool whites + blue accent (Alto's Odyssey) ----
    arctic: {
        name: 'Arctic',
        sidebarBg: '#f8fafc',
        sidebarText: '#1e293b',
        sidebarTextMuted: '#94a3b8',
        sidebarBorder: '#e2e8f0',
        sidebarAccent: '#3b82f6',
        buttonPrimary: '#2563eb',
        buttonPrimaryText: '#ffffff',
        buttonSecondary: '#475569',
        buttonSecondaryText: '#f1f5f9',
        buttonMuted: '#334155',
        buttonMutedText: '#cbd5e1',
        gameAreaBg: '#f1f5f9',
        surfaceAlt: '#e8edf5',
        scrollbarTrack: '#e2e8f0',
        scrollbarThumb: '#94a3b8',
    },

    // ---- EMBER: warm terracotta + burnt orange (Journey vibes) ----
    ember: {
        name: 'Ember',
        sidebarBg: '#faf3eb',
        sidebarText: '#3d2518',
        sidebarTextMuted: '#a08068',
        sidebarBorder: '#e8d8c4',
        sidebarAccent: '#c4501a',
        buttonPrimary: '#d4622a',
        buttonPrimaryText: '#fff8f0',
        buttonSecondary: '#7a5040',
        buttonSecondaryText: '#faf0e4',
        buttonMuted: '#5a3e30',
        buttonMutedText: '#e8d4c0',
        gameAreaBg: '#f4ece0',
        surfaceAlt: '#f0e4d6',
        scrollbarTrack: '#ecdcc8',
        scrollbarThumb: '#c4a080',
    },

    // ---- JADE: muted green + earthy tones (Monument Valley) ----
    jade: {
        name: 'Jade',
        sidebarBg: '#f2f5f0',
        sidebarText: '#1a2e1a',
        sidebarTextMuted: '#6a846a',
        sidebarBorder: '#d0dcc8',
        sidebarAccent: '#2a7a3a',
        buttonPrimary: '#2d8a3e',
        buttonPrimaryText: '#f0faf2',
        buttonSecondary: '#4a6a4a',
        buttonSecondaryText: '#e8f4e8',
        buttonMuted: '#3a4e38',
        buttonMutedText: '#c0d8b8',
        gameAreaBg: '#eaf2e8',
        surfaceAlt: '#e0eedc',
        scrollbarTrack: '#d4e0cc',
        scrollbarThumb: '#8aaa80',
    },

    // ---- DUSK: deep purple + mauve accent (Celeste night palette) ----
    dusk: {
        name: 'Dusk',
        sidebarBg: '#1e1828',
        sidebarText: '#e0d8ec',
        sidebarTextMuted: '#8878a0',
        sidebarBorder: '#302840',
        sidebarAccent: '#c490b0',
        buttonPrimary: '#9060a8',
        buttonPrimaryText: '#f4eef8',
        buttonSecondary: '#3e3050',
        buttonSecondaryText: '#d0c4dc',
        buttonMuted: '#2c2240',
        buttonMutedText: '#a898b8',
        gameAreaBg: '#161020',
        surfaceAlt: '#241c30',
        scrollbarTrack: '#1e1828',
        scrollbarThumb: '#3e3050',
    },

    // ---- IVORY: clean warm minimal (Baba Is You serenity) ----
    ivory: {
        name: 'Ivory',
        sidebarBg: '#fffefa',
        sidebarText: '#3a3530',
        sidebarTextMuted: '#a09890',
        sidebarBorder: '#ebe4da',
        sidebarAccent: '#c07050',
        buttonPrimary: '#c07050',
        buttonPrimaryText: '#fffcf8',
        buttonSecondary: '#887870',
        buttonSecondaryText: '#faf6f0',
        buttonMuted: '#605850',
        buttonMutedText: '#e8e0d8',
        gameAreaBg: '#faf7f2',
        surfaceAlt: '#f5f0ea',
        scrollbarTrack: '#ebe4da',
        scrollbarThumb: '#c8beb0',
    },

    // ---- COBALT: electric blue-on-dark (Hyper Light Drifter) ----
    cobalt: {
        name: 'Cobalt',
        sidebarBg: '#0c1424',
        sidebarText: '#d0dcea',
        sidebarTextMuted: '#6080a8',
        sidebarBorder: '#1a2840',
        sidebarAccent: '#38bdf8',
        buttonPrimary: '#0ea5e9',
        buttonPrimaryText: '#f0faff',
        buttonSecondary: '#1e3a5f',
        buttonSecondaryText: '#c0d8f0',
        buttonMuted: '#162a44',
        buttonMutedText: '#80a8cc',
        gameAreaBg: '#080e1a',
        surfaceAlt: '#10182a',
        scrollbarTrack: '#0c1424',
        scrollbarThumb: '#1e3a5f',
    },
};

// =============================================================================
// STATE
// =============================================================================

const STORAGE_KEY = 'chess-ui-theme';
let currentTheme: ThemeName = 'newspaper';

// =============================================================================
// PERSISTENCE
// =============================================================================

function loadTheme(): void {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && themes[saved as ThemeName]) {
        currentTheme = saved as ThemeName;
    }
}

function saveTheme(): void {
    localStorage.setItem(STORAGE_KEY, currentTheme);
}

// =============================================================================
// THEME APPLICATION
// =============================================================================

function applyTheme(theme: Theme): void {
    const root = document.documentElement;

    // Sidebar / chrome CSS custom properties
    root.style.setProperty('--sidebar-bg', theme.sidebarBg);
    root.style.setProperty('--sidebar-text', theme.sidebarText);
    root.style.setProperty('--sidebar-text-muted', theme.sidebarTextMuted);
    root.style.setProperty('--sidebar-border', theme.sidebarBorder);
    root.style.setProperty('--sidebar-accent', theme.sidebarAccent);
    root.style.setProperty('--btn-primary', theme.buttonPrimary);
    root.style.setProperty('--btn-primary-text', theme.buttonPrimaryText);
    root.style.setProperty('--btn-secondary', theme.buttonSecondary);
    root.style.setProperty('--btn-secondary-text', theme.buttonSecondaryText);
    root.style.setProperty('--btn-muted', theme.buttonMuted);
    root.style.setProperty('--btn-muted-text', theme.buttonMutedText);
    root.style.setProperty('--game-area-bg', theme.gameAreaBg);
    root.style.setProperty('--surface-alt', theme.surfaceAlt);
    root.style.setProperty('--scrollbar-track', theme.scrollbarTrack);
    root.style.setProperty('--scrollbar-thumb', theme.scrollbarThumb);

    // Backward compat: keep old CSS vars alive for any remaining references
    root.style.setProperty('--bg-color', theme.gameAreaBg);
    root.style.setProperty('--paper-color', theme.sidebarBg);
    root.style.setProperty('--border-color', theme.sidebarBorder);
    root.style.setProperty('--accent-color', theme.sidebarAccent);
    root.style.setProperty('--text-color', theme.sidebarText);
    root.style.setProperty('--button-bg', theme.buttonMuted);
    root.style.setProperty('--button-text', theme.buttonMutedText);
}

// =============================================================================
// PUBLIC API
// =============================================================================

export function init(): void {
    loadTheme();
    applyTheme(themes[currentTheme]);
    console.log('[Theme] Initialized:', currentTheme);
}

export function getCurrent(): ThemeName {
    return currentTheme;
}

export function getCurrentDisplayName(): string {
    return themes[currentTheme].name;
}

export function setTheme(name: ThemeName): void {
    if (themes[name]) {
        currentTheme = name;
        applyTheme(themes[name]);
        saveTheme();
        console.log('[Theme] Changed to:', name);
    }
}

export function cycle(): ThemeName {
    const themeNames = Object.keys(themes) as ThemeName[];
    const currentIndex = themeNames.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % themeNames.length;
    const nextTheme = themeNames[nextIndex];
    setTheme(nextTheme);
    return nextTheme;
}

export function getThemeNames(): ThemeName[] {
    return Object.keys(themes) as ThemeName[];
}

export function getThemeDisplayName(name: ThemeName): string {
    return themes[name]?.name || name;
}

export function getTheme(): Theme {
    return themes[currentTheme];
}

// src/themeSystem.ts
// Theme switching system with CSS variables

// =============================================================================
// TYPES
// =============================================================================

type ThemeName = 'classic' | 'dark' | 'sepia';

interface Theme {
    name: string;
    bgColor: string;
    textColor: string;
    headerBg: string;
    paperColor: string;
    borderColor: string;
    accentColor: string;
    buttonBg: string;
    buttonText: string;
}

// =============================================================================
// THEME DEFINITIONS
// =============================================================================

const themes: Record<ThemeName, Theme> = {
    classic: {
        name: 'Classic',
        bgColor: '#f4e8d4',
        textColor: '#1a1a1a',
        headerBg: '#e8dcc8',
        paperColor: '#f8f4ec',
        borderColor: '#c0b090',
        accentColor: '#8b4513',
        buttonBg: '#5a4a3a',
        buttonText: '#f0e0c0',
    },
    dark: {
        name: 'Dark Mode',
        bgColor: '#1a1a2e',
        textColor: '#e0e0e0',
        headerBg: '#16213e',
        paperColor: '#242444',
        borderColor: '#4a4a6a',
        accentColor: '#ffd700',
        buttonBg: '#0f3460',
        buttonText: '#e0e0e0',
    },
    sepia: {
        name: 'Sepia',
        bgColor: '#d4c4a8',
        textColor: '#3c2415',
        headerBg: '#c4b498',
        paperColor: '#e8dcc8',
        borderColor: '#a09070',
        accentColor: '#6b4423',
        buttonBg: '#6b4423',
        buttonText: '#f0e0c0',
    },
};

// =============================================================================
// STATE
// =============================================================================

const STORAGE_KEY = 'chess-theme';
let currentTheme: ThemeName = 'classic';

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

    root.style.setProperty('--bg-color', theme.bgColor);
    root.style.setProperty('--text-color', theme.textColor);
    root.style.setProperty('--header-bg', theme.headerBg);
    root.style.setProperty('--paper-color', theme.paperColor);
    root.style.setProperty('--border-color', theme.borderColor);
    root.style.setProperty('--accent-color', theme.accentColor);
    root.style.setProperty('--button-bg', theme.buttonBg);
    root.style.setProperty('--button-text', theme.buttonText);

    // Also update body background directly for immediate effect
    document.body.style.backgroundColor = theme.bgColor;
    document.body.style.color = theme.textColor;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Initialize theme system
 */
export function init(): void {
    loadTheme();
    applyTheme(themes[currentTheme]);
    console.log('[Theme] Initialized:', currentTheme);
}

/**
 * Get current theme name
 */
export function getCurrent(): ThemeName {
    return currentTheme;
}

/**
 * Get current theme display name
 */
export function getCurrentDisplayName(): string {
    return themes[currentTheme].name;
}

/**
 * Set theme by name
 */
export function setTheme(name: ThemeName): void {
    if (themes[name]) {
        currentTheme = name;
        applyTheme(themes[name]);
        saveTheme();
        console.log('[Theme] Changed to:', name);
    }
}

/**
 * Cycle to next theme
 */
export function cycle(): ThemeName {
    const themeNames = Object.keys(themes) as ThemeName[];
    const currentIndex = themeNames.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % themeNames.length;
    const nextTheme = themeNames[nextIndex];

    setTheme(nextTheme);
    return nextTheme;
}

/**
 * Get all available theme names
 */
export function getThemeNames(): ThemeName[] {
    return Object.keys(themes) as ThemeName[];
}

/**
 * Get theme display name
 */
export function getThemeDisplayName(name: ThemeName): string {
    return themes[name]?.name || name;
}

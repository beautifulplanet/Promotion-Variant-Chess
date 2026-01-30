// src/boardStyles.ts
// Configuration for 12 high-quality chess board themes

export interface BoardStyleConfig {
    id: string;
    name: string;
    description: string;
    // Square colors
    lightSquareColor: number;
    darkSquareColor: number;
    // Board frame/base
    frameColor: number;
    baseColor: number;
    // Material properties
    lightRoughness: number;
    darkRoughness: number;
    lightMetalness: number;
    darkMetalness: number;
    // Clearcoat for polished surfaces
    clearcoat: number;
    clearcoatRoughness: number;
    // Frame material
    frameMetalness: number;
    frameRoughness: number;
    // Emissive properties (for glowing boards)
    lightEmissive?: number;
    darkEmissive?: number;
    emissiveIntensity?: number;
    // Special effects
    transparent?: boolean;
    opacity?: number;
}

export const BOARD_STYLES: Record<string, BoardStyleConfig> = {
    // =========================================================================
    // CLASSIC & TRADITIONAL
    // =========================================================================

    classic: {
        id: 'classic',
        name: 'Classic Wood',
        description: 'Traditional dark wood & ivory squares',
        lightSquareColor: 0xf0e8dc,    // Ivory cream
        darkSquareColor: 0x3a2820,     // Dark mahogany
        frameColor: 0xc0a060,          // Gold trim
        baseColor: 0x2a1a10,           // Dark wood base
        lightRoughness: 0.15,
        darkRoughness: 0.3,
        lightMetalness: 0.0,
        darkMetalness: 0.0,
        clearcoat: 0.6,
        clearcoatRoughness: 0.1,
        frameMetalness: 0.8,
        frameRoughness: 0.2,
    },

    tournament: {
        id: 'tournament',
        name: 'Tournament Green',
        description: 'Official FIDE tournament colors',
        lightSquareColor: 0xf0f0d8,    // Cream
        darkSquareColor: 0x5d8c5d,     // Forest green
        frameColor: 0x2d4c2d,          // Dark green trim
        baseColor: 0x1a2a1a,           // Dark green base
        lightRoughness: 0.3,
        darkRoughness: 0.35,
        lightMetalness: 0.0,
        darkMetalness: 0.0,
        clearcoat: 0.3,
        clearcoatRoughness: 0.2,
        frameMetalness: 0.0,
        frameRoughness: 0.4,
    },

    walnut: {
        id: 'walnut',
        name: 'Walnut & Maple',
        description: 'Rich walnut with light maple inlay',
        lightSquareColor: 0xe8d4b0,    // Light maple
        darkSquareColor: 0x5c4033,     // Walnut brown
        frameColor: 0x3d2817,          // Dark walnut trim
        baseColor: 0x2d1a0d,           // Dark wood base
        lightRoughness: 0.35,
        darkRoughness: 0.4,
        lightMetalness: 0.0,
        darkMetalness: 0.0,
        clearcoat: 0.4,
        clearcoatRoughness: 0.15,
        frameMetalness: 0.0,
        frameRoughness: 0.35,
    },

    ebony: {
        id: 'ebony',
        name: 'Ebony & Ivory',
        description: 'Luxury ebony with ivory inlay',
        lightSquareColor: 0xfff8f0,    // Pure ivory
        darkSquareColor: 0x0a0808,     // True ebony
        frameColor: 0xd4af37,          // Pure gold
        baseColor: 0x050404,           // Black lacquer
        lightRoughness: 0.1,
        darkRoughness: 0.15,
        lightMetalness: 0.0,
        darkMetalness: 0.0,
        clearcoat: 0.8,
        clearcoatRoughness: 0.05,
        frameMetalness: 0.9,
        frameRoughness: 0.1,
    },

    // =========================================================================
    // STONE & MARBLE
    // =========================================================================

    marble: {
        id: 'marble',
        name: 'Italian Marble',
        description: 'White Carrara & gray Bardiglio marble',
        lightSquareColor: 0xf5f5f8,    // White marble
        darkSquareColor: 0x5a5a6a,     // Gray marble
        frameColor: 0xd4af37,          // Gold trim
        baseColor: 0x3a3a40,           // Stone base
        lightRoughness: 0.08,
        darkRoughness: 0.1,
        lightMetalness: 0.0,
        darkMetalness: 0.0,
        clearcoat: 0.7,
        clearcoatRoughness: 0.05,
        frameMetalness: 0.9,
        frameRoughness: 0.1,
    },

    stone: {
        id: 'stone',
        name: 'Ancient Stone',
        description: 'Weathered slate & sandstone',
        lightSquareColor: 0xd4c4a8,    // Sandstone
        darkSquareColor: 0x4a4a50,     // Slate gray
        frameColor: 0x6a5a4a,          // Stone trim
        baseColor: 0x3a3530,           // Rough stone
        lightRoughness: 0.6,
        darkRoughness: 0.55,
        lightMetalness: 0.0,
        darkMetalness: 0.0,
        clearcoat: 0.1,
        clearcoatRoughness: 0.4,
        frameMetalness: 0.0,
        frameRoughness: 0.5,
    },

    // =========================================================================
    // MODERN & FUTURISTIC
    // =========================================================================

    crystal: {
        id: 'crystal',
        name: 'Crystal Glass',
        description: 'Translucent crystal with ambient glow',
        lightSquareColor: 0xe8f0ff,    // Frosted white
        darkSquareColor: 0x2a3a4a,     // Smoked glass
        frameColor: 0x88aacc,          // Steel blue
        baseColor: 0x1a2a3a,           // Dark glass
        lightRoughness: 0.05,
        darkRoughness: 0.1,
        lightMetalness: 0.1,
        darkMetalness: 0.1,
        clearcoat: 0.9,
        clearcoatRoughness: 0.02,
        frameMetalness: 0.7,
        frameRoughness: 0.15,
        lightEmissive: 0x4488aa,
        darkEmissive: 0x224466,
        emissiveIntensity: 0.1,
        transparent: true,
        opacity: 0.92,
    },

    neon: {
        id: 'neon',
        name: 'Neon Grid',
        description: 'Cyberpunk glowing neon aesthetic',
        lightSquareColor: 0x1a1a2e,    // Dark base
        darkSquareColor: 0x0a0a15,     // Darker base
        frameColor: 0x00ffff,          // Cyan neon
        baseColor: 0x050510,           // Near black
        lightRoughness: 0.2,
        darkRoughness: 0.3,
        lightMetalness: 0.8,
        darkMetalness: 0.8,
        clearcoat: 0.5,
        clearcoatRoughness: 0.1,
        frameMetalness: 0.9,
        frameRoughness: 0.1,
        lightEmissive: 0x00ffff,
        darkEmissive: 0xff00ff,
        emissiveIntensity: 0.3,
    },

    // =========================================================================
    // THEMED
    // =========================================================================

    newspaper: {
        id: 'newspaper',
        name: 'Newspaper Print',
        description: 'Classic newspaper diagram style',
        lightSquareColor: 0xf5f0e6,    // Newsprint cream
        darkSquareColor: 0xc8c0b0,     // Shaded squares
        frameColor: 0x1a1a1a,          // Black ink border
        baseColor: 0xe8e0d0,           // Paper color
        lightRoughness: 0.7,
        darkRoughness: 0.7,
        lightMetalness: 0.0,
        darkMetalness: 0.0,
        clearcoat: 0.0,
        clearcoatRoughness: 0.5,
        frameMetalness: 0.0,
        frameRoughness: 0.8,
    },

    ocean: {
        id: 'ocean',
        name: 'Ocean Depths',
        description: 'Deep blue & aqua marine theme',
        lightSquareColor: 0x88ccdd,    // Light aqua
        darkSquareColor: 0x1a4466,     // Deep ocean blue
        frameColor: 0xd4af37,          // Gold trim
        baseColor: 0x0a2233,           // Dark ocean
        lightRoughness: 0.2,
        darkRoughness: 0.25,
        lightMetalness: 0.1,
        darkMetalness: 0.1,
        clearcoat: 0.6,
        clearcoatRoughness: 0.1,
        frameMetalness: 0.85,
        frameRoughness: 0.15,
        lightEmissive: 0x2288aa,
        darkEmissive: 0x0a2244,
        emissiveIntensity: 0.08,
    },

    forest: {
        id: 'forest',
        name: 'Forest Grove',
        description: 'Natural greens & rich browns',
        lightSquareColor: 0xc8d8b8,    // Sage green
        darkSquareColor: 0x2a4020,     // Forest green
        frameColor: 0x5c4033,          // Wood brown
        baseColor: 0x1a2810,           // Dark moss
        lightRoughness: 0.4,
        darkRoughness: 0.45,
        lightMetalness: 0.0,
        darkMetalness: 0.0,
        clearcoat: 0.3,
        clearcoatRoughness: 0.2,
        frameMetalness: 0.0,
        frameRoughness: 0.4,
    },

    royal: {
        id: 'royal',
        name: 'Royal Purple',
        description: 'Purple velvet with gold accents',
        lightSquareColor: 0xe8d8f0,    // Light lavender
        darkSquareColor: 0x3a1a4a,     // Royal purple
        frameColor: 0xffd700,          // Pure gold
        baseColor: 0x1a0a2a,           // Deep purple
        lightRoughness: 0.35,
        darkRoughness: 0.5,           // Velvet texture
        lightMetalness: 0.0,
        darkMetalness: 0.0,
        clearcoat: 0.4,
        clearcoatRoughness: 0.15,
        frameMetalness: 0.95,
        frameRoughness: 0.08,
        lightEmissive: 0x8844aa,
        darkEmissive: 0x4422aa,
        emissiveIntensity: 0.05,
    },
};

// Ordered list for UI display
export const BOARD_STYLE_ORDER: string[] = [
    'classic',
    'tournament',
    'marble',
    'walnut',
    'ebony',
    'stone',
    'crystal',
    'neon',
    'newspaper',
    'ocean',
    'forest',
    'royal',
];

export function getBoardStyleConfig(styleId: string): BoardStyleConfig {
    return BOARD_STYLES[styleId] || BOARD_STYLES.classic;
}

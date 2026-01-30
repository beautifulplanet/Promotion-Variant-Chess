// src/pieceStyles.ts
// Configuration for 12 high-quality chess piece styles

export interface PieceStyleConfig {
    id: string;
    name: string;
    description: string;
    type: '2d' | '3d';
    // 3D style properties
    whiteColor?: number;
    blackColor?: number;
    whiteTrimColor?: number;
    blackTrimColor?: number;
    whiteEmissive?: number;
    blackEmissive?: number;
    emissiveIntensity?: number;
    roughness?: number;
    metalness?: number;
    // 2D style properties
    useSymbols?: boolean;      // Use unicode symbols (♔ ♚)
    fontFamily?: string;
    whiteTextColor?: string;
    blackTextColor?: string;
    backgroundColor?: string;
    spriteSheet?: string;      // Path to sprite sheet image (relative to public)
    spriteMap?: Record<string, number>; // Map piece type to index (0-5)
    // Special effects
    glowEffect?: boolean;
    crystalEffect?: boolean;
    wireframe?: boolean;
}

export const PIECE_STYLES: Record<string, PieceStyleConfig> = {
    // =========================================================================
    // 3D PIECE STYLES
    // =========================================================================

    staunton3d: {
        id: 'staunton3d',
        name: 'Staunton Classic',
        description: 'Tournament standard - polished ivory & ebony',
        type: '3d',
        whiteColor: 0xf8f0e8,      // Warm ivory
        blackColor: 0x1a1410,      // Rich ebony
        whiteTrimColor: 0xc0a060,  // Gold accents
        blackTrimColor: 0xd0d0d0,  // Silver accents
        whiteEmissive: 0xffffff,
        blackEmissive: 0x000000,
        emissiveIntensity: 0.05,
        roughness: 0.15,
        metalness: 0.0,
    },

    lewis3d: {
        id: 'lewis3d',
        name: 'Lewis Chessmen',
        description: 'Medieval Norse carved ivory figures',
        type: '3d',
        whiteColor: 0xf5e6c8,      // Aged ivory/bone
        blackColor: 0x8b4513,      // Walrus tusk brown
        whiteTrimColor: 0xd4b896,  // Natural bone
        blackTrimColor: 0x654321,  // Dark wood
        whiteEmissive: 0xffe4b5,
        blackEmissive: 0x3d2817,
        emissiveIntensity: 0.03,
        roughness: 0.6,           // Carved texture
        metalness: 0.0,
    },

    modern3d: {
        id: 'modern3d',
        name: 'Modern Minimal',
        description: 'Bauhaus-inspired geometric design',
        type: '3d',
        whiteColor: 0xffffff,      // Pure white
        blackColor: 0x1a1a1a,      // Pure black
        whiteTrimColor: 0x888888,  // Gray accent
        blackTrimColor: 0x666666,  // Gray accent
        whiteEmissive: 0x000000,
        blackEmissive: 0x000000,
        emissiveIntensity: 0.0,
        roughness: 0.05,          // Super smooth/polished
        metalness: 0.1,
    },

    fantasy3d: {
        id: 'fantasy3d',
        name: 'Crystal Fantasy',
        description: 'Glowing magical crystal pieces',
        type: '3d',
        whiteColor: 0xccddff,      // Ice blue
        blackColor: 0x330022,      // Dark purple
        whiteTrimColor: 0x4488ff,  // Blue glow
        blackTrimColor: 0xff4488,  // Pink glow
        whiteEmissive: 0x2244aa,
        blackEmissive: 0x882244,
        emissiveIntensity: 0.4,
        roughness: 0.2,
        metalness: 0.3,
        glowEffect: true,
        crystalEffect: true,
    },

    neon3d: {
        id: 'neon3d',
        name: 'Neon Cyberpunk',
        description: 'Futuristic neon-lit wireframe',
        type: '3d',
        whiteColor: 0x001122,      // Dark base
        blackColor: 0x110011,      // Dark base
        whiteTrimColor: 0x00ffff,  // Cyan neon
        blackTrimColor: 0xff00ff,  // Magenta neon
        whiteEmissive: 0x00ffff,
        blackEmissive: 0xff00ff,
        emissiveIntensity: 0.8,
        roughness: 0.1,
        metalness: 0.9,
        glowEffect: true,
    },

    marble3d: {
        id: 'marble3d',
        name: 'Italian Marble',
        description: 'Luxurious carved Carrara & Nero marble',
        type: '3d',
        whiteColor: 0xf0f0f5,      // White marble
        blackColor: 0x1a1a20,      // Black marble
        whiteTrimColor: 0xe0e0e8,  // Marble veins
        blackTrimColor: 0x2a2a30,  // Dark veins
        whiteEmissive: 0xffffff,
        blackEmissive: 0x000000,
        emissiveIntensity: 0.02,
        roughness: 0.1,           // Polished stone
        metalness: 0.0,
    },

    wooden3d: {
        id: 'wooden3d',
        name: 'Handcrafted Wood',
        description: 'Warm boxwood & rosewood finish',
        type: '3d',
        whiteColor: 0xdec89c,      // Light boxwood
        blackColor: 0x5c3a21,      // Dark rosewood
        whiteTrimColor: 0xc4a870,  // Wood grain
        blackTrimColor: 0x3d2517,  // Dark grain
        whiteEmissive: 0x806040,
        blackEmissive: 0x201008,
        emissiveIntensity: 0.02,
        roughness: 0.4,           // Natural wood
        metalness: 0.0,
    },

    // =========================================================================
    // 2D PIECE STYLES
    // =========================================================================

    staunton2d: {
        id: 'staunton2d',
        name: 'Staunton Diagram',
        description: 'Traditional 2D tournament diagrams',
        type: '2d',
        useSymbols: true,
        fontFamily: 'serif',
        whiteTextColor: '#1a1a1a',
        blackTextColor: '#1a1a1a',
        backgroundColor: '#f5f0e6',
    },

    lewis2d: {
        id: 'lewis2d',
        name: 'Lewis Illustrated',
        description: 'Medieval manuscript illustration style',
        type: '2d',
        useSymbols: true,
        fontFamily: '"Old English Text MT", serif',
        whiteTextColor: '#4a3520',
        blackTextColor: '#2a1810',
        backgroundColor: '#f0e4c8',
    },

    modern2d: {
        id: 'modern2d',
        name: 'Modern Line Art',
        description: 'Clean minimalist line drawings',
        type: '2d',
        useSymbols: true,
        fontFamily: 'Arial, sans-serif',
        whiteTextColor: '#333333',
        blackTextColor: '#111111',
        backgroundColor: '#ffffff',
    },

    fantasy2d: {
        id: 'fantasy2d',
        name: 'Fantasy Illustrated',
        description: 'Ornate fantasy-themed pieces',
        type: '2d',
        useSymbols: true,
        fontFamily: '"Papyrus", fantasy',
        whiteTextColor: '#4488ff',
        blackTextColor: '#ff4488',
        backgroundColor: '#1a1a2e',
    },

    newspaper2d: {
        id: 'newspaper2d',
        name: 'Newspaper Classic',
        description: 'Classic newspaper diagram symbols',
        type: '2d',
        useSymbols: true,
        fontFamily: '"Times New Roman", serif',
        whiteTextColor: '#1a1a1a',
        blackTextColor: '#1a1a1a',
        backgroundColor: '#f5f0e6',
    },

    neon2d: {
        id: 'neon2d',
        name: 'Neon Cyberpunk 2D',
        description: 'Glowing arcade style characters',
        type: '2d',
        useSymbols: true,
        fontFamily: '"Courier New", monospace',
        whiteTextColor: '#00ffff',  // Cyan
        blackTextColor: '#ff00ff',  // Magenta
        backgroundColor: '#000000', // Black arcade screen
    },

    marble2d: {
        id: 'marble2d',
        name: 'Marble Engraved',
        description: 'Classical serif on stone',
        type: '2d',
        useSymbols: true,
        fontFamily: '"Times New Roman", serif',
        whiteTextColor: '#555555',  // Engraved Stone
        blackTextColor: '#111111',  // Deep Carving
        backgroundColor: '#f2f2f2', // Pale Marble
    },

    wooden2d: {
        id: 'wooden2d',
        name: 'Woodcut Print',
        description: 'Traditional woodblock style',
        type: '2d',
        useSymbols: true,
        fontFamily: 'Georgia, serif',
        whiteTextColor: '#5c3a21',  // Dark Brown
        blackTextColor: '#3d2517',  // Deep Brown
        backgroundColor: '#eaddcf', // Light Wood/Paper
    },

    gameboy2d: {
        id: 'gameboy2d',
        name: 'Retro Handheld',
        description: 'Classic 8-bit green monochrome',
        type: '2d',
        useSymbols: true,
        fontFamily: '"Courier New", monospace',
        whiteTextColor: '#306230', // Medium Green (Light)
        blackTextColor: '#0f380f', // Darkest Green (Dark)
        backgroundColor: '#8bac0f', // LCD Green
    },

    blueprint2d: {
        id: 'blueprint2d',
        name: 'Architect Blueprint',
        description: 'Technical drawing style',
        type: '2d',
        useSymbols: true,
        fontFamily: '"Courier New", monospace',
        whiteTextColor: '#ffffff', // White Lines
        blackTextColor: '#e0e0e0', // Light Grey Lines
        backgroundColor: '#1c3f94', // Blueprint Blue
    },

    matrix2d: {
        id: 'matrix2d',
        name: 'Digital Rain',
        description: 'Hacker console style',
        type: '2d',
        useSymbols: true,
        fontFamily: 'monospace',
        whiteTextColor: '#00ff00', // Bright Green
        blackTextColor: '#008f11', // Darker Green
        backgroundColor: '#000000', // Black Console
    },

    graffiti2d: {
        id: 'graffiti2d',
        name: 'Street Art',
        description: 'Urban graffiti style',
        type: '2d',
        useSymbols: true,
        fontFamily: 'Impact, sans-serif',
        whiteTextColor: '#ff00ff', // Magenta
        blackTextColor: '#00ffff', // Cyan
        backgroundColor: '#333333', // Concrete
    },

    sketch2d: {
        id: 'sketch2d',
        name: 'Hand Drawn',
        description: 'Pencil sketch on paper',
        type: '2d',
        useSymbols: true,
        fontFamily: '"Comic Sans MS", "Chalkboard SE", sans-serif',
        whiteTextColor: '#2f4f4f', // Charcoal
        blackTextColor: '#1a1a1a', // Darker Charcoal
        backgroundColor: '#fffcec', // Paper
    },

    bold2d: {
        id: 'bold2d',
        name: 'Bold Geometric',
        description: 'High contrast modern shapes',
        type: '2d',
        useSymbols: true,
        fontFamily: 'Verdana, sans-serif',
        whiteTextColor: '#000000', // Crisp Black
        blackTextColor: '#000000', // Crisp Black
        backgroundColor: '#ffffff', // Pure White
    },
};

// Ordered list for UI display
export const PIECE_STYLE_ORDER: string[] = [
    'staunton3d',
    'staunton2d',
    'lewis3d',
    'lewis2d',
    'modern3d',
    'modern2d',
    'fantasy3d',
    'fantasy2d',
    'neon3d',
    'neon2d',
    'newspaper2d',
    'marble3d',
    'marble2d',
    'wooden3d',
    'wooden2d',
    'gameboy2d',
    'blueprint2d',
    'matrix2d',
    'graffiti2d',
    'sketch2d',
    'bold2d',
];

export function getPieceStyleConfig(styleId: string): PieceStyleConfig {
    return PIECE_STYLES[styleId] || PIECE_STYLES.staunton3d;
}

export function is2DPieceStyle(styleId: string): boolean {
    const config = PIECE_STYLES[styleId];
    return config ? config.type === '2d' : false;
}

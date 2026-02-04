// src/pieceStyles.ts
// Chess piece style configurations
// 
// 2D styles use canvas-drawn SVG-style pieces (no external files needed)
// 3D styles use procedural geometry
// Sprite styles use external sprite sheet images

export interface PieceStyleConfig {
    id: string;
    name: string;
    description: string;
    type: '2d' | '3d';
    // 3D properties
    whiteColor?: number;
    blackColor?: number;
    whiteTrimColor?: number;
    blackTrimColor?: number;
    whiteEmissive?: number;
    blackEmissive?: number;
    emissiveIntensity?: number;
    roughness?: number;
    metalness?: number;
    glowEffect?: boolean;
    // 2D properties - canvas drawing style
    drawStyle?: 'classic' | 'modern' | 'staunton' | 'symbols' | 'newspaper' | 'outline' | 'figurine' | 'pixel' | 'gothic' | 'minimalist' | 'celtic' | 'sketch' | 'pharaoh';
    // Sprite sheet properties (for image-based 2D styles)
    spriteSheet?: string;  // Path to sprite sheet image
    spriteLayout?: 'standard';  // Layout format: 'standard' = 2 rows (white/black) x 6 cols (K,Q,R,B,N,P)
}

// =============================================================================
// 3D STYLES (procedural geometry - all work)
// =============================================================================
const STYLES_3D: Record<string, PieceStyleConfig> = {
    staunton3d: {
        id: 'staunton3d',
        name: 'Staunton Classic',
        description: 'Tournament standard',
        type: '3d',
        whiteColor: 0xf8f0e8,
        blackColor: 0x1a1410,
        whiteTrimColor: 0xc0a060,
        blackTrimColor: 0xd0d0d0,
        whiteEmissive: 0xffffff,
        blackEmissive: 0x000000,
        emissiveIntensity: 0.05,
        roughness: 0.15,
        metalness: 0.0,
    },
    lewis3d: {
        id: 'lewis3d',
        name: 'Lewis Chessmen',
        description: 'Medieval Norse carved',
        type: '3d',
        whiteColor: 0xf5e6c8,
        blackColor: 0x8b4513,
        whiteTrimColor: 0xd4b896,
        blackTrimColor: 0x654321,
        whiteEmissive: 0xffe4b5,
        blackEmissive: 0x3d2817,
        emissiveIntensity: 0.03,
        roughness: 0.6,
        metalness: 0.0,
    },
    modern3d: {
        id: 'modern3d',
        name: 'Modern Minimal',
        description: 'Bauhaus geometric',
        type: '3d',
        whiteColor: 0xffffff,
        blackColor: 0x1a1a1a,
        whiteTrimColor: 0x888888,
        blackTrimColor: 0x666666,
        whiteEmissive: 0x000000,
        blackEmissive: 0x000000,
        emissiveIntensity: 0.0,
        roughness: 0.05,
        metalness: 0.1,
    },
    fantasy3d: {
        id: 'fantasy3d',
        name: 'Crystal Fantasy',
        description: 'Glowing crystal pieces',
        type: '3d',
        whiteColor: 0xccddff,
        blackColor: 0x330022,
        whiteTrimColor: 0x4488ff,
        blackTrimColor: 0xff4488,
        whiteEmissive: 0x2244aa,
        blackEmissive: 0x882244,
        emissiveIntensity: 0.4,
        roughness: 0.2,
        metalness: 0.3,
        glowEffect: true,
    },
    neon3d: {
        id: 'neon3d',
        name: 'Neon Cyberpunk',
        description: 'Futuristic neon',
        type: '3d',
        whiteColor: 0x001122,
        blackColor: 0x110011,
        whiteTrimColor: 0x00ffff,
        blackTrimColor: 0xff00ff,
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
        description: 'Carrara & Nero marble',
        type: '3d',
        whiteColor: 0xf0f0f5,
        blackColor: 0x1a1a20,
        whiteTrimColor: 0xe0e0e8,
        blackTrimColor: 0x2a2a30,
        whiteEmissive: 0xffffff,
        blackEmissive: 0x000000,
        emissiveIntensity: 0.02,
        roughness: 0.1,
        metalness: 0.0,
    },
    wooden3d: {
        id: 'wooden3d',
        name: 'Handcrafted Wood',
        description: 'Boxwood & rosewood',
        type: '3d',
        whiteColor: 0xdec89c,
        blackColor: 0x5c3a21,
        whiteTrimColor: 0xc4a870,
        blackTrimColor: 0x3d2517,
        whiteEmissive: 0x806040,
        blackEmissive: 0x201008,
        emissiveIntensity: 0.02,
        roughness: 0.4,
        metalness: 0.0,
    },
};

// =============================================================================
// 2D STYLES (canvas-drawn - no external files needed)
// =============================================================================
const STYLES_2D: Record<string, PieceStyleConfig> = {
    classic2d: {
        id: 'classic2d',
        name: 'Classic',
        description: 'Traditional silhouettes',
        type: '2d',
        drawStyle: 'classic',
    },
    staunton2d: {
        id: 'staunton2d',
        name: 'Staunton 2D',
        description: 'Tournament style flat',
        type: '2d',
        drawStyle: 'staunton',
    },
    modern2d: {
        id: 'modern2d',
        name: 'Modern Minimal',
        description: 'Clean geometric shapes',
        type: '2d',
        drawStyle: 'modern',
    },
    symbols2d: {
        id: 'symbols2d',
        name: 'Unicode Symbols',
        description: 'Chess font symbols',
        type: '2d',
        drawStyle: 'symbols',
    },
    newspaper2d: {
        id: 'newspaper2d',
        name: 'Newspaper',
        description: 'Classic newspaper diagram style',
        type: '2d',
        drawStyle: 'newspaper',
    },
    outline2d: {
        id: 'outline2d',
        name: 'Outline',
        description: 'Simple outlined silhouettes',
        type: '2d',
        drawStyle: 'outline',
    },
    figurine2d: {
        id: 'figurine2d',
        name: 'Figurine',
        description: 'Algebraic notation style',
        type: '2d',
        drawStyle: 'figurine',
    },
    pixel2d: {
        id: 'pixel2d',
        name: 'Pixel Art',
        description: '8-bit retro game style',
        type: '2d',
        drawStyle: 'pixel',
    },
    gothic2d: {
        id: 'gothic2d',
        name: 'Gothic',
        description: 'Dark medieval ornate',
        type: '2d',
        drawStyle: 'gothic',
    },
    minimalist2d: {
        id: 'minimalist2d',
        name: 'Minimalist',
        description: 'Ultra simple geometric',
        type: '2d',
        drawStyle: 'minimalist',
    },
    celtic2d: {
        id: 'celtic2d',
        name: 'Celtic Knot',
        description: 'Interlaced Celtic design',
        type: '2d',
        drawStyle: 'celtic',
    },
    sketch2d: {
        id: 'sketch2d',
        name: 'Hand Sketch',
        description: 'Pencil drawn style',
        type: '2d',
        drawStyle: 'sketch',
    },
    pharaoh2d: {
        id: 'pharaoh2d',
        name: 'Pharaoh',
        description: 'Ancient Egyptian sprite set',
        type: '2d',
        spriteSheet: '/assets/pieces/Pharoh Set.png',
        spriteLayout: 'standard',
    },
};

// =============================================================================
// COMBINED EXPORTS
// =============================================================================
export const PIECE_STYLES: Record<string, PieceStyleConfig> = {
    ...STYLES_3D,
    ...STYLES_2D,
};

// Separate lists for UI
export const STYLES_3D_ORDER: string[] = Object.keys(STYLES_3D);
export const STYLES_2D_ORDER: string[] = Object.keys(STYLES_2D);

// Combined order (legacy)
export const PIECE_STYLE_ORDER: string[] = [
    ...STYLES_3D_ORDER,
    ...STYLES_2D_ORDER,
];

export function getPieceStyleConfig(styleId: string): PieceStyleConfig {
    return PIECE_STYLES[styleId] || PIECE_STYLES.staunton3d;
}

export function is2DPieceStyle(styleId: string): boolean {
    const config = PIECE_STYLES[styleId];
    return config ? config.type === '2d' : false;
}

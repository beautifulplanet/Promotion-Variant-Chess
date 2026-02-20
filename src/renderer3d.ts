// src/renderer3d.ts
// 3D Ribbon World Renderer - ELO-Based Procedural Era System
// 2026 Studio Quality with procedural skybox, dynamic lighting, and wormhole transitions

import * as THREE from 'three';
import type { Piece } from './types';
import type { Move } from './engineProvider';
import { TILE_SIZE, BOARD_SIZE } from './constants';
import {
    EraConfig,
    getEraForElo,
    getEraProgress,
    getRibbonSpeed,
    getFogDensity,
    checkEraTransition,
} from './eraSystem';
import { ProceduralSkybox, WormholeTransition } from './proceduralSkybox';
import { DynamicLighting } from './dynamicLighting';
import { createEraEnvironment, updateEraEnvironment, setAssetDensityScale as setEraAssetDensityScale, setParticleDensityScale as setEraParticleDensityScale } from './eraWorlds';
import { getPieceStyleConfig, is2DPieceStyle, PIECE_STYLE_ORDER, STYLES_3D_ORDER, STYLES_2D_ORDER, type PieceStyleConfig } from './pieceStyles';
import { getBoardStyleConfig, BOARD_STYLE_ORDER, type BoardStyleConfig } from './boardStyles';
import { getPieceImage } from './pieces';

// =============================================================================
// RENDERER STATE
// =============================================================================

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let canvas: HTMLCanvasElement;
let basePixelRatio = 1;
let renderScale = 1.0;  // Start at full quality
let autoFpsEnabled = false;  // Disable auto-FPS reduction by default
let targetFps = 60;
let fixedTimestepEnabled = false;
let fixedFps = 60;
let animQuality = 3;
let fixedAccumulator = 0;
let travelSpeedScale = 1.6;

// Scene groups
let boardGroup: THREE.Group;
let piecesGroup: THREE.Group;
let environmentGroup: THREE.Group;
let uiGroup: THREE.Group;

// New procedural systems
let proceduralSkybox: ProceduralSkybox;
let wormholeTransition: WormholeTransition;
let dynamicLighting: DynamicLighting;

// Camera state
export type ViewMode = 'pan' | 'play';
let currentViewMode: ViewMode = 'play';

// Orbit camera state for pan mode
let orbitRadius = 15;
let orbitTheta = 0;
let orbitPhi = Math.PI / 4;
let orbitTarget = new THREE.Vector3(0, 0, 0);

// Mouse/touch state for camera control
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let lastMouseX = 0;
let lastMouseY = 0;
let isTouchDevice = false;
let pinchStartDist = 0;

// ELO-based era state
let currentElo: number = 400;
let previousElo: number = 400;
let scrollOffset = 0;

// Animation state
let isAnimating = false;
let animationId: number | null = null;
let lastTime = 0;

// FPS tracking (actual render loop)
let fpsFrameCount = 0;
let fpsLastUpdate = 0;
let currentFPS = 0;

// Cached game state
let cachedBoard: (Piece | null)[][] = [];
let cachedSelectedSquare: { row: number; col: number } | null = null;
let cachedLegalMoves: Move[] = [];
let cachedTurn: 'white' | 'black' = 'white';
let cachedInCheck: boolean = false;
let cachedPlayerColor: 'white' | 'black' = 'white';
let viewFlipped: boolean = false; // User-toggled flip that persists across state updates

// =============================================================================
// DEBUG TOGGLES (Performance/Asset control)
// =============================================================================

let envEnabled = true;
let particlesEnabled = true;
let skyboxEnabled = true;
let lightingEnabled = true;
let shadowsEnabled = false;  // PERFORMANCE: Shadows disabled by default
let envAnimEnabled = true;   // Re-enabled for scrolling world
let wormholeEnabled = true;
let motionScale = 1;

// Constants for 3D layout
const BOARD_UNIT = 1;
const BOARD_WIDTH = 8 * BOARD_UNIT;
const BOARD_LENGTH = 8 * BOARD_UNIT;

// Colors for 3D materials (mutable — updated by setBoardStyle)
let COLORS_3D = {
    lightSquare: 0xf0e8dc,       // Classic wood ivory (matches classic board)
    darkSquare: 0x3a2820,        // Classic wood mahogany
    selectedSquare: 0xc8a86c,    // Warm amber (no more clown green)
    legalMoveHighlight: 0xb89858, // Muted gold
    boardEdge: 0x2a2a2a,
};

// Helper function to get visual color based on player perspective
function getVisualColor(pieceColor: 'white' | 'black'): 'white' | 'black' {
    // If player is white, show pieces as their logical color
    // If player is black, invert colors so player's pieces appear white
    return cachedPlayerColor === 'white' ? pieceColor : (pieceColor === 'white' ? 'black' : 'white');
}

// Callbacks
let onWorldChangeCallback: ((eraName: string) => void) | null = null;
let onEraTransitionCallback: ((fromEra: EraConfig, toEra: EraConfig) => void) | null = null;
let onSquareClickCallback: ((row: number, col: number) => void) | null = null;

// 2D Overhead Mode - Newspaper-style chess symbols
let is2DMode = false;
let pieceSpritesCache: Map<string, THREE.SpriteMaterial> = new Map();
const OVERHEAD_THRESHOLD = 0.35; // Switch to 2D when camera angle < this (radians from vertical)

// Piece Style System - Separate 2D and 3D styles
export type PieceStyle = string;
let current3DStyle: string = 'staunton3d';
let current2DStyle: string = 'classic2d';
let currentPieceStyle: PieceStyle = 'staunton3d';  // Active style (switches based on mode)
let currentPieceStyleConfig: PieceStyleConfig = getPieceStyleConfig('staunton3d');

// Board Style System - 12 unique themes
export type BoardStyle = 'classic' | 'tournament' | 'marble' | 'walnut' | 'ebony' | 'stone' |
    'crystal' | 'neon' | 'newspaper' | 'ocean' | 'forest' | 'royal';
let currentBoardStyle: BoardStyle = 'classic';
let currentBoardStyleConfig: BoardStyleConfig = getBoardStyleConfig('classic');

// PBR Environment Map for realistic reflections
let envMap: THREE.Texture | null = null;
let pmremGenerator: THREE.PMREMGenerator | null = null;

// =============================================================================
// INITIALIZATION
// =============================================================================

export function initRenderer(canvasElement: HTMLCanvasElement): void {
    canvas = canvasElement;
    console.log('[Renderer3D] Canvas dimensions:', canvas.width, 'x', canvas.height);

    // Clear any cached sprites from previous session
    pieceSpritesCache.clear();

    // Create scene
    scene = new THREE.Scene();
    console.log('[Renderer3D] Scene created');

    // Create camera
    camera = new THREE.PerspectiveCamera(
        60,
        canvas.width / canvas.height,
        0.1,
        1000
    );
    console.log('[Renderer3D] Camera created');

    // Create WebGL renderer with settings adapted for desktop/mobile
    const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768;
    try {
        renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: !isMobileDevice,  // Disable on mobile for performance
            alpha: false,
            powerPreference: isMobileDevice ? 'default' : 'high-performance',
            precision: 'mediump',
            stencil: false,
            logarithmicDepthBuffer: false,
        });
    } catch (e) {
        console.error('[Renderer3D] WebGL initialization failed:', e);
        // Show user-friendly fallback message
        const fallbackMsg = document.createElement('div');
        fallbackMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a1a1a;color:#fff;padding:40px;border-radius:12px;text-align:center;font-family:sans-serif;z-index:9999;';
        fallbackMsg.innerHTML = `
            <h2 style="color:#ff6b6b;margin:0 0 16px 0;">WebGL Not Supported</h2>
            <p style="margin:0 0 12px 0;">Your browser or device doesn't support WebGL, which is required for 3D graphics.</p>
            <p style="margin:0;color:#888;">Try using Chrome, Firefox, or Edge on a desktop computer.</p>
        `;
        document.body.appendChild(fallbackMsg);
        return; // Exit init gracefully
    }
    console.log('[Renderer3D] WebGL renderer created');

    // Catch WebGL context loss to avoid silent white screens
    canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        console.error('[Renderer3D] WebGL context lost');
        alert('WebGL context lost. Please reload the page.');
    });

    renderer.setSize(canvas.width, canvas.height);
    basePixelRatio = Math.min(window.devicePixelRatio, 1.5); // Balanced quality/performance
    renderer.setPixelRatio(basePixelRatio);

    // OPTIMIZED SHADOW SETTINGS - Disabled by default for performance
    renderer.shadowMap.enabled = false;  // PERFORMANCE: Start with shadows off
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;  // Better quality than BasicShadowMap
    renderer.shadowMap.autoUpdate = false;  // Manual control - update only when pieces move

    // ADVANCED TONE MAPPING - Cinematic look
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Create scene groups
    boardGroup = new THREE.Group();
    piecesGroup = new THREE.Group();
    environmentGroup = new THREE.Group();
    uiGroup = new THREE.Group();

    scene.add(boardGroup);
    scene.add(piecesGroup);
    scene.add(environmentGroup);
    scene.add(uiGroup);

    // Effects group for capture/dust animations (lives outside piecesGroup)
    effectsGroup = new THREE.Group();
    effectsGroup.name = 'effectsGroup';
    scene.add(effectsGroup);

    // ==========================================================================
    // PBR ENVIRONMENT MAP SETUP - Critical for realistic reflections
    // ==========================================================================
    pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    // Create a procedural environment for PBR reflections
    createPBREnvironment();

    // Initialize procedural systems
    proceduralSkybox = new ProceduralSkybox();
    scene.add(proceduralSkybox.getMesh());

    wormholeTransition = new WormholeTransition();
    uiGroup.add(wormholeTransition.getMesh());

    dynamicLighting = new DynamicLighting(scene);

    // Apply initial era settings
    updateEraForElo(currentElo, true);

    // Sync COLORS_3D from initial board style (prevents stale defaults)
    COLORS_3D.lightSquare = currentBoardStyleConfig.lightSquareColor;
    COLORS_3D.darkSquare = currentBoardStyleConfig.darkSquareColor;
    COLORS_3D.selectedSquare = currentBoardStyleConfig.selectedSquareColor ?? 0xc8a86c;
    COLORS_3D.legalMoveHighlight = currentBoardStyleConfig.legalMoveColor ?? 0xb89858;

    // Create the chess board
    createBoard();

    // Setup camera controls
    setupCameraControls();

    // Setup click handling for square selection
    setupClickHandler();

    // Setup responsive resize
    setupResize();

    // Set initial camera position
    updateCameraPosition();

    // Start render loop
    startRenderLoop();

    // Detect mobile and adjust quality
    detectMobileAndOptimize();

    console.log('[Renderer3D] Initialized - ELO-Based Era System with PBR');
    console.log('[Renderer3D] Current Era:', getEraForElo(currentElo).name);
}

// =============================================================================
// RESPONSIVE CANVAS RESIZE
// =============================================================================

let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

function setupResize(): void {
    const handleResize = () => {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(doResize, 100);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => setTimeout(handleResize, 200));
    // Initial size
    doResize();
}

function doResize(): void {
    if (!canvas || !renderer || !camera) return;

    const wrapper = canvas.parentElement;
    if (!wrapper) return;

    // Get available space — wrapper fills the game area via flex
    const gameArea = wrapper.parentElement;
    const availWidth = gameArea?.clientWidth || window.innerWidth;
    const availHeight = gameArea?.clientHeight || window.innerHeight;

    // On mobile, use nearly full viewport; on desktop, fill game area
    const isMobile = window.innerWidth < 768;
    const width = Math.floor(isMobile ? availWidth - 6 : availWidth - 6);
    // Keep aspect ratio ~2:1 for the chess board but fill height
    const height = Math.floor(isMobile ? width * 0.6 : availHeight - 6);

    // Update canvas HTML attributes (drawing buffer)
    const dpr = Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    // Update canvas CSS size
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    // Update overlay canvas if it exists
    const overlayCanvas = document.getElementById('overlay-canvas') as HTMLCanvasElement | null;
    if (overlayCanvas) {
        overlayCanvas.width = Math.floor(width * dpr);
        overlayCanvas.height = Math.floor(height * dpr);
        overlayCanvas.style.width = width + 'px';
        overlayCanvas.style.height = height + 'px';
    }

    // Update wrapper size
    wrapper.style.width = width + 'px';
    wrapper.style.height = height + 'px';

    // Update Three.js renderer and camera
    renderer.setSize(width, height);
    renderer.setPixelRatio(dpr);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // Invalidate caches
    _cachedSquares = null;

    console.log('[Renderer3D] Resized to', width, 'x', height, '@ DPR', dpr.toFixed(1));
}

export function getCanvasSize(): { width: number; height: number } {
    return { width: canvas?.clientWidth || 1150, height: canvas?.clientHeight || 550 };
}

// =============================================================================
// MOBILE PERFORMANCE DETECTION
// =============================================================================

function detectMobileAndOptimize(): void {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768;
    if (isMobile) {
        console.log('[Renderer3D] Mobile detected — optimizing performance');
        // Disable expensive features on mobile
        renderer.shadowMap.enabled = false;
        shadowsEnabled = false;
        // Lower pixel ratio for performance
        const mobileDpr = Math.min(window.devicePixelRatio, 1.5);
        renderer.setPixelRatio(mobileDpr);
        // Disable antialias can't be done after init, but we can reduce tonemap exposure
        renderer.toneMappingExposure = 1.0;
    }
}

// =============================================================================
// PBR ENVIRONMENT MAP
// =============================================================================

/**
 * Create procedural PBR environment map for realistic reflections
 * This gives materials something to reflect - critical for PBR to look realistic
 */
function createPBREnvironment(): void {
    try {
        if (!pmremGenerator || !scene) {
            console.warn('[Renderer3D] PBR environment skipped - renderer not ready');
            return;
        }

        // Create a render target scene for the environment
        const envScene = new THREE.Scene();

        // Create gradient sky dome for reflections
        const skyGeometry = new THREE.SphereGeometry(500, 16, 16);
        const skyMaterial = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x5090c0) },     // Sky blue
                bottomColor: { value: new THREE.Color(0x90b8a8) },  // Soft green ground
                horizonColor: { value: new THREE.Color(0x80a8b8) }, // Soft gray horizon (NO YELLOW)
                sunColor: { value: new THREE.Color(0xffffff) },     // White sun (NO YELLOW)
                sunPosition: { value: new THREE.Vector3(0.5, 0.3, 0.8).normalize() },
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform vec3 horizonColor;
                uniform vec3 sunColor;
                uniform vec3 sunPosition;
                varying vec3 vWorldPosition;
                
                void main() {
                    vec3 direction = normalize(vWorldPosition);
                    float y = direction.y;
                
                // Sky gradient
                vec3 color;
                if (y > 0.0) {
                    // Above horizon: blend from horizon to top
                    float t = pow(y, 0.5);
                    color = mix(horizonColor, topColor, t);
                } else {
                    // Below horizon: blend from horizon to ground
                    float t = pow(-y, 0.7);
                    color = mix(horizonColor, bottomColor, t);
                }
                
                // Sun glow
                float sunDot = max(0.0, dot(direction, sunPosition));
                float sunGlow = pow(sunDot, 32.0) * 2.0;
                float sunHalo = pow(sunDot, 4.0) * 0.5;
                color += sunColor * (sunGlow + sunHalo);
                
                // Subtle ambient occlusion near horizon
                float ao = 1.0 - pow(1.0 - abs(y), 3.0) * 0.2;
                color *= ao;
                
                gl_FragColor = vec4(color, 1.0);
            }
        `,
            side: THREE.BackSide,
        });

        const sky = new THREE.Mesh(skyGeometry, skyMaterial);
        envScene.add(sky);

        // Add some subtle ambient light sources for reflection
        const ambientCube = new THREE.Mesh(
            new THREE.BoxGeometry(100, 100, 100),
            new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.02,
                side: THREE.BackSide,
            })
        );
        envScene.add(ambientCube);

        // Generate PMREM from the environment scene
        if (pmremGenerator) {
            const renderTarget = pmremGenerator.fromScene(envScene, 0.04);
            envMap = renderTarget.texture;

            // Apply to scene for all materials to use
            scene.environment = envMap;

            console.log('[Renderer3D] PBR environment map created');
        }
    } catch (err) {
        console.error('[Renderer3D] Failed to create PBR environment:', err);
    }
}

/**
 * Update PBR environment colors based on era
 */
export function updatePBREnvironment(era: EraConfig): void {
    try {
        // Recreate environment with new era colors
        if (pmremGenerator) {
            const envScene = new THREE.Scene();

            const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
            const skyMaterial = new THREE.ShaderMaterial({
                uniforms: {
                    topColor: { value: new THREE.Color(era.skyTopColor) },
                    bottomColor: { value: new THREE.Color(era.skyBottomColor) },
                    horizonColor: { value: new THREE.Color(era.fogColor) },
                    sunColor: { value: new THREE.Color(era.sunColor) },
                    sunPosition: { value: new THREE.Vector3(0.5, 0.3, 0.8).normalize() },
                },
                vertexShader: `
                    varying vec3 vWorldPosition;
                    void main() {
                        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                        vWorldPosition = worldPosition.xyz;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform vec3 topColor;
                    uniform vec3 bottomColor;
                    uniform vec3 horizonColor;
                    uniform vec3 sunColor;
                    uniform vec3 sunPosition;
                    varying vec3 vWorldPosition;
                    
                    void main() {
                        vec3 direction = normalize(vWorldPosition);
                        float y = direction.y;
                        
                        vec3 color;
                        if (y > 0.0) {
                            float t = pow(y, 0.5);
                            color = mix(horizonColor, topColor, t);
                        } else {
                            float t = pow(-y, 0.7);
                            color = mix(horizonColor, bottomColor, t);
                        }
                        
                        float sunDot = max(0.0, dot(direction, sunPosition));
                        float sunGlow = pow(sunDot, 32.0) * 2.0;
                        float sunHalo = pow(sunDot, 4.0) * 0.5;
                        color += sunColor * (sunGlow + sunHalo);
                        
                        gl_FragColor = vec4(color, 1.0);
                    }
                `,
                side: THREE.BackSide,
            });

            const sky = new THREE.Mesh(skyGeometry, skyMaterial);
            envScene.add(sky);

            const renderTarget = pmremGenerator.fromScene(envScene, 0.04);
            envMap = renderTarget.texture;
            scene.environment = envMap;
        }
    } catch (err) {
        console.error('[Renderer3D] Failed to update PBR environment:', err);
    }
}

// =============================================================================
// ERA SYSTEM INTEGRATION
// =============================================================================

// PERFORMANCE: Throttle era updates and environment regeneration
let _lastEraId: number = -1;
let _lastEnvRegenElo: number = -1;

/**
 * Update all systems for new ELO value
 */
export function updateEraForElo(elo: number, instant: boolean = false): void {
    previousElo = currentElo;
    currentElo = elo;

    const era = getEraForElo(elo);
    const progress = getEraProgress(elo);

    // PERFORMANCE: Skip if era hasn't changed (unless instant/forced)
    const eraChanged = era.id !== _lastEraId;
    _lastEraId = era.id;

    // Check for era transition
    const transition = checkEraTransition(previousElo, elo);
    if (transition && !instant) {
        // Trigger wormhole transition
        wormholeTransition.startTransition(
            transition.fromEra,
            transition.toEra,
            () => {
                // Callback when transition completes
                regenerateEnvironment();
                // Update PBR environment for new era
                updatePBREnvironment(transition.toEra);
            }
        );

        if (onEraTransitionCallback) {
            onEraTransitionCallback(transition.fromEra, transition.toEra);
        }
    }

    // Update procedural skybox (only if era changed or instant)
    if (eraChanged || instant) {
        if (skyboxEnabled) {
            proceduralSkybox.updateForElo(elo, instant);
        }
        if (lightingEnabled) {
            dynamicLighting.updateForElo(elo, instant);
        }
        updateFog(era, progress);
    }

    // Regenerate environment only if era changed or instant
    if ((instant || !transition) && eraChanged) {
        regenerateEnvironment();
        updatePBREnvironment(era);
    }

    // Notify UI (only on era change)
    if (eraChanged && onWorldChangeCallback) {
        onWorldChangeCallback(era.name);
    }
}

/**
 * Regenerate environment assets for current ELO
 */
function regenerateEnvironment(): void {
    createEraEnvironment(currentElo, environmentGroup, scrollOffset);
    applyParticleVisibility();
    _cullableMeshes = []; // PERF: Clear cached array so it repopulates on next cull pass
}

// PERFORMANCE: Reusable fog object
let _sceneFog: THREE.Fog | null = null;

/**
 * Update fog settings for current era
 */
function updateFog(era: EraConfig, progress: number): void {
    const fogDensity = getFogDensity(currentElo);
    const fogNear = era.fogNearBase * (1 - fogDensity * 0.3);
    const fogFar = era.fogFarBase * (1 - fogDensity * 0.2);

    // PERFORMANCE: Reuse fog object instead of creating new one
    if (!_sceneFog) {
        _sceneFog = new THREE.Fog(era.fogColor, fogNear, fogFar);
        scene.fog = _sceneFog;
    } else {
        _sceneFog.color.setHex(era.fogColor);
        _sceneFog.near = fogNear;
        _sceneFog.far = fogFar;
    }
}

// =============================================================================
// BOARD CREATION
// =============================================================================

function createBoard(): void {
    // Clear existing board
    while (boardGroup.children.length > 0) {
        boardGroup.remove(boardGroup.children[0]);
    }

    // PERFORMANCE: Invalidate cached squares
    _cachedSquares = null;

    const style = currentBoardStyleConfig;

    // Create board base with optimized materials - using current board style
    const baseGeometry = new THREE.BoxGeometry(BOARD_WIDTH + 0.8, 0.35, BOARD_LENGTH + 0.8);
    const baseMaterial = new THREE.MeshStandardMaterial({
        color: style.baseColor,
        roughness: style.frameRoughness + 0.1,
        metalness: style.frameMetalness * 0.2,
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = -0.175;
    base.receiveShadow = true;
    base.castShadow = false;
    boardGroup.add(base);

    // Add decorative border/frame
    const frameGeometry = new THREE.BoxGeometry(BOARD_WIDTH + 0.9, 0.08, BOARD_LENGTH + 0.9);
    const frameMaterial = new THREE.MeshStandardMaterial({
        color: style.frameColor,
        roughness: style.frameRoughness,
        metalness: style.frameMetalness,
        emissive: style.lightEmissive || 0x000000,
        emissiveIntensity: (style.emissiveIntensity || 0) * 0.3,
    });
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    frame.position.y = 0.02;
    frame.receiveShadow = true;
    boardGroup.add(frame);

    // Create board squares with ADVANCED PBR materials using board style
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const isLight = (row + col) % 2 === 0;

            const geometry = new THREE.BoxGeometry(BOARD_UNIT * 0.98, 0.10, BOARD_UNIT * 0.98);
            const materialProps: any = {
                color: isLight ? style.lightSquareColor : style.darkSquareColor,
                roughness: isLight ? style.lightRoughness : style.darkRoughness,
                metalness: isLight ? style.lightMetalness : style.darkMetalness,
            };

            // Add emissive properties for glowing boards
            if (style.emissiveIntensity && style.emissiveIntensity > 0) {
                materialProps.emissive = isLight ? (style.lightEmissive || 0) : (style.darkEmissive || 0);
                materialProps.emissiveIntensity = style.emissiveIntensity;
            }

            // Add transparency for crystal-style boards
            if (style.transparent) {
                materialProps.transparent = true;
                materialProps.opacity = style.opacity || 0.9;
            }

            const material = new THREE.MeshStandardMaterial(materialProps);

            const square = new THREE.Mesh(geometry, material);
            square.position.set(
                col * BOARD_UNIT - BOARD_WIDTH / 2 + BOARD_UNIT / 2,
                0.07,
                row * BOARD_UNIT - BOARD_LENGTH / 2 + BOARD_UNIT / 2
            );
            square.receiveShadow = true;
            square.castShadow = false;
            square.userData = { row, col, type: 'square' };

            boardGroup.add(square);
        }
    }

    // Create ribbon extensions
    createRibbonExtensions();
}


function createRibbonExtensions(): void {
    const style = currentBoardStyleConfig;

    // Create infinite path extending forward and backward
    const pathLength = 500; // Very long path for infinite look
    const pathWidth = BOARD_WIDTH + 0.4;

    // Forward infinite path (into the distance)
    const forwardPathGeo = new THREE.PlaneGeometry(pathWidth, pathLength);
    const forwardPathMat = new THREE.MeshStandardMaterial({
        color: style.baseColor || 0x1a1a2a,
        roughness: 0.7,
        metalness: 0.2,
        transparent: true,
        opacity: 0.85,
    });
    const forwardPath = new THREE.Mesh(forwardPathGeo, forwardPathMat);
    forwardPath.rotation.x = -Math.PI / 2;
    forwardPath.position.set(0, -0.17, -pathLength / 2 - BOARD_LENGTH / 2);
    forwardPath.receiveShadow = true;
    boardGroup.add(forwardPath);

    // Backward infinite path (behind the player)
    const backwardPath = new THREE.Mesh(forwardPathGeo.clone(), forwardPathMat.clone());
    backwardPath.rotation.x = -Math.PI / 2;
    backwardPath.position.set(0, -0.17, pathLength / 2 + BOARD_LENGTH / 2);
    backwardPath.receiveShadow = true;
    boardGroup.add(backwardPath);

    // Add faded checker pattern on the paths for continuity
    const extensionCount = 12;
    for (let ext = 1; ext <= extensionCount; ext++) {
        const distanceFactor = ext / extensionCount;
        const opacity = Math.max(0.08, 0.5 - distanceFactor * 0.4);

        // Forward faded boards
        createFadedBoard(-ext * BOARD_LENGTH, opacity, style);

        // Backward faded boards  
        createFadedBoard(ext * BOARD_LENGTH, opacity, style);
    }

    // Add edge lines for the infinite path look
    const lineMat = new THREE.LineBasicMaterial({
        color: style.frameColor || 0x4a4a6a,
        transparent: true,
        opacity: 0.4
    });

    // Left edge line
    const leftLineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-pathWidth / 2, -0.1, -pathLength),
        new THREE.Vector3(-pathWidth / 2, -0.1, pathLength)
    ]);
    const leftLine = new THREE.Line(leftLineGeo, lineMat);
    boardGroup.add(leftLine);

    // Right edge line
    const rightLineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(pathWidth / 2, -0.1, -pathLength),
        new THREE.Vector3(pathWidth / 2, -0.1, pathLength)
    ]);
    const rightLine = new THREE.Line(rightLineGeo, lineMat);
    boardGroup.add(rightLine);
}

function createFadedBoard(zOffset: number, opacity: number, style?: BoardStyleConfig): void {
    const group = new THREE.Group();
    const boardStyle = style || currentBoardStyleConfig;

    // Faded squares only (no platform for cleaner infinite look)
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const isLight = (row + col) % 2 === 0;
            const baseColor = isLight ?
                (boardStyle.lightSquareColor || COLORS_3D.lightSquare) :
                (boardStyle.darkSquareColor || COLORS_3D.darkSquare);

            const geometry = new THREE.BoxGeometry(BOARD_UNIT * 0.95, 0.06, BOARD_UNIT * 0.95);
            const material = new THREE.MeshStandardMaterial({
                color: baseColor,
                roughness: 0.8,
                transparent: true,
                opacity: opacity,
            });

            const square = new THREE.Mesh(geometry, material);
            square.position.set(
                col * BOARD_UNIT - BOARD_WIDTH / 2 + BOARD_UNIT / 2,
                -0.12,
                row * BOARD_UNIT - BOARD_LENGTH / 2 + BOARD_UNIT / 2 + zOffset
            );

            group.add(square);
        }
    }

    boardGroup.add(group);
}

// =============================================================================
// CAMERA CONTROLS (Mouse + Touch)
// =============================================================================

// Minimum drag distance (px) before we consider it a drag vs a tap/click
const DRAG_THRESHOLD = 8;

function setupCameraControls(): void {
    // --- MOUSE EVENTS ---
    // Right-click drag = orbit camera (mouse users)
    // Middle-click drag = orbit camera (alternative)
    // Alt + left-click drag = orbit camera (trackpad / 3D-app convention)
    // Left-click (no Alt) = piece selection (handled by click handler)
    canvas.addEventListener('mousedown', (e) => {
        const isOrbitTrigger = e.button === 2              // right-click
                            || e.button === 1              // middle-click
                            || (e.button === 0 && e.altKey); // Alt+left-click
        if (isOrbitTrigger) {
            e.preventDefault();
            isDragging = false;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if ((dragStartX !== 0 || dragStartY !== 0)) {
            const dx = e.clientX - dragStartX;
            const dy = e.clientY - dragStartY;
            if (!isDragging && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
                isDragging = true;
            }
            if (isDragging) {
                const deltaX = e.clientX - lastMouseX;
                const deltaY = e.clientY - lastMouseY;
                orbitTheta -= deltaX * 0.01;
                orbitPhi = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, orbitPhi - deltaY * 0.01));
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
                // Switch to pan view while orbiting
                if (currentViewMode !== 'pan') {
                    currentViewMode = 'pan';
                    if (renderer) renderer.toneMappingExposure = 0.6;
                }
                updateCameraPosition();
            }
        }
    });

    canvas.addEventListener('mouseup', () => {
        dragStartX = 0;
        dragStartY = 0;
        setTimeout(() => { isDragging = false; }, 50);
    });

    canvas.addEventListener('mouseleave', () => {
        dragStartX = 0;
        dragStartY = 0;
        isDragging = false;
    });

    // Prevent context menu on right-click (we use it for orbit)
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // Prevent middle-click auto-scroll (we use it for orbit)
    canvas.addEventListener('auxclick', (e) => {
        if (e.button === 1) e.preventDefault();
    });

    // Scroll wheel = zoom (always available)
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        orbitRadius = Math.max(8, Math.min(40, orbitRadius + e.deltaY * 0.02));
        if (currentViewMode !== 'pan') {
            currentViewMode = 'pan';
            if (renderer) renderer.toneMappingExposure = 0.6;
        }
        updateCameraPosition();
    }, { passive: false });

    // --- TOUCH EVENTS ---
    // Single touch = piece selection (tap) — no orbit on single touch
    // Two-finger drag = orbit camera (always available)
    // Two-finger pinch = zoom (always available)
    canvas.addEventListener('touchstart', (e) => {
        isTouchDevice = true;
        if (e.touches.length === 1) {
            const t = e.touches[0];
            dragStartX = t.clientX;
            dragStartY = t.clientY;
            lastMouseX = t.clientX;
            lastMouseY = t.clientY;
            isDragging = false;
        } else if (e.touches.length === 2) {
            // Two-finger: start orbit + pinch
            e.preventDefault();
            pinchStartDist = getTouchDistance(e.touches);
            // Track midpoint for orbit
            lastMouseX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            lastMouseY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            isDragging = true;
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) {
            // Single finger: track drag distance but DON'T orbit
            // This is for distinguishing taps from accidental drags
            const t = e.touches[0];
            const dx = t.clientX - dragStartX;
            const dy = t.clientY - dragStartY;
            if (!isDragging && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
                isDragging = true;
            }
        } else if (e.touches.length === 2) {
            // Two-finger: orbit + pinch-to-zoom
            e.preventDefault();

            // Orbit via midpoint movement
            const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            const deltaX = midX - lastMouseX;
            const deltaY = midY - lastMouseY;
            orbitTheta -= deltaX * 0.01;
            orbitPhi = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, orbitPhi - deltaY * 0.01));
            lastMouseX = midX;
            lastMouseY = midY;

            // Pinch-to-zoom
            const dist = getTouchDistance(e.touches);
            const scale = pinchStartDist / dist;
            orbitRadius = Math.max(8, Math.min(40, orbitRadius * scale));
            pinchStartDist = dist;

            // Switch to pan view while manipulating
            if (currentViewMode !== 'pan') {
                currentViewMode = 'pan';
                if (renderer) renderer.toneMappingExposure = 0.6;
            }
            updateCameraPosition();
        }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        if (e.touches.length === 0) {
            // Single finger lift — if it was a tap (not a drag), fire click
            if (!isDragging && e.changedTouches.length === 1) {
                const t = e.changedTouches[0];
                const boardPos = screenToBoard(t.clientX, t.clientY);
                if (boardPos && onSquareClickCallback) {
                    onSquareClickCallback(boardPos.row, boardPos.col);
                }
            }
            dragStartX = 0;
            dragStartY = 0;
            isDragging = false;
        }
    });

    canvas.addEventListener('touchcancel', () => {
        dragStartX = 0;
        dragStartY = 0;
        isDragging = false;
    });
}

function getTouchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function updateCameraPosition(): void {
    if (currentViewMode === 'pan') {
        camera.position.x = orbitTarget.x + orbitRadius * Math.sin(orbitPhi) * Math.sin(orbitTheta);
        camera.position.y = orbitTarget.y + orbitRadius * Math.cos(orbitPhi);
        camera.position.z = orbitTarget.z + orbitRadius * Math.sin(orbitPhi) * Math.cos(orbitTheta);
        camera.lookAt(orbitTarget);
    } else {
        camera.position.set(0, 14, 0.5);
        camera.lookAt(0, 0, 0);
    }

    // Check if we should switch to 2D newspaper mode (looking overhead)
    const wasIs2DMode = is2DMode;
    is2DMode = orbitPhi < OVERHEAD_THRESHOLD || currentViewMode === 'play';

    // If mode changed, switch to appropriate style and rebuild pieces
    if (wasIs2DMode !== is2DMode && cachedBoard.length > 0) {
        console.log('[Renderer3D] Switching to', is2DMode ? '2D' : '3D', 'piece mode');
        // Apply the correct style for the new mode
        const newStyle = is2DMode ? current2DStyle : current3DStyle;
        if (currentPieceStyle !== newStyle) {
            currentPieceStyle = newStyle;
            currentPieceStyleConfig = getPieceStyleConfig(newStyle);
            pieceSpritesCache.clear();
            pieceMaterialCache.clear();
            pieceMeshCache.clear();
        }
        updatePieces(true); // Force update since hash hasn't changed
    }
}

// =============================================================================
// CLICK HANDLING
// =============================================================================

function setupClickHandler(): void {
    canvas.addEventListener('click', (e) => {
        // Don't process clicks during drag operations or Alt+clicks (orbit trigger)
        if (isDragging || e.altKey) return;

        const boardPos = screenToBoard(e.clientX, e.clientY);
        if (boardPos && onSquareClickCallback) {
            onSquareClickCallback(boardPos.row, boardPos.col);
        }
    });
}

/**
 * Register callback for square clicks
 */
export function onSquareClick(callback: (row: number, col: number) => void): void {
    onSquareClickCallback = callback;
}

// =============================================================================
// VIEW MODE CONTROLS
// =============================================================================

export function setViewMode(mode: ViewMode): void {
    currentViewMode = mode;
    updateCameraPosition();

    // Darken background in pan mode (reduce distracting bright greens/colors)
    if (renderer) {
        if (mode === 'pan') {
            renderer.toneMappingExposure = 0.6;  // Dimmed cinematic look
        } else {
            renderer.toneMappingExposure = 1.1;  // Normal play brightness
        }
    }

    console.log('[Renderer3D] View mode:', mode);
}

export function toggleViewMode(): void {
    setViewMode(currentViewMode === 'pan' ? 'play' : 'pan');
}

export function getViewMode(): ViewMode {
    return currentViewMode;
}

// Legacy API compatibility
export function setCameraView(view: 'tactical' | 'cinematic'): void {
    setViewMode(view === 'tactical' ? 'play' : 'pan');
}

export function toggleCameraView(): void {
    toggleViewMode();
}

export function getCurrentView(): string {
    return currentViewMode === 'pan' ? 'cinematic' : 'tactical';
}

// =============================================================================
// CALLBACKS
// =============================================================================

export function onWorldChange(callback: (eraName: string) => void): void {
    onWorldChangeCallback = callback;
}

export function onEraTransition(callback: (fromEra: EraConfig, toEra: EraConfig) => void): void {
    onEraTransitionCallback = callback;
}

export function getCurrentWorldName(): string {
    return getEraForElo(currentElo).name;
}

export function getCurrentEra(): EraConfig {
    return getEraForElo(currentElo);
}

// =============================================================================
// DEBUG TOGGLE API
// =============================================================================

function applyParticleVisibility(): void {
    if (!environmentGroup) return;
    environmentGroup.children.forEach((child) => {
        if (child.userData?.isParticles) {
            child.visible = particlesEnabled && envEnabled;
        }
    });
}

export function setEnvironmentEnabled(enabled: boolean): void {
    envEnabled = enabled;
    if (environmentGroup) {
        environmentGroup.visible = enabled;
    }
    applyParticleVisibility();
}

export function setParticlesEnabled(enabled: boolean): void {
    particlesEnabled = enabled;
    applyParticleVisibility();
}

export function setSkyboxEnabled(enabled: boolean): void {
    skyboxEnabled = enabled;
    if (proceduralSkybox) {
        proceduralSkybox.getMesh().visible = enabled;
    }
}

export function setLightingEnabled(enabled: boolean): void {
    lightingEnabled = enabled;
    if (dynamicLighting) {
        dynamicLighting.setEnabled(enabled);
    }
}

export function setShadowsEnabled(enabled: boolean): void {
    shadowsEnabled = enabled;
    if (renderer) {
        renderer.shadowMap.enabled = enabled;
    }
}

export function setEnvironmentAnimationEnabled(enabled: boolean): void {
    envAnimEnabled = enabled;
}

export function setWormholeEnabled(enabled: boolean): void {
    wormholeEnabled = enabled;
    if (wormholeTransition) {
        wormholeTransition.getMesh().visible = enabled;
    }
}

export function setAssetDensityScale(scale: number): void {
    setEraAssetDensityScale(scale);
    regenerateEnvironment();
}

export function setParticleDensityScale(scale: number): void {
    setEraParticleDensityScale(scale);
    regenerateEnvironment();
}

export function setMotionScale(scale: number): void {
    motionScale = Math.max(0, Math.min(1, scale));
}

export function setRenderScale(scale: number): void {
    if (!renderer) return;
    renderScale = Math.max(0.5, Math.min(1.5, scale));
    renderer.setPixelRatio(basePixelRatio * renderScale);
}

export function setAutoFpsEnabled(enabled: boolean): void {
    autoFpsEnabled = enabled;
}

export function setTargetFps(fps: number): void {
    targetFps = Math.max(30, Math.min(120, fps));
}

export function setFixedTimestepEnabled(enabled: boolean): void {
    fixedTimestepEnabled = enabled;
    fixedAccumulator = 0;
}

export function setFixedFps(fps: number): void {
    fixedFps = Math.max(30, Math.min(120, fps));
}

export function setAnimQuality(quality: number): void {
    animQuality = Math.max(1, Math.min(6, quality));
}

export function setTravelSpeedScale(scale: number): void {
    travelSpeedScale = Math.max(0.5, Math.min(3, scale));
}

// =============================================================================
// PUBLIC API
// =============================================================================

export function updateState(
    board: (Piece | null)[][],
    selectedSquare: { row: number; col: number } | null,
    legalMoves: Move[],
    turn: 'white' | 'black',
    inCheck: boolean,
    playerColor?: 'white' | 'black'
): void {
    cachedBoard = board;
    cachedSelectedSquare = selectedSquare;
    cachedLegalMoves = legalMoves;
    cachedTurn = turn;
    cachedInCheck = inCheck;
    // Apply viewFlipped override: if user toggled flip, invert the perspective
    const baseColor = playerColor || 'white';
    cachedPlayerColor = viewFlipped
        ? (baseColor === 'white' ? 'black' : 'white')
        : baseColor;

    updatePieces();
    updateSquareHighlights();
}

/**
 * Set player color (perspective) and refresh pieces
 */
export function setPlayerColor(color: 'white' | 'black'): void {
    cachedPlayerColor = color;
    // Clear material caches since colors change
    pieceMaterialCache.clear();
    pieceSpritesCache.clear();
    _prevBoardHash = '';
    if (cachedBoard.length > 0) {
        updatePieces();
    }
}

/**
 * Get current player color (accounts for flip override)
 */
export function getPlayerColor(): 'white' | 'black' {
    return cachedPlayerColor;
}

/**
 * Toggle board flip — purely visual, persists across state updates.
 * Returns the new effective player color.
 */
export function toggleBoardFlip(): 'white' | 'black' {
    viewFlipped = !viewFlipped;
    // Recompute the effective color
    const baseColor = cachedPlayerColor;
    const newColor = viewFlipped
        ? (baseColor === 'white' ? 'black' : 'white')
        : baseColor;
    // We need to re-derive from the un-flipped base, so recalc:
    // The current cachedPlayerColor already has the OLD flip applied.
    // Simplest: just invert current.
    cachedPlayerColor = cachedPlayerColor === 'white' ? 'black' : 'white';
    pieceMaterialCache.clear();
    pieceSpritesCache.clear();
    _prevBoardHash = '';
    if (cachedBoard.length > 0) {
        updatePieces();
    }
    return cachedPlayerColor;
}

/**
 * Check if the board view is currently flipped
 */
export function isViewFlipped(): boolean {
    return viewFlipped;
}

/**
 * Set ELO and update all era systems
 */
export function setElo(elo: number): void {
    updateEraForElo(elo, false);
}

/**
 * Set piece style and refresh all pieces
 */
export function setPieceStyle(style: PieceStyle): void {
    if (currentPieceStyle === style) return;

    console.log('[Renderer3D] Changing piece style to:', style);
    currentPieceStyle = style;
    currentPieceStyleConfig = getPieceStyleConfig(style);

    // Track which type was set
    if (is2DPieceStyle(style)) {
        current2DStyle = style;
    } else {
        current3DStyle = style;
    }

    // Clear caches
    pieceSpritesCache.clear();
    pieceMaterialCache.clear();
    pieceMeshCache.clear();

    // Force board update
    _prevBoardHash = '';

    // Refresh pieces with new style
    if (cachedBoard.length > 0) {
        updatePieces(true); // Force update since hash hasn't changed
    }
}

/**
 * Set 3D piece style specifically
 */
export function set3DPieceStyle(style: string): void {
    current3DStyle = style;
    console.log('[Renderer3D] Set 3D style:', style);
    // If currently in 3D mode, apply immediately
    if (!is2DMode) {
        setPieceStyle(style);
    }
}

/**
 * Set 2D piece style specifically
 */
export function set2DPieceStyle(style: string): void {
    current2DStyle = style;
    console.log('[Renderer3D] Set 2D style:', style);
    // If currently in 2D mode, apply immediately
    if (is2DMode) {
        setPieceStyle(style);
    }
}

/**
 * Get current piece style
 */
export function getPieceStyle(): PieceStyle {
    return currentPieceStyle;
}

/**
 * Get current 3D style
 */
export function get3DPieceStyle(): string {
    return current3DStyle;
}

/**
 * Get current 2D style  
 */
export function get2DPieceStyle(): string {
    return current2DStyle;
}

/**
 * Set board style and refresh board
 */
export function setBoardStyle(style: BoardStyle): void {
    if (currentBoardStyle === style) return;

    console.log('[Renderer3D] Changing board style to:', style);
    currentBoardStyle = style;
    currentBoardStyleConfig = getBoardStyleConfig(style);

    // Update highlight colors from board style (no more hardcoded green)
    COLORS_3D.lightSquare = currentBoardStyleConfig.lightSquareColor;
    COLORS_3D.darkSquare = currentBoardStyleConfig.darkSquareColor;
    COLORS_3D.selectedSquare = currentBoardStyleConfig.selectedSquareColor ?? 0xc8a86c;
    COLORS_3D.legalMoveHighlight = currentBoardStyleConfig.legalMoveColor ?? 0xb89858;

    // Rebuild the board with new style
    createBoard();
}

/**
 * Get current board style
 */
export function getBoardStyle(): BoardStyle {
    return currentBoardStyle;
}

/**
 * Cycle to next piece style (legacy - cycles through all)
 */
export function cyclePieceStyle(): void {
    const currentIndex = PIECE_STYLE_ORDER.indexOf(currentPieceStyle);
    const nextIndex = (currentIndex + 1) % PIECE_STYLE_ORDER.length;
    setPieceStyle(PIECE_STYLE_ORDER[nextIndex] as PieceStyle);
}

/**
 * Cycle to next 3D piece style
 */
export function cycle3DPieceStyle(): void {
    const currentIndex = STYLES_3D_ORDER.indexOf(current3DStyle);
    const nextIndex = (currentIndex + 1) % STYLES_3D_ORDER.length;
    set3DPieceStyle(STYLES_3D_ORDER[nextIndex]);
}

/**
 * Cycle to next 2D piece style
 */
export function cycle2DPieceStyle(): void {
    const currentIndex = STYLES_2D_ORDER.indexOf(current2DStyle);
    const nextIndex = (currentIndex + 1) % STYLES_2D_ORDER.length;
    set2DPieceStyle(STYLES_2D_ORDER[nextIndex]);
}

/**
 * Generate a preview canvas showing sample pieces for a given 2D style.
 * Returns an HTMLCanvasElement showing K, Q, N in white and black.
 */
export function generate2DStylePreview(styleId: string): HTMLCanvasElement {
    const config = getPieceStyleConfig(styleId);
    const drawStyle = config.drawStyle || 'classic';
    const cellSize = 48;
    const cols = 3; // K, Q, N
    const rows = 2; // white row, black row
    const padding = 4;
    const canvas = document.createElement('canvas');
    canvas.width = cols * cellSize + padding * 2;
    canvas.height = rows * cellSize + padding * 2;
    const ctx = canvas.getContext('2d')!;

    // Transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pieces = ['k', 'q', 'n'];

    for (let row = 0; row < rows; row++) {
        const isWhite = row === 0;
        for (let col = 0; col < cols; col++) {
            const pieceType = pieces[col];
            const x = padding + col * cellSize;
            const y = padding + row * cellSize;

            // Draw into a temp canvas at full size, then scale down
            const tmpCanvas = document.createElement('canvas');
            tmpCanvas.width = tmpCanvas.height = 256;
            const tmpCtx = tmpCanvas.getContext('2d')!;
            tmpCtx.clearRect(0, 0, 256, 256);

            switch (drawStyle) {
                case 'classic': drawClassicPiece(tmpCtx, pieceType, isWhite, 256); break;
                case 'modern': drawModernPiece(tmpCtx, pieceType, isWhite, 256); break;
                case 'staunton': drawStauntonPiece(tmpCtx, pieceType, isWhite, 256); break;
                case 'newspaper': drawNewspaperPiece(tmpCtx, pieceType, isWhite, 256); break;
                case 'editorial': drawEditorialPiece(tmpCtx, pieceType, isWhite, 256); break;
                case 'outline': drawOutlinePiece(tmpCtx, pieceType, isWhite, 256); break;
                case 'figurine': drawFigurinePiece(tmpCtx, pieceType, isWhite, 256); break;
                case 'pixel': drawPixelPiece(tmpCtx, pieceType, isWhite, 256); break;
                case 'gothic': drawGothicPiece(tmpCtx, pieceType, isWhite, 256); break;
                case 'minimalist': drawMinimalistPiece(tmpCtx, pieceType, isWhite, 256); break;
                case 'celtic': drawCelticPiece(tmpCtx, pieceType, isWhite, 256); break;
                case 'sketch': drawSketchPiece(tmpCtx, pieceType, isWhite, 256); break;
                case 'lichess': drawLichessPiece(tmpCtx, pieceType, isWhite, 256); break;
                case 'art_deco': drawArtDecoPiece(tmpCtx, pieceType, isWhite, 256); break;
                case 'steampunk': drawSteampunkPiece(tmpCtx, pieceType, isWhite, 256); break;
                case 'tribal': drawTribalPiece(tmpCtx, pieceType, isWhite, 256); break;
                case 'symbols': default: drawSymbolPiece(tmpCtx, pieceType, isWhite, 256); break;
            }

            // Scale down to cell
            ctx.drawImage(tmpCanvas, 0, 0, 256, 256, x, y, cellSize, cellSize);
        }
    }

    return canvas;
}

/**
 * Cycle to next board style
 */
export function cycleBoardStyle(): void {
    const currentIndex = BOARD_STYLE_ORDER.indexOf(currentBoardStyle);
    const nextIndex = (currentIndex + 1) % BOARD_STYLE_ORDER.length;
    setBoardStyle(BOARD_STYLE_ORDER[nextIndex] as BoardStyle);
}

/**
 * Show game over overlay
 */
export function showGameOverOverlay(message: string): void {
    // Create or update overlay element
    let overlay = document.getElementById('game-over-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'game-over-overlay';
        overlay.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.92);
            color: white;
            padding: 40px 60px;
            border-radius: 15px;
            text-align: center;
            font-family: Arial, sans-serif;
            z-index: 1000;
            box-shadow: 0 0 40px rgba(255,215,0,0.5);
            border: 3px solid #ffd700;
            animation: pulse 0.5s ease-in-out;
        `;
        // Add animation keyframes
        if (!document.getElementById('game-over-styles')) {
            const style = document.createElement('style');
            style.id = 'game-over-styles';
            style.textContent = `
                @keyframes pulse {
                    0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
                    100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        canvas.parentElement?.appendChild(overlay);
    }

    // Check if it's a win (contains "Win")
    const isWin = message.toLowerCase().includes('win');
    const borderColor = isWin ? '#ffd700' : (message.toLowerCase().includes('lose') ? '#ff4444' : '#4488ff');
    overlay.style.borderColor = borderColor;
    overlay.style.boxShadow = `0 0 40px ${borderColor}80`;

    // Format message - replace newlines with <br>
    const formattedMessage = message.replace(/\n/g, '<br>');

    overlay.innerHTML = `
        <h2 style="margin: 0 0 15px 0; font-size: 32px; color: ${isWin ? '#ffd700' : '#ffffff'};">${isWin ? '🎉 ' : ''}${formattedMessage.split('<br>')[0]}${isWin ? ' 🎉' : ''}</h2>
        <p style="margin: 0 0 20px 0; font-size: 18px; opacity: 0.9;">${formattedMessage.split('<br>').slice(1).join('<br>')}</p>
        <p style="margin: 0; font-size: 14px; opacity: 0.6;">Click anywhere to continue</p>
    `;
    overlay.style.display = 'block';

    // Hide overlay on click
    const hideOverlay = () => {
        overlay!.style.display = 'none';
        overlay?.removeEventListener('click', hideOverlay);
    };
    overlay.addEventListener('click', hideOverlay);
}

/**
 * Get current FPS from the render loop
 */
export function getFPS(): number {
    return currentFPS;
}

export function render(): void {
    // Handled by render loop
}

export function playWinAnimation(): Promise<void> {
    return new Promise((resolve) => {
        if (isAnimating) {
            resolve();
            return;
        }

        isAnimating = true;

        // Store original piece positions for jump animation
        const pieceData: Array<{ mesh: THREE.Object3D, startZ: number, delay: number }> = [];
        piecesGroup.children.forEach((piece, index) => {
            pieceData.push({
                mesh: piece,
                startZ: piece.position.z,
                delay: index * 80 // Stagger the jumps
            });
        });

        const startTime = performance.now();
        const totalDuration = 3500; // Total animation time
        const jumpDistance = 2 * BOARD_UNIT; // 2 squares per jump
        const totalJumps = 6; // Number of jumps to reach new board
        const jumpDuration = 400; // ms per jump
        const jumpHeight = 1.5; // How high pieces jump

        function animate(currentTime: number) {
            const elapsed = currentTime - startTime;

            // Animate each piece with staggered timing
            pieceData.forEach(({ mesh, startZ, delay }) => {
                const pieceElapsed = Math.max(0, elapsed - delay);

                if (pieceElapsed > 0) {
                    // Calculate which jump we're on
                    const jumpProgress = pieceElapsed / jumpDuration;
                    const currentJump = Math.floor(jumpProgress);
                    const jumpPhase = jumpProgress - currentJump; // 0-1 within current jump

                    if (currentJump < totalJumps) {
                        // Z position: move forward by jumpDistance per completed jump
                        const baseZ = startZ + currentJump * jumpDistance;
                        const nextZ = startZ + (currentJump + 1) * jumpDistance;
                        const zProgress = easeInOutQuad(jumpPhase);
                        mesh.position.z = baseZ + (nextZ - baseZ) * zProgress;

                        // Y position: parabolic arc for hop effect
                        const hopProgress = Math.sin(jumpPhase * Math.PI);
                        mesh.position.y = 0.12 + hopProgress * jumpHeight;
                    } else {
                        // Animation complete for this piece
                        mesh.position.z = startZ + totalJumps * jumpDistance;
                        mesh.position.y = 0.12;
                    }
                }
            });

            // Move board smoothly
            const boardProgress = Math.min(elapsed / totalDuration, 1);
            const boardEase = easeInOutQuad(boardProgress);
            boardGroup.position.z = boardEase * (totalJumps * jumpDistance);

            if (elapsed < totalDuration) {
                requestAnimationFrame(animate);
            } else {
                // Reset positions
                boardGroup.position.z = 0;
                pieceData.forEach(({ mesh, startZ }) => {
                    mesh.position.z = startZ;
                    mesh.position.y = 0.12;
                });
                isAnimating = false;
                resolve();
            }
        }

        requestAnimationFrame(animate);
    });
}

// Easing function for smooth jumps
function easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function isAnimationPlaying(): boolean {
    return isAnimating || wormholeTransition.isTransitioning();
}

export function drawGameOverOverlay(_message: string): void {
    // Handled by HTML overlay
}

// PERFORMANCE: Cached raycaster and vector to avoid GC pressure
const _raycaster = new THREE.Raycaster();
const _mouseVec = new THREE.Vector2();
let _cachedSquares: THREE.Mesh[] | null = null;

export function screenToBoard(screenX: number, screenY: number): { row: number; col: number } | null {
    const rect = canvas.getBoundingClientRect();
    _mouseVec.x = ((screenX - rect.left) / rect.width) * 2 - 1;
    _mouseVec.y = -((screenY - rect.top) / rect.height) * 2 + 1;

    _raycaster.setFromCamera(_mouseVec, camera);

    // Cache board squares - invalidate when board is recreated
    if (!_cachedSquares) {
        _cachedSquares = boardGroup.children.filter(
            (child): child is THREE.Mesh =>
                child instanceof THREE.Mesh && child.userData?.type === 'square'
        );
    }

    const intersects = _raycaster.intersectObjects(_cachedSquares, false);

    if (intersects.length > 0) {
        const hit = intersects[0].object;
        if (hit.userData?.row !== undefined && hit.userData?.col !== undefined) {
            return {
                row: hit.userData.row,
                col: hit.userData.col,
            };
        }
    }

    return null;
}

// =============================================================================
// PIECE RENDERING - 2D Canvas-Drawn Pieces (SVG-style)
// =============================================================================

// Unicode chess symbols
const PIECE_SYMBOLS: Record<string, Record<string, string>> = {
    white: { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' },
    black: { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' }
};

// Draw classic silhouette style pieces
function drawClassicPiece(ctx: CanvasRenderingContext2D, type: string, isWhite: boolean, size: number): void {
    const s = size;
    const cx = s / 2;
    const fill = isWhite ? '#f8f4e8' : '#2a2420';
    const stroke = isWhite ? '#1a1a1a' : '#d0d0d0';

    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = s * 0.04;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();

    switch (type) {
        case 'K': // King - cross on top
            // Base
            ctx.moveTo(cx - s * 0.3, s * 0.88);
            ctx.lineTo(cx + s * 0.3, s * 0.88);
            ctx.lineTo(cx + s * 0.25, s * 0.78);
            ctx.lineTo(cx + s * 0.2, s * 0.45);
            ctx.quadraticCurveTo(cx + s * 0.25, s * 0.35, cx + s * 0.15, s * 0.28);
            // Cross
            ctx.lineTo(cx + s * 0.15, s * 0.22);
            ctx.lineTo(cx + s * 0.08, s * 0.22);
            ctx.lineTo(cx + s * 0.08, s * 0.15);
            ctx.lineTo(cx + s * 0.15, s * 0.15);
            ctx.lineTo(cx + s * 0.15, s * 0.08);
            ctx.lineTo(cx - s * 0.15, s * 0.08);
            ctx.lineTo(cx - s * 0.15, s * 0.15);
            ctx.lineTo(cx - s * 0.08, s * 0.15);
            ctx.lineTo(cx - s * 0.08, s * 0.22);
            ctx.lineTo(cx - s * 0.15, s * 0.22);
            ctx.lineTo(cx - s * 0.15, s * 0.28);
            ctx.quadraticCurveTo(cx - s * 0.25, s * 0.35, cx - s * 0.2, s * 0.45);
            ctx.lineTo(cx - s * 0.25, s * 0.78);
            ctx.closePath();
            break;

        case 'Q': // Queen - crown with points
            ctx.moveTo(cx - s * 0.28, s * 0.88);
            ctx.lineTo(cx + s * 0.28, s * 0.88);
            ctx.lineTo(cx + s * 0.22, s * 0.75);
            ctx.lineTo(cx + s * 0.18, s * 0.4);
            ctx.lineTo(cx + s * 0.28, s * 0.18);
            ctx.arc(cx + s * 0.28, s * 0.14, s * 0.04, Math.PI * 0.5, Math.PI * 2.5);
            ctx.lineTo(cx + s * 0.14, s * 0.25);
            ctx.lineTo(cx + s * 0.14, s * 0.08);
            ctx.arc(cx + s * 0.14, s * 0.06, s * 0.03, Math.PI * 0.5, Math.PI * 2.5);
            ctx.lineTo(cx, s * 0.2);
            ctx.lineTo(cx, s * 0.08);
            ctx.arc(cx, s * 0.05, s * 0.04, Math.PI * 0.5, Math.PI * 2.5);
            ctx.lineTo(cx - s * 0.14, s * 0.2);
            ctx.lineTo(cx - s * 0.14, s * 0.08);
            ctx.arc(cx - s * 0.14, s * 0.06, s * 0.03, Math.PI * 0.5, Math.PI * 2.5);
            ctx.lineTo(cx - s * 0.28, s * 0.25);
            ctx.lineTo(cx - s * 0.28, s * 0.18);
            ctx.arc(cx - s * 0.28, s * 0.14, s * 0.04, Math.PI * 0.5, Math.PI * 2.5);
            ctx.lineTo(cx - s * 0.18, s * 0.4);
            ctx.lineTo(cx - s * 0.22, s * 0.75);
            ctx.closePath();
            break;

        case 'R': // Rook - castle tower
            ctx.moveTo(cx - s * 0.25, s * 0.88);
            ctx.lineTo(cx + s * 0.25, s * 0.88);
            ctx.lineTo(cx + s * 0.22, s * 0.75);
            ctx.lineTo(cx + s * 0.18, s * 0.35);
            ctx.lineTo(cx + s * 0.25, s * 0.3);
            ctx.lineTo(cx + s * 0.25, s * 0.12);
            ctx.lineTo(cx + s * 0.18, s * 0.12);
            ctx.lineTo(cx + s * 0.18, s * 0.2);
            ctx.lineTo(cx + s * 0.08, s * 0.2);
            ctx.lineTo(cx + s * 0.08, s * 0.12);
            ctx.lineTo(cx - s * 0.08, s * 0.12);
            ctx.lineTo(cx - s * 0.08, s * 0.2);
            ctx.lineTo(cx - s * 0.18, s * 0.2);
            ctx.lineTo(cx - s * 0.18, s * 0.12);
            ctx.lineTo(cx - s * 0.25, s * 0.12);
            ctx.lineTo(cx - s * 0.25, s * 0.3);
            ctx.lineTo(cx - s * 0.18, s * 0.35);
            ctx.lineTo(cx - s * 0.22, s * 0.75);
            ctx.closePath();
            break;

        case 'B': // Bishop - mitre hat
            ctx.moveTo(cx - s * 0.22, s * 0.88);
            ctx.lineTo(cx + s * 0.22, s * 0.88);
            ctx.lineTo(cx + s * 0.18, s * 0.78);
            ctx.lineTo(cx + s * 0.12, s * 0.5);
            ctx.quadraticCurveTo(cx + s * 0.22, s * 0.35, cx + s * 0.15, s * 0.22);
            ctx.quadraticCurveTo(cx + s * 0.12, s * 0.12, cx, s * 0.1);
            ctx.quadraticCurveTo(cx - s * 0.12, s * 0.12, cx - s * 0.15, s * 0.22);
            ctx.quadraticCurveTo(cx - s * 0.22, s * 0.35, cx - s * 0.12, s * 0.5);
            ctx.lineTo(cx - s * 0.18, s * 0.78);
            ctx.closePath();
            // Ball on top
            ctx.moveTo(cx + s * 0.06, s * 0.08);
            ctx.arc(cx, s * 0.06, s * 0.06, 0, Math.PI * 2);
            // Slot
            ctx.moveTo(cx - s * 0.02, s * 0.28);
            ctx.lineTo(cx + s * 0.02, s * 0.28);
            ctx.lineTo(cx + s * 0.02, s * 0.42);
            ctx.lineTo(cx - s * 0.02, s * 0.42);
            ctx.closePath();
            break;

        case 'N': // Knight - horse head
            ctx.moveTo(cx - s * 0.2, s * 0.88);
            ctx.lineTo(cx + s * 0.22, s * 0.88);
            ctx.lineTo(cx + s * 0.18, s * 0.72);
            ctx.lineTo(cx + s * 0.15, s * 0.55);
            ctx.quadraticCurveTo(cx + s * 0.25, s * 0.45, cx + s * 0.22, s * 0.32);
            ctx.quadraticCurveTo(cx + s * 0.2, s * 0.22, cx + s * 0.1, s * 0.18);
            ctx.lineTo(cx + s * 0.15, s * 0.12);
            ctx.quadraticCurveTo(cx + s * 0.08, s * 0.08, cx - s * 0.05, s * 0.12);
            ctx.quadraticCurveTo(cx - s * 0.18, s * 0.15, cx - s * 0.25, s * 0.25);
            ctx.lineTo(cx - s * 0.3, s * 0.28);
            ctx.lineTo(cx - s * 0.22, s * 0.32);
            ctx.quadraticCurveTo(cx - s * 0.18, s * 0.38, cx - s * 0.12, s * 0.42);
            ctx.quadraticCurveTo(cx - s * 0.2, s * 0.55, cx - s * 0.15, s * 0.72);
            ctx.closePath();
            // Eye
            ctx.moveTo(cx + s * 0.02, s * 0.28);
            ctx.arc(cx - s * 0.02, s * 0.28, s * 0.04, 0, Math.PI * 2);
            break;

        case 'P': // Pawn - simple rounded
            ctx.moveTo(cx - s * 0.18, s * 0.88);
            ctx.lineTo(cx + s * 0.18, s * 0.88);
            ctx.lineTo(cx + s * 0.15, s * 0.78);
            ctx.lineTo(cx + s * 0.1, s * 0.55);
            ctx.quadraticCurveTo(cx + s * 0.18, s * 0.45, cx + s * 0.15, s * 0.35);
            ctx.arc(cx, s * 0.25, s * 0.15, Math.PI * 0.3, Math.PI * 2.7);
            ctx.quadraticCurveTo(cx - s * 0.18, s * 0.45, cx - s * 0.1, s * 0.55);
            ctx.lineTo(cx - s * 0.15, s * 0.78);
            ctx.closePath();
            break;
    }

    ctx.fill();
    ctx.stroke();
}

// Draw modern minimal geometric pieces
function drawModernPiece(ctx: CanvasRenderingContext2D, type: string, isWhite: boolean, size: number): void {
    const s = size;
    const cx = s / 2;
    const fill = isWhite ? '#ffffff' : '#1a1a1a';
    const stroke = isWhite ? '#333333' : '#cccccc';

    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = s * 0.035;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Common base
    ctx.beginPath();
    ctx.ellipse(cx, s * 0.85, s * 0.25, s * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();

    switch (type) {
        case 'K': // King - tall rectangle with cross
            ctx.rect(cx - s * 0.12, s * 0.25, s * 0.24, s * 0.55);
            ctx.fill();
            ctx.stroke();
            // Cross
            ctx.fillRect(cx - s * 0.08, s * 0.08, s * 0.16, s * 0.06);
            ctx.fillRect(cx - s * 0.03, s * 0.05, s * 0.06, s * 0.18);
            ctx.strokeRect(cx - s * 0.08, s * 0.08, s * 0.16, s * 0.06);
            ctx.strokeRect(cx - s * 0.03, s * 0.05, s * 0.06, s * 0.18);
            break;

        case 'Q': // Queen - tall with circle on top
            ctx.rect(cx - s * 0.12, s * 0.3, s * 0.24, s * 0.5);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, s * 0.18, s * 0.12, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            break;

        case 'R': // Rook - rectangle with flat top
            ctx.rect(cx - s * 0.15, s * 0.2, s * 0.3, s * 0.6);
            ctx.fill();
            ctx.stroke();
            // Battlements
            ctx.fillRect(cx - s * 0.18, s * 0.12, s * 0.1, s * 0.12);
            ctx.fillRect(cx + s * 0.08, s * 0.12, s * 0.1, s * 0.12);
            ctx.strokeRect(cx - s * 0.18, s * 0.12, s * 0.1, s * 0.12);
            ctx.strokeRect(cx + s * 0.08, s * 0.12, s * 0.1, s * 0.12);
            break;

        case 'B': // Bishop - tall with pointed top
            ctx.moveTo(cx - s * 0.1, s * 0.8);
            ctx.lineTo(cx - s * 0.1, s * 0.35);
            ctx.lineTo(cx, s * 0.12);
            ctx.lineTo(cx + s * 0.1, s * 0.35);
            ctx.lineTo(cx + s * 0.1, s * 0.8);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // Ball
            ctx.beginPath();
            ctx.arc(cx, s * 0.1, s * 0.05, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            break;

        case 'N': // Knight - L shape
            ctx.moveTo(cx - s * 0.15, s * 0.8);
            ctx.lineTo(cx - s * 0.15, s * 0.4);
            ctx.lineTo(cx - s * 0.05, s * 0.4);
            ctx.lineTo(cx - s * 0.05, s * 0.15);
            ctx.lineTo(cx + s * 0.15, s * 0.15);
            ctx.lineTo(cx + s * 0.15, s * 0.3);
            ctx.lineTo(cx + s * 0.05, s * 0.3);
            ctx.lineTo(cx + s * 0.05, s * 0.8);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            break;

        case 'P': // Pawn - circle on stem
            ctx.rect(cx - s * 0.06, s * 0.4, s * 0.12, s * 0.4);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, s * 0.3, s * 0.12, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            break;
    }
}

// Draw Staunton style pieces
function drawStauntonPiece(ctx: CanvasRenderingContext2D, type: string, isWhite: boolean, size: number): void {
    const s = size;
    const cx = s / 2;
    const fill = isWhite ? '#f0e8d8' : '#3a3028';
    const stroke = isWhite ? '#2a2a2a' : '#c8c0b0';
    const highlight = isWhite ? '#ffffff' : '#5a5048';

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw with gradient for 3D effect
    const gradient = ctx.createLinearGradient(cx - s * 0.3, 0, cx + s * 0.3, 0);
    gradient.addColorStop(0, fill);
    gradient.addColorStop(0.3, highlight);
    gradient.addColorStop(0.7, fill);
    gradient.addColorStop(1, isWhite ? '#d0c8b8' : '#2a2420');

    ctx.fillStyle = gradient;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = s * 0.025;

    // Draw the piece based on type
    drawClassicPiece(ctx, type, isWhite, size);
}

// Draw unicode symbols
function drawSymbolPiece(ctx: CanvasRenderingContext2D, type: string, isWhite: boolean, size: number): void {
    const symbol = PIECE_SYMBOLS[isWhite ? 'white' : 'black']?.[type] || '?';

    ctx.font = `bold ${size * 0.82}px "Segoe UI Symbol", "Arial Unicode MS", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Shadow
    ctx.shadowColor = isWhite ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.4)';
    ctx.shadowBlur = size * 0.05;
    ctx.shadowOffsetY = size * 0.015;

    // Outline
    ctx.strokeStyle = isWhite ? '#000' : '#fff';
    ctx.lineWidth = size * 0.045;
    ctx.lineJoin = 'round';
    ctx.strokeText(symbol, size / 2, size / 2 + size * 0.05);

    // Fill
    ctx.fillStyle = isWhite ? '#fff' : '#111';
    ctx.fillText(symbol, size / 2, size / 2 + size * 0.05);

    ctx.shadowColor = 'transparent';
}

// Draw newspaper-style pieces (classic diagram style with hatching for black pieces)
function drawNewspaperPiece(ctx: CanvasRenderingContext2D, type: string, isWhite: boolean, size: number): void {
    const s = size;
    const cx = s / 2;

    // Newspaper style: white pieces are hollow, black pieces are filled with diagonal lines
    ctx.lineWidth = s * 0.025;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#ffffff';

    // Helper to draw the piece outline
    const drawPieceShape = (fill: boolean) => {
        ctx.beginPath();

        switch (type) {
            case 'K': // King
                ctx.moveTo(cx - s * 0.25, s * 0.88);
                ctx.lineTo(cx + s * 0.25, s * 0.88);
                ctx.lineTo(cx + s * 0.2, s * 0.78);
                ctx.lineTo(cx + s * 0.15, s * 0.48);
                ctx.quadraticCurveTo(cx + s * 0.2, s * 0.38, cx + s * 0.12, s * 0.32);
                ctx.lineTo(cx + s * 0.12, s * 0.25);
                ctx.lineTo(cx + s * 0.06, s * 0.25);
                ctx.lineTo(cx + s * 0.06, s * 0.18);
                ctx.lineTo(cx + s * 0.12, s * 0.18);
                ctx.lineTo(cx + s * 0.12, s * 0.12);
                ctx.lineTo(cx - s * 0.12, s * 0.12);
                ctx.lineTo(cx - s * 0.12, s * 0.18);
                ctx.lineTo(cx - s * 0.06, s * 0.18);
                ctx.lineTo(cx - s * 0.06, s * 0.25);
                ctx.lineTo(cx - s * 0.12, s * 0.25);
                ctx.lineTo(cx - s * 0.12, s * 0.32);
                ctx.quadraticCurveTo(cx - s * 0.2, s * 0.38, cx - s * 0.15, s * 0.48);
                ctx.lineTo(cx - s * 0.2, s * 0.78);
                ctx.closePath();
                break;

            case 'Q': // Queen
                ctx.moveTo(cx - s * 0.25, s * 0.88);
                ctx.lineTo(cx + s * 0.25, s * 0.88);
                ctx.lineTo(cx + s * 0.2, s * 0.75);
                ctx.lineTo(cx + s * 0.15, s * 0.42);
                ctx.lineTo(cx + s * 0.25, s * 0.2);
                ctx.arc(cx + s * 0.25, s * 0.15, s * 0.045, Math.PI * 0.5, Math.PI * 2.5);
                ctx.lineTo(cx + s * 0.12, s * 0.28);
                ctx.lineTo(cx + s * 0.12, s * 0.1);
                ctx.arc(cx + s * 0.12, s * 0.07, s * 0.035, Math.PI * 0.5, Math.PI * 2.5);
                ctx.lineTo(cx, s * 0.22);
                ctx.lineTo(cx, s * 0.1);
                ctx.arc(cx, s * 0.065, s * 0.04, Math.PI * 0.5, Math.PI * 2.5);
                ctx.lineTo(cx - s * 0.12, s * 0.22);
                ctx.lineTo(cx - s * 0.12, s * 0.1);
                ctx.arc(cx - s * 0.12, s * 0.07, s * 0.035, Math.PI * 0.5, Math.PI * 2.5);
                ctx.lineTo(cx - s * 0.25, s * 0.28);
                ctx.lineTo(cx - s * 0.25, s * 0.2);
                ctx.arc(cx - s * 0.25, s * 0.15, s * 0.045, Math.PI * 0.5, Math.PI * 2.5);
                ctx.lineTo(cx - s * 0.15, s * 0.42);
                ctx.lineTo(cx - s * 0.2, s * 0.75);
                ctx.closePath();
                break;

            case 'R': // Rook
                ctx.moveTo(cx - s * 0.22, s * 0.88);
                ctx.lineTo(cx + s * 0.22, s * 0.88);
                ctx.lineTo(cx + s * 0.18, s * 0.75);
                ctx.lineTo(cx + s * 0.14, s * 0.35);
                ctx.lineTo(cx + s * 0.22, s * 0.32);
                ctx.lineTo(cx + s * 0.22, s * 0.14);
                ctx.lineTo(cx + s * 0.15, s * 0.14);
                ctx.lineTo(cx + s * 0.15, s * 0.22);
                ctx.lineTo(cx + s * 0.06, s * 0.22);
                ctx.lineTo(cx + s * 0.06, s * 0.14);
                ctx.lineTo(cx - s * 0.06, s * 0.14);
                ctx.lineTo(cx - s * 0.06, s * 0.22);
                ctx.lineTo(cx - s * 0.15, s * 0.22);
                ctx.lineTo(cx - s * 0.15, s * 0.14);
                ctx.lineTo(cx - s * 0.22, s * 0.14);
                ctx.lineTo(cx - s * 0.22, s * 0.32);
                ctx.lineTo(cx - s * 0.14, s * 0.35);
                ctx.lineTo(cx - s * 0.18, s * 0.75);
                ctx.closePath();
                break;

            case 'B': // Bishop
                ctx.moveTo(cx - s * 0.2, s * 0.88);
                ctx.lineTo(cx + s * 0.2, s * 0.88);
                ctx.lineTo(cx + s * 0.16, s * 0.78);
                ctx.lineTo(cx + s * 0.1, s * 0.52);
                ctx.quadraticCurveTo(cx + s * 0.2, s * 0.38, cx + s * 0.14, s * 0.25);
                ctx.quadraticCurveTo(cx + s * 0.1, s * 0.15, cx, s * 0.14);
                ctx.quadraticCurveTo(cx - s * 0.1, s * 0.15, cx - s * 0.14, s * 0.25);
                ctx.quadraticCurveTo(cx - s * 0.2, s * 0.38, cx - s * 0.1, s * 0.52);
                ctx.lineTo(cx - s * 0.16, s * 0.78);
                ctx.closePath();
                break;

            case 'N': // Knight
                ctx.moveTo(cx - s * 0.18, s * 0.88);
                ctx.lineTo(cx + s * 0.2, s * 0.88);
                ctx.lineTo(cx + s * 0.16, s * 0.7);
                ctx.lineTo(cx + s * 0.12, s * 0.55);
                ctx.quadraticCurveTo(cx + s * 0.22, s * 0.42, cx + s * 0.18, s * 0.3);
                ctx.quadraticCurveTo(cx + s * 0.15, s * 0.2, cx + s * 0.05, s * 0.18);
                ctx.lineTo(cx + s * 0.1, s * 0.12);
                ctx.quadraticCurveTo(cx + s * 0.05, s * 0.08, cx - s * 0.08, s * 0.12);
                ctx.quadraticCurveTo(cx - s * 0.2, s * 0.16, cx - s * 0.28, s * 0.26);
                ctx.lineTo(cx - s * 0.32, s * 0.3);
                ctx.lineTo(cx - s * 0.24, s * 0.34);
                ctx.quadraticCurveTo(cx - s * 0.18, s * 0.4, cx - s * 0.12, s * 0.44);
                ctx.quadraticCurveTo(cx - s * 0.18, s * 0.55, cx - s * 0.14, s * 0.7);
                ctx.closePath();
                break;

            case 'P': // Pawn
                ctx.moveTo(cx - s * 0.16, s * 0.88);
                ctx.lineTo(cx + s * 0.16, s * 0.88);
                ctx.lineTo(cx + s * 0.13, s * 0.78);
                ctx.lineTo(cx + s * 0.09, s * 0.55);
                ctx.quadraticCurveTo(cx + s * 0.16, s * 0.45, cx + s * 0.14, s * 0.35);
                ctx.arc(cx, s * 0.26, s * 0.14, Math.PI * 0.25, Math.PI * 2.75);
                ctx.quadraticCurveTo(cx - s * 0.16, s * 0.45, cx - s * 0.09, s * 0.55);
                ctx.lineTo(cx - s * 0.13, s * 0.78);
                ctx.closePath();
                break;
        }

        if (fill) {
            ctx.fill();
        }
        ctx.stroke();
    };

    // Draw white background first
    ctx.fillStyle = '#ffffff';
    drawPieceShape(true);

    // For black pieces, add diagonal line hatching
    if (!isWhite) {
        ctx.save();
        ctx.clip();

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = s * 0.018;

        // Draw diagonal lines
        const spacing = s * 0.045;
        for (let i = -s; i < s * 2; i += spacing) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + s, s);
            ctx.stroke();
        }

        ctx.restore();

        // Redraw outline
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = s * 0.025;
        drawPieceShape(false);
    }

    // Add bishop ball and slot
    if (type === 'B') {
        ctx.beginPath();
        ctx.arc(cx, s * 0.095, s * 0.055, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        if (!isWhite) {
            ctx.save();
            ctx.clip();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = s * 0.018;
            const spacing = s * 0.045;
            for (let i = -s; i < s * 2; i += spacing) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i + s, s);
                ctx.stroke();
            }
            ctx.restore();
        }
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = s * 0.025;
        ctx.stroke();

        // Slot
        ctx.fillStyle = '#000000';
        ctx.fillRect(cx - s * 0.015, s * 0.3, s * 0.03, s * 0.14);
    }

    // Knight eye
    if (type === 'N') {
        ctx.beginPath();
        ctx.arc(cx - s * 0.04, s * 0.28, s * 0.025, 0, Math.PI * 2);
        ctx.fillStyle = '#000000';
        ctx.fill();
    }
}

// Draw editorial woodcut-style pieces (bold silhouettes, stipple/crosshatch for black)
function drawEditorialPiece(ctx: CanvasRenderingContext2D, type: string, isWhite: boolean, size: number): void {
    const s = size;
    const cx = s / 2;

    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';

    // Helper to draw bold piece silhouettes (woodcut proportions)
    const drawShape = () => {
        ctx.beginPath();
        switch (type) {
            case 'K': // King - heavy crown cross
                ctx.moveTo(cx - s * 0.28, s * 0.9);
                ctx.lineTo(cx + s * 0.28, s * 0.9);  // wide base
                ctx.lineTo(cx + s * 0.28, s * 0.82);
                ctx.lineTo(cx + s * 0.2, s * 0.78);
                ctx.lineTo(cx + s * 0.16, s * 0.48);
                ctx.lineTo(cx + s * 0.16, s * 0.34);
                ctx.lineTo(cx + s * 0.08, s * 0.34);
                ctx.lineTo(cx + s * 0.08, s * 0.2);
                ctx.lineTo(cx + s * 0.16, s * 0.2);
                ctx.lineTo(cx + s * 0.16, s * 0.1);
                ctx.lineTo(cx - s * 0.16, s * 0.1);
                ctx.lineTo(cx - s * 0.16, s * 0.2);
                ctx.lineTo(cx - s * 0.08, s * 0.2);
                ctx.lineTo(cx - s * 0.08, s * 0.34);
                ctx.lineTo(cx - s * 0.16, s * 0.34);
                ctx.lineTo(cx - s * 0.16, s * 0.48);
                ctx.lineTo(cx - s * 0.2, s * 0.78);
                ctx.lineTo(cx - s * 0.28, s * 0.82);
                ctx.closePath();
                break;

            case 'Q': // Queen - pointed crown with orbs
                ctx.moveTo(cx - s * 0.28, s * 0.9);
                ctx.lineTo(cx + s * 0.28, s * 0.9);
                ctx.lineTo(cx + s * 0.22, s * 0.76);
                ctx.lineTo(cx + s * 0.16, s * 0.45);
                ctx.lineTo(cx + s * 0.3, s * 0.14);
                ctx.lineTo(cx + s * 0.16, s * 0.3);
                ctx.lineTo(cx + s * 0.12, s * 0.08);
                ctx.lineTo(cx, s * 0.26);
                ctx.lineTo(cx - s * 0.12, s * 0.08);
                ctx.lineTo(cx - s * 0.16, s * 0.3);
                ctx.lineTo(cx - s * 0.3, s * 0.14);
                ctx.lineTo(cx - s * 0.16, s * 0.45);
                ctx.lineTo(cx - s * 0.22, s * 0.76);
                ctx.closePath();
                break;

            case 'R': // Rook - fortress battlements
                ctx.moveTo(cx - s * 0.26, s * 0.9);
                ctx.lineTo(cx + s * 0.26, s * 0.9);
                ctx.lineTo(cx + s * 0.22, s * 0.78);
                ctx.lineTo(cx + s * 0.16, s * 0.38);
                ctx.lineTo(cx + s * 0.26, s * 0.35);
                ctx.lineTo(cx + s * 0.26, s * 0.12);
                ctx.lineTo(cx + s * 0.18, s * 0.12);
                ctx.lineTo(cx + s * 0.18, s * 0.22);
                ctx.lineTo(cx + s * 0.08, s * 0.22);
                ctx.lineTo(cx + s * 0.08, s * 0.12);
                ctx.lineTo(cx - s * 0.08, s * 0.12);
                ctx.lineTo(cx - s * 0.08, s * 0.22);
                ctx.lineTo(cx - s * 0.18, s * 0.22);
                ctx.lineTo(cx - s * 0.18, s * 0.12);
                ctx.lineTo(cx - s * 0.26, s * 0.12);
                ctx.lineTo(cx - s * 0.26, s * 0.35);
                ctx.lineTo(cx - s * 0.16, s * 0.38);
                ctx.lineTo(cx - s * 0.22, s * 0.78);
                ctx.closePath();
                break;

            case 'B': // Bishop - elongated mitre
                ctx.moveTo(cx - s * 0.24, s * 0.9);
                ctx.lineTo(cx + s * 0.24, s * 0.9);
                ctx.lineTo(cx + s * 0.18, s * 0.78);
                ctx.lineTo(cx + s * 0.14, s * 0.5);
                ctx.quadraticCurveTo(cx + s * 0.22, s * 0.36, cx + s * 0.12, s * 0.22);
                ctx.lineTo(cx, s * 0.08);
                ctx.lineTo(cx - s * 0.12, s * 0.22);
                ctx.quadraticCurveTo(cx - s * 0.22, s * 0.36, cx - s * 0.14, s * 0.5);
                ctx.lineTo(cx - s * 0.18, s * 0.78);
                ctx.closePath();
                break;

            case 'N': // Knight - bold horse head
                ctx.moveTo(cx - s * 0.2, s * 0.9);
                ctx.lineTo(cx + s * 0.24, s * 0.9);
                ctx.lineTo(cx + s * 0.2, s * 0.72);
                ctx.lineTo(cx + s * 0.14, s * 0.52);
                ctx.quadraticCurveTo(cx + s * 0.26, s * 0.38, cx + s * 0.2, s * 0.26);
                ctx.quadraticCurveTo(cx + s * 0.14, s * 0.14, cx + s * 0.02, s * 0.14);
                ctx.lineTo(cx + s * 0.08, s * 0.08);
                ctx.quadraticCurveTo(cx + s * 0.02, s * 0.04, cx - s * 0.12, s * 0.1);
                ctx.quadraticCurveTo(cx - s * 0.26, s * 0.16, cx - s * 0.32, s * 0.28);
                ctx.lineTo(cx - s * 0.36, s * 0.32);
                ctx.lineTo(cx - s * 0.26, s * 0.36);
                ctx.quadraticCurveTo(cx - s * 0.18, s * 0.42, cx - s * 0.14, s * 0.48);
                ctx.quadraticCurveTo(cx - s * 0.2, s * 0.6, cx - s * 0.16, s * 0.72);
                ctx.closePath();
                break;

            case 'P': // Pawn - stout ball on cone
                ctx.moveTo(cx - s * 0.2, s * 0.9);
                ctx.lineTo(cx + s * 0.2, s * 0.9);
                ctx.lineTo(cx + s * 0.16, s * 0.78);
                ctx.lineTo(cx + s * 0.1, s * 0.56);
                ctx.quadraticCurveTo(cx + s * 0.2, s * 0.42, cx + s * 0.16, s * 0.32);
                ctx.arc(cx, s * 0.24, s * 0.16, Math.PI * 0.2, Math.PI * 2.8);
                ctx.quadraticCurveTo(cx - s * 0.2, s * 0.42, cx - s * 0.1, s * 0.56);
                ctx.lineTo(cx - s * 0.16, s * 0.78);
                ctx.closePath();
                break;
        }
    };

    if (isWhite) {
        // WHITE: bold outline, clean white fill, double-line border
        ctx.fillStyle = '#ffffff';
        drawShape();
        ctx.fill();

        // Inner line for engraving effect
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = s * 0.035;
        drawShape();
        ctx.stroke();

        // Second inner outline for woodcut depth
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = s * 0.015;
        ctx.setLineDash([s * 0.02, s * 0.015]);
        const inset = s * 0.06;
        ctx.save();
        ctx.translate(0, 0);
        ctx.scale((s - inset * 2) / s, (s - inset * 2) / s);
        ctx.translate(inset * s / (s - inset * 2), inset * s / (s - inset * 2));
        drawShape();
        ctx.stroke();
        ctx.restore();
        ctx.setLineDash([]);
    } else {
        // BLACK: solid black fill with white stipple dots - woodcut negative
        ctx.fillStyle = '#000000';
        drawShape();
        ctx.fill();

        // Bold white outline
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = s * 0.03;
        drawShape();
        ctx.stroke();

        // Stipple dots for texture (woodcut engraving effect)
        ctx.save();
        drawShape();
        ctx.clip();

        ctx.fillStyle = '#ffffff';
        const dotSize = s * 0.012;
        const spacing = s * 0.04;
        for (let y = 0; y < s; y += spacing) {
            const offset = (Math.floor(y / spacing) % 2) * spacing * 0.5;
            for (let x = offset; x < s; x += spacing) {
                ctx.beginPath();
                ctx.arc(x, y, dotSize, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();

        // Re-stroke for clean edge
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = s * 0.02;
        drawShape();
        ctx.stroke();
    }

    // Bishop diagonal slash
    if (type === 'B') {
        ctx.strokeStyle = isWhite ? '#000000' : '#ffffff';
        ctx.lineWidth = s * 0.025;
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.06, s * 0.42);
        ctx.lineTo(cx + s * 0.06, s * 0.3);
        ctx.stroke();
        // Tip ball
        ctx.beginPath();
        ctx.arc(cx, s * 0.065, s * 0.05, 0, Math.PI * 2);
        ctx.fillStyle = isWhite ? '#000000' : '#ffffff';
        ctx.fill();
    }

    // Knight eye
    if (type === 'N') {
        ctx.beginPath();
        ctx.arc(cx - s * 0.06, s * 0.28, s * 0.03, 0, Math.PI * 2);
        ctx.fillStyle = isWhite ? '#000000' : '#ffffff';
        ctx.fill();
    }

    // Queen crown orbs
    if (type === 'Q') {
        const orbs = [
            [cx + s * 0.3, s * 0.1],
            [cx + s * 0.12, s * 0.04],
            [cx, s * 0.22],
            [cx - s * 0.12, s * 0.04],
            [cx - s * 0.3, s * 0.1],
        ];
        for (const [ox, oy] of orbs) {
            ctx.beginPath();
            ctx.arc(ox, oy, s * 0.04, 0, Math.PI * 2);
            ctx.fillStyle = isWhite ? '#000000' : '#ffffff';
            ctx.fill();
        }
    }
}

// Draw outline-only pieces (simple hollow silhouettes)
function drawOutlinePiece(ctx: CanvasRenderingContext2D, type: string, isWhite: boolean, size: number): void {
    const s = size;
    const cx = s / 2;

    ctx.lineWidth = s * 0.04;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = isWhite ? '#e8e4d8' : '#1a1816';
    ctx.fillStyle = 'transparent';

    // Add subtle glow for visibility
    ctx.shadowColor = isWhite ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.3)';
    ctx.shadowBlur = s * 0.03;

    ctx.beginPath();

    switch (type) {
        case 'K': // King - simplified crown with cross
            ctx.moveTo(cx - s * 0.22, s * 0.85);
            ctx.lineTo(cx + s * 0.22, s * 0.85);
            ctx.lineTo(cx + s * 0.18, s * 0.5);
            ctx.lineTo(cx + s * 0.1, s * 0.35);
            ctx.lineTo(cx + s * 0.1, s * 0.28);
            ctx.lineTo(cx + s * 0.05, s * 0.28);
            ctx.lineTo(cx + s * 0.05, s * 0.2);
            ctx.lineTo(cx + s * 0.1, s * 0.2);
            ctx.lineTo(cx + s * 0.1, s * 0.15);
            ctx.lineTo(cx - s * 0.1, s * 0.15);
            ctx.lineTo(cx - s * 0.1, s * 0.2);
            ctx.lineTo(cx - s * 0.05, s * 0.2);
            ctx.lineTo(cx - s * 0.05, s * 0.28);
            ctx.lineTo(cx - s * 0.1, s * 0.28);
            ctx.lineTo(cx - s * 0.1, s * 0.35);
            ctx.lineTo(cx - s * 0.18, s * 0.5);
            ctx.closePath();
            break;

        case 'Q': // Queen - crown shape
            ctx.moveTo(cx - s * 0.22, s * 0.85);
            ctx.lineTo(cx + s * 0.22, s * 0.85);
            ctx.lineTo(cx + s * 0.18, s * 0.5);
            ctx.lineTo(cx + s * 0.24, s * 0.18);
            ctx.lineTo(cx + s * 0.12, s * 0.32);
            ctx.lineTo(cx, s * 0.12);
            ctx.lineTo(cx - s * 0.12, s * 0.32);
            ctx.lineTo(cx - s * 0.24, s * 0.18);
            ctx.lineTo(cx - s * 0.18, s * 0.5);
            ctx.closePath();
            break;

        case 'R': // Rook - castle
            ctx.moveTo(cx - s * 0.2, s * 0.85);
            ctx.lineTo(cx + s * 0.2, s * 0.85);
            ctx.lineTo(cx + s * 0.16, s * 0.35);
            ctx.lineTo(cx + s * 0.2, s * 0.35);
            ctx.lineTo(cx + s * 0.2, s * 0.15);
            ctx.lineTo(cx + s * 0.12, s * 0.15);
            ctx.lineTo(cx + s * 0.12, s * 0.25);
            ctx.lineTo(cx + s * 0.04, s * 0.25);
            ctx.lineTo(cx + s * 0.04, s * 0.15);
            ctx.lineTo(cx - s * 0.04, s * 0.15);
            ctx.lineTo(cx - s * 0.04, s * 0.25);
            ctx.lineTo(cx - s * 0.12, s * 0.25);
            ctx.lineTo(cx - s * 0.12, s * 0.15);
            ctx.lineTo(cx - s * 0.2, s * 0.15);
            ctx.lineTo(cx - s * 0.2, s * 0.35);
            ctx.lineTo(cx - s * 0.16, s * 0.35);
            ctx.closePath();
            break;

        case 'B': // Bishop - mitre
            ctx.moveTo(cx - s * 0.18, s * 0.85);
            ctx.lineTo(cx + s * 0.18, s * 0.85);
            ctx.lineTo(cx + s * 0.14, s * 0.55);
            ctx.quadraticCurveTo(cx + s * 0.18, s * 0.35, cx, s * 0.12);
            ctx.quadraticCurveTo(cx - s * 0.18, s * 0.35, cx - s * 0.14, s * 0.55);
            ctx.closePath();
            break;

        case 'N': // Knight - horse head
            ctx.moveTo(cx - s * 0.15, s * 0.85);
            ctx.lineTo(cx + s * 0.18, s * 0.85);
            ctx.lineTo(cx + s * 0.14, s * 0.55);
            ctx.quadraticCurveTo(cx + s * 0.2, s * 0.4, cx + s * 0.12, s * 0.25);
            ctx.lineTo(cx + s * 0.08, s * 0.15);
            ctx.quadraticCurveTo(cx - s * 0.05, s * 0.1, cx - s * 0.2, s * 0.2);
            ctx.lineTo(cx - s * 0.28, s * 0.28);
            ctx.lineTo(cx - s * 0.18, s * 0.32);
            ctx.quadraticCurveTo(cx - s * 0.15, s * 0.45, cx - s * 0.12, s * 0.55);
            ctx.closePath();
            break;

        case 'P': // Pawn - simple
            ctx.moveTo(cx - s * 0.15, s * 0.85);
            ctx.lineTo(cx + s * 0.15, s * 0.85);
            ctx.lineTo(cx + s * 0.1, s * 0.58);
            ctx.quadraticCurveTo(cx + s * 0.16, s * 0.45, cx + s * 0.12, s * 0.35);
            ctx.arc(cx, s * 0.26, s * 0.12, Math.PI * 0.3, Math.PI * 2.7);
            ctx.quadraticCurveTo(cx - s * 0.16, s * 0.45, cx - s * 0.1, s * 0.58);
            ctx.closePath();
            break;
    }

    ctx.stroke();
    ctx.shadowColor = 'transparent';
}

// Draw figurine algebraic notation style pieces (bold, filled, iconic)
function drawFigurinePiece(ctx: CanvasRenderingContext2D, type: string, isWhite: boolean, size: number): void {
    const s = size;
    const cx = s / 2;

    // Figurine style: solid filled pieces with clear outlines
    const fill = isWhite ? '#f5f2e8' : '#2a2622';
    const stroke = isWhite ? '#1a1815' : '#d8d4c8';

    ctx.lineWidth = s * 0.03;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;

    ctx.beginPath();

    switch (type) {
        case 'K': // King - bold with prominent cross
            // Base
            ctx.ellipse(cx, s * 0.84, s * 0.26, s * 0.06, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(cx - s * 0.22, s * 0.8);
            ctx.lineTo(cx + s * 0.22, s * 0.8);
            ctx.lineTo(cx + s * 0.16, s * 0.45);
            ctx.lineTo(cx + s * 0.12, s * 0.32);
            ctx.lineTo(cx + s * 0.12, s * 0.24);
            ctx.lineTo(cx + s * 0.2, s * 0.24);
            ctx.lineTo(cx + s * 0.2, s * 0.18);
            ctx.lineTo(cx + s * 0.06, s * 0.18);
            ctx.lineTo(cx + s * 0.06, s * 0.1);
            ctx.lineTo(cx - s * 0.06, s * 0.1);
            ctx.lineTo(cx - s * 0.06, s * 0.18);
            ctx.lineTo(cx - s * 0.2, s * 0.18);
            ctx.lineTo(cx - s * 0.2, s * 0.24);
            ctx.lineTo(cx - s * 0.12, s * 0.24);
            ctx.lineTo(cx - s * 0.12, s * 0.32);
            ctx.lineTo(cx - s * 0.16, s * 0.45);
            ctx.closePath();
            break;

        case 'Q': // Queen - bold crown with ball
            ctx.ellipse(cx, s * 0.84, s * 0.26, s * 0.06, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(cx - s * 0.22, s * 0.8);
            ctx.lineTo(cx + s * 0.22, s * 0.8);
            ctx.lineTo(cx + s * 0.16, s * 0.45);
            ctx.lineTo(cx + s * 0.22, s * 0.3);
            ctx.lineTo(cx + s * 0.1, s * 0.35);
            ctx.lineTo(cx, s * 0.2);
            ctx.lineTo(cx - s * 0.1, s * 0.35);
            ctx.lineTo(cx - s * 0.22, s * 0.3);
            ctx.lineTo(cx - s * 0.16, s * 0.45);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Ball on top
            ctx.beginPath();
            ctx.arc(cx, s * 0.14, s * 0.06, 0, Math.PI * 2);
            break;

        case 'R': // Rook
            ctx.ellipse(cx, s * 0.84, s * 0.24, s * 0.06, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(cx - s * 0.2, s * 0.8);
            ctx.lineTo(cx + s * 0.2, s * 0.8);
            ctx.lineTo(cx + s * 0.15, s * 0.35);
            ctx.lineTo(cx + s * 0.22, s * 0.35);
            ctx.lineTo(cx + s * 0.22, s * 0.12);
            ctx.lineTo(cx + s * 0.14, s * 0.12);
            ctx.lineTo(cx + s * 0.14, s * 0.22);
            ctx.lineTo(cx + s * 0.05, s * 0.22);
            ctx.lineTo(cx + s * 0.05, s * 0.12);
            ctx.lineTo(cx - s * 0.05, s * 0.12);
            ctx.lineTo(cx - s * 0.05, s * 0.22);
            ctx.lineTo(cx - s * 0.14, s * 0.22);
            ctx.lineTo(cx - s * 0.14, s * 0.12);
            ctx.lineTo(cx - s * 0.22, s * 0.12);
            ctx.lineTo(cx - s * 0.22, s * 0.35);
            ctx.lineTo(cx - s * 0.15, s * 0.35);
            ctx.closePath();
            break;

        case 'B': // Bishop
            ctx.ellipse(cx, s * 0.84, s * 0.22, s * 0.06, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(cx - s * 0.18, s * 0.8);
            ctx.lineTo(cx + s * 0.18, s * 0.8);
            ctx.lineTo(cx + s * 0.12, s * 0.5);
            ctx.quadraticCurveTo(cx + s * 0.2, s * 0.35, cx + s * 0.12, s * 0.22);
            ctx.quadraticCurveTo(cx + s * 0.08, s * 0.12, cx, s * 0.12);
            ctx.quadraticCurveTo(cx - s * 0.08, s * 0.12, cx - s * 0.12, s * 0.22);
            ctx.quadraticCurveTo(cx - s * 0.2, s * 0.35, cx - s * 0.12, s * 0.5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Ball on top
            ctx.beginPath();
            ctx.arc(cx, s * 0.09, s * 0.05, 0, Math.PI * 2);
            break;

        case 'N': // Knight
            ctx.ellipse(cx, s * 0.84, s * 0.22, s * 0.06, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(cx - s * 0.16, s * 0.8);
            ctx.lineTo(cx + s * 0.18, s * 0.8);
            ctx.lineTo(cx + s * 0.14, s * 0.55);
            ctx.quadraticCurveTo(cx + s * 0.22, s * 0.42, cx + s * 0.16, s * 0.28);
            ctx.quadraticCurveTo(cx + s * 0.12, s * 0.18, cx + s * 0.02, s * 0.16);
            ctx.lineTo(cx + s * 0.06, s * 0.1);
            ctx.quadraticCurveTo(cx - s * 0.02, s * 0.06, cx - s * 0.12, s * 0.12);
            ctx.quadraticCurveTo(cx - s * 0.22, s * 0.16, cx - s * 0.28, s * 0.25);
            ctx.lineTo(cx - s * 0.32, s * 0.28);
            ctx.lineTo(cx - s * 0.24, s * 0.32);
            ctx.quadraticCurveTo(cx - s * 0.18, s * 0.4, cx - s * 0.12, s * 0.45);
            ctx.quadraticCurveTo(cx - s * 0.18, s * 0.55, cx - s * 0.14, s * 0.65);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Eye
            ctx.beginPath();
            ctx.arc(cx - s * 0.05, s * 0.26, s * 0.03, 0, Math.PI * 2);
            ctx.fillStyle = stroke;
            ctx.fill();
            ctx.fillStyle = fill;
            return;

        case 'P': // Pawn
            ctx.ellipse(cx, s * 0.84, s * 0.2, s * 0.06, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(cx - s * 0.14, s * 0.8);
            ctx.lineTo(cx + s * 0.14, s * 0.8);
            ctx.lineTo(cx + s * 0.1, s * 0.55);
            ctx.quadraticCurveTo(cx + s * 0.16, s * 0.45, cx + s * 0.14, s * 0.35);
            ctx.arc(cx, s * 0.25, s * 0.14, Math.PI * 0.25, Math.PI * 2.75);
            ctx.quadraticCurveTo(cx - s * 0.16, s * 0.45, cx - s * 0.1, s * 0.55);
            ctx.closePath();
            break;
    }

    ctx.fill();
    ctx.stroke();
}

// =============================================================================
// NEW 2D STYLES - Pixel, Gothic, Minimalist, Celtic, Sketch
// =============================================================================

// Draw pixel art 8-bit style pieces
function drawPixelPiece(ctx: CanvasRenderingContext2D, type: string, isWhite: boolean, size: number): void {
    const s = size;
    const pixelSize = s / 16; // 16x16 grid
    const fill = isWhite ? '#f0ece0' : '#2a2520';
    const outline = isWhite ? '#3a3530' : '#c8c4b8';
    const highlight = isWhite ? '#ffffff' : '#4a4540';

    ctx.imageSmoothingEnabled = false;

    const drawPixel = (x: number, y: number, color: string) => {
        ctx.fillStyle = color;
        ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
    };

    // Pixel art patterns for each piece (16x16 grid, centered)
    const patterns: Record<string, number[][]> = {
        'K': [
            [0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
            [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        ],
        'Q': [
            [0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0],
            [0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
            [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        ],
        'R': [
            [0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 0, 0],
            [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
            [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        ],
        'B': [
            [0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
            [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        ],
        'N': [
            [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        ],
        'P': [
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        ],
    };

    const pattern = patterns[type] || patterns['P'];

    // Draw outline first
    for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
            if (pattern[y][x] === 1) {
                // Check if edge pixel
                const isEdge = (
                    x === 0 || x === 15 || y === 0 || y === 15 ||
                    pattern[y - 1]?.[x] !== 1 || pattern[y + 1]?.[x] !== 1 ||
                    pattern[y][x - 1] !== 1 || pattern[y][x + 1] !== 1
                );
                drawPixel(x, y, isEdge ? outline : fill);
            }
        }
    }

    // Add highlight pixels (top-left inner)
    for (let y = 1; y < 15; y++) {
        for (let x = 1; x < 15; x++) {
            if (pattern[y][x] === 1 && pattern[y - 1]?.[x] === 1 && pattern[y][x - 1] === 1 &&
                (pattern[y - 1]?.[x - 1] !== 1 || y < 5)) {
                drawPixel(x, y, highlight);
            }
        }
    }
}

// Draw gothic ornate medieval style
function drawGothicPiece(ctx: CanvasRenderingContext2D, type: string, isWhite: boolean, size: number): void {
    const s = size;
    const cx = s / 2;

    // Dark gothic colors
    const fill = isWhite ? '#d8d0c0' : '#1a1412';
    const stroke = isWhite ? '#2a2420' : '#a09080';
    const accent = isWhite ? '#8b7355' : '#705840';

    ctx.lineWidth = s * 0.025;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;

    // Add dark shadow
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = s * 0.05;
    ctx.shadowOffsetX = s * 0.02;
    ctx.shadowOffsetY = s * 0.02;

    ctx.beginPath();

    switch (type) {
        case 'K': // Gothic King - pointed crown
            // Base
            ctx.moveTo(cx - s * 0.26, s * 0.88);
            ctx.lineTo(cx + s * 0.26, s * 0.88);
            ctx.lineTo(cx + s * 0.22, s * 0.78);
            ctx.lineTo(cx + s * 0.18, s * 0.55);
            // Gothic crown points
            ctx.lineTo(cx + s * 0.16, s * 0.35);
            ctx.lineTo(cx + s * 0.22, s * 0.22);
            ctx.lineTo(cx + s * 0.14, s * 0.28);
            ctx.lineTo(cx + s * 0.1, s * 0.15);
            ctx.lineTo(cx + s * 0.04, s * 0.25);
            ctx.lineTo(cx, s * 0.08);
            ctx.lineTo(cx - s * 0.04, s * 0.25);
            ctx.lineTo(cx - s * 0.1, s * 0.15);
            ctx.lineTo(cx - s * 0.14, s * 0.28);
            ctx.lineTo(cx - s * 0.22, s * 0.22);
            ctx.lineTo(cx - s * 0.16, s * 0.35);
            ctx.lineTo(cx - s * 0.18, s * 0.55);
            ctx.lineTo(cx - s * 0.22, s * 0.78);
            ctx.closePath();
            break;

        case 'Q': // Gothic Queen - ornate crown
            ctx.moveTo(cx - s * 0.26, s * 0.88);
            ctx.lineTo(cx + s * 0.26, s * 0.88);
            ctx.lineTo(cx + s * 0.22, s * 0.75);
            ctx.lineTo(cx + s * 0.18, s * 0.5);
            // Fleur-de-lis style crown
            ctx.quadraticCurveTo(cx + s * 0.25, s * 0.4, cx + s * 0.2, s * 0.25);
            ctx.quadraticCurveTo(cx + s * 0.22, s * 0.2, cx + s * 0.15, s * 0.18);
            ctx.quadraticCurveTo(cx + s * 0.1, s * 0.22, cx + s * 0.08, s * 0.15);
            ctx.quadraticCurveTo(cx + s * 0.04, s * 0.08, cx, s * 0.06);
            ctx.quadraticCurveTo(cx - s * 0.04, s * 0.08, cx - s * 0.08, s * 0.15);
            ctx.quadraticCurveTo(cx - s * 0.1, s * 0.22, cx - s * 0.15, s * 0.18);
            ctx.quadraticCurveTo(cx - s * 0.22, s * 0.2, cx - s * 0.2, s * 0.25);
            ctx.quadraticCurveTo(cx - s * 0.25, s * 0.4, cx - s * 0.18, s * 0.5);
            ctx.lineTo(cx - s * 0.22, s * 0.75);
            ctx.closePath();
            break;

        case 'R': // Gothic Rook - castle tower
            ctx.moveTo(cx - s * 0.24, s * 0.88);
            ctx.lineTo(cx + s * 0.24, s * 0.88);
            ctx.lineTo(cx + s * 0.2, s * 0.7);
            ctx.lineTo(cx + s * 0.18, s * 0.4);
            // Crenellations
            ctx.lineTo(cx + s * 0.24, s * 0.4);
            ctx.lineTo(cx + s * 0.24, s * 0.12);
            ctx.lineTo(cx + s * 0.16, s * 0.12);
            ctx.lineTo(cx + s * 0.16, s * 0.22);
            ctx.lineTo(cx + s * 0.06, s * 0.22);
            ctx.lineTo(cx + s * 0.06, s * 0.12);
            ctx.lineTo(cx - s * 0.06, s * 0.12);
            ctx.lineTo(cx - s * 0.06, s * 0.22);
            ctx.lineTo(cx - s * 0.16, s * 0.22);
            ctx.lineTo(cx - s * 0.16, s * 0.12);
            ctx.lineTo(cx - s * 0.24, s * 0.12);
            ctx.lineTo(cx - s * 0.24, s * 0.4);
            ctx.lineTo(cx - s * 0.18, s * 0.4);
            ctx.lineTo(cx - s * 0.2, s * 0.7);
            ctx.closePath();
            break;

        case 'B': // Gothic Bishop - pointed mitre
            ctx.moveTo(cx - s * 0.22, s * 0.88);
            ctx.lineTo(cx + s * 0.22, s * 0.88);
            ctx.lineTo(cx + s * 0.18, s * 0.7);
            ctx.lineTo(cx + s * 0.14, s * 0.45);
            ctx.quadraticCurveTo(cx + s * 0.2, s * 0.35, cx + s * 0.12, s * 0.22);
            ctx.lineTo(cx, s * 0.08);
            ctx.lineTo(cx - s * 0.12, s * 0.22);
            ctx.quadraticCurveTo(cx - s * 0.2, s * 0.35, cx - s * 0.14, s * 0.45);
            ctx.lineTo(cx - s * 0.18, s * 0.7);
            ctx.closePath();
            break;

        case 'N': // Gothic Knight - armored horse
            ctx.moveTo(cx - s * 0.2, s * 0.88);
            ctx.lineTo(cx + s * 0.22, s * 0.88);
            ctx.lineTo(cx + s * 0.18, s * 0.65);
            ctx.quadraticCurveTo(cx + s * 0.28, s * 0.5, cx + s * 0.2, s * 0.3);
            ctx.lineTo(cx + s * 0.15, s * 0.18);
            ctx.quadraticCurveTo(cx + s * 0.1, s * 0.1, cx - s * 0.05, s * 0.12);
            ctx.lineTo(cx - s * 0.15, s * 0.08);
            ctx.lineTo(cx - s * 0.25, s * 0.15);
            ctx.lineTo(cx - s * 0.3, s * 0.25);
            ctx.lineTo(cx - s * 0.2, s * 0.3);
            ctx.quadraticCurveTo(cx - s * 0.15, s * 0.45, cx - s * 0.12, s * 0.55);
            ctx.lineTo(cx - s * 0.16, s * 0.7);
            ctx.closePath();
            break;

        case 'P': // Gothic Pawn - pointed helmet
            ctx.moveTo(cx - s * 0.18, s * 0.88);
            ctx.lineTo(cx + s * 0.18, s * 0.88);
            ctx.lineTo(cx + s * 0.14, s * 0.7);
            ctx.lineTo(cx + s * 0.1, s * 0.5);
            ctx.quadraticCurveTo(cx + s * 0.16, s * 0.4, cx + s * 0.1, s * 0.3);
            ctx.lineTo(cx, s * 0.12);
            ctx.lineTo(cx - s * 0.1, s * 0.3);
            ctx.quadraticCurveTo(cx - s * 0.16, s * 0.4, cx - s * 0.1, s * 0.5);
            ctx.lineTo(cx - s * 0.14, s * 0.7);
            ctx.closePath();
            break;
    }

    ctx.fill();
    ctx.stroke();

    // Add gothic decorative lines
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = accent;
    ctx.lineWidth = s * 0.015;

    if (type === 'K' || type === 'Q') {
        // Crown band
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.16, s * 0.35);
        ctx.lineTo(cx + s * 0.16, s * 0.35);
        ctx.stroke();
    }
    if (type === 'B') {
        // Mitre cross
        ctx.beginPath();
        ctx.moveTo(cx, s * 0.2);
        ctx.lineTo(cx, s * 0.4);
        ctx.moveTo(cx - s * 0.08, s * 0.3);
        ctx.lineTo(cx + s * 0.08, s * 0.3);
        ctx.stroke();
    }
}

// Draw ultra-minimalist geometric style
function drawMinimalistPiece(ctx: CanvasRenderingContext2D, type: string, isWhite: boolean, size: number): void {
    const s = size;
    const cx = s / 2;

    const fill = isWhite ? '#f8f6f0' : '#18161a';
    const stroke = isWhite ? '#1a1816' : '#e8e6e0';

    ctx.lineWidth = s * 0.035;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;

    ctx.beginPath();

    switch (type) {
        case 'K': // Simple cross on rectangle
            // Rectangle body
            ctx.rect(cx - s * 0.15, s * 0.35, s * 0.3, s * 0.5);
            ctx.fill();
            ctx.stroke();
            // Cross
            ctx.beginPath();
            ctx.moveTo(cx, s * 0.1);
            ctx.lineTo(cx, s * 0.3);
            ctx.moveTo(cx - s * 0.1, s * 0.2);
            ctx.lineTo(cx + s * 0.1, s * 0.2);
            ctx.stroke();
            return;

        case 'Q': // Circle on rectangle
            ctx.rect(cx - s * 0.15, s * 0.4, s * 0.3, s * 0.45);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, s * 0.25, s * 0.12, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            return;

        case 'R': // Simple rectangle with notches
            ctx.rect(cx - s * 0.18, s * 0.25, s * 0.36, s * 0.6);
            ctx.fill();
            ctx.stroke();
            // Three notches at top
            ctx.fillStyle = isWhite ? '#f8f6f0' : '#18161a';
            ctx.fillRect(cx - s * 0.1, s * 0.15, s * 0.06, s * 0.15);
            ctx.fillRect(cx + s * 0.04, s * 0.15, s * 0.06, s * 0.15);
            return;

        case 'B': // Triangle
            ctx.moveTo(cx, s * 0.12);
            ctx.lineTo(cx + s * 0.18, s * 0.85);
            ctx.lineTo(cx - s * 0.18, s * 0.85);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            return;

        case 'N': // L-shape
            ctx.moveTo(cx - s * 0.15, s * 0.85);
            ctx.lineTo(cx - s * 0.15, s * 0.2);
            ctx.lineTo(cx + s * 0.15, s * 0.2);
            ctx.lineTo(cx + s * 0.15, s * 0.45);
            ctx.lineTo(cx, s * 0.45);
            ctx.lineTo(cx, s * 0.85);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            return;

        case 'P': // Simple circle
            ctx.arc(cx, s * 0.5, s * 0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            return;
    }
}

// Draw Celtic knotwork style
function drawCelticPiece(ctx: CanvasRenderingContext2D, type: string, isWhite: boolean, size: number): void {
    const s = size;
    const cx = s / 2;

    const fill = isWhite ? '#e8e4d8' : '#1a1816';
    const stroke = isWhite ? '#2a6030' : '#40a048'; // Celtic green
    const accent = isWhite ? '#8b4513' : '#cd853f'; // Celtic bronze

    ctx.lineWidth = s * 0.03;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw main shape
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;

    ctx.beginPath();

    switch (type) {
        case 'K': // Celtic King with knotwork crown
            ctx.moveTo(cx - s * 0.22, s * 0.88);
            ctx.lineTo(cx + s * 0.22, s * 0.88);
            ctx.lineTo(cx + s * 0.18, s * 0.5);
            // Interlaced top
            ctx.quadraticCurveTo(cx + s * 0.22, s * 0.35, cx + s * 0.1, s * 0.25);
            ctx.quadraticCurveTo(cx + s * 0.15, s * 0.15, cx, s * 0.1);
            ctx.quadraticCurveTo(cx - s * 0.15, s * 0.15, cx - s * 0.1, s * 0.25);
            ctx.quadraticCurveTo(cx - s * 0.22, s * 0.35, cx - s * 0.18, s * 0.5);
            ctx.closePath();
            break;

        case 'Q': // Celtic Queen with spiral
            ctx.moveTo(cx - s * 0.22, s * 0.88);
            ctx.lineTo(cx + s * 0.22, s * 0.88);
            ctx.lineTo(cx + s * 0.16, s * 0.45);
            ctx.arc(cx, s * 0.28, s * 0.16, 0, Math.PI * 2);
            ctx.moveTo(cx - s * 0.16, s * 0.45);
            ctx.closePath();
            break;

        case 'R': // Celtic tower
            ctx.moveTo(cx - s * 0.2, s * 0.88);
            ctx.lineTo(cx + s * 0.2, s * 0.88);
            ctx.lineTo(cx + s * 0.16, s * 0.35);
            ctx.lineTo(cx + s * 0.2, s * 0.15);
            ctx.lineTo(cx - s * 0.2, s * 0.15);
            ctx.lineTo(cx - s * 0.16, s * 0.35);
            ctx.closePath();
            break;

        case 'B': // Celtic bishop with trinity knot area
            ctx.moveTo(cx - s * 0.18, s * 0.88);
            ctx.lineTo(cx + s * 0.18, s * 0.88);
            ctx.lineTo(cx + s * 0.12, s * 0.5);
            ctx.quadraticCurveTo(cx + s * 0.18, s * 0.3, cx, s * 0.12);
            ctx.quadraticCurveTo(cx - s * 0.18, s * 0.3, cx - s * 0.12, s * 0.5);
            ctx.closePath();
            break;

        case 'N': // Celtic horse
            ctx.moveTo(cx - s * 0.16, s * 0.88);
            ctx.lineTo(cx + s * 0.2, s * 0.88);
            ctx.lineTo(cx + s * 0.16, s * 0.55);
            ctx.quadraticCurveTo(cx + s * 0.25, s * 0.4, cx + s * 0.15, s * 0.25);
            ctx.quadraticCurveTo(cx + s * 0.05, s * 0.1, cx - s * 0.15, s * 0.15);
            ctx.lineTo(cx - s * 0.25, s * 0.25);
            ctx.quadraticCurveTo(cx - s * 0.15, s * 0.4, cx - s * 0.12, s * 0.55);
            ctx.closePath();
            break;

        case 'P': // Celtic pawn with spiral
            ctx.moveTo(cx - s * 0.14, s * 0.88);
            ctx.lineTo(cx + s * 0.14, s * 0.88);
            ctx.lineTo(cx + s * 0.1, s * 0.55);
            ctx.arc(cx, s * 0.35, s * 0.14, Math.PI * 0.3, Math.PI * 2.7);
            ctx.lineTo(cx - s * 0.1, s * 0.55);
            ctx.closePath();
            break;
    }

    ctx.fill();
    ctx.stroke();

    // Add Celtic knotwork decoration
    ctx.strokeStyle = accent;
    ctx.lineWidth = s * 0.02;

    // Draw interlace patterns
    if (type === 'K' || type === 'Q') {
        // Circular knotwork
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
            const angle = (i * Math.PI * 2) / 3;
            const r = s * 0.08;
            const x = cx + Math.cos(angle) * r * 0.6;
            const y = s * 0.32 + Math.sin(angle) * r * 0.6;
            ctx.moveTo(x + r * 0.4, y);
            ctx.arc(x, y, r * 0.4, 0, Math.PI * 2);
        }
        ctx.stroke();
    }

    if (type === 'B') {
        // Trinity knot
        ctx.beginPath();
        ctx.moveTo(cx, s * 0.22);
        ctx.quadraticCurveTo(cx + s * 0.08, s * 0.32, cx, s * 0.42);
        ctx.quadraticCurveTo(cx - s * 0.08, s * 0.32, cx, s * 0.22);
        ctx.stroke();
    }
}

// Draw hand-sketched pencil style
function drawSketchPiece(ctx: CanvasRenderingContext2D, type: string, isWhite: boolean, size: number): void {
    const s = size;
    const cx = s / 2;

    const stroke = isWhite ? '#3a3835' : '#d8d4c8';
    const fill = isWhite ? '#f5f2e8' : '#252220';

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = fill;

    // Sketchy line function - draws wobbly lines
    const sketchLine = (x1: number, y1: number, x2: number, y2: number) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        // Add slight wobble
        const midX = (x1 + x2) / 2 + (Math.random() - 0.5) * s * 0.02;
        const midY = (y1 + y2) / 2 + (Math.random() - 0.5) * s * 0.02;
        ctx.quadraticCurveTo(midX, midY, x2, y2);
        ctx.stroke();
    };

    // Draw multiple sketchy lines for that hand-drawn look
    const sketchyStroke = () => {
        ctx.strokeStyle = stroke;
        // Draw 2-3 overlapping strokes with slight variation
        for (let i = 0; i < 2; i++) {
            ctx.lineWidth = s * (0.015 + Math.random() * 0.01);
            ctx.stroke();
        }
    };

    ctx.beginPath();

    switch (type) {
        case 'K':
            ctx.moveTo(cx - s * 0.2, s * 0.85);
            ctx.lineTo(cx + s * 0.2, s * 0.85);
            ctx.lineTo(cx + s * 0.16, s * 0.5);
            ctx.lineTo(cx + s * 0.12, s * 0.35);
            // Cross
            ctx.lineTo(cx + s * 0.06, s * 0.35);
            ctx.lineTo(cx + s * 0.06, s * 0.25);
            ctx.lineTo(cx + s * 0.12, s * 0.25);
            ctx.lineTo(cx + s * 0.12, s * 0.18);
            ctx.lineTo(cx - s * 0.12, s * 0.18);
            ctx.lineTo(cx - s * 0.12, s * 0.25);
            ctx.lineTo(cx - s * 0.06, s * 0.25);
            ctx.lineTo(cx - s * 0.06, s * 0.35);
            ctx.lineTo(cx - s * 0.12, s * 0.35);
            ctx.lineTo(cx - s * 0.16, s * 0.5);
            ctx.closePath();
            break;

        case 'Q':
            ctx.moveTo(cx - s * 0.2, s * 0.85);
            ctx.lineTo(cx + s * 0.2, s * 0.85);
            ctx.lineTo(cx + s * 0.16, s * 0.5);
            ctx.lineTo(cx + s * 0.2, s * 0.3);
            ctx.lineTo(cx + s * 0.08, s * 0.35);
            ctx.lineTo(cx, s * 0.18);
            ctx.lineTo(cx - s * 0.08, s * 0.35);
            ctx.lineTo(cx - s * 0.2, s * 0.3);
            ctx.lineTo(cx - s * 0.16, s * 0.5);
            ctx.closePath();
            break;

        case 'R':
            ctx.moveTo(cx - s * 0.18, s * 0.85);
            ctx.lineTo(cx + s * 0.18, s * 0.85);
            ctx.lineTo(cx + s * 0.14, s * 0.35);
            ctx.lineTo(cx + s * 0.18, s * 0.35);
            ctx.lineTo(cx + s * 0.18, s * 0.15);
            ctx.lineTo(cx + s * 0.1, s * 0.15);
            ctx.lineTo(cx + s * 0.1, s * 0.25);
            ctx.lineTo(cx - s * 0.1, s * 0.25);
            ctx.lineTo(cx - s * 0.1, s * 0.15);
            ctx.lineTo(cx - s * 0.18, s * 0.15);
            ctx.lineTo(cx - s * 0.18, s * 0.35);
            ctx.lineTo(cx - s * 0.14, s * 0.35);
            ctx.closePath();
            break;

        case 'B':
            ctx.moveTo(cx - s * 0.16, s * 0.85);
            ctx.lineTo(cx + s * 0.16, s * 0.85);
            ctx.lineTo(cx + s * 0.12, s * 0.55);
            ctx.quadraticCurveTo(cx + s * 0.18, s * 0.4, cx, s * 0.15);
            ctx.quadraticCurveTo(cx - s * 0.18, s * 0.4, cx - s * 0.12, s * 0.55);
            ctx.closePath();
            break;

        case 'N':
            ctx.moveTo(cx - s * 0.14, s * 0.85);
            ctx.lineTo(cx + s * 0.18, s * 0.85);
            ctx.lineTo(cx + s * 0.14, s * 0.55);
            ctx.quadraticCurveTo(cx + s * 0.22, s * 0.4, cx + s * 0.12, s * 0.25);
            ctx.lineTo(cx + s * 0.06, s * 0.15);
            ctx.quadraticCurveTo(cx - s * 0.08, s * 0.12, cx - s * 0.2, s * 0.2);
            ctx.lineTo(cx - s * 0.26, s * 0.28);
            ctx.lineTo(cx - s * 0.18, s * 0.32);
            ctx.quadraticCurveTo(cx - s * 0.12, s * 0.45, cx - s * 0.1, s * 0.55);
            ctx.closePath();
            break;

        case 'P':
            ctx.moveTo(cx - s * 0.12, s * 0.85);
            ctx.lineTo(cx + s * 0.12, s * 0.85);
            ctx.lineTo(cx + s * 0.08, s * 0.55);
            ctx.arc(cx, s * 0.38, s * 0.12, Math.PI * 0.3, Math.PI * 2.7);
            ctx.lineTo(cx - s * 0.08, s * 0.55);
            ctx.closePath();
            break;
    }

    ctx.fill();
    sketchyStroke();

    // Add sketch hatching for shading
    ctx.strokeStyle = stroke;
    ctx.lineWidth = s * 0.008;
    ctx.globalAlpha = 0.3;

    // Quick diagonal hatch marks
    for (let i = 0; i < 8; i++) {
        const y = s * 0.3 + i * s * 0.08;
        sketchLine(cx - s * 0.1, y, cx - s * 0.05, y + s * 0.04);
    }

    ctx.globalAlpha = 1;
}

// Draw Ancient Egyptian Pharaoh style pieces
function drawPharaohPiece(ctx: CanvasRenderingContext2D, type: string, isWhite: boolean, size: number): void {
    const s = size;
    const cx = s / 2;

    // Egyptian colors - gold and lapis lazuli blue
    const fill = isWhite ? '#f5e6a8' : '#1a2840';  // Gold / Dark blue
    const stroke = isWhite ? '#8b6914' : '#c9a227'; // Dark gold / Bright gold
    const accent = isWhite ? '#1e4d8c' : '#f5e6a8'; // Blue / Gold accents
    const detail = isWhite ? '#2a1810' : '#d4af37'; // Dark detail / Gold detail

    ctx.lineWidth = s * 0.025;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;

    // Add golden glow
    ctx.shadowColor = isWhite ? 'rgba(212, 175, 55, 0.5)' : 'rgba(201, 162, 39, 0.4)';
    ctx.shadowBlur = s * 0.04;

    ctx.beginPath();

    switch (type) {
        case 'K': // Pharaoh with Nemes headdress and Uraeus
            // Nemes headdress (striped cloth)
            ctx.moveTo(cx - s * 0.28, s * 0.88);
            ctx.lineTo(cx + s * 0.28, s * 0.88);
            ctx.lineTo(cx + s * 0.24, s * 0.7);
            ctx.lineTo(cx + s * 0.26, s * 0.55);
            // Headdress flaps
            ctx.lineTo(cx + s * 0.22, s * 0.35);
            ctx.lineTo(cx + s * 0.18, s * 0.28);
            // Crown top
            ctx.lineTo(cx + s * 0.14, s * 0.22);
            ctx.lineTo(cx + s * 0.08, s * 0.18);
            // Uraeus (cobra) on top
            ctx.lineTo(cx + s * 0.04, s * 0.12);
            ctx.quadraticCurveTo(cx + s * 0.06, s * 0.06, cx, s * 0.05);
            ctx.quadraticCurveTo(cx - s * 0.06, s * 0.06, cx - s * 0.04, s * 0.12);
            ctx.lineTo(cx - s * 0.08, s * 0.18);
            ctx.lineTo(cx - s * 0.14, s * 0.22);
            ctx.lineTo(cx - s * 0.18, s * 0.28);
            ctx.lineTo(cx - s * 0.22, s * 0.35);
            ctx.lineTo(cx - s * 0.26, s * 0.55);
            ctx.lineTo(cx - s * 0.24, s * 0.7);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Draw Nemes stripes
            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = accent;
            ctx.lineWidth = s * 0.015;
            for (let i = 0; i < 5; i++) {
                const y = s * 0.35 + i * s * 0.1;
                ctx.beginPath();
                ctx.moveTo(cx - s * 0.22 + i * s * 0.01, y);
                ctx.lineTo(cx + s * 0.22 - i * s * 0.01, y);
                ctx.stroke();
            }

            // Uraeus cobra head detail
            ctx.fillStyle = accent;
            ctx.beginPath();
            ctx.arc(cx, s * 0.09, s * 0.03, 0, Math.PI * 2);
            ctx.fill();
            return;

        case 'Q': // Queen with vulture crown (Nekhbet)
            ctx.moveTo(cx - s * 0.26, s * 0.88);
            ctx.lineTo(cx + s * 0.26, s * 0.88);
            ctx.lineTo(cx + s * 0.22, s * 0.7);
            ctx.lineTo(cx + s * 0.2, s * 0.5);
            // Vulture wings spreading
            ctx.quadraticCurveTo(cx + s * 0.28, s * 0.38, cx + s * 0.22, s * 0.28);
            ctx.quadraticCurveTo(cx + s * 0.18, s * 0.22, cx + s * 0.12, s * 0.2);
            // Vulture head
            ctx.lineTo(cx + s * 0.06, s * 0.15);
            ctx.quadraticCurveTo(cx + s * 0.04, s * 0.08, cx, s * 0.06);
            ctx.quadraticCurveTo(cx - s * 0.04, s * 0.08, cx - s * 0.06, s * 0.15);
            ctx.lineTo(cx - s * 0.12, s * 0.2);
            ctx.quadraticCurveTo(cx - s * 0.18, s * 0.22, cx - s * 0.22, s * 0.28);
            ctx.quadraticCurveTo(cx - s * 0.28, s * 0.38, cx - s * 0.2, s * 0.5);
            ctx.lineTo(cx - s * 0.22, s * 0.7);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Wing feather details
            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = accent;
            ctx.lineWidth = s * 0.012;
            for (let i = 0; i < 4; i++) {
                const angle = Math.PI * 0.15 + i * 0.12;
                ctx.beginPath();
                ctx.moveTo(cx + s * 0.08, s * 0.35);
                ctx.lineTo(cx + s * 0.18 + i * s * 0.015, s * 0.28 + i * s * 0.04);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(cx - s * 0.08, s * 0.35);
                ctx.lineTo(cx - s * 0.18 - i * s * 0.015, s * 0.28 + i * s * 0.04);
                ctx.stroke();
            }
            return;

        case 'R': // Obelisk
            ctx.moveTo(cx - s * 0.2, s * 0.88);
            ctx.lineTo(cx + s * 0.2, s * 0.88);
            ctx.lineTo(cx + s * 0.16, s * 0.75);
            ctx.lineTo(cx + s * 0.14, s * 0.25);
            // Pyramidion (pointed top)
            ctx.lineTo(cx + s * 0.1, s * 0.18);
            ctx.lineTo(cx, s * 0.08);
            ctx.lineTo(cx - s * 0.1, s * 0.18);
            ctx.lineTo(cx - s * 0.14, s * 0.25);
            ctx.lineTo(cx - s * 0.16, s * 0.75);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Hieroglyphic decorations
            ctx.shadowColor = 'transparent';
            ctx.fillStyle = accent;
            // Ankh symbol
            ctx.beginPath();
            ctx.ellipse(cx, s * 0.38, s * 0.04, s * 0.05, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(cx - s * 0.015, s * 0.42, s * 0.03, s * 0.15);
            ctx.fillRect(cx - s * 0.05, s * 0.48, s * 0.1, s * 0.025);

            // Eye of Horus simplified
            ctx.beginPath();
            ctx.ellipse(cx, s * 0.65, s * 0.04, s * 0.025, 0, 0, Math.PI * 2);
            ctx.fill();
            return;

        case 'B': // Anubis (jackal-headed god)
            ctx.moveTo(cx - s * 0.18, s * 0.88);
            ctx.lineTo(cx + s * 0.18, s * 0.88);
            ctx.lineTo(cx + s * 0.14, s * 0.65);
            ctx.lineTo(cx + s * 0.12, s * 0.45);
            // Jackal snout
            ctx.quadraticCurveTo(cx + s * 0.18, s * 0.35, cx + s * 0.22, s * 0.28);
            ctx.lineTo(cx + s * 0.2, s * 0.22);
            // Tall ears
            ctx.lineTo(cx + s * 0.14, s * 0.18);
            ctx.lineTo(cx + s * 0.12, s * 0.08);
            ctx.lineTo(cx + s * 0.06, s * 0.15);
            ctx.lineTo(cx, s * 0.2);
            ctx.lineTo(cx - s * 0.06, s * 0.15);
            ctx.lineTo(cx - s * 0.12, s * 0.08);
            ctx.lineTo(cx - s * 0.14, s * 0.18);
            ctx.lineTo(cx - s * 0.2, s * 0.22);
            ctx.lineTo(cx - s * 0.22, s * 0.28);
            ctx.quadraticCurveTo(cx - s * 0.18, s * 0.35, cx - s * 0.12, s * 0.45);
            ctx.lineTo(cx - s * 0.14, s * 0.65);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Eye
            ctx.shadowColor = 'transparent';
            ctx.fillStyle = detail;
            ctx.beginPath();
            ctx.ellipse(cx + s * 0.02, s * 0.28, s * 0.025, s * 0.018, -0.3, 0, Math.PI * 2);
            ctx.fill();
            return;

        case 'N': // Sphinx
            ctx.moveTo(cx - s * 0.22, s * 0.88);
            ctx.lineTo(cx + s * 0.24, s * 0.88);
            // Lion body crouching
            ctx.lineTo(cx + s * 0.22, s * 0.7);
            ctx.lineTo(cx + s * 0.18, s * 0.55);
            // Human head with Nemes
            ctx.quadraticCurveTo(cx + s * 0.24, s * 0.45, cx + s * 0.18, s * 0.32);
            ctx.lineTo(cx + s * 0.14, s * 0.25);
            ctx.lineTo(cx + s * 0.1, s * 0.18);
            ctx.lineTo(cx + s * 0.06, s * 0.14);
            ctx.quadraticCurveTo(cx, s * 0.12, cx - s * 0.06, s * 0.14);
            // Front profile
            ctx.lineTo(cx - s * 0.12, s * 0.2);
            ctx.lineTo(cx - s * 0.16, s * 0.28);
            ctx.lineTo(cx - s * 0.22, s * 0.35);
            // Front paws
            ctx.lineTo(cx - s * 0.28, s * 0.45);
            ctx.lineTo(cx - s * 0.26, s * 0.55);
            ctx.lineTo(cx - s * 0.22, s * 0.65);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Face detail
            ctx.shadowColor = 'transparent';
            ctx.fillStyle = detail;
            ctx.beginPath();
            ctx.arc(cx - s * 0.02, s * 0.24, s * 0.02, 0, Math.PI * 2);
            ctx.fill();

            // Beard
            ctx.strokeStyle = detail;
            ctx.lineWidth = s * 0.02;
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.08, s * 0.32);
            ctx.lineTo(cx - s * 0.06, s * 0.42);
            ctx.stroke();
            return;

        case 'P': // Scarab beetle
            // Oval body
            ctx.ellipse(cx, s * 0.52, s * 0.16, s * 0.22, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Head
            ctx.beginPath();
            ctx.arc(cx, s * 0.26, s * 0.08, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Wing line
            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = accent;
            ctx.lineWidth = s * 0.02;
            ctx.beginPath();
            ctx.moveTo(cx, s * 0.35);
            ctx.lineTo(cx, s * 0.7);
            ctx.stroke();

            // Legs
            ctx.lineWidth = s * 0.015;
            for (let i = 0; i < 3; i++) {
                const y = s * 0.42 + i * s * 0.12;
                ctx.beginPath();
                ctx.moveTo(cx - s * 0.14, y);
                ctx.lineTo(cx - s * 0.22, y + s * 0.04);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(cx + s * 0.14, y);
                ctx.lineTo(cx + s * 0.22, y + s * 0.04);
                ctx.stroke();
            }

            // Sun disk on head
            ctx.fillStyle = accent;
            ctx.beginPath();
            ctx.arc(cx, s * 0.18, s * 0.04, 0, Math.PI * 2);
            ctx.fill();
            return;
    }

    ctx.fill();
    ctx.stroke();
}

// =============================================================================
// LICHESS SVG STYLE — High-quality vector pieces from pieces.ts
// =============================================================================

function drawLichessPiece(ctx: CanvasRenderingContext2D, type: string, isWhite: boolean, size: number): void {
    const img = getPieceImage(type, isWhite ? 'white' : 'black');
    if (img && img.complete && img.naturalWidth > 0) {
        // Draw the SVG image scaled to fill the canvas
        const padding = size * 0.05;
        ctx.drawImage(img, padding, padding, size - padding * 2, size - padding * 2);
    } else {
        // Fallback: draw classic piece if SVG not loaded yet
        drawClassicPiece(ctx, type, isWhite, size);
    }
}

// =============================================================================
// ART DECO STYLE — 1920s geometric with gold accents
// =============================================================================

function drawArtDecoPiece(ctx: CanvasRenderingContext2D, type: string, isWhite: boolean, size: number): void {
    const s = size;
    const cx = s / 2;

    const fill = isWhite ? '#f5f0e0' : '#1a1a2e';
    const stroke = isWhite ? '#b8860b' : '#daa520';  // Gold
    const accent = isWhite ? '#2a2a3e' : '#f5e6a8';

    ctx.lineWidth = s * 0.03;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;

    // Subtle gold shadow
    ctx.shadowColor = isWhite ? 'rgba(184,134,11,0.3)' : 'rgba(218,165,32,0.3)';
    ctx.shadowBlur = s * 0.03;

    switch (type) {
        case 'K': {
            // Stepped pyramid crown with sunburst
            ctx.beginPath();
            // Base
            ctx.rect(cx - s * 0.22, s * 0.7, s * 0.44, s * 0.18);
            ctx.fill(); ctx.stroke();
            // Middle step
            ctx.beginPath();
            ctx.rect(cx - s * 0.17, s * 0.5, s * 0.34, s * 0.22);
            ctx.fill(); ctx.stroke();
            // Top step
            ctx.beginPath();
            ctx.rect(cx - s * 0.12, s * 0.3, s * 0.24, s * 0.22);
            ctx.fill(); ctx.stroke();
            // Art deco sunburst at top
            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = accent;
            ctx.lineWidth = s * 0.015;
            for (let i = -2; i <= 2; i++) {
                const angle = -Math.PI / 2 + i * 0.2;
                ctx.beginPath();
                ctx.moveTo(cx, s * 0.3);
                ctx.lineTo(cx + Math.cos(angle) * s * 0.15, s * 0.3 + Math.sin(angle) * s * -0.2);
                ctx.stroke();
            }
            break;
        }
        case 'Q': {
            // Fan/shell motif
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.22, s * 0.88);
            ctx.lineTo(cx - s * 0.22, s * 0.5);
            ctx.arc(cx, s * 0.5, s * 0.22, Math.PI, 0);
            ctx.lineTo(cx + s * 0.22, s * 0.88);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            // Radiating fan lines
            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = accent;
            ctx.lineWidth = s * 0.012;
            for (let i = 0; i < 5; i++) {
                const a = Math.PI + i * Math.PI / 4;
                ctx.beginPath();
                ctx.moveTo(cx, s * 0.5);
                ctx.lineTo(cx + Math.cos(a) * s * 0.2, s * 0.5 + Math.sin(a) * s * 0.2);
                ctx.stroke();
            }
            // Crown point
            ctx.fillStyle = stroke;
            ctx.beginPath();
            ctx.arc(cx, s * 0.28, s * 0.04, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
        case 'R': {
            // Geometric tower with chevron detail
            ctx.beginPath();
            ctx.rect(cx - s * 0.2, s * 0.25, s * 0.4, s * 0.63);
            ctx.fill(); ctx.stroke();
            // Top crenellations — wide deco style
            ctx.beginPath();
            ctx.rect(cx - s * 0.25, s * 0.2, s * 0.14, s * 0.12);
            ctx.fill(); ctx.stroke();
            ctx.beginPath();
            ctx.rect(cx + s * 0.11, s * 0.2, s * 0.14, s * 0.12);
            ctx.fill(); ctx.stroke();
            // Chevron detail
            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = accent;
            ctx.lineWidth = s * 0.015;
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.12, s * 0.55);
            ctx.lineTo(cx, s * 0.45);
            ctx.lineTo(cx + s * 0.12, s * 0.55);
            ctx.stroke();
            break;
        }
        case 'B': {
            // Elongated diamond
            ctx.beginPath();
            ctx.moveTo(cx, s * 0.12);
            ctx.lineTo(cx + s * 0.2, s * 0.5);
            ctx.lineTo(cx, s * 0.88);
            ctx.lineTo(cx - s * 0.2, s * 0.5);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            // Central line accent
            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = accent;
            ctx.lineWidth = s * 0.015;
            ctx.beginPath();
            ctx.moveTo(cx, s * 0.22);
            ctx.lineTo(cx, s * 0.78);
            ctx.stroke();
            break;
        }
        case 'N': {
            // Stylized horse head with geometric mane
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.12, s * 0.88);
            ctx.lineTo(cx - s * 0.18, s * 0.5);
            ctx.lineTo(cx - s * 0.08, s * 0.25);
            ctx.lineTo(cx + s * 0.05, s * 0.15);
            ctx.lineTo(cx + s * 0.18, s * 0.22);
            ctx.lineTo(cx + s * 0.15, s * 0.4);
            ctx.lineTo(cx + s * 0.08, s * 0.5);
            ctx.lineTo(cx + s * 0.12, s * 0.88);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            // Geometric mane stripes
            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = accent;
            ctx.lineWidth = s * 0.012;
            for (let i = 0; i < 3; i++) {
                const y = s * (0.3 + i * 0.08);
                ctx.beginPath();
                ctx.moveTo(cx - s * 0.14, y);
                ctx.lineTo(cx - s * 0.06, y - s * 0.03);
                ctx.stroke();
            }
            break;
        }
        case 'P': {
            // Pointed arch / keystone shape
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.15, s * 0.88);
            ctx.lineTo(cx - s * 0.15, s * 0.5);
            ctx.quadraticCurveTo(cx - s * 0.15, s * 0.25, cx, s * 0.2);
            ctx.quadraticCurveTo(cx + s * 0.15, s * 0.25, cx + s * 0.15, s * 0.5);
            ctx.lineTo(cx + s * 0.15, s * 0.88);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            break;
        }
    }
    ctx.shadowColor = 'transparent';
}

// =============================================================================
// STEAMPUNK STYLE — Gears, copper, brass mechanical
// =============================================================================

function drawSteampunkPiece(ctx: CanvasRenderingContext2D, type: string, isWhite: boolean, size: number): void {
    const s = size;
    const cx = s / 2;

    const fill = isWhite ? '#d4a76a' : '#2a1a0a';       // Brass / dark wood
    const stroke = isWhite ? '#8b5e3c' : '#b87333';     // Copper
    const gear = isWhite ? '#6b4226' : '#cd7f32';       // Gear accent color

    ctx.lineWidth = s * 0.025;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;

    // Helper: draw a small gear at position
    function drawGear(gx: number, gy: number, r: number, teeth: number) {
        ctx.save();
        ctx.strokeStyle = gear;
        ctx.lineWidth = s * 0.015;
        ctx.beginPath();
        for (let i = 0; i < teeth; i++) {
            const a1 = (i / teeth) * Math.PI * 2;
            const a2 = ((i + 0.5) / teeth) * Math.PI * 2;
            ctx.lineTo(gx + Math.cos(a1) * r, gy + Math.sin(a1) * r);
            ctx.lineTo(gx + Math.cos(a2) * r * 1.3, gy + Math.sin(a2) * r * 1.3);
        }
        ctx.closePath();
        ctx.stroke();
        // Central hole
        ctx.beginPath();
        ctx.arc(gx, gy, r * 0.3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    switch (type) {
        case 'K': {
            // Mechanical crown with gears
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.22, s * 0.88);
            ctx.lineTo(cx - s * 0.22, s * 0.35);
            ctx.lineTo(cx - s * 0.15, s * 0.25);
            ctx.lineTo(cx - s * 0.08, s * 0.3);
            ctx.lineTo(cx, s * 0.15);
            ctx.lineTo(cx + s * 0.08, s * 0.3);
            ctx.lineTo(cx + s * 0.15, s * 0.25);
            ctx.lineTo(cx + s * 0.22, s * 0.35);
            ctx.lineTo(cx + s * 0.22, s * 0.88);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            drawGear(cx, s * 0.58, s * 0.08, 8);
            break;
        }
        case 'Q': {
            // Riveted bell shape
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.2, s * 0.88);
            ctx.quadraticCurveTo(cx - s * 0.28, s * 0.5, cx - s * 0.12, s * 0.3);
            ctx.lineTo(cx, s * 0.18);
            ctx.lineTo(cx + s * 0.12, s * 0.3);
            ctx.quadraticCurveTo(cx + s * 0.28, s * 0.5, cx + s * 0.2, s * 0.88);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            drawGear(cx - s * 0.1, s * 0.6, s * 0.05, 6);
            drawGear(cx + s * 0.1, s * 0.6, s * 0.05, 6);
            // Crown rivet
            ctx.fillStyle = gear;
            ctx.beginPath();
            ctx.arc(cx, s * 0.18, s * 0.035, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
        case 'R': {
            // Industrial tower with pipes
            ctx.beginPath();
            ctx.rect(cx - s * 0.18, s * 0.3, s * 0.36, s * 0.58);
            ctx.fill(); ctx.stroke();
            // Pipe on side
            ctx.beginPath();
            ctx.rect(cx + s * 0.18, s * 0.45, s * 0.08, s * 0.3);
            ctx.fill(); ctx.stroke();
            // Chimney top
            ctx.beginPath();
            ctx.rect(cx - s * 0.22, s * 0.22, s * 0.44, s * 0.1);
            ctx.fill(); ctx.stroke();
            drawGear(cx, s * 0.58, s * 0.07, 7);
            break;
        }
        case 'B': {
            // Pointed boiler dome
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.18, s * 0.88);
            ctx.lineTo(cx - s * 0.18, s * 0.45);
            ctx.arc(cx, s * 0.45, s * 0.18, Math.PI, 0);
            ctx.lineTo(cx + s * 0.18, s * 0.88);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            // Spire
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.04, s * 0.28);
            ctx.lineTo(cx, s * 0.12);
            ctx.lineTo(cx + s * 0.04, s * 0.28);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            drawGear(cx, s * 0.62, s * 0.06, 6);
            break;
        }
        case 'N': {
            // Mechanical horse
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.12, s * 0.88);
            ctx.lineTo(cx - s * 0.2, s * 0.55);
            ctx.lineTo(cx - s * 0.15, s * 0.35);
            ctx.lineTo(cx - s * 0.05, s * 0.2);
            ctx.lineTo(cx + s * 0.1, s * 0.15);
            ctx.lineTo(cx + s * 0.18, s * 0.25);
            ctx.lineTo(cx + s * 0.12, s * 0.45);
            ctx.lineTo(cx + s * 0.15, s * 0.88);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            drawGear(cx - s * 0.02, s * 0.5, s * 0.06, 6);
            // Eye rivet
            ctx.fillStyle = gear;
            ctx.beginPath();
            ctx.arc(cx + s * 0.06, s * 0.22, s * 0.025, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
        case 'P': {
            // Bolt/rivet shape
            ctx.beginPath();
            const sides = 6;
            for (let i = 0; i <= sides; i++) {
                const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
                const r = s * 0.18;
                const px = cx + Math.cos(a) * r;
                const py = s * 0.5 + Math.sin(a) * r;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            // Central dot
            ctx.fillStyle = gear;
            ctx.beginPath();
            ctx.arc(cx, s * 0.5, s * 0.05, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
    }
}

// =============================================================================
// TRIBAL STYLE — Bold angular shapes, mask-inspired
// =============================================================================

function drawTribalPiece(ctx: CanvasRenderingContext2D, type: string, isWhite: boolean, size: number): void {
    const s = size;
    const cx = s / 2;

    const fill = isWhite ? '#e8d4a0' : '#1a0e06';
    const stroke = isWhite ? '#6b3410' : '#d4842a';
    const markings = isWhite ? '#8b1a1a' : '#cc4422';  // War paint red

    ctx.lineWidth = s * 0.035;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;

    switch (type) {
        case 'K': {
            // Tribal chief mask with headdress
            ctx.beginPath();
            // Wide headdress
            ctx.moveTo(cx - s * 0.3, s * 0.35);
            ctx.lineTo(cx - s * 0.15, s * 0.12);
            ctx.lineTo(cx, s * 0.08);
            ctx.lineTo(cx + s * 0.15, s * 0.12);
            ctx.lineTo(cx + s * 0.3, s * 0.35);
            // Face
            ctx.lineTo(cx + s * 0.2, s * 0.6);
            ctx.lineTo(cx + s * 0.15, s * 0.88);
            ctx.lineTo(cx - s * 0.15, s * 0.88);
            ctx.lineTo(cx - s * 0.2, s * 0.6);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            // War paint — horizontal stripes
            ctx.strokeStyle = markings;
            ctx.lineWidth = s * 0.02;
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.15, s * 0.45);
            ctx.lineTo(cx + s * 0.15, s * 0.45);
            ctx.moveTo(cx - s * 0.12, s * 0.55);
            ctx.lineTo(cx + s * 0.12, s * 0.55);
            ctx.stroke();
            // Eyes
            ctx.fillStyle = markings;
            ctx.fillRect(cx - s * 0.1, s * 0.38, s * 0.06, s * 0.04);
            ctx.fillRect(cx + s * 0.04, s * 0.38, s * 0.06, s * 0.04);
            break;
        }
        case 'Q': {
            // Tribal queen — elongated face with ornamental points
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.18, s * 0.88);
            ctx.lineTo(cx - s * 0.22, s * 0.4);
            ctx.lineTo(cx - s * 0.12, s * 0.18);
            ctx.lineTo(cx, s * 0.1);
            ctx.lineTo(cx + s * 0.12, s * 0.18);
            ctx.lineTo(cx + s * 0.22, s * 0.4);
            ctx.lineTo(cx + s * 0.18, s * 0.88);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            // Zigzag markings
            ctx.strokeStyle = markings;
            ctx.lineWidth = s * 0.02;
            ctx.beginPath();
            let zy = s * 0.55;
            ctx.moveTo(cx - s * 0.15, zy);
            for (let i = 1; i <= 5; i++) {
                const zx = cx - s * 0.15 + i * s * 0.06;
                zy = s * 0.55 + (i % 2 === 1 ? s * 0.06 : 0);
                ctx.lineTo(zx, zy);
            }
            ctx.stroke();
            break;
        }
        case 'R': {
            // Totem pole
            ctx.beginPath();
            ctx.rect(cx - s * 0.16, s * 0.15, s * 0.32, s * 0.73);
            ctx.fill(); ctx.stroke();
            // Face sections
            ctx.strokeStyle = markings;
            ctx.lineWidth = s * 0.018;
            // Top face
            ctx.beginPath();
            ctx.arc(cx, s * 0.3, s * 0.04, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, s * 0.55, s * 0.04, 0, Math.PI * 2);
            ctx.stroke();
            // Horizontal separators
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.14, s * 0.42);
            ctx.lineTo(cx + s * 0.14, s * 0.42);
            ctx.moveTo(cx - s * 0.14, s * 0.68);
            ctx.lineTo(cx + s * 0.14, s * 0.68);
            ctx.stroke();
            break;
        }
        case 'B': {
            // Spear shape
            ctx.beginPath();
            ctx.moveTo(cx, s * 0.08);
            ctx.lineTo(cx + s * 0.15, s * 0.35);
            ctx.lineTo(cx + s * 0.06, s * 0.4);
            ctx.lineTo(cx + s * 0.06, s * 0.88);
            ctx.lineTo(cx - s * 0.06, s * 0.88);
            ctx.lineTo(cx - s * 0.06, s * 0.4);
            ctx.lineTo(cx - s * 0.15, s * 0.35);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            // Diamond markings on shaft
            ctx.fillStyle = markings;
            for (let i = 0; i < 3; i++) {
                const dy = s * 0.5 + i * s * 0.12;
                ctx.beginPath();
                ctx.moveTo(cx, dy - s * 0.03);
                ctx.lineTo(cx + s * 0.04, dy);
                ctx.lineTo(cx, dy + s * 0.03);
                ctx.lineTo(cx - s * 0.04, dy);
                ctx.closePath();
                ctx.fill();
            }
            break;
        }
        case 'N': {
            // Animal head (lion/jaguar)
            ctx.beginPath();
            // Ears
            ctx.moveTo(cx - s * 0.2, s * 0.3);
            ctx.lineTo(cx - s * 0.18, s * 0.15);
            ctx.lineTo(cx - s * 0.08, s * 0.22);
            // Head top
            ctx.lineTo(cx, s * 0.18);
            ctx.lineTo(cx + s * 0.08, s * 0.22);
            ctx.lineTo(cx + s * 0.18, s * 0.15);
            ctx.lineTo(cx + s * 0.2, s * 0.3);
            // Jaw
            ctx.lineTo(cx + s * 0.2, s * 0.55);
            ctx.lineTo(cx + s * 0.1, s * 0.7);
            ctx.lineTo(cx + s * 0.12, s * 0.88);
            ctx.lineTo(cx - s * 0.12, s * 0.88);
            ctx.lineTo(cx - s * 0.1, s * 0.7);
            ctx.lineTo(cx - s * 0.2, s * 0.55);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            // Eyes
            ctx.fillStyle = markings;
            ctx.fillRect(cx - s * 0.12, s * 0.32, s * 0.07, s * 0.04);
            ctx.fillRect(cx + s * 0.05, s * 0.32, s * 0.07, s * 0.04);
            // Nose
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.04, s * 0.45);
            ctx.lineTo(cx, s * 0.42);
            ctx.lineTo(cx + s * 0.04, s * 0.45);
            ctx.stroke();
            break;
        }
        case 'P': {
            // Shield shape
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.16, s * 0.2);
            ctx.lineTo(cx + s * 0.16, s * 0.2);
            ctx.lineTo(cx + s * 0.16, s * 0.6);
            ctx.lineTo(cx, s * 0.85);
            ctx.lineTo(cx - s * 0.16, s * 0.6);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            // Central marking
            ctx.strokeStyle = markings;
            ctx.lineWidth = s * 0.02;
            ctx.beginPath();
            ctx.moveTo(cx, s * 0.3);
            ctx.lineTo(cx, s * 0.7);
            ctx.stroke();
            break;
        }
    }
}

// =============================================================================
// SPRITE SHEET LOADING FOR IMAGE-BASED 2D STYLES
// =============================================================================

// Cache for loaded sprite sheet images
const spriteSheetCache: Map<string, HTMLImageElement> = new Map();
const spriteSheetLoadingPromises: Map<string, Promise<HTMLImageElement>> = new Map();

// Load sprite sheet image (returns cached if available)
async function loadSpriteSheet(path: string): Promise<HTMLImageElement> {
    // Return cached image if available
    if (spriteSheetCache.has(path)) {
        return spriteSheetCache.get(path)!;
    }

    // Return existing loading promise if in progress
    if (spriteSheetLoadingPromises.has(path)) {
        return spriteSheetLoadingPromises.get(path)!;
    }

    // Create new loading promise
    const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            spriteSheetCache.set(path, img);
            spriteSheetLoadingPromises.delete(path);
            console.log(`[Renderer3D] Loaded sprite sheet: ${path} (${img.width}x${img.height})`);
            resolve(img);
        };
        img.onerror = (err) => {
            spriteSheetLoadingPromises.delete(path);
            console.error(`[Renderer3D] Failed to load sprite sheet: ${path}`, err);
            reject(err);
        };
        img.src = path;
    });

    spriteSheetLoadingPromises.set(path, loadPromise);
    return loadPromise;
}

// Extract a single piece from sprite sheet
// Standard layout: 2 rows (white=0, black=1) x 6 cols (K,Q,R,B,N,P)
function extractPieceFromSpriteSheet(
    img: HTMLImageElement,
    pieceType: string,
    isWhite: boolean,
    outputSize: number
): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = outputSize;
    const ctx = canvas.getContext('2d')!;

    // Piece order in sprite sheet: K, Q, R, B, N, P
    const pieceOrder = ['K', 'Q', 'R', 'B', 'N', 'P'];
    const col = pieceOrder.indexOf(pieceType);
    const row = isWhite ? 0 : 1;

    if (col === -1) {
        console.warn(`[Renderer3D] Unknown piece type: ${pieceType}`);
        return canvas;
    }

    // Calculate sprite dimensions (assume equal-sized sprites in 6x2 grid)
    const spriteWidth = img.width / 6;
    const spriteHeight = img.height / 2;

    // Extract and draw to canvas
    ctx.drawImage(
        img,
        col * spriteWidth,      // Source X
        row * spriteHeight,     // Source Y
        spriteWidth,            // Source Width
        spriteHeight,           // Source Height
        0,                      // Dest X
        0,                      // Dest Y
        outputSize,             // Dest Width
        outputSize              // Dest Height
    );

    return canvas;
}

// Create material from sprite sheet
function createSpriteSheetMaterial(piece: Piece, spriteSheet: HTMLImageElement): THREE.SpriteMaterial {
    const size = 256;
    const canvas = extractPieceFromSpriteSheet(
        spriteSheet,
        piece.type,
        getVisualColor(piece.color) === 'white',
        size
    );

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    return new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
    });
}

// Main function to create 2D piece material
function create2DPieceMaterial(piece: Piece): THREE.SpriteMaterial {
    const canvas = document.createElement('canvas');
    const size = 256;
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const isWhite = getVisualColor(piece.color) === 'white';
    const drawStyle = currentPieceStyleConfig.drawStyle || 'classic';

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Draw based on style
    switch (drawStyle) {
        case 'classic':
            drawClassicPiece(ctx, piece.type, isWhite, size);
            break;
        case 'modern':
            drawModernPiece(ctx, piece.type, isWhite, size);
            break;
        case 'staunton':
            drawStauntonPiece(ctx, piece.type, isWhite, size);
            break;
        case 'newspaper':
            drawNewspaperPiece(ctx, piece.type, isWhite, size);
            break;
        case 'editorial':
            drawEditorialPiece(ctx, piece.type, isWhite, size);
            break;
        case 'outline':
            drawOutlinePiece(ctx, piece.type, isWhite, size);
            break;
        case 'figurine':
            drawFigurinePiece(ctx, piece.type, isWhite, size);
            break;
        case 'pixel':
            drawPixelPiece(ctx, piece.type, isWhite, size);
            break;
        case 'gothic':
            drawGothicPiece(ctx, piece.type, isWhite, size);
            break;
        case 'minimalist':
            drawMinimalistPiece(ctx, piece.type, isWhite, size);
            break;
        case 'celtic':
            drawCelticPiece(ctx, piece.type, isWhite, size);
            break;
        case 'sketch':
            drawSketchPiece(ctx, piece.type, isWhite, size);
            break;
        case 'lichess':
            drawLichessPiece(ctx, piece.type, isWhite, size);
            break;
        case 'art_deco':
            drawArtDecoPiece(ctx, piece.type, isWhite, size);
            break;
        case 'steampunk':
            drawSteampunkPiece(ctx, piece.type, isWhite, size);
            break;
        case 'tribal':
            drawTribalPiece(ctx, piece.type, isWhite, size);
            break;
        case 'symbols':
        default:
            drawSymbolPiece(ctx, piece.type, isWhite, size);
            break;
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    return new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
    });
}

function create2DPieceSprite(piece: Piece, row: number, col: number): void {
    try {
        const styleConfig = currentPieceStyleConfig;
        const cacheKey = `${styleConfig.id}-${piece.color}-${piece.type}`;

        // Check if this style uses a sprite sheet
        if (styleConfig.spriteSheet) {
            // Async sprite sheet loading
            createSpriteSheetPiece(piece, row, col, styleConfig.spriteSheet, cacheKey);
            return;
        }

        let material = pieceSpritesCache.get(cacheKey);

        if (!material) {
            material = create2DPieceMaterial(piece);
            pieceSpritesCache.set(cacheKey, material);
        }

        const sprite = new THREE.Sprite(material);
        sprite.position.set(
            col * BOARD_UNIT - BOARD_WIDTH / 2 + BOARD_UNIT / 2,
            0.6,
            row * BOARD_UNIT - BOARD_LENGTH / 2 + BOARD_UNIT / 2
        );
        sprite.scale.set(0.9, 0.9, 1);
        sprite.userData = { piece, row, col };
        piecesGroup.add(sprite);
    } catch (err) {
        console.error('[Renderer3D] Error creating 2D sprite:', err);
    }
}

// Async helper to create sprite from sprite sheet
async function createSpriteSheetPiece(
    piece: Piece,
    row: number,
    col: number,
    spriteSheetPath: string,
    cacheKey: string
): Promise<void> {
    try {
        let material = pieceSpritesCache.get(cacheKey);

        if (!material) {
            const spriteSheet = await loadSpriteSheet(spriteSheetPath);
            material = createSpriteSheetMaterial(piece, spriteSheet);
            pieceSpritesCache.set(cacheKey, material);
        }

        const sprite = new THREE.Sprite(material);
        sprite.position.set(
            col * BOARD_UNIT - BOARD_WIDTH / 2 + BOARD_UNIT / 2,
            0.6,
            row * BOARD_UNIT - BOARD_LENGTH / 2 + BOARD_UNIT / 2
        );
        sprite.scale.set(0.9, 0.9, 1);
        sprite.userData = { piece, row, col };
        piecesGroup.add(sprite);
    } catch (err) {
        console.error('[Renderer3D] Error creating sprite sheet piece:', err);
        // Fallback to canvas-drawn pharaoh style
        let material = pieceSpritesCache.get(cacheKey + '-fallback');
        if (!material) {
            material = create2DPieceMaterial(piece);
            pieceSpritesCache.set(cacheKey + '-fallback', material);
        }
        const sprite = new THREE.Sprite(material);
        sprite.position.set(
            col * BOARD_UNIT - BOARD_WIDTH / 2 + BOARD_UNIT / 2,
            0.6,
            row * BOARD_UNIT - BOARD_LENGTH / 2 + BOARD_UNIT / 2
        );
        sprite.scale.set(0.9, 0.9, 1);
        sprite.userData = { piece, row, col };
        piecesGroup.add(sprite);
    }
}

// PERFORMANCE: Cache for 3D piece meshes to avoid recreation
const pieceMeshCache: Map<string, THREE.Group> = new Map();

// PERFORMANCE: Material cache to reuse materials instead of creating new ones
const pieceMaterialCache: Map<string, {
    base: THREE.Material;
    accent: THREE.Material;
    rim: THREE.Material;
    team: THREE.Material;
}> = new Map();

function getPieceMaterials(piece: Piece): {
    base: THREE.Material;
    accent: THREE.Material;
    rim: THREE.Material;
    team: THREE.Material;
} {
    const styleConfig = currentPieceStyleConfig;
    const isWhite = getVisualColor(piece.color) === 'white';
    const cacheKey = `${piece.color}-${currentPieceStyle}`;

    // Return cached materials if available
    if (pieceMaterialCache.has(cacheKey)) {
        return pieceMaterialCache.get(cacheKey)!;
    }

    // Create new materials
    const baseColor = isWhite ? (styleConfig.whiteColor || 0xf8f8f8) : (styleConfig.blackColor || 0x0a0a0a);
    const trimColor = isWhite ? (styleConfig.whiteTrimColor || 0x1a1a1a) : (styleConfig.blackTrimColor || 0xffffff);
    const emissiveColor = isWhite ? (styleConfig.whiteEmissive || 0x000000) : (styleConfig.blackEmissive || 0x000000);
    const emissiveIntensity = styleConfig.emissiveIntensity || 0.05;
    const roughness = styleConfig.roughness || 0.2;
    const metalness = styleConfig.metalness || 0.0;
    const hasGlow = styleConfig.glowEffect || false;

    const materials = {
        base: new THREE.MeshStandardMaterial({
            color: baseColor,
            roughness: roughness,
            metalness: metalness,
            emissive: emissiveColor,
            emissiveIntensity: emissiveIntensity,
        }),
        accent: new THREE.MeshStandardMaterial({
            // For black pieces: bright white/silver accents; for white pieces: gold accents
            color: hasGlow ? trimColor : (isWhite ? 0xc0a060 : 0xf0f0f0),
            roughness: hasGlow ? 0.2 : 0.15,
            metalness: hasGlow ? 0.3 : 0.9,
            emissive: hasGlow ? trimColor : (isWhite ? 0x604020 : 0x808080),
            emissiveIntensity: hasGlow ? 0.5 : (isWhite ? 0.1 : 0.3),
        }),
        rim: new THREE.MeshStandardMaterial({
            // For black pieces: bright white rims
            color: isWhite ? trimColor : 0xffffff,
            roughness: 0.2,
            metalness: hasGlow ? 0.3 : 0.6,
            emissive: hasGlow ? trimColor : (isWhite ? 0x202040 : 0x606060),
            emissiveIntensity: hasGlow ? 0.3 : (isWhite ? 0.15 : 0.4),
        }),
        team: new THREE.MeshBasicMaterial({
            color: isWhite ? 0x0088ff : 0xff0044,
            transparent: true,
            opacity: 0.5
        })
    };

    // Cache for reuse
    pieceMaterialCache.set(cacheKey, materials);
    return materials;
}

// PERFORMANCE: Track previous board state to avoid unnecessary updates
let _prevBoardHash: string = '';

// =============================================================================
// PIECE MOVE ANIMATION — Cartoonish arc + squash/stretch + capture effects
// =============================================================================

// Separate group for effects so updatePieces clearing piecesGroup won't kill them
let effectsGroup: THREE.Group;

interface MoveAnimationData {
    fromRow: number;
    fromCol: number;
    toRow: number;
    toCol: number;
    isCapture: boolean;
    capturedType?: string;
    movingPieceType?: string;
    isCastling?: boolean;
    rookFromCol?: number;
    rookToCol?: number;
}

// Set by gameController before notifyStateChange
let pendingMoveAnim: MoveAnimationData | null = null;

// Waiting for piece to appear (handles async sprite sheet creation)
let pendingStartAnim: MoveAnimationData | null = null;
let pendingStartTime: number = 0;

interface ActiveMoveAnimation {
    toRow: number;
    toCol: number;
    fromX: number;
    fromZ: number;
    toX: number;
    toZ: number;
    baseY: number;
    startTime: number;
    duration: number;
    isCapture: boolean;
    arcHeight: number;
    isCastling?: boolean;
    rookToRow?: number;
    rookToCol?: number;
    rookFromX?: number;
    rookToX?: number;
}

let activeMoveAnim: ActiveMoveAnimation | null = null;

// Landing bounce state (separate from main animation)
let landingBounce: { row: number; col: number; startTime: number; duration: number } | null = null;

interface CaptureEffect {
    object: THREE.Object3D;
    startTime: number;
    duration: number;
    effectType: 'poof' | 'squish' | 'spiral' | 'pop';
    basePos: { x: number; y: number; z: number };
}
let activeCaptureEffects: CaptureEffect[] = [];

interface DustPuff {
    particles: THREE.Points;
    startTime: number;
    duration: number;
}
let activeDustPuffs: DustPuff[] = [];

/** Queue a move animation. Called BEFORE notifyStateChange. */
export function setPendingMoveAnimation(data: MoveAnimationData): void {
    console.log('[ANIM] setPending:', data.fromRow, data.fromCol, '->', data.toRow, data.toCol, 'capture:', data.isCapture);
    pendingMoveAnim = data;
}

function _sqWorld(row: number, col: number): { x: number; z: number } {
    return {
        x: col * BOARD_UNIT - BOARD_WIDTH / 2 + BOARD_UNIT / 2,
        z: row * BOARD_UNIT - BOARD_LENGTH / 2 + BOARD_UNIT / 2
    };
}

function _findPiece(row: number, col: number): THREE.Object3D | undefined {
    return piecesGroup.children.find(
        c => c.userData.row === row && c.userData.col === col
    );
}

function _resetScale(piece: THREE.Object3D): void {
    if (piece instanceof THREE.Sprite) piece.scale.set(0.9, 0.9, 1);
    else if (piece instanceof THREE.Group) piece.scale.set(1, 1, 1);
}

/** Snap any running animation to its final position. */
function _finishAnim(): void {
    if (!activeMoveAnim) return;
    const a = activeMoveAnim;
    const p = _findPiece(a.toRow, a.toCol);
    if (p) {
        p.position.set(a.toX, a.baseY, a.toZ);
        _resetScale(p);
    }
    if (a.isCastling && a.rookToCol !== undefined && a.rookToX !== undefined) {
        const rook = _findPiece(a.rookToRow!, a.rookToCol);
        if (rook) rook.position.x = a.rookToX;
    }
    activeMoveAnim = null;
    landingBounce = null;
}

/** Try to start the animation. Returns false if piece not found yet (async). */
function _tryStartAnim(anim: MoveAnimationData): boolean {
    const piece = _findPiece(anim.toRow, anim.toCol);
    if (!piece) return false;

    const from = _sqWorld(anim.fromRow, anim.fromCol);
    const to = _sqWorld(anim.toRow, anim.toCol);
    const baseY = piece.position.y;

    // Snap piece to source position
    piece.position.x = from.x;
    piece.position.z = from.z;

    const isKnight = anim.movingPieceType === 'N';
    const dist = Math.sqrt((to.x - from.x) ** 2 + (to.z - from.z) ** 2);
    const arcHeight = isKnight ? 1.8 + dist * 0.3 : 0.4 + dist * 0.12;
    const duration = isKnight ? 700 : 500;

    if (anim.isCapture) _spawnCapture(anim.toRow, anim.toCol);

    let rookFromX: number | undefined;
    let rookToX: number | undefined;
    if (anim.isCastling && anim.rookFromCol !== undefined && anim.rookToCol !== undefined) {
        const rook = _findPiece(anim.toRow, anim.rookToCol);
        if (rook) {
            const rf = _sqWorld(anim.fromRow, anim.rookFromCol);
            const rt = _sqWorld(anim.toRow, anim.rookToCol);
            rook.position.x = rf.x;
            rookFromX = rf.x;
            rookToX = rt.x;
        }
    }

    activeMoveAnim = {
        toRow: anim.toRow, toCol: anim.toCol,
        fromX: from.x, fromZ: from.z, toX: to.x, toZ: to.z,
        baseY, startTime: performance.now(), duration,
        isCapture: anim.isCapture, arcHeight,
        isCastling: anim.isCastling,
        rookToRow: anim.toRow, rookToCol: anim.rookToCol,
        rookFromX, rookToX,
    };
    return true;
}

function _spawnCapture(row: number, col: number): void {
    if (!effectsGroup) return;
    const pos = _sqWorld(row, col);
    const types: CaptureEffect['effectType'][] = ['poof', 'squish', 'spiral', 'pop'];
    const effectType = types[Math.floor(Math.random() * types.length)];
    const geo = new THREE.RingGeometry(0.05, 0.35, 16);
    const mat = new THREE.MeshBasicMaterial({
        color: effectType === 'poof' ? 0xffcc44 : effectType === 'squish' ? 0xff4444 :
               effectType === 'spiral' ? 0x44aaff : 0xff8800,
        transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, 0.7, pos.z);
    mesh.rotation.x = -Math.PI / 2;
    effectsGroup.add(mesh);
    activeCaptureEffects.push({
        object: mesh, startTime: performance.now(),
        duration: effectType === 'spiral' ? 800 : 600,
        effectType, basePos: { x: pos.x, y: 0.7, z: pos.z },
    });
}

function _spawnDust(x: number, z: number): void {
    if (!effectsGroup) return;
    const count = 8;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 0.3;
        pos[i * 3 + 1] = Math.random() * 0.15;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
        color: 0xccbbaa, size: 0.12, transparent: true, opacity: 0.7, depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.position.set(x, 0.15, z);
    effectsGroup.add(pts);
    activeDustPuffs.push({ particles: pts, startTime: performance.now(), duration: 500 });
}

function _easeOutBack(t: number): number {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function _easeOutQuad(t: number): number {
    return 1 - (1 - t) * (1 - t);
}

/** Tick all animations. Called every frame from render loop. */
function tickMoveAnimations(): void {
    const now = performance.now();

    // --- Poll for pending animation start (piece may be async) ---
    if (pendingStartAnim) {
        const found = _findPiece(pendingStartAnim.toRow, pendingStartAnim.toCol);
        console.log('[ANIM] polling for piece at', pendingStartAnim.toRow, pendingStartAnim.toCol, 'found:', !!found, 'children:', piecesGroup.children.length, 'elapsed:', Math.round(now - pendingStartTime), 'ms');
        if (found && _tryStartAnim(pendingStartAnim)) {
            console.log('[ANIM] animation STARTED!');
            pendingStartAnim = null;
        } else if (now - pendingStartTime > 500) {
            console.warn('[ANIM] poll timeout - piece never appeared');
            pendingStartAnim = null; // timeout
        }
    }

    // --- Active move animation ---
    if (activeMoveAnim) {
        const a = activeMoveAnim;
        const t = Math.min((now - a.startTime) / a.duration, 1);
        const piece = _findPiece(a.toRow, a.toCol);

        if (!piece) {
            activeMoveAnim = null;
        } else {
            const ease = _easeOutBack(t);
            piece.position.x = a.fromX + (a.toX - a.fromX) * ease;
            piece.position.z = a.fromZ + (a.toZ - a.fromZ) * ease;

            const arc = Math.sin(t * Math.PI);
            piece.position.y = a.baseY + arc * a.arcHeight;

            // Squash-and-stretch
            if (piece instanceof THREE.Sprite) {
                piece.scale.set(0.9 * (1 - arc * 0.1), 0.9 * (1 + arc * 0.25), 1);
            } else if (piece instanceof THREE.Group) {
                piece.scale.set(1 - arc * 0.08, 1 + arc * 0.2, 1 - arc * 0.08);
            }

            // Castling rook slide
            if (a.isCastling && a.rookToCol !== undefined && a.rookFromX !== undefined && a.rookToX !== undefined) {
                const rook = _findPiece(a.rookToRow!, a.rookToCol);
                if (rook) rook.position.x = a.rookFromX + (a.rookToX - a.rookFromX) * _easeOutQuad(t);
            }

            if (t >= 1) {
                piece.position.set(a.toX, a.baseY, a.toZ);
                _resetScale(piece);
                if (a.isCastling && a.rookToCol !== undefined && a.rookToX !== undefined) {
                    const rook = _findPiece(a.rookToRow!, a.rookToCol);
                    if (rook) rook.position.x = a.rookToX;
                }
                _spawnDust(a.toX, a.toZ);
                landingBounce = { row: a.toRow, col: a.toCol, startTime: now, duration: 220 };
                activeMoveAnim = null;
            }
        }
    }

    // --- Landing bounce ---
    if (landingBounce) {
        const lb = landingBounce;
        const t = Math.min((now - lb.startTime) / lb.duration, 1);
        const piece = _findPiece(lb.row, lb.col);
        if (!piece) {
            landingBounce = null;
        } else {
            const squash = Math.sin(t * Math.PI);
            if (piece instanceof THREE.Sprite) {
                piece.scale.set(0.9 * (1 + squash * 0.12), 0.9 * (1 - squash * 0.15), 1);
            } else if (piece instanceof THREE.Group) {
                piece.scale.set(1 + squash * 0.1, 1 - squash * 0.12, 1 + squash * 0.1);
            }
            if (t >= 1) {
                _resetScale(piece);
                landingBounce = null;
            }
        }
    }

    // --- Capture effects ---
    for (let i = activeCaptureEffects.length - 1; i >= 0; i--) {
        const fx = activeCaptureEffects[i];
        const t = Math.min((now - fx.startTime) / fx.duration, 1);
        const mat = (fx.object as THREE.Mesh).material as THREE.MeshBasicMaterial;
        switch (fx.effectType) {
            case 'poof': {
                const s = 1 + t * 3;
                fx.object.scale.set(s, s, s);
                mat.opacity = 0.9 * (1 - t);
                break;
            }
            case 'squish': {
                const sy = t < 0.4 ? 1 - (t / 0.4) * 0.9 : 0.1;
                const sx = t < 0.4 ? 1 + (t / 0.4) * 0.5 : Math.max(0.01, 1.5 - (t - 0.4) / 0.6 * 1.5);
                fx.object.scale.set(Math.max(0.01, sx), Math.max(0.01, sy), 1);
                mat.opacity = t < 0.4 ? 0.9 : 0.9 * (1 - (t - 0.4) / 0.6);
                break;
            }
            case 'spiral': {
                fx.object.rotation.z = t * Math.PI * 4;
                const shrink = 1 - t;
                fx.object.scale.set(shrink, shrink, shrink);
                fx.object.position.y = fx.basePos.y + t * 1.5;
                mat.opacity = 0.9 * (1 - t * t);
                break;
            }
            case 'pop': {
                const ps = t < 0.3 ? 1 + (t / 0.3) * 2.5 : Math.max(0.01, 3.5 * (1 - (t - 0.3) / 0.7));
                fx.object.scale.set(ps, ps, 1);
                mat.opacity = t < 0.3 ? 0.95 : 0.95 * (1 - (t - 0.3) / 0.7);
                break;
            }
        }
        if (t >= 1) {
            effectsGroup.remove(fx.object);
            (fx.object as THREE.Mesh).geometry.dispose();
            mat.dispose();
            activeCaptureEffects.splice(i, 1);
        }
    }

    // --- Dust puffs ---
    for (let i = activeDustPuffs.length - 1; i >= 0; i--) {
        const dp = activeDustPuffs[i];
        const t = Math.min((now - dp.startTime) / dp.duration, 1);
        const mat = dp.particles.material as THREE.PointsMaterial;
        dp.particles.scale.set(1 + t * 2, 1 + t * 3, 1 + t * 2);
        mat.opacity = 0.7 * (1 - t);
        if (t >= 1) {
            effectsGroup.remove(dp.particles);
            dp.particles.geometry.dispose();
            mat.dispose();
            activeDustPuffs.splice(i, 1);
        }
    }
}

function getBoardHash(board: (Piece | null)[][]): string {
    // OPTIMIZED: Use array + join instead of string concatenation
    const parts: string[] = [];
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const p = board[row]?.[col];
            parts.push(p ? `${p.color[0]}${p.type}` : '..');
        }
    }
    return parts.join('');
}

function updatePieces(force: boolean = false): void {
    // PERFORMANCE: Skip if board hasn't changed
    const newHash = getBoardHash(cachedBoard);
    if (!force && newHash === _prevBoardHash) {
        return;
    }
    _prevBoardHash = newHash;

    // If an animation is running, finish it instantly before rebuild
    _finishAnim();
    pendingStartAnim = null;

    // Grab pending animation before rebuilding
    const anim = pendingMoveAnim;
    pendingMoveAnim = null;

    // Trigger shadow map update since pieces changed
    if (renderer && renderer.shadowMap) {
        renderer.shadowMap.needsUpdate = true;
    }

    while (piecesGroup.children.length > 0) {
        piecesGroup.remove(piecesGroup.children[0]);
    }

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = cachedBoard[row]?.[col];
            if (piece) {
                createPieceMesh(piece, row, col);
            }
        }
    }

    // Queue animation start — tickMoveAnimations will poll until piece exists
    if (anim) {
        console.log('[ANIM] updatePieces grabbed anim, queuing poll. piecesGroup children:', piecesGroup.children.length);
        pendingStartAnim = anim;
        pendingStartTime = performance.now();
    }
}

function createPieceMesh(piece: Piece, row: number, col: number): void {
    const styleConfig = currentPieceStyleConfig;

    // Check piece style - use 2D for 2D styles OR when in overhead mode
    const use2D = styleConfig.type === '2d' || is2DMode;

    if (use2D) {
        create2DPieceSprite(piece, row, col);
        return;
    }

    // 3D Piece rendering using cached materials
    const isWhite = getVisualColor(piece.color) === 'white';

    // PERFORMANCE: Cache piece geometry groups by type+color+style
    // Only build geometry once, then clone the cached group
    const cacheKey = `${piece.type}-${piece.color}-${currentPieceStyle}`;
    let group: THREE.Group;

    if (pieceMeshCache.has(cacheKey)) {
        // Clone the cached geometry group (shares geometry/material, cheap)
        group = pieceMeshCache.get(cacheKey)!.clone();
    } else {
        // Get cached materials (or create if first time)
        const materials = getPieceMaterials(piece);
        const material = materials.base;
        const accentMaterial = materials.accent;
        const rimMaterial = materials.rim;
        const teamMaterial = materials.team;

        group = new THREE.Group();

        // Add subtle team indicator ring at the very bottom
        const indicator = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.45, 32), teamMaterial);
        indicator.rotation.x = -Math.PI / 2;
        indicator.position.y = 0.01;
        group.add(indicator);

        switch (piece.type) {
            case 'K':
                createKingMesh(group, material, accentMaterial, rimMaterial, isWhite);
                break;
            case 'Q':
                createQueenMesh(group, material, accentMaterial, rimMaterial, isWhite);
                break;
            case 'R':
                createRookMesh(group, material, rimMaterial, accentMaterial);
                break;
            case 'B':
                createBishopMesh(group, material, accentMaterial, rimMaterial);
                break;
            case 'N':
                createKnightMesh(group, material, rimMaterial, accentMaterial);
                break;
            case 'P':
            default:
                createPawnMesh(group, material, rimMaterial, accentMaterial);
                break;
        }

        // Store in cache for reuse
        pieceMeshCache.set(cacheKey, group.clone());
    }

    group.position.set(
        col * BOARD_UNIT - BOARD_WIDTH / 2 + BOARD_UNIT / 2,
        0.12,
        row * BOARD_UNIT - BOARD_LENGTH / 2 + BOARD_UNIT / 2
    );

    group.castShadow = true;
    group.userData = { piece, row, col };

    piecesGroup.add(group);
}

// Piece mesh creators - REALISTIC STAUNTON CHESS PIECES using Lathe Geometry
// Based on authentic Staunton chess piece profiles

// Helper to create smooth lathe profiles
function createLatheProfile(points: Array<{ x: number, y: number }>): THREE.Vector2[] {
    return points.map(p => new THREE.Vector2(p.x, p.y));
}

function createKingMesh(group: THREE.Group, material: THREE.Material, accentMaterial: THREE.Material, rimMaterial: THREE.Material, isWhite: boolean): void {
    // Realistic Staunton King profile (lathe-turned)
    const kingProfile = createLatheProfile([
        { x: 0.00, y: 0.00 },   // Bottom center
        { x: 0.40, y: 0.00 },   // Base outer edge
        { x: 0.42, y: 0.03 },   // Base lip
        { x: 0.38, y: 0.06 },   // Base curve in
        { x: 0.36, y: 0.10 },   // Base top
        { x: 0.32, y: 0.12 },   // First collar
        { x: 0.30, y: 0.16 },   // Stem start
        { x: 0.26, y: 0.25 },   // Stem taper
        { x: 0.24, y: 0.35 },   // Mid stem
        { x: 0.22, y: 0.45 },   // Upper stem
        { x: 0.20, y: 0.52 },   // Collar bottom
        { x: 0.26, y: 0.55 },   // Collar bulge
        { x: 0.22, y: 0.60 },   // Collar top
        { x: 0.18, y: 0.65 },   // Neck
        { x: 0.22, y: 0.72 },   // Crown base
        { x: 0.24, y: 0.78 },   // Crown widest
        { x: 0.20, y: 0.85 },   // Crown taper
        { x: 0.14, y: 0.90 },   // Crown top
        { x: 0.08, y: 0.93 },   // Crown peak
        { x: 0.00, y: 0.95 },   // Top center
    ]);

    const bodyGeom = new THREE.LatheGeometry(kingProfile, 12);  // Reduced from 24 for performance
    const body = new THREE.Mesh(bodyGeom, material);
    body.castShadow = true;
    group.add(body);

    // Decorative collar ring
    const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.018, 8, 24), accentMaterial);
    collarRing.rotation.x = Math.PI / 2;
    collarRing.position.y = 0.56;
    group.add(collarRing);

    // Base ring
    const baseRing = new THREE.Mesh(new THREE.TorusGeometry(0.40, 0.02, 8, 24), rimMaterial);
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = 0.015;
    group.add(baseRing);

    // Iconic cross on top
    const crossVertical = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.05), accentMaterial);
    crossVertical.position.y = 1.08;
    group.add(crossVertical);

    const crossHorizontal = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.05), accentMaterial);
    crossHorizontal.position.y = 1.12;
    group.add(crossHorizontal);

    // Cross cap ball
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), rimMaterial);
    cap.position.y = 1.24;
    group.add(cap);
}

function createQueenMesh(group: THREE.Group, material: THREE.Material, accentMaterial: THREE.Material, rimMaterial: THREE.Material, isWhite: boolean): void {
    // Realistic Staunton Queen profile - elegant and tall
    const queenProfile = createLatheProfile([
        { x: 0.00, y: 0.00 },   // Bottom center
        { x: 0.38, y: 0.00 },   // Base outer edge
        { x: 0.40, y: 0.03 },   // Base lip
        { x: 0.36, y: 0.06 },   // Base curve in
        { x: 0.34, y: 0.10 },   // Base top
        { x: 0.28, y: 0.13 },   // First collar
        { x: 0.24, y: 0.18 },   // Stem start
        { x: 0.20, y: 0.30 },   // Stem taper
        { x: 0.18, y: 0.42 },   // Mid stem
        { x: 0.16, y: 0.52 },   // Upper stem
        { x: 0.20, y: 0.56 },   // Collar bulge
        { x: 0.16, y: 0.62 },   // Neck
        { x: 0.18, y: 0.68 },   // Crown base
        { x: 0.22, y: 0.74 },   // Crown swell
        { x: 0.20, y: 0.82 },   // Crown taper
        { x: 0.14, y: 0.88 },   // Crown narrow
        { x: 0.06, y: 0.92 },   // Crown peak
        { x: 0.00, y: 0.94 },   // Top center (for orb)
    ]);

    const bodyGeom = new THREE.LatheGeometry(queenProfile, 12);  // Reduced from 24 for performance
    const body = new THREE.Mesh(bodyGeom, material);
    body.castShadow = true;
    group.add(body);

    // Decorative waist ring
    const waistRing = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.015, 8, 24), accentMaterial);
    waistRing.rotation.x = Math.PI / 2;
    waistRing.position.y = 0.57;
    group.add(waistRing);

    // Base ring
    const baseRing = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.018, 8, 24), rimMaterial);
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = 0.015;
    group.add(baseRing);

    // Crown spikes (coronet) - 8 delicate points
    const spikeCount = 8;
    for (let i = 0; i < spikeCount; i++) {
        const angle = (i / spikeCount) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.14, 6), material);
        spike.position.set(Math.sin(angle) * 0.12, 0.98, Math.cos(angle) * 0.12);
        group.add(spike);

        // Small ball on each spike tip
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), accentMaterial);
        ball.position.set(Math.sin(angle) * 0.12, 1.06, Math.cos(angle) * 0.12);
        group.add(ball);
    }

    // Central orb (iconic queen symbol)
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), accentMaterial);
    orb.position.y = 1.02;
    group.add(orb);
}

function createRookMesh(group: THREE.Group, material: THREE.Material, rimMaterial: THREE.Material, accentMaterial: THREE.Material): void {
    // Realistic Staunton Rook profile - solid tower
    const rookProfile = createLatheProfile([
        { x: 0.00, y: 0.00 },   // Bottom center
        { x: 0.36, y: 0.00 },   // Base outer edge
        { x: 0.38, y: 0.03 },   // Base lip
        { x: 0.34, y: 0.06 },   // Base curve
        { x: 0.32, y: 0.10 },   // Base top
        { x: 0.26, y: 0.13 },   // Collar
        { x: 0.24, y: 0.18 },   // Stem start
        { x: 0.22, y: 0.32 },   // Mid stem
        { x: 0.22, y: 0.42 },   // Upper stem (straight)
        { x: 0.26, y: 0.46 },   // Battlement base swell
        { x: 0.28, y: 0.50 },   // Battlement platform
        { x: 0.28, y: 0.52 },   // Platform top
        { x: 0.00, y: 0.52 },   // Inner top
    ]);

    const bodyGeom = new THREE.LatheGeometry(rookProfile, 12);  // Reduced from 24 for performance
    const body = new THREE.Mesh(bodyGeom, material);
    body.castShadow = true;
    group.add(body);

    // Base ring
    const baseRing = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.018, 8, 24), rimMaterial);
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = 0.015;
    group.add(baseRing);

    // Collar ring
    const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.012, 8, 24), accentMaterial);
    collarRing.rotation.x = Math.PI / 2;
    collarRing.position.y = 0.15;
    group.add(collarRing);

    // Battlements (crenellations) - the castle top
    const battlementCount = 4;
    const battlementWidth = 0.12;
    const battlementHeight = 0.18;
    const battlementDepth = 0.12;
    const battlementRadius = 0.20;

    for (let i = 0; i < battlementCount; i++) {
        const angle = (i / battlementCount) * Math.PI * 2 + Math.PI / 4;
        const battlement = new THREE.Mesh(
            new THREE.BoxGeometry(battlementWidth, battlementHeight, battlementDepth),
            material
        );
        battlement.position.set(
            Math.sin(angle) * battlementRadius,
            0.61,
            Math.cos(angle) * battlementRadius
        );
        battlement.rotation.y = angle;
        battlement.castShadow = true;
        group.add(battlement);
    }
}

function createBishopMesh(group: THREE.Group, material: THREE.Material, accentMaterial: THREE.Material, rimMaterial: THREE.Material): void {
    // Realistic Staunton Bishop profile - tall and elegant with mitre
    const bishopProfile = createLatheProfile([
        { x: 0.00, y: 0.00 },   // Bottom center
        { x: 0.34, y: 0.00 },   // Base outer edge
        { x: 0.36, y: 0.03 },   // Base lip
        { x: 0.32, y: 0.06 },   // Base curve
        { x: 0.30, y: 0.10 },   // Base top
        { x: 0.24, y: 0.13 },   // Collar
        { x: 0.20, y: 0.20 },   // Stem start
        { x: 0.16, y: 0.35 },   // Stem taper
        { x: 0.14, y: 0.48 },   // Mid stem
        { x: 0.16, y: 0.52 },   // Collar bulge
        { x: 0.14, y: 0.58 },   // Neck
        { x: 0.18, y: 0.64 },   // Mitre base
        { x: 0.20, y: 0.72 },   // Mitre widest
        { x: 0.16, y: 0.82 },   // Mitre taper
        { x: 0.10, y: 0.90 },   // Mitre narrow
        { x: 0.04, y: 0.96 },   // Mitre tip
        { x: 0.00, y: 0.98 },   // Top point
    ]);

    const bodyGeom = new THREE.LatheGeometry(bishopProfile, 12);  // Reduced from 24 for performance
    const body = new THREE.Mesh(bodyGeom, material);
    body.castShadow = true;
    group.add(body);

    // Base ring
    const baseRing = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.016, 8, 24), rimMaterial);
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = 0.015;
    group.add(baseRing);

    // Collar ring
    const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 8, 24), accentMaterial);
    collarRing.rotation.x = Math.PI / 2;
    collarRing.position.y = 0.53;
    group.add(collarRing);

    // Bishop's slot (diagonal cut in mitre) - using a thin box
    const slot = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.008, 0.06),
        accentMaterial
    );
    slot.position.y = 0.78;
    slot.rotation.z = Math.PI / 6; // Diagonal tilt
    group.add(slot);

    // Top ball
    const topBall = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), accentMaterial);
    topBall.position.y = 1.02;
    group.add(topBall);
}

function createKnightMesh(group: THREE.Group, material: THREE.Material, rimMaterial: THREE.Material, accentMaterial: THREE.Material): void {
    // Realistic Staunton Knight - the most complex piece (horse head)
    // Base profile (lathe turned)
    const baseProfile = createLatheProfile([
        { x: 0.00, y: 0.00 },
        { x: 0.34, y: 0.00 },
        { x: 0.36, y: 0.03 },
        { x: 0.32, y: 0.06 },
        { x: 0.30, y: 0.10 },
        { x: 0.24, y: 0.13 },
        { x: 0.22, y: 0.18 },
        { x: 0.20, y: 0.24 },
        { x: 0.18, y: 0.28 },
        { x: 0.00, y: 0.28 },
    ]);

    const baseGeom = new THREE.LatheGeometry(baseProfile, 24);
    const baseMesh = new THREE.Mesh(baseGeom, material);
    baseMesh.castShadow = true;
    group.add(baseMesh);

    // Base ring
    const baseRing = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.016, 8, 24), rimMaterial);
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = 0.015;
    group.add(baseRing);

    // Horse neck (curved cylinder)
    const neckGeom = new THREE.CylinderGeometry(0.12, 0.16, 0.45, 12);
    const neck = new THREE.Mesh(neckGeom, material);
    neck.position.set(0, 0.48, -0.06);
    neck.rotation.x = -0.25;
    neck.castShadow = true;
    group.add(neck);

    // Horse head - main skull shape
    const headGeom = new THREE.SphereGeometry(0.16, 16, 12);
    const head = new THREE.Mesh(headGeom, material);
    head.scale.set(0.85, 1.0, 1.3);
    head.position.set(0, 0.72, -0.18);
    head.rotation.x = -0.3;
    head.castShadow = true;
    group.add(head);

    // Horse muzzle/snout
    const muzzleGeom = new THREE.CylinderGeometry(0.07, 0.11, 0.22, 12);
    const muzzle = new THREE.Mesh(muzzleGeom, material);
    muzzle.position.set(0, 0.60, -0.40);
    muzzle.rotation.x = -Math.PI / 2 + 0.4;
    muzzle.castShadow = true;
    group.add(muzzle);

    // Nostrils (small indents)
    const nostrilGeom = new THREE.SphereGeometry(0.02, 6, 6);
    const nostril1 = new THREE.Mesh(nostrilGeom, accentMaterial);
    nostril1.position.set(0.035, 0.54, -0.50);
    group.add(nostril1);
    const nostril2 = nostril1.clone();
    nostril2.position.x = -0.035;
    group.add(nostril2);

    // Eyes
    const eyeGeom = new THREE.SphereGeometry(0.025, 6, 6);
    const eye1 = new THREE.Mesh(eyeGeom, accentMaterial);
    eye1.position.set(0.10, 0.76, -0.24);
    group.add(eye1);
    const eye2 = eye1.clone();
    eye2.position.x = -0.10;
    group.add(eye2);

    // Ears
    const earGeom = new THREE.ConeGeometry(0.04, 0.14, 6);
    const ear1 = new THREE.Mesh(earGeom, material);
    ear1.position.set(0.07, 0.90, -0.10);
    ear1.rotation.z = 0.25;
    ear1.rotation.x = -0.2;
    ear1.castShadow = true;
    group.add(ear1);
    const ear2 = ear1.clone();
    ear2.position.x = -0.07;
    ear2.rotation.z = -0.25;
    group.add(ear2);

    // Mane (series of ridges down the neck)
    for (let i = 0; i < 5; i++) {
        const maneRidge = new THREE.Mesh(
            new THREE.BoxGeometry(0.025, 0.08 - i * 0.01, 0.05),
            material
        );
        maneRidge.position.set(0, 0.82 - i * 0.10, -0.02 + i * 0.02);
        maneRidge.rotation.x = -0.3;
        group.add(maneRidge);
    }
}

function createPawnMesh(group: THREE.Group, material: THREE.Material, rimMaterial: THREE.Material, accentMaterial: THREE.Material): void {
    // Realistic Staunton Pawn profile - simple but elegant
    const pawnProfile = createLatheProfile([
        { x: 0.00, y: 0.00 },   // Bottom center
        { x: 0.30, y: 0.00 },   // Base outer edge
        { x: 0.32, y: 0.025 },  // Base lip
        { x: 0.28, y: 0.05 },   // Base curve
        { x: 0.26, y: 0.08 },   // Base top
        { x: 0.20, y: 0.10 },   // Collar
        { x: 0.16, y: 0.15 },   // Stem start
        { x: 0.12, y: 0.25 },   // Stem taper
        { x: 0.10, y: 0.34 },   // Upper stem
        { x: 0.14, y: 0.38 },   // Collar bulge
        { x: 0.10, y: 0.44 },   // Neck
        { x: 0.14, y: 0.50 },   // Head base
        { x: 0.15, y: 0.56 },   // Head widest
        { x: 0.12, y: 0.64 },   // Head taper
        { x: 0.06, y: 0.70 },   // Head top
        { x: 0.00, y: 0.72 },   // Top center
    ]);

    const bodyGeom = new THREE.LatheGeometry(pawnProfile, 16);  // Reduced from 48 for performance
    const body = new THREE.Mesh(bodyGeom, material);
    body.castShadow = true;
    group.add(body);

    // Base ring
    const baseRing = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.014, 8, 16), rimMaterial);  // Reduced segments
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = 0.012;
    group.add(baseRing);

    // Collar ring
    const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.01, 8, 16), accentMaterial);  // Reduced segments
    collarRing.rotation.x = Math.PI / 2;
    collarRing.position.y = 0.39;
    group.add(collarRing);
}

// =============================================================================
// SQUARE HIGHLIGHTS
// =============================================================================

// PERFORMANCE: Track previous highlight state to avoid unnecessary updates
let _prevSelectedSquare: { row: number; col: number } | null = null;
let _prevLegalMoveCount: number = 0;
const _legalMoveSet: Set<number> = new Set(); // PERF: O(1) legal move lookup

function updateSquareHighlights(): void {
    // PERFORMANCE: Skip if nothing changed
    const sameSelection =
        (cachedSelectedSquare?.row === _prevSelectedSquare?.row) &&
        (cachedSelectedSquare?.col === _prevSelectedSquare?.col);
    const sameMoveCount = cachedLegalMoves.length === _prevLegalMoveCount;

    if (sameSelection && sameMoveCount) {
        return;
    }

    _prevSelectedSquare = cachedSelectedSquare ? { ...cachedSelectedSquare } : null;
    _prevLegalMoveCount = cachedLegalMoves.length;

    // PERFORMANCE: Pre-compute legal move set for O(1) lookup
    _legalMoveSet.clear();
    for (const m of cachedLegalMoves) {
        _legalMoveSet.add((m.to.row << 3) | m.to.col);
    }

    // Use cached squares if available
    const squares = _cachedSquares || boardGroup.children.filter(
        (child): child is THREE.Mesh =>
            child instanceof THREE.Mesh && child.userData?.type === 'square'
    );

    for (const child of squares) {
        const { row, col } = child.userData;
        const isLight = (row + col) % 2 === 0;

        let color = isLight ? COLORS_3D.lightSquare : COLORS_3D.darkSquare;

        if (cachedSelectedSquare?.row === row && cachedSelectedSquare?.col === col) {
            color = COLORS_3D.selectedSquare;
        }

        if (_legalMoveSet.has((row << 3) | col)) {
            color = COLORS_3D.legalMoveHighlight;
        }

        (child.material as THREE.MeshStandardMaterial).color.setHex(color);
    }
}

// =============================================================================
// RENDER LOOP
// =============================================================================

// PERFORMANCE: Track when environment was last regenerated
let _lastEnvRegenTime = 0;
const ENV_REGEN_INTERVAL = 5000; // Only regenerate every 5 seconds
let _cullableMeshes: THREE.Mesh[] = []; // PERF: flat array for distance culling

function startRenderLoop(): void {
    let frameCount = 0;

    function animate(currentTime: number) {
        animationId = requestAnimationFrame(animate);

        let deltaTime = currentTime - lastTime;
        lastTime = currentTime;
        frameCount++;

        // Prevent large spikes that cause motion jolts
        if (deltaTime > 50) {
            deltaTime = 50;
        }

        // PERFORMANCE: Fixed timestep option to reduce jitter and CPU spikes
        if (fixedTimestepEnabled) {
            const step = 1000 / fixedFps;
            fixedAccumulator += deltaTime;
            if (fixedAccumulator < step) {
                return;
            }
            deltaTime = step;
            fixedAccumulator = 0;
        }

        // FPS tracking - update every second
        fpsFrameCount++;
        if (currentTime - fpsLastUpdate >= 1000) {
            currentFPS = fpsFrameCount;
            fpsFrameCount = 0;
            fpsLastUpdate = currentTime;

            // PERFORMANCE: Auto-adjust render scale to hit target FPS
            if (autoFpsEnabled) {
                const lower = targetFps - 5;
                const upper = targetFps + 5;
                if (currentFPS < lower) {
                    setRenderScale(renderScale - 0.1);
                } else if (currentFPS > upper) {
                    setRenderScale(renderScale + 0.1);
                }
            }
        }

        // PERFORMANCE: Frustum/Distance Culling for environment assets
        // Only run every 10 frames to avoid CPU overhead
        if (frameCount % 10 === 0 && environmentGroup && environmentGroup.visible && !is2DMode) {
            const cameraPos = camera.position;
            const maxDistSq = 150 * 150; // Cull objects > 150 units away

            // PERF: Use flat array instead of traverse() for distance culling
            if (_cullableMeshes.length === 0) {
                environmentGroup.traverse((obj) => {
                    if (obj instanceof THREE.Mesh && !obj.name.includes('sky') && !obj.name.includes('ground') && obj.scale.x <= 50) {
                        _cullableMeshes.push(obj);
                    }
                });
            }
            for (let i = 0; i < _cullableMeshes.length; i++) {
                const mesh = _cullableMeshes[i];
                mesh.visible = mesh.position.distanceToSquared(cameraPos) < maxDistSq;
            }
        }

        // Tick piece move/capture/dust animations every frame
        tickMoveAnimations();

        // PERFORMANCE: In overhead/2D mode, hide environment but ALWAYS render
        // (skipping frames causes stuttering/visual artifacts)
        if (is2DMode) {
            // Hide environment completely when looking overhead
            environmentGroup.visible = false;

            // Always render in 2D mode - no frame skipping to avoid stuttering
            renderer.render(scene, camera);
            return;
        }

        // Show/hide environment in 3D mode
        environmentGroup.visible = envEnabled;

        // Get current ribbon speed from era
        const ribbonSpeed = getRibbonSpeed(currentElo) * motionScale * travelSpeedScale;
        scrollOffset += ribbonSpeed;

        // Animate procedural systems - EVERY FRAME for smooth motion
        // (Performance gained from reduced particle/asset counts instead of frame skipping)
        if (skyboxEnabled) {
            proceduralSkybox.animate(deltaTime * motionScale);
        }
        if (wormholeEnabled) {
            wormholeTransition.animate(deltaTime * motionScale);
        }

        // Lighting - every frame for smooth transitions
        if (lightingEnabled) {
            dynamicLighting.animate(deltaTime * motionScale);
        }

        // Environment scrolling - every frame for smooth motion
        if (envEnabled && envAnimEnabled) {
            updateEraEnvironment(environmentGroup, deltaTime * motionScale, ribbonSpeed);
        }

        // Render scene
        renderer.render(scene, camera);
    }

    animate(0);
}

// =============================================================================
// CLEANUP
// =============================================================================

export function dispose(): void {
    if (animationId !== null) {
        cancelAnimationFrame(animationId);
    }

    // Dispose procedural systems
    proceduralSkybox.dispose();
    wormholeTransition.dispose();
    dynamicLighting.dispose();

    // Dispose cached sprite materials
    pieceSpritesCache.forEach((material) => {
        if (material && material.dispose) {
            material.dispose();
        }
    });
    pieceSpritesCache.clear();

    // Dispose piece material cache
    pieceMaterialCache.forEach((materials) => {
        if (materials.base?.dispose) materials.base.dispose();
        if (materials.accent?.dispose) materials.accent.dispose();
        if (materials.rim?.dispose) materials.rim.dispose();
        if (materials.team?.dispose) materials.team.dispose();
    });
    pieceMaterialCache.clear();

    // Dispose renderer
    renderer.dispose();
}

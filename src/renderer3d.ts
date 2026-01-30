// Get number of moves made in current game
import { engine } from './chessEngine';

export function getMoveCount(): number {
    // chess.js history() returns all moves made
    return engine["chess"].history().length;
}
// src/renderer3d.ts
// 3D Ribbon World Renderer - ELO-Based Procedural Era System
// 2026 Studio Quality with procedural skybox, dynamic lighting, and wormhole transitions

import * as THREE from 'three';
import type { Piece } from './types';
import type { Move } from './chessEngine';
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
import { getPieceStyleConfig, is2DPieceStyle, PIECE_STYLE_ORDER, type PieceStyleConfig } from './pieceStyles';
import { getBoardStyleConfig, BOARD_STYLE_ORDER, type BoardStyleConfig } from './boardStyles';

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
let currentViewMode: ViewMode = 'pan';

// Orbit camera state for pan mode
let orbitRadius = 15;
let orbitTheta = 0;
let orbitPhi = Math.PI / 4;
let orbitTarget = new THREE.Vector3(0, 0, 0);

// Mouse state for camera control
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

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

// =============================================================================
// DEBUG TOGGLES (Performance/Asset control)
// =============================================================================

let envEnabled = true;
let particlesEnabled = true;
let skyboxEnabled = true;
let lightingEnabled = true;
let shadowsEnabled = false;
let envAnimEnabled = true;
let wormholeEnabled = true;
let motionScale = 1;

// Constants for 3D layout
const BOARD_UNIT = 1;
const BOARD_WIDTH = 8 * BOARD_UNIT;
const BOARD_LENGTH = 8 * BOARD_UNIT;

// Colors for 3D materials
const COLORS_3D = {
    lightSquare: 0xf0e6d3,
    darkSquare: 0x5d8a66,
    selectedSquare: 0x8bc99b,
    legalMoveHighlight: 0x6db87d,
    boardEdge: 0x2a2a2a,
};

// Callbacks
let onWorldChangeCallback: ((eraName: string) => void) | null = null;
let onEraTransitionCallback: ((fromEra: EraConfig, toEra: EraConfig) => void) | null = null;
let onSquareClickCallback: ((row: number, col: number) => void) | null = null;

// 2D Overhead Mode - Newspaper-style chess symbols
let is2DMode = false;
let pieceSpritesCache: Map<string, THREE.SpriteMaterial> = new Map();
let spriteTextureCache: Map<string, THREE.Texture> = new Map(); // Cache for loaded textures
const OVERHEAD_THRESHOLD = 0.35; // Switch to 2D when camera angle < this (radians from vertical)

// Piece Style System - 12 unique styles
export type PieceStyle = 'staunton3d' | 'staunton2d' | 'lewis3d' | 'lewis2d' | 'modern3d' | 'modern2d' |
    'fantasy3d' | 'fantasy2d' | 'neon3d' | 'newspaper2d' | 'marble3d' | 'wooden3d';
let currentPieceStyle: PieceStyle = 'staunton3d';
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

    // Create WebGL renderer with ADVANCED HIGH-END settings
    try {
        renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
            precision: 'highp', // High precision for better quality
            stencil: true,
            logarithmicDepthBuffer: true, // Better depth precision for large scenes
        });
    } catch (e) {
        console.error('[Renderer3D] WebGL initialization failed:', e);
        throw e;
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

    // OPTIMIZED SHADOW SETTINGS - Manual updates for performance
    renderer.shadowMap.enabled = true;
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

    // Create the chess board
    createBoard();

    // Setup camera controls
    setupCameraControls();

    // Setup click handling for square selection
    setupClickHandler();

    // Set initial camera position
    updateCameraPosition();

    // Start render loop
    startRenderLoop();

    console.log('[Renderer3D] Initialized - ELO-Based Era System with PBR');
    console.log('[Renderer3D] Current Era:', getEraForElo(currentElo).name);
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
// CAMERA CONTROLS
// =============================================================================

function setupCameraControls(): void {
    canvas.addEventListener('mousedown', (e) => {
        if (currentViewMode === 'pan') {
            isDragging = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isDragging && currentViewMode === 'pan') {
            const deltaX = e.clientX - lastMouseX;
            const deltaY = e.clientY - lastMouseY;

            orbitTheta -= deltaX * 0.01;
            orbitPhi = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, orbitPhi - deltaY * 0.01));

            lastMouseX = e.clientX;
            lastMouseY = e.clientY;

            updateCameraPosition();
        }
    });

    canvas.addEventListener('mouseup', () => {
        isDragging = false;
    });

    canvas.addEventListener('mouseleave', () => {
        isDragging = false;
    });

    canvas.addEventListener('wheel', (e) => {
        if (currentViewMode === 'pan') {
            e.preventDefault();
            orbitRadius = Math.max(8, Math.min(40, orbitRadius + e.deltaY * 0.02));
            updateCameraPosition();
        }
    }, { passive: false });
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

    // If mode changed, rebuild pieces
    if (wasIs2DMode !== is2DMode && cachedBoard.length > 0) {
        console.log('[Renderer3D] Switching to', is2DMode ? '2D Newspaper' : '3D', 'piece mode');
        updatePieces(true); // Force update since hash hasn't changed
    }
}

// =============================================================================
// CLICK HANDLING
// =============================================================================

function setupClickHandler(): void {
    canvas.addEventListener('click', (e) => {
        // Don't process clicks during drag operations
        if (isDragging) return;

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
    inCheck: boolean
): void {
    cachedBoard = board;
    cachedSelectedSquare = selectedSquare;
    cachedLegalMoves = legalMoves;
    cachedTurn = turn;
    cachedInCheck = inCheck;

    updatePieces();
    updateSquareHighlights();
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
 * Get current piece style
 */
export function getPieceStyle(): PieceStyle {
    return currentPieceStyle;
}

/**
 * Set board style and refresh board
 */
export function setBoardStyle(style: BoardStyle): void {
    if (currentBoardStyle === style) return;

    console.log('[Renderer3D] Changing board style to:', style);
    currentBoardStyle = style;
    currentBoardStyleConfig = getBoardStyleConfig(style);

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
 * Cycle to next piece style
 */
export function cyclePieceStyle(): void {
    const currentIndex = PIECE_STYLE_ORDER.indexOf(currentPieceStyle);
    const nextIndex = (currentIndex + 1) % PIECE_STYLE_ORDER.length;
    setPieceStyle(PIECE_STYLE_ORDER[nextIndex] as PieceStyle);
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
            background: rgba(0, 0, 0, 0.85);
            color: white;
            padding: 40px 60px;
            border-radius: 15px;
            text-align: center;
            font-family: Arial, sans-serif;
            z-index: 1000;
            box-shadow: 0 0 30px rgba(0,0,0,0.5);
        `;
        canvas.parentElement?.appendChild(overlay);
    }

    overlay.innerHTML = `
        <h2 style="margin: 0 0 15px 0; font-size: 28px;">${message}</h2>
        <p style="margin: 0; font-size: 16px; opacity: 0.8;">Click to play again</p>
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
// PIECE RENDERING
// =============================================================================

// Newspaper style: White pieces = OUTLINE symbols, Black pieces = FILLED SOLID symbols
const PIECE_SYMBOLS: Record<string, Record<string, string>> = {
    white: { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' },  // Outline symbols
    black: { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' }   // Filled solid symbols
};

function create2DPieceSprite(piece: Piece, row: number, col: number): void {
    try {
        const cacheKey = `${piece.color}-${piece.type}`;

        // Create or get cached sprite material
        let material = pieceSpritesCache.get(cacheKey);

        if (!material) {
            const styleConfig = currentPieceStyleConfig;

            // Check for Sprite Sheet style
            if (styleConfig.spriteSheet) {
                // Load or get cached texture
                let texture = spriteTextureCache.get(styleConfig.spriteSheet);
                if (!texture) {
                    const loader = new THREE.TextureLoader();
                    // Load relative to public root
                    console.log('[Renderer3D] Loading sprite sheet:', styleConfig.spriteSheet);
                    texture = loader.load(
                        styleConfig.spriteSheet,
                        (tex) => {
                            console.log('[Renderer3D] Texture loaded successfully', tex.image.width, 'x', tex.image.height);
                            // Force update of all pieces using this texture
                            updatePieces(true);
                        },
                        undefined,
                        (err) => console.error('[Renderer3D] Error loading sprite sheet:', err)
                    );
                    texture.colorSpace = THREE.SRGBColorSpace;
                    spriteTextureCache.set(styleConfig.spriteSheet, texture);
                }

                // Clone texture to set specific UVs for this piece type
                // Note: We clone the texture object to change offset/repeat without affecting others
                // But efficient way is to just use the same texture and update offset? 
                // No, SpriteMaterial shares the map. We need distinct materials, which we have (cached by key).
                // But the texture itself?
                // Actually, THREE.Texture.clone() is lightweight (shares image).
                const pieceTexture = texture.clone();
                pieceTexture.needsUpdate = true;

                // Calculate UVs (Assume 1 row, 6 columns: K, Q, B, N, R, P)
                // If user image is different, we might need to adjust.
                const pieceOrder = ['K', 'Q', 'B', 'N', 'R', 'P'];
                const index = pieceOrder.indexOf(piece.type);
                const cols = 6;
                const rows = 1;

                pieceTexture.repeat.set(1 / cols, 1 / rows);
                pieceTexture.offset.x = index / cols;
                pieceTexture.offset.y = 0; // Top row

                material = new THREE.SpriteMaterial({
                    map: pieceTexture,
                    transparent: true,
                    depthTest: true,
                    depthWrite: false,
                    color: piece.color === 'black' ? 0x808080 : 0xffffff, // Tint black pieces dark grey
                });

                // Add background if specified
                if (styleConfig.backgroundColor) {
                    // We can't easily add a background rect to a Sprite without a second sprite or canvas.
                    // For now, we assume the sprite sheet handles it or we rely on the board.
                    // Or we could create a canvas, fill color, draw image... but that requires image to be loaded.
                    // Simple solution: Just render the sprite.
                }

            } else {
                // FALLBACK: Canvas generation for Font-based styles (Newspaper, etc.)
                const spriteCanvas = document.createElement('canvas');
                // ... (Existing canvas logic)
                const size = 256;
                spriteCanvas.width = size;
                spriteCanvas.height = size;
                const ctx = spriteCanvas.getContext('2d');
                if (!ctx) {
                    console.error('[Renderer3D] Failed to get 2D context');
                    return;
                }

                const isWhite = piece.color === 'white';

                // Draw square background
                if (styleConfig.backgroundColor) {
                    ctx.fillStyle = styleConfig.backgroundColor;
                    ctx.fillRect(0, 0, size, size);
                }

                // Draw piece symbol (Unicode)
                const symbolSet = PIECE_SYMBOLS[piece.color];
                const symbol = symbolSet ? symbolSet[piece.type] : '?';

                const fontName = styleConfig.fontFamily || 'serif';
                ctx.font = `bold 200px ${fontName}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                ctx.fillStyle = isWhite ?
                    (styleConfig.whiteTextColor || '#1a1a1a') :
                    (styleConfig.blackTextColor || '#1a1a1a');

                ctx.fillText(symbol, size / 2, size / 2 + 12);

                const texture = new THREE.CanvasTexture(spriteCanvas);
                texture.needsUpdate = true;

                material = new THREE.SpriteMaterial({
                    map: texture,
                    transparent: true,
                    depthTest: true,
                    depthWrite: false,
                });
            }

            pieceSpritesCache.set(cacheKey, material);
        }

        // Create sprite
        const sprite = new THREE.Sprite(material);

        // Position on board
        sprite.position.set(
            col * BOARD_UNIT - BOARD_WIDTH / 2 + BOARD_UNIT / 2,
            0.6, // Float above board
            row * BOARD_UNIT - BOARD_LENGTH / 2 + BOARD_UNIT / 2
        );

        // Scale to fit square nicely
        sprite.scale.set(0.85, 0.85, 1);

        sprite.userData = { piece, row, col };
        piecesGroup.add(sprite);
    } catch (err) {
        console.error('[Renderer3D] Error creating 2D sprite:', err);
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
    const isWhite = piece.color === 'white';
    const cacheKey = `${piece.color}-${currentPieceStyle}`;

    // Return cached materials if available
    if (pieceMaterialCache.has(cacheKey)) {
        return pieceMaterialCache.get(cacheKey)!;
    }

    // Create new materials
    const baseColor = isWhite ? (styleConfig.whiteColor || 0xf8f8f8) : (styleConfig.blackColor || 0x0a0a0a);
    const trimColor = isWhite ? (styleConfig.whiteTrimColor || 0x1a1a1a) : (styleConfig.blackTrimColor || 0xe8e8e8);
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
            color: hasGlow ? trimColor : (isWhite ? 0xc0a060 : 0xd0d0d0),
            roughness: hasGlow ? 0.2 : 0.15,
            metalness: hasGlow ? 0.3 : 0.9,
            emissive: hasGlow ? trimColor : (isWhite ? 0x604020 : 0x404040),
            emissiveIntensity: hasGlow ? 0.5 : 0.1,
        }),
        rim: new THREE.MeshStandardMaterial({
            color: trimColor,
            roughness: 0.2,
            metalness: hasGlow ? 0.3 : 0.6,
            emissive: hasGlow ? trimColor : (isWhite ? 0x202040 : 0x404020),
            emissiveIntensity: hasGlow ? 0.3 : 0.15,
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

function getBoardHash(board: (Piece | null)[][]): string {
    let hash = '';
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const p = board[row]?.[col];
            hash += p ? `${p.color[0]}${p.type}` : '..';
        }
    }
    return hash;
}

function updatePieces(force: boolean = false): void {
    // PERFORMANCE: Skip if board hasn't changed
    const newHash = getBoardHash(cachedBoard);
    if (!force && newHash === _prevBoardHash) {
        return;
    }
    _prevBoardHash = newHash;

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
    const isWhite = piece.color === 'white';

    // Get cached materials (or create if first time)
    const materials = getPieceMaterials(piece);
    const material = materials.base;
    const accentMaterial = materials.accent;
    const rimMaterial = materials.rim;
    const teamMaterial = materials.team;

    const group = new THREE.Group();

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

        const isLegalMove = cachedLegalMoves.some(
            (m) => m.to.row === row && m.to.col === col
        );
        if (isLegalMove) {
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

        // PERFORMANCE: In overhead/2D mode, hide environment and skip heavy updates
        if (is2DMode) {
            // Hide environment completely when looking overhead
            environmentGroup.visible = false;

            // Only update every 4th frame in 2D mode (static view needs less updates)
            if (frameCount % 4 !== 0) {
                return; // Skip render entirely for non-update frames
            }

            // Skip all environment animations
            renderer.render(scene, camera);
            return;
        }

        // Show/hide environment in 3D mode
        environmentGroup.visible = envEnabled;

        // Get current ribbon speed from era
        const ribbonSpeed = getRibbonSpeed(currentElo) * motionScale * travelSpeedScale;
        scrollOffset += ribbonSpeed;

        // Animate procedural systems (heavily throttled for performance)
        if (skyboxEnabled && frameCount % (6 * animQuality) === 0) {
            proceduralSkybox.animate(deltaTime * 6 * motionScale);
        }
        if (wormholeEnabled) {
            wormholeTransition.animate(deltaTime * motionScale);
        }

        // Throttle lighting updates (every 3rd frame)
        if (lightingEnabled && frameCount % (3 * animQuality) === 0) {
            dynamicLighting.animate(deltaTime * 3 * motionScale);
        }

        // Animate environment (every 3rd frame)
        if (envEnabled && envAnimEnabled && frameCount % (3 * animQuality) === 0) {
            updateEraEnvironment(environmentGroup, deltaTime * 3 * motionScale, ribbonSpeed);
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

    proceduralSkybox.dispose();
    wormholeTransition.dispose();
    dynamicLighting.dispose();

    renderer.dispose();
}

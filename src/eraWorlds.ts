// src/eraWorlds.ts
// Era-Based World Environment Generator
// Replaces static worlds with ELO-driven procedural environments

import * as THREE from 'three';
import {
    EraConfig,
    getEraForElo,
    getEraProgress,
    getRibbonSpeed,
    getFogDensity,
    interpolateEraValue,
} from './eraSystem';
import { disposeObject, clearEnvironment } from './eras/utils';
import {
    seededRandom,
    getAssetDensity,
    getSpreadX,
    getGroundLevel,
    getParticleSpread,
    getParticleSize
} from './eras/helpers';
import { addJurassicEnvironment } from './eras/jurassic';
import { addIceAgeEnvironment } from './eras/iceAge';
import { addStoneAgeEnvironment } from './eras/stoneAge';
import { addBronzeAgeEnvironment } from './eras/bronzeAge';
import { addClassicalEnvironment } from './eras/classicalAge';
import { addMedievalEnvironment } from './eras/medieval';
import { addRenaissanceEnvironment } from './eras/renaissance';
import { addCyberpunkEnvironment, addTypeCivilizationEnvironment } from './eras/future';
import { createEraAsset } from './assetMutator';
import * as EraBuildings from './eraBuildings';

// =============================================================================
// ENVIRONMENT STATE
// =============================================================================

let currentElo: number = 400;
let assetSeed: number = 12345;
let assetDensityScale = 1;
let particleDensityScale = 1;

const MAX_PRIMARY_ASSETS = 6;  // PERFORMANCE: Reduced from 12
const MAX_SECONDARY_ASSETS = 8;  // PERFORMANCE: Reduced from 15
const MAX_PARTICLES = 300;  // PERFORMANCE: Reduced from 1200

// =============================================================================
// MAIN ENVIRONMENT BUILDER
// =============================================================================

/**
 * Create world environment based on current ELO
 */
export function createEraEnvironment(
    elo: number,
    group: THREE.Group,
    scrollOffset: number
): void {
    currentElo = elo;
    const era = getEraForElo(elo);
    const progress = getEraProgress(elo);

    // Clear existing environment
    clearEnvironment(group);

    // Add ground plane for non-space eras (1-12)
    if (era.id <= 12) {
        addGroundPlane(era, group, scrollOffset, progress);
    }

    // Spawn era-specific assets
    spawnEraAssets(era, group, scrollOffset, progress);

    // Add board connectors (vines, bridges, chains per era)
    addBoardConnectors(era, group, scrollOffset, progress);

    // Add particles
    addEraParticles(era, group, scrollOffset, progress);
}

// =============================================================================
// DENSITY CONTROLS (Debug/Performance)
// =============================================================================

export function setAssetDensityScale(scale: number): void {
    assetDensityScale = Math.max(0.1, Math.min(1.5, scale));
}

export function setParticleDensityScale(scale: number): void {
    particleDensityScale = Math.max(0, Math.min(2, scale));
}





/**
 * Spawn assets appropriate for the current era
 */
function spawnEraAssets(
    era: EraConfig,
    group: THREE.Group,
    offset: number,
    progress: number
): void {
    const assetDensity = getAssetDensity(era, progress, assetDensityScale);
    const spreadX = getSpreadX(era);
    const spreadZ = 260;

    // Spawn primary assets
    const primaryCount = Math.min(Math.floor(assetDensity * 0.6), MAX_PRIMARY_ASSETS);
    for (let i = 0; i < primaryCount; i++) {
        const assetType = era.primaryAssets[i % era.primaryAssets.length];
        const seed = assetSeed + i * 1000 + era.id * 10000;

        const asset = createEraAsset(assetType, currentElo, seed);

        // Position to sides of ribbon - MINIMUM 8 units from center to avoid board
        const side = seededRandom(seed)() > 0.5 ? 1 : -1;
        const distFromCenter = 12 + seededRandom(seed + 1)() * spreadX;

        asset.position.set(
            side * distFromCenter,
            getGroundLevel(era, seededRandom(seed + 2)()),
            (seededRandom(seed + 3)() - 0.5) * spreadZ + offset
        );

        asset.userData.scrollable = true;
        asset.userData.era = era.id;
        group.add(asset);
    }

    // Spawn secondary assets (more numerous, smaller)
    const secondaryCount = Math.min(Math.floor(assetDensity * 0.8), MAX_SECONDARY_ASSETS);
    for (let i = 0; i < secondaryCount; i++) {
        const assetType = era.secondaryAssets[i % era.secondaryAssets.length];
        const seed = assetSeed + i * 1000 + era.id * 10000 + 500000;

        const asset = createEraAsset(assetType, currentElo, seed);
        asset.scale.multiplyScalar(0.6); // Smaller secondary assets

        const side = seededRandom(seed)() > 0.5 ? 1 : -1;
        const distFromCenter = 12 + seededRandom(seed + 1)() * spreadX * 1.2;  // Min 12 units from center

        asset.position.set(
            side * distFromCenter,
            getGroundLevel(era, seededRandom(seed + 2)()),
            (seededRandom(seed + 3)() - 0.5) * spreadZ + offset
        );

        asset.userData.scrollable = true;
        asset.userData.era = era.id;
        group.add(asset);
    }

    // Add era-specific special elements
    addEraSpecialElements(era, group, offset, progress);
}

/**
 * Add particles appropriate for the era
 */
function addEraParticles(
    era: EraConfig,
    group: THREE.Group,
    offset: number,
    progress: number
): void {
    const particleCount = Math.min(
        Math.floor(era.particleDensity * (0.8 + progress * 0.4) * particleDensityScale),
        MAX_PARTICLES
    );
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    const baseColor = new THREE.Color(era.particleColor);

    for (let i = 0; i < particleCount; i++) {
        const spread = getParticleSpread(era);

        positions[i * 3] = (Math.random() - 0.5) * spread * 2;
        positions[i * 3 + 1] = Math.random() * spread * 0.5;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 200 + offset;

        // Slight color variation
        const colorVariance = 0.1;
        colors[i * 3] = baseColor.r + (Math.random() - 0.5) * colorVariance;
        colors[i * 3 + 1] = baseColor.g + (Math.random() - 0.5) * colorVariance;
        colors[i * 3 + 2] = baseColor.b + (Math.random() - 0.5) * colorVariance;

        sizes[i] = getParticleSize(era) * (0.5 + Math.random() * 0.5);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = createParticleMaterial(era);
    const particles = new THREE.Points(geometry, material);

    particles.userData.isParticles = true;
    particles.userData.particleType = era.particleType;
    particles.userData.scrollable = true;

    group.add(particles);
}

/**
 * Create particle material based on era type
 */
function createParticleMaterial(era: EraConfig): THREE.PointsMaterial | THREE.ShaderMaterial {
    const isGlowing = ['energy', 'data', 'cosmic', 'sparks'].includes(era.particleType);

    if (isGlowing) {
        // Glowing particles for futuristic eras
        return new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(era.particleColor) },
                time: { value: 0 },
            },
            vertexShader: `
                attribute float size;
                varying vec3 vColor;
                uniform float time;
                
                void main() {
                    vColor = color;
                    vec3 pos = position;
                    
                    // Floating animation
                    pos.y += sin(time + position.x * 0.5) * 0.3;
                    pos.x += cos(time * 0.7 + position.z * 0.3) * 0.2;
                    
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_PointSize = size * (200.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                uniform vec3 color;
                
                void main() {
                    float dist = length(gl_PointCoord - vec2(0.5));
                    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
                    float glow = exp(-dist * 4.0);
                    
                    vec3 finalColor = color + vColor * 0.3;
                    gl_FragColor = vec4(finalColor, alpha * 0.8 + glow * 0.5);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexColors: true,
        });
    }

    // Standard particles for natural eras
    return new THREE.PointsMaterial({
        color: era.particleColor,
        size: getParticleSize(era),
        transparent: true,
        opacity: 0.7,
        sizeAttenuation: true,
        vertexColors: true,
    });
}

/**
 * Add era-specific special elements
 */
function addEraSpecialElements(
    era: EraConfig,
    group: THREE.Group,
    offset: number,
    progress: number
): void {
    switch (era.id) {
        case 1: // Jurassic - HIGH-END PREHISTORIC JUNGLE
            addJurassicEnvironment(group, offset, progress);
            break;
        case 2: // Ice Age - PIXAR ICE AGE + MONET style
            addIceAgeEnvironment(group, offset, progress);
            break;
        case 3: // Stone Age - Megaliths, cave dwellings, primitive shelters
            addStoneAgeEnvironment(group, offset, progress);
            break;
        case 4: // Bronze Age - Ziggurats, pyramids, obelisks
            addBronzeAgeEnvironment(group, offset, progress);
            break;
        case 5: // Classical - Greek temples, colonnades
            addClassicalEnvironment(group, offset, progress);
            break;
        case 6: // Medieval - Castle towers, cathedrals
            addMedievalEnvironment(group, offset, progress);
            break;
        case 7: // Renaissance - Domes, palazzos
            addRenaissanceEnvironment(group, offset, progress);
            break;
        case 12: // Cyberpunk - Add holographic ads
            addCyberpunkEnvironment(group, offset, progress);
            break;
        case 17: case 18: case 19: case 20: // Type I-III - Add energy fields
            addTypeCivilizationEnvironment(group, offset, progress, era);
            break;
    }
}

// =============================================================================
// =============================================================================
/**
 * Add era-specific visual elements that connect the chess boards together
 * Creates the visual "ribbon" that ties the infinite boards
 */
function addBoardConnectors(
    era: EraConfig,
    group: THREE.Group,
    offset: number,
    progress: number
): void {
    // Mario 2 Style wants clear path - NO VINES for Era 1
    if (era.id === 1) return;

    // Board connectors run along the sides of the ribbon at x = -4 and x = 4
    const connectorPositions = [
        { x: -4.5, side: 'left' },
        { x: 4.5, side: 'right' }
    ];

    // Configure connector style based on era
    const connectorConfigs: Record<number, {
        type: 'vines' | 'ice' | 'rope' | 'stone' | 'marble' | 'chains' | 'ornate' | 'rails' | 'conveyor' | 'energy';
        color: number;
        emissive?: number;
        thickness: number;
    }> = {
        1: { type: 'vines', color: 0x2a4a1a, thickness: 0.2 },       // Cretaceous - thick jungle vines
        2: { type: 'ice', color: 0x8ac0e0, thickness: 0.25 },        // Ice Age - frozen ice bridges
        3: { type: 'rope', color: 0x5a4a3a, thickness: 0.15 },       // Stone Age - primitive rope/wood
        4: { type: 'stone', color: 0xc8b090, thickness: 0.3 },       // Bronze Age - stone walkways
        5: { type: 'marble', color: 0xf0e8d8, thickness: 0.35 },     // Classical - marble columns
        6: { type: 'chains', color: 0x4a4a4a, thickness: 0.15 },     // Medieval - iron chains
        7: { type: 'ornate', color: 0x8a7050, thickness: 0.3 },      // Renaissance - ornate arches
        8: { type: 'rails', color: 0x3a3a3a, thickness: 0.2 },       // Industrial - rail tracks
        9: { type: 'conveyor', color: 0x4a4a4a, thickness: 0.25 },   // Modern - conveyor belt
        10: { type: 'energy', color: 0x00ff80, emissive: 0x00ff80, thickness: 0.15 },  // Digital - light bridge
        11: { type: 'energy', color: 0x80ffff, emissive: 0x40c0ff, thickness: 0.2 },   // Near Future
        12: { type: 'energy', color: 0xff00ff, emissive: 0xff00ff, thickness: 0.15 },  // Cyberpunk
    };

    const config = connectorConfigs[era.id] || { type: 'rope', color: 0x808080, thickness: 0.2 };

    // Create connectors along both sides
    connectorPositions.forEach(pos => {
        // Create a series of connector segments along the z-axis - continuous like train tracks
        const segmentCount = 40; // More segments for smoother continuous look
        const segmentLength = 7; // Shorter segments = smoother curve

        for (let i = 0; i < segmentCount; i++) {
            const z = offset + (i - segmentCount / 2) * segmentLength;

            let connectorMesh: THREE.Mesh;

            if (config.type === 'vines') {
                // Slim continuous vine like a train track - always present
                const vineGroup = new THREE.Group();

                // Main slim vine - continuous and straight like a rail
                const mainVineGeo = new THREE.CylinderGeometry(0.08, 0.08, segmentLength + 0.5, 8);
                const vineTextureMat = new THREE.MeshStandardMaterial({
                    color: 0x3d2a1a, // Dark woody brown
                    roughness: 1.0,
                    metalness: 0,
                });
                const mainVine = new THREE.Mesh(mainVineGeo, vineTextureMat);
                mainVine.rotation.x = Math.PI / 2;
                mainVine.position.set(pos.x, -0.15, z + segmentLength / 2);
                mainVine.castShadow = true;
                vineGroup.add(mainVine);

                // Secondary parallel vine (like second rail)
                const secondVine = new THREE.Mesh(mainVineGeo.clone(), vineTextureMat.clone());
                secondVine.rotation.x = Math.PI / 2;
                secondVine.position.set(pos.x + (pos.x > 0 ? -0.3 : 0.3), -0.15, z + segmentLength / 2);
                vineGroup.add(secondVine);

                // Cross-ties (like railroad ties but organic)
                const tieCount = 3;
                for (let t = 0; t < tieCount; t++) {
                    const tieZ = z + (t + 0.5) * (segmentLength / tieCount);
                    const tieGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6);
                    const tieMat = new THREE.MeshStandardMaterial({
                        color: 0x2a4a2a, // Green woody
                        roughness: 0.9
                    });
                    const tie = new THREE.Mesh(tieGeo, tieMat);
                    tie.rotation.z = Math.PI / 2;
                    tie.position.set(pos.x + (pos.x > 0 ? -0.15 : 0.15), -0.12, tieZ);
                    vineGroup.add(tie);
                }

                // Thin wrapping tendrils for texture
                const tendrilCount = 2;
                for (let td = 0; td < tendrilCount; td++) {
                    const tendrilZ = z + (td + 0.3) * (segmentLength / tendrilCount);
                    const spiralPoints: THREE.Vector3[] = [];
                    for (let s = 0; s <= 12; s++) {
                        const angle = (s / 12) * Math.PI * 3;
                        const radius = 0.12;
                        spiralPoints.push(new THREE.Vector3(
                            pos.x + Math.cos(angle) * radius,
                            -0.15 + Math.sin(angle) * radius,
                            tendrilZ + s * 0.15
                        ));
                    }
                    const spiralCurve = new THREE.CatmullRomCurve3(spiralPoints);
                    const spiralGeo = new THREE.TubeGeometry(spiralCurve, 20, 0.015, 6, false);
                    const spiralMat = new THREE.MeshStandardMaterial({
                        color: 0x1a5a1a,
                        roughness: 0.7
                    });
                    vineGroup.add(new THREE.Mesh(spiralGeo, spiralMat));
                }

                // Sparse leaves (not too many)
                if (i % 3 === 0) {
                    const leafCount = 2;
                    for (let l = 0; l < leafCount; l++) {
                        const leafGeo = new THREE.PlaneGeometry(0.15, 0.25);
                        const leafMat = new THREE.MeshStandardMaterial({
                            color: 0x2a5a2a,
                            roughness: 0.8,
                            side: THREE.DoubleSide
                        });
                        const leaf = new THREE.Mesh(leafGeo, leafMat);
                        leaf.position.set(
                            pos.x + (Math.random() - 0.5) * 0.2,
                            -0.05,
                            z + Math.random() * segmentLength
                        );
                        leaf.rotation.x = -0.5 + Math.random() * 0.3;
                        leaf.rotation.y = Math.random() * Math.PI;
                        vineGroup.add(leaf);
                    }
                }

                // Occasional small flower clusters
                if (i % 5 === 0) {
                    const flowerColors = [0xff6090, 0xffaa40, 0xffffff, 0xffff80];
                    const clusterPos = new THREE.Vector3(
                        pos.x + (Math.random() - 0.5) * 0.15,
                        0,
                        z + segmentLength * 0.5
                    );
                    const flowerCount = 3;
                    for (let f = 0; f < flowerCount; f++) {
                        const flowerGeo = new THREE.SphereGeometry(0.03, 6, 6);
                        const flowerMat = new THREE.MeshStandardMaterial({
                            color: flowerColors[Math.floor(Math.random() * flowerColors.length)],
                            emissive: 0x222200,
                            emissiveIntensity: 0.2
                        });
                        const flower = new THREE.Mesh(flowerGeo, flowerMat);
                        flower.position.copy(clusterPos);
                        flower.position.x += (Math.random() - 0.5) * 0.1;
                        flower.position.z += (Math.random() - 0.5) * 0.1;
                        vineGroup.add(flower);
                    }
                }

                vineGroup.userData.scrollable = true;
                vineGroup.userData.era = era.id;
                group.add(vineGroup);
                continue; // Skip adding connectorMesh since we added a group
            } else if (config.type === 'ice') {
                // Crystalline ice bridge
                const bridgeGeo = new THREE.BoxGeometry(config.thickness * 4, config.thickness, segmentLength);
                const bridgeMat = new THREE.MeshPhysicalMaterial({
                    color: config.color,
                    roughness: 0.1,
                    metalness: 0.3,
                    transparent: true,
                    opacity: 0.7,
                    transmission: 0.3
                });
                connectorMesh = new THREE.Mesh(bridgeGeo, bridgeMat);
                connectorMesh.position.set(pos.x, -0.3, z + segmentLength / 2);
            } else if (config.type === 'chains') {
                // Chain links
                const chainGroup = new THREE.Group();
                const linkCount = 8;
                for (let j = 0; j < linkCount; j++) {
                    const linkGeo = new THREE.TorusGeometry(config.thickness * 2, config.thickness * 0.3, 8, 12);
                    const linkMat = new THREE.MeshStandardMaterial({ color: config.color, metalness: 0.8, roughness: 0.3 });
                    const link = new THREE.Mesh(linkGeo, linkMat);
                    link.position.set(0, 0, j * (config.thickness * 4));
                    link.rotation.x = j % 2 === 0 ? 0 : Math.PI / 2;
                    chainGroup.add(link);
                }
                chainGroup.position.set(pos.x, -0.2, z);
                group.add(chainGroup);
                continue; // Skip adding connectorMesh since we added a group
            } else if (config.type === 'energy') {
                // Glowing energy bridge  
                const bridgeGeo = new THREE.BoxGeometry(config.thickness * 2, config.thickness, segmentLength);
                const bridgeMat = new THREE.MeshStandardMaterial({
                    color: config.color,
                    emissive: config.emissive || config.color,
                    emissiveIntensity: 0.8,
                    transparent: true,
                    opacity: 0.6
                });
                connectorMesh = new THREE.Mesh(bridgeGeo, bridgeMat);
                connectorMesh.position.set(pos.x, -0.1, z + segmentLength / 2);
            } else {
                // Default: simple beam connector (rope, rails, stone, marble, etc)
                const beamGeo = new THREE.CylinderGeometry(config.thickness, config.thickness, segmentLength, 8);
                const beamMat = new THREE.MeshStandardMaterial({
                    color: config.color,
                    roughness: 0.6,
                    metalness: config.type === 'rails' ? 0.5 : 0.1
                });
                connectorMesh = new THREE.Mesh(beamGeo, beamMat);
                connectorMesh.rotation.x = Math.PI / 2; // Rotate to lie along z-axis
                connectorMesh.position.set(pos.x, -0.3, z + segmentLength / 2);
            }

            connectorMesh.userData.scrollable = true;
            connectorMesh.userData.era = era.id;
            connectorMesh.castShadow = true;
            connectorMesh.receiveShadow = true;
            group.add(connectorMesh);
        }
    });
}

// =============================================================================
// SPECIAL ELEMENT CREATORS
// =============================================================================

/**
 * Add ground plane for terrestrial eras (1-12)
 * Each era has unique ground colors and texturing
 */
function addGroundPlane(era: EraConfig, group: THREE.Group, offset: number, progress: number): void {
    // Era-specific ground configurations - DISTINCT from sky colors
    // Ground colors - EARTHY tones only (brown, tan, grey, green grass) - NO BLUE
    const groundConfigs: Record<number, {
        color: number;
        roughness: number;
        metalness: number;
        emissive?: number;
        emissiveIntensity?: number;
        detailColor?: number;
    }> = {
        1: { color: 0x5a4530, roughness: 1.0, metalness: 0, emissive: 0x0a0805, emissiveIntensity: 0.05, detailColor: 0x3a5a2a }, // Cretaceous - rich brown earth with grass
        2: { color: 0xc8c8d0, roughness: 0.4, metalness: 0.1, detailColor: 0xe0e8f0 },   // Ice Age - white/grey frozen ground
        3: { color: 0x6a5a45, roughness: 0.9, metalness: 0, detailColor: 0x4a4030 },     // Stone Age - brown dirt
        4: { color: 0xd4b896, roughness: 0.85, metalness: 0, detailColor: 0xc0a070 },    // Bronze Age - sandy tan desert
        5: { color: 0x5a7045, roughness: 0.8, metalness: 0, detailColor: 0x4a6035 },     // Classical - olive/grass green
        6: { color: 0x3a4528, roughness: 0.85, metalness: 0, detailColor: 0x2a351a },    // Medieval - dark forest floor
        7: { color: 0x4a6038, roughness: 0.7, metalness: 0, detailColor: 0x3a5028 },     // Renaissance - manicured grass
        8: { color: 0x454540, roughness: 0.6, metalness: 0.2, detailColor: 0x353530 },   // Industrial - cobblestone grey
        9: { color: 0x505050, roughness: 0.5, metalness: 0.3, detailColor: 0x404040 },   // Modern - asphalt grey
        10: { color: 0x404045, roughness: 0.4, metalness: 0.4, detailColor: 0x303035 },  // Digital - polished grey concrete
        11: { color: 0x454550, roughness: 0.3, metalness: 0.5, emissive: 0x101520, emissiveIntensity: 0.1 },  // Near Future - grey smart surface
        12: { color: 0x252530, roughness: 0.2, metalness: 0.6, emissive: 0x150015, emissiveIntensity: 0.2 },  // Cyberpunk - dark grey streets
    };

    const config = groundConfigs[era.id] || { color: 0x4a4a4a, roughness: 0.8, metalness: 0 };

    // Create large ground plane that extends beyond visible area
    const groundWidth = 300;
    const groundLength = 500;

    const groundGeo = new THREE.PlaneGeometry(groundWidth, groundLength, 64, 128);

    // Add terrain undulation for natural eras
    if (era.id <= 7) {
        const positions = groundGeo.attributes.position;
        const colors = new Float32Array(positions.count * 3);
        const baseColor = new THREE.Color(config.color);
        const detailColor = new THREE.Color(config.detailColor || 0x2a5a2a);

        for (let i = 0; i < positions.count; i++) {
            // PlaneGeometry is created in X-Y plane.
            // When rotated -90 deg on X, Local X -> World X, Local Y -> World Z.
            // To create height (World Y), we must displace Local Z (normal direction).

            const x = positions.getX(i);
            const y = positions.getY(i); // This becomes World Z

            // Create varied terrain undulation based on World X (x) and World Z (y)
            const noise1 = Math.sin(x * 0.08) * Math.cos(y * 0.04);
            const noise2 = Math.sin(x * 0.15 + y * 0.1) * 0.5;
            const noise3 = Math.sin(x * 0.03) * Math.sin(y * 0.02) * 0.3;
            // Displace Local Z (which becomes World Y)
            const height = (noise1 + noise2 + noise3) * 0.15;
            positions.setZ(i, height);

            // Vertex colors for texture variation
            const blend = (Math.sin(x * 0.2 + y * 0.15) + 1) * 0.5 * (0.3 + Math.random() * 0.2);
            const color = baseColor.clone().lerp(detailColor, blend);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }
        groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        groundGeo.computeVertexNormals();
    }

    const groundMat = new THREE.MeshStandardMaterial({
        color: config.color,
        roughness: config.roughness,
        metalness: config.metalness,
        emissive: config.emissive || 0x000000,
        emissiveIntensity: config.emissiveIntensity || 0,
        side: THREE.DoubleSide,
        vertexColors: era.id <= 7, // Use vertex colors for natural eras
        flatShading: era.id <= 3, // Flat shading for ancient eras
    });

    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -1.2, 0); // Lower to be more visible
    ground.receiveShadow = true;
    ground.userData.isGround = true;
    group.add(ground);

    // Add texture detail objects for Cretaceous
    if (era.id === 1) {
        // Mario 2 Style: Keep ground CLEAN (no dirt patches)
        // addGroundTexture(group, offset);
        // addVolcanicCracks(group, offset);
    } else if (era.id === 2) {
        addIcePatches(group, offset);
    } else if (era.id >= 8 && era.id <= 12) {
        addUrbanRoadway(group, offset, era);
    }
}

/**
 * Add ground texture details - dirt patches, grass tufts, small rocks
 */
function addGroundTexture(group: THREE.Group, offset: number): void {
    // Dirt patches
    for (let i = 0; i < 40; i++) {
        const seed = 11000 + i * 50;
        const random = seededRandom(seed);

        const patchGeo = new THREE.CircleGeometry(1 + random() * 3, 8);
        const patchMat = new THREE.MeshStandardMaterial({
            color: random() > 0.5 ? 0x4a3a25 : 0x3a2a18,
            roughness: 1,
            side: THREE.DoubleSide
        });
        const patch = new THREE.Mesh(patchGeo, patchMat);
        patch.rotation.x = -Math.PI / 2;
        patch.position.set(
            (random() - 0.5) * 150,
            -1.15,
            (random() - 0.5) * 300 + offset
        );
        patch.userData.scrollable = true;
        group.add(patch);
    }

    // Grass tufts / vegetation patches
    for (let i = 0; i < 60; i++) {
        const seed = 11500 + i * 30;
        const random = seededRandom(seed);

        const tuftsGroup = new THREE.Group();
        const tuftCount = 3 + Math.floor(random() * 5);

        for (let t = 0; t < tuftCount; t++) {
            const grassGeo = new THREE.PlaneGeometry(0.2, 0.4 + random() * 0.3);
            const grassMat = new THREE.MeshStandardMaterial({
                color: random() > 0.3 ? 0x3a5a2a : 0x4a6a3a,
                roughness: 0.9,
                side: THREE.DoubleSide
            });
            const grass = new THREE.Mesh(grassGeo, grassMat);
            grass.position.set(
                (random() - 0.5) * 0.5,
                0.2,
                (random() - 0.5) * 0.5
            );
            grass.rotation.y = random() * Math.PI;
            grass.rotation.x = -0.2 + random() * 0.1;
            tuftsGroup.add(grass);
        }

        tuftsGroup.position.set(
            (random() - 0.5) * 150,
            -1.2,
            (random() - 0.5) * 300 + offset
        );
        tuftsGroup.userData.scrollable = true;
        group.add(tuftsGroup);
    }

    // Small rocks scattered
    for (let i = 0; i < 30; i++) {
        const seed = 12000 + i * 40;
        const random = seededRandom(seed);

        const rockGeo = new THREE.DodecahedronGeometry(0.15 + random() * 0.25, 0);
        const rockMat = new THREE.MeshStandardMaterial({
            color: 0x5a5040 + Math.floor(random() * 0x101010),
            roughness: 0.95,
            flatShading: true
        });
        const rock = new THREE.Mesh(rockGeo, rockMat);
        rock.position.set(
            (random() - 0.5) * 150,
            -1.1,
            (random() - 0.5) * 300 + offset
        );
        rock.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
        rock.scale.y = 0.5 + random() * 0.3;
        rock.userData.scrollable = true;
        group.add(rock);
    }
}

function addVolcanicCracks(group: THREE.Group, offset: number): void {
    for (let i = 0; i < 15; i++) {
        const crackGeo = new THREE.PlaneGeometry(0.3, 5 + Math.random() * 10);
        const crackMat = new THREE.MeshStandardMaterial({
            color: 0xff4400,
            emissive: 0xff2200,
            emissiveIntensity: 0.8,
        });
        const crack = new THREE.Mesh(crackGeo, crackMat);
        crack.rotation.x = -Math.PI / 2;
        crack.rotation.z = Math.random() * Math.PI;
        crack.position.set(
            (Math.random() - 0.5) * 100,
            -1.18, // Slightly above ground
            (Math.random() - 0.5) * 200 + offset
        );
        group.add(crack);
    }
}

function addIcePatches(group: THREE.Group, offset: number): void {
    for (let i = 0; i < 20; i++) {
        const patchGeo = new THREE.CircleGeometry(2 + Math.random() * 5, 8);
        const patchMat = new THREE.MeshStandardMaterial({
            color: 0xc0e8ff,
            roughness: 0.1,
            metalness: 0.3,
            transparent: true,
            opacity: 0.7,
        });
        const patch = new THREE.Mesh(patchGeo, patchMat);
        patch.rotation.x = -Math.PI / 2;
        patch.position.set(
            (Math.random() - 0.5) * 100,
            -0.45,
            (Math.random() - 0.5) * 200 + offset
        );
        group.add(patch);
    }
}

function addUrbanRoadway(group: THREE.Group, offset: number, era: EraConfig): void {
    // Main roadway along the ribbon
    const roadWidth = era.id >= 10 ? 12 : 8;
    const roadGeo = new THREE.PlaneGeometry(roadWidth, 400);

    const roadColor = era.id >= 11 ? 0x2a2a3a : 0x303030;
    const roadMat = new THREE.MeshStandardMaterial({
        color: roadColor,
        roughness: 0.4,
        metalness: 0.1,
    });

    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, -0.45, offset);
    road.receiveShadow = true;
    group.add(road);

    // Road markings for modern+ eras
    if (era.id >= 9) {
        const lineColor = era.id >= 11 ? 0x00ffff : 0xffff00;
        const lineMat = new THREE.MeshStandardMaterial({
            color: lineColor,
            emissive: era.id >= 11 ? lineColor : 0x000000,
            emissiveIntensity: era.id >= 11 ? 0.5 : 0,
        });

        // Center line
        for (let z = -150; z < 150; z += 8) {
            const lineGeo = new THREE.PlaneGeometry(0.2, 4);
            const line = new THREE.Mesh(lineGeo, lineMat);
            line.rotation.x = -Math.PI / 2;
            line.position.set(0, -0.44, z + offset);
            group.add(line);
        }
    }
}




// =============================================================================
// ANIMATION UPDATE
// =============================================================================

/**
 * Update environment animations each frame
 * Now with frustum culling - only update visible objects
 */
export function updateEraEnvironment(
    group: THREE.Group,
    deltaTime: number,
    ribbonSpeed: number
): void {
    // Skip if group is hidden (overhead mode)
    if (!group.visible) return;

    const time = performance.now() * 0.001;

    // Process only a subset of children each frame for performance
    const childCount = group.children.length;
    const startIdx = Math.floor(time * 10) % Math.max(1, Math.floor(childCount / 3));
    const endIdx = Math.min(startIdx + Math.ceil(childCount / 3), childCount);

    for (let i = 0; i < childCount; i++) {
        const child = group.children[i];

        // Always scroll all objects (essential for gameplay)
        if (child.userData.scrollable) {
            if (child.userData.isDinosaur) {
                const walkSpeed = child.userData.walkSpeed || 0.3;
                child.position.z += ribbonSpeed * walkSpeed;
            } else {
                child.position.z += ribbonSpeed;
            }

            if (child.position.z > 120) {
                child.position.z -= 280;
            }
        }

        // Skip non-essential animations for objects outside the current batch
        if (i < startIdx || i >= endIdx) continue;

        // Animate specific object types
        if (child.userData.isLava) {
            // Pulsing lava glow
            const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
            mat.emissiveIntensity = 1.5 + Math.sin(time * 3) * 0.5;
        }

        if (child.userData.isHologram) {
            // Flickering holograms
            const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
            mat.opacity = 0.4 + Math.sin(time * 10 + child.id) * 0.2;
        }

        if (child.userData.isEnergyField) {
            // Rotating energy fields
            child.rotation.z += child.userData.rotationSpeed * deltaTime * 0.001;
        }

        // Update particle shader time
        if (child.userData.isParticles) {
            const particles = child as THREE.Points;
            const material = particles.material;
            if ((material as THREE.ShaderMaterial).uniforms) {
                (material as THREE.ShaderMaterial).uniforms.time.value = time;
            }
        }

        // Rotate space-era asteroids/objects
        if (child.userData.rotate) {
            child.rotation.x += 0.001 * deltaTime;
            child.rotation.y += 0.002 * deltaTime;
        }

        // Animate dinosaur walking (bobbing, sway, and leg movement)
        if (child.userData.isDinosaur) {
            const bobSpeed = child.userData.bobSpeed || 2;
            const bobAmount = child.userData.bobAmount || 0.05;
            child.position.y = -0.5 + Math.sin(time * bobSpeed + child.id) * bobAmount;
            // Subtle side-to-side sway
            child.rotation.z = Math.sin(time * bobSpeed * 0.5 + child.id) * 0.02;

            // Animate legs if they exist
            child.children.forEach((part) => {
                if (part.userData.animPhase !== undefined) {
                    // This is a leg group - animate it
                    const phase = part.userData.animPhase;
                    const legSwing = Math.sin(time * bobSpeed * 1.5 + phase) * 0.15;
                    part.rotation.x = legSwing;
                }
            });
        }

        // Animate lightning flashes
        if (child.userData.isLightning) {
            const flashTimer = child.userData.flashTimer || 0;
            const flashInterval = child.userData.flashInterval || 10;

            // Check if it's time to flash
            const timeSinceFlash = (time - flashTimer) % flashInterval;
            const isFlashing = timeSinceFlash < 0.15; // Flash for 150ms
            const flashIntensity = isFlashing ? (1 - timeSinceFlash / 0.15) : 0;

            // Update all meshes in lightning group
            child.children.forEach((part) => {
                if (part instanceof THREE.Mesh) {
                    const mat = part.material as THREE.MeshBasicMaterial;
                    if (mat.opacity !== undefined) {
                        mat.opacity = flashIntensity * (mat.color.getHex() === 0xffffff ? 1 : 0.5);
                    }
                }
                if (part instanceof THREE.PointLight) {
                    part.intensity = flashIntensity * 50;
                }
            });
        }

        // Animate storm clouds (slow drift)
        if (child.userData.isStormCloud) {
            child.position.x += Math.sin(time * 0.1 + child.id) * 0.01;
            child.position.y += Math.cos(time * 0.08 + child.id) * 0.005;
        }

        // Animate flying birds (wing flapping)
        if (child.userData.isBird) {
            const flapPhase = child.userData.flapPhase || 0;
            const flapSpeed = child.userData.flapSpeed || 5;
            // Flap wings by scaling Y
            const flapAngle = Math.sin(time * flapSpeed + flapPhase) * 0.3;
            child.rotation.z = flapAngle;
        }

        // Animate snowfall
        if (child.userData.isSnowfall) {
            const positions = (child as THREE.Points).geometry.attributes.position;
            const posArray = positions.array as Float32Array;

            for (let p = 0; p < posArray.length; p += 3) {
                // Fall down
                posArray[p + 1] -= 0.1;
                // Drift sideways
                posArray[p] += (Math.sin(time + p) * 0.01);

                // Reset if below ground
                if (posArray[p + 1] < 0) {
                    posArray[p + 1] = 30 + Math.random() * 10;
                    posArray[p] = (Math.random() - 0.5) * 100;
                }
            }
            positions.needsUpdate = true;
        }

        // =====================================================================
        // ICE AGE ANIMATIONS - Mammoth/Caveman chase, rushing water, heavy snow
        // =====================================================================

        // Animate running mammoths (bobbing motion while running)
        if (child.userData.isMammothShadow) {
            const runPhase = child.userData.runPhase || 0;
            // Running bob
            child.position.y = 0.5 + Math.abs(Math.sin(time * 4 + runPhase)) * 0.8;
            // Slight tilt while running
            child.rotation.z = Math.sin(time * 4 + runPhase) * 0.05;
        }

        // Animate running cavemen (more dynamic running motion)
        if (child.userData.isCavemanShadow) {
            const runPhase = child.userData.runPhase || 0;
            // Running bob - faster than mammoths
            child.position.y = 0.3 + Math.abs(Math.sin(time * 6 + runPhase)) * 0.5;
            // Arm pumping motion (rotate whole figure slightly)
            child.rotation.z = Math.sin(time * 6 + runPhase) * 0.1;
            // Lean forward while running
            child.rotation.x = 0.15;
        }

        // Animate rushing water (wave motion)
        if (child.userData.isRushingWater) {
            const mesh = child as THREE.Mesh;
            if (mesh.geometry && mesh.geometry.attributes && mesh.geometry.attributes.position) {
                const positions = mesh.geometry.attributes.position;
                const posArray = positions.array as Float32Array;
                const vertexCount = posArray.length / 3;

                for (let v = 0; v < vertexCount; v++) {
                    const x = posArray[v * 3];
                    const z = posArray[v * 3 + 2];
                    // Create rushing wave effect
                    posArray[v * 3 + 1] = Math.sin(time * 4 + x * 0.1 + z * 0.05) * 0.5 +
                        Math.sin(time * 6 + x * 0.2) * 0.3;
                }
                positions.needsUpdate = true;
                mesh.geometry.computeVertexNormals();
            }
        }

        // Animate water foam (pulse and drift)
        if (child.userData.isFoam) {
            child.scale.setScalar(1 + Math.sin(time * 3 + child.id) * 0.2);
            const mesh = child as THREE.Mesh;
            if (mesh.material && !Array.isArray(mesh.material)) {
                (mesh.material as THREE.Material).opacity = 0.4 + Math.sin(time * 4 + child.id) * 0.2;
            }
        }

        // Animate water spray particles
        if (child.userData.isWaterSpray) {
            const points = child as THREE.Points;
            if (points.geometry && points.geometry.attributes && points.geometry.attributes.position) {
                const positions = points.geometry.attributes.position;
                const posArray = positions.array as Float32Array;

                for (let p = 0; p < posArray.length; p += 3) {
                    // Rise up and drift
                    posArray[p + 1] += 0.02;
                    posArray[p] += (Math.random() - 0.5) * 0.02;

                    // Reset if too high
                    if (posArray[p + 1] > 2) {
                        posArray[p + 1] = -2;
                        posArray[p] = (Math.random() - 0.5) * 60;
                    }
                }
                positions.needsUpdate = true;
            }
        }

        // Animate heavy snowfall (thick blizzard)
        if (child.userData.isHeavySnow) {
            const points = child as THREE.Points;
            if (points.geometry && points.geometry.attributes && points.geometry.attributes.position) {
                const positions = points.geometry.attributes.position;
                const posArray = positions.array as Float32Array;

                for (let p = 0; p < posArray.length; p += 3) {
                    // Fall down faster (blizzard)
                    posArray[p + 1] -= 0.2 + Math.random() * 0.1;
                    // Strong wind drift
                    posArray[p] += Math.sin(time * 2 + p * 0.01) * 0.05;
                    // Forward drift (wind pushing toward camera)
                    posArray[p + 2] += 0.1;

                    // Reset if below ground
                    if (posArray[p + 1] < -1) {
                        posArray[p + 1] = 45 + Math.random() * 15;
                        posArray[p] = (Math.random() - 0.5) * 120;
                        posArray[p + 2] -= 250;
                    }
                }
                positions.needsUpdate = true;
            }
        }

        // Animate ground fog (gentle drift and opacity pulse)
        if (child.userData.isGroundFog) {
            const layer = child.userData.fogLayer || 0;
            child.position.x = Math.sin(time * 0.3 + layer) * 5;
            const mesh = child as THREE.Mesh;
            if (mesh.material && !Array.isArray(mesh.material)) {
                (mesh.material as THREE.Material).opacity = 0.12 + Math.sin(time * 0.5 + layer * 0.5) * 0.05;
            }
        }

        // =====================================================================
        // STONE AGE ANIMATIONS - Flickering campfires
        // =====================================================================

        // Animate campfires (flickering flames and light)
        if (child.userData.isCampfire) {
            child.traverse((part) => {
                // Animate flame meshes
                if (part.userData.isFlame) {
                    const flameSpeed = part.userData.flameSpeed || 8;
                    const flamePhase = part.userData.flamePhase || 0;
                    const baseY = part.userData.baseY || 0.5;
                    const baseScale = part.userData.baseScale || 1;

                    // Flickering scale and position
                    const flicker = Math.sin(time * flameSpeed + flamePhase) * 0.15 +
                        Math.sin(time * flameSpeed * 1.7 + flamePhase) * 0.1;
                    part.scale.y = baseScale * (0.8 + flicker + Math.random() * 0.1);
                    part.scale.x = baseScale * (0.9 + flicker * 0.5);
                    part.scale.z = baseScale * (0.9 + flicker * 0.5);
                    part.position.y = baseY + Math.sin(time * flameSpeed * 0.8 + flamePhase) * 0.05;

                    // Slight sway
                    part.rotation.x = Math.sin(time * flameSpeed * 0.5 + flamePhase) * 0.1;
                    part.rotation.z = Math.cos(time * flameSpeed * 0.6 + flamePhase + 1) * 0.08;
                }

                // Animate fire light
                if (part.userData.isFireLight && part instanceof THREE.PointLight) {
                    const baseIntensity = part.userData.baseIntensity || 2.5;
                    // Flickering light intensity
                    part.intensity = baseIntensity * (0.8 + Math.sin(time * 12) * 0.15 +
                        Math.sin(time * 7.3) * 0.1 + Math.random() * 0.05);
                }
            });
        }
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

export function setAssetSeed(seed: number): void {
    assetSeed = seed;
}

export function getCurrentElo(): number {
    return currentElo;
}

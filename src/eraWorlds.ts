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
 * Clear all objects from environment group
 */
function clearEnvironment(group: THREE.Group): void {
    while (group.children.length > 0) {
        const child = group.children[0];
        group.remove(child);
        disposeObject(child);
    }
}

/**
 * Recursively dispose of an object and all its children
 * Prevents memory leaks from geometries and materials
 */
function disposeObject(obj: THREE.Object3D): void {
    // Dispose mesh geometry and materials
    if (obj instanceof THREE.Mesh) {
        if (obj.geometry) {
            obj.geometry.dispose();
        }
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach((m) => {
                    // Dispose ALL texture types
                    if ('map' in m && m.map) m.map.dispose();
                    if ('normalMap' in m && m.normalMap) m.normalMap.dispose();
                    if ('roughnessMap' in m && m.roughnessMap) m.roughnessMap.dispose();
                    if ('metalnessMap' in m && m.metalnessMap) m.metalnessMap.dispose();
                    if ('emissiveMap' in m && m.emissiveMap) m.emissiveMap.dispose();
                    if ('envMap' in m && m.envMap) m.envMap.dispose();
                    if ('lightMap' in m && m.lightMap) m.lightMap.dispose();
                    if ('aoMap' in m && m.aoMap) m.aoMap.dispose();
                    if ('alphaMap' in m && m.alphaMap) m.alphaMap.dispose();
                    if ('bumpMap' in m && m.bumpMap) m.bumpMap.dispose();
                    if ('displacementMap' in m && m.displacementMap) m.displacementMap.dispose();
                    m.dispose();
                });
            } else {
                // Dispose ALL texture types
                const mat = obj.material as THREE.Material & Record<string, any>;
                if (mat.map) mat.map.dispose();
                if (mat.normalMap) mat.normalMap.dispose();
                if (mat.roughnessMap) mat.roughnessMap.dispose();
                if (mat.metalnessMap) mat.metalnessMap.dispose();
                if (mat.emissiveMap) mat.emissiveMap.dispose();
                if (mat.envMap) mat.envMap.dispose();
                if (mat.lightMap) mat.lightMap.dispose();
                if (mat.aoMap) mat.aoMap.dispose();
                if (mat.alphaMap) mat.alphaMap.dispose();
                if (mat.bumpMap) mat.bumpMap.dispose();
                if (mat.displacementMap) mat.displacementMap.dispose();
                obj.material.dispose();
            }
        }
    }

    // Dispose particle systems
    if (obj instanceof THREE.Points) {
        if (obj.geometry) {
            obj.geometry.dispose();
        }
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach((m) => m.dispose());
            } else {
                obj.material.dispose();
            }
        }
    }

    // Dispose sprite materials
    if (obj instanceof THREE.Sprite) {
        if (obj.material) {
            if (obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
        }
    }

    // Recursively dispose children
    if (obj.children) {
        for (let i = obj.children.length - 1; i >= 0; i--) {
            disposeObject(obj.children[i]);
        }
    }
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
    const assetDensity = getAssetDensity(era, progress);
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
            // Fast 35mph journey through frozen tundra - SCAFFOLDED FOR EPIC SCALE
            addIceAgeSun(group, offset);              // Subtle winter sun
            addGlacialCanyon(group, offset);          // MASSIVE canyon walls on both sides
            addDistantMountainRange(group, offset);   // Snowy peaks on horizon
            addFrozenWaterfalls(group, offset);       // Frozen cascades on glacier walls
            addRushingMeltwater(group, offset);       // Giant water rushes underneath
            addIceCaves(group, offset);               // Cave openings in glacier walls
            addMammothCavemanChase(group, offset);    // Multiple chase groups
            addMonetSnowPines(group, offset);         // Forest of snowy trees
            addIceAgeHills(group, offset);            // Rolling snowy hills
            addIceBoulders(group, offset);            // Scattered ice rocks
            addHeavySnowfall(group, offset);          // Thick blizzard
            addIceCrystals(group, offset, progress);  // Sparkling crystals
            addFlyingBirds(group, offset);            // Birds in distance
            addGroundFog(group, offset);              // Low-lying mist
            break;
        case 3: // Stone Age - Megaliths, cave dwellings, primitive shelters
            addStoneAgeBuildings(group, offset, progress);
            break;
        case 4: // Bronze Age - Ziggurats, pyramids, obelisks
            addBronzeAgeBuildings(group, offset, progress);
            break;
        case 5: // Classical - Greek temples, colonnades
            addClassicalBuildings(group, offset, progress);
            break;
        case 6: // Medieval - Castle towers, cathedrals
            addMedievalBuildings(group, offset, progress);
            break;
        case 7: // Renaissance - Domes, palazzos
            addRenaissanceBuildings(group, offset, progress);
            break;
        case 12: // Cyberpunk - Add holographic ads
            addHolograms(group, offset, progress);
            break;
        case 17: case 18: case 19: case 20: // Type I-III - Add energy fields
            addEnergyFields(group, offset, progress, era);
            break;
    }
}

// =============================================================================
// ERA-SPECIFIC BUILDING SPAWNERS (Eras 3-7)
// High-quality architectural structures positioned to avoid board interference
// =============================================================================

/**
 * Stone Age (Era 3) - Megaliths, cave dwellings, primitive shelters, Stonehenge, dolmens
 */
function addStoneAgeBuildings(group: THREE.Group, offset: number, progress: number): void {
    const buildingCount = 6 + Math.floor(progress * 4);
    const spreadZ = 200;

    // Add Stonehenge in the distance (1-2 per section, far away for iconic silhouette)
    const stonehengeCount = 1 + (progress > 0.5 ? 1 : 0);
    for (let i = 0; i < stonehengeCount; i++) {
        const seed = 30500 + i * 5000;
        const random = seededRandom(seed);
        const side = i % 2 === 0 ? 1 : -1;

        // Place far in the distance for dramatic effect
        const distFromCenter = 45 + random() * 25;

        const stonehenge = EraBuildings.createStonehenge(seed);
        stonehenge.position.set(
            side * distFromCenter,
            0,
            (random() - 0.5) * spreadZ + offset
        );
        stonehenge.rotation.y = random() * Math.PI * 2;
        stonehenge.userData.scrollable = true;
        stonehenge.userData.era = 3;
        group.add(stonehenge);
    }

    // Add dolmens scattered around (3-5 per section)
    const dolmenCount = 3 + Math.floor(progress * 2);
    for (let i = 0; i < dolmenCount; i++) {
        const seed = 30200 + i * 800;
        const random = seededRandom(seed);
        const side = random() > 0.5 ? 1 : -1;

        // Medium distance
        const distFromCenter = 15 + random() * 20;

        const dolmen = EraBuildings.createDolmen(seed);
        dolmen.position.set(
            side * distFromCenter,
            0,
            (random() - 0.5) * spreadZ + offset
        );
        dolmen.rotation.y = random() * Math.PI * 2;
        dolmen.userData.scrollable = true;
        dolmen.userData.era = 3;
        group.add(dolmen);
    }

    // Add burning campfires (5-8 per section, scattered for warmth)
    const campfireCount = 5 + Math.floor(progress * 3);
    for (let i = 0; i < campfireCount; i++) {
        const seed = 30300 + i * 600;
        const random = seededRandom(seed);
        const side = random() > 0.5 ? 1 : -1;

        // Campfires closer to path for visibility
        const distFromCenter = 8 + random() * 18;

        const campfire = EraBuildings.createCampfire(seed);
        campfire.position.set(
            side * distFromCenter,
            0,
            (random() - 0.5) * spreadZ + offset
        );
        campfire.userData.scrollable = true;
        campfire.userData.era = 3;
        campfire.userData.isCampfire = true;
        group.add(campfire);
    }

    // Original buildings (megaliths, caves, shelters)
    for (let i = 0; i < buildingCount; i++) {
        const seed = 30000 + i * 1000;
        const random = seededRandom(seed);
        const side = random() > 0.5 ? 1 : -1;

        // Min 12 units from center for larger structures
        const distFromCenter = 12 + random() * 25;

        // Choose building type
        const typeRoll = random();
        let building: THREE.Group;
        if (typeRoll > 0.6) {
            building = EraBuildings.createMegalith(seed);
        } else if (typeRoll > 0.3) {
            building = EraBuildings.createCaveDwelling(seed);
        } else {
            building = EraBuildings.createPrimitiveShelter(seed);
            building.scale.setScalar(0.8 + random() * 0.4);
        }

        building.position.set(
            side * distFromCenter,
            0,
            (random() - 0.5) * spreadZ + offset
        );
        building.rotation.y = random() * Math.PI * 2;

        building.userData.scrollable = true;
        building.userData.era = 3;
        group.add(building);
    }
}

/**
 * Bronze Age (Era 4) - Ziggurats, pyramids, obelisks
 */
function addBronzeAgeBuildings(group: THREE.Group, offset: number, progress: number): void {
    const spreadZ = 250;

    // Add major structures (ziggurats, pyramids) - fewer but larger
    const majorCount = 2 + Math.floor(progress * 2);
    for (let i = 0; i < majorCount; i++) {
        const seed = 40000 + i * 2000;
        const random = seededRandom(seed);
        const side = i % 2 === 0 ? 1 : -1;

        // Large structures need more distance
        const distFromCenter = 25 + random() * 35;

        // Alternate between ziggurats and pyramids
        const building = i % 2 === 0
            ? EraBuildings.createZiggurat(seed)
            : EraBuildings.createPyramid(seed);

        building.position.set(
            side * distFromCenter,
            0,
            (random() - 0.5) * spreadZ + offset
        );
        building.rotation.y = random() * 0.3 - 0.15; // Slight rotation

        building.userData.scrollable = true;
        building.userData.era = 4;
        group.add(building);
    }

    // Add obelisks - smaller, more numerous
    const obeliskCount = 5 + Math.floor(progress * 3);
    for (let i = 0; i < obeliskCount; i++) {
        const seed = 41000 + i * 500;
        const random = seededRandom(seed);
        const side = random() > 0.5 ? 1 : -1;

        const distFromCenter = 12 + random() * 20;

        const obelisk = EraBuildings.createObelisk(seed);
        obelisk.scale.setScalar(0.6 + random() * 0.5);

        obelisk.position.set(
            side * distFromCenter,
            0,
            (random() - 0.5) * spreadZ + offset
        );

        obelisk.userData.scrollable = true;
        obelisk.userData.era = 4;
        group.add(obelisk);
    }
}

/**
 * Classical (Era 5) - Greek temples, colonnades
 */
function addClassicalBuildings(group: THREE.Group, offset: number, progress: number): void {
    const spreadZ = 250;

    // Add major temples - 2-3 per section
    const templeCount = 2 + Math.floor(progress * 1);
    for (let i = 0; i < templeCount; i++) {
        const seed = 50000 + i * 3000;
        const random = seededRandom(seed);
        const side = i % 2 === 0 ? 1 : -1;

        // Temples are wide, need good distance
        const distFromCenter = 22 + random() * 30;

        const temple = EraBuildings.createGreekTemple(seed);
        temple.scale.setScalar(0.8 + random() * 0.3);

        temple.position.set(
            side * distFromCenter,
            0,
            (random() - 0.5) * spreadZ + offset
        );
        // Face toward the ribbon/board
        temple.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;

        temple.userData.scrollable = true;
        temple.userData.era = 5;
        group.add(temple);
    }

    // Add colonnades - linear structures along the path
    const colonnadeCount = 3 + Math.floor(progress * 2);
    for (let i = 0; i < colonnadeCount; i++) {
        const seed = 51000 + i * 1000;
        const random = seededRandom(seed);
        const side = random() > 0.5 ? 1 : -1;

        const distFromCenter = 15 + random() * 18;

        const colonnade = EraBuildings.createColonnade(seed);
        colonnade.scale.setScalar(0.7 + random() * 0.4);

        colonnade.position.set(
            side * distFromCenter,
            0,
            (random() - 0.5) * spreadZ + offset
        );
        // Align with path direction
        colonnade.rotation.y = 0;

        colonnade.userData.scrollable = true;
        colonnade.userData.era = 5;
        group.add(colonnade);
    }
}

/**
 * Medieval (Era 6) - Castle towers, gothic cathedrals
 */
function addMedievalBuildings(group: THREE.Group, offset: number, progress: number): void {
    const spreadZ = 250;

    // Add castle towers - main defensive structures
    const towerCount = 4 + Math.floor(progress * 3);
    for (let i = 0; i < towerCount; i++) {
        const seed = 60000 + i * 1000;
        const random = seededRandom(seed);
        const side = random() > 0.5 ? 1 : -1;

        const distFromCenter = 14 + random() * 25;

        const tower = EraBuildings.createCastleTower(seed);
        const scale = 0.6 + random() * 0.5;
        tower.scale.setScalar(scale);

        tower.position.set(
            side * distFromCenter,
            0,
            (random() - 0.5) * spreadZ + offset
        );

        tower.userData.scrollable = true;
        tower.userData.era = 6;
        group.add(tower);
    }

    // Add cathedrals - grand structures, fewer
    const cathedralCount = 1 + Math.floor(progress * 1);
    for (let i = 0; i < cathedralCount; i++) {
        const seed = 62000 + i * 5000;
        const random = seededRandom(seed);
        const side = i % 2 === 0 ? 1 : -1;

        // Cathedrals are very large
        const distFromCenter = 35 + random() * 25;

        const cathedral = EraBuildings.createGothicCathedral(seed);
        cathedral.scale.setScalar(0.7 + random() * 0.3);

        cathedral.position.set(
            side * distFromCenter,
            0,
            (random() - 0.5) * spreadZ * 0.5 + offset
        );
        // Face toward ribbon
        cathedral.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;

        cathedral.userData.scrollable = true;
        cathedral.userData.era = 6;
        group.add(cathedral);
    }
}

/**
 * Renaissance (Era 7) - Domes, palazzos
 */
function addRenaissanceBuildings(group: THREE.Group, offset: number, progress: number): void {
    const spreadZ = 250;

    // Add domes - iconic Renaissance structures
    const domeCount = 1 + Math.floor(progress * 1);
    for (let i = 0; i < domeCount; i++) {
        const seed = 70000 + i * 4000;
        const random = seededRandom(seed);
        const side = i % 2 === 0 ? 1 : -1;

        // Domes are large feature buildings
        const distFromCenter = 30 + random() * 30;

        const dome = EraBuildings.createRenaissanceDome(seed);
        dome.scale.setScalar(0.8 + random() * 0.3);

        dome.position.set(
            side * distFromCenter,
            0,
            (random() - 0.5) * spreadZ * 0.6 + offset
        );

        dome.userData.scrollable = true;
        dome.userData.era = 7;
        group.add(dome);
    }

    // Add palazzos - Italian palaces lining the route
    const palazzoCount = 4 + Math.floor(progress * 3);
    for (let i = 0; i < palazzoCount; i++) {
        const seed = 71000 + i * 800;
        const random = seededRandom(seed);
        const side = random() > 0.5 ? 1 : -1;

        const distFromCenter = 16 + random() * 22;

        const palazzo = EraBuildings.createPalazzo(seed);
        palazzo.scale.setScalar(0.6 + random() * 0.4);

        palazzo.position.set(
            side * distFromCenter,
            0,
            (random() - 0.5) * spreadZ + offset
        );
        // Face toward the ribbon
        palazzo.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;

        palazzo.userData.scrollable = true;
        palazzo.userData.era = 7;
        group.add(palazzo);
    }
}

// =============================================================================
// ERA 1: JURASSIC - HIGH-END PREHISTORIC JUNGLE ENVIRONMENT
// Industry-standard quality with realistic vegetation, atmospheric effects,
// and proper composition. NO weird dinosaurs or blocking elements.
// =============================================================================

/**
 * Create the complete Jurassic environment - lush prehistoric jungle
 */
function addJurassicEnvironment(group: THREE.Group, offset: number, progress: number): void {
    // Layer 1: Distant mountain silhouettes (furthest back)
    addJurassicMountains(group, offset);

    // Layer 2: Dense jungle treeline (middle distance)
    addJurassicTreeline(group, offset);

    // Layer 3: Atmospheric volumetric mist
    addJurassicMist(group, offset);

    // Layer 4: Ground cover vegetation (close to path)
    addJurassicGroundCover(group, offset);

    // Layer 5: Scattered large ferns and cycads (foreground interest)
    addJurassicFoliage(group, offset, progress);

    // Layer 6: Ambient floating particles (spores/pollen)
    addJurassicParticles(group, offset);

    // Layer 7: Dinosaur Vectors (Background Silhouettes)
    addJurassicDinosaurs(group, offset, progress);
}

// Dinosaur Texture and Material Cache
const dinoTextures: THREE.Texture[] = [];
const dinoMaterials: THREE.SpriteMaterial[] = []; // Cache materials to reduce GPU state changes
let dinoResourcesLoaded = false;

function loadDinoResources() {
    if (dinoResourcesLoaded) return;

    const loader = new THREE.TextureLoader();
    // Load 13 dinosaur sprites
    for (let i = 0; i < 13; i++) {
        const texture = loader.load(`/assets/dinos/dino_${i}.png`);
        texture.colorSpace = THREE.SRGBColorSpace;
        dinoTextures[i] = texture;

        // Pre-create material for batching efficiency
        // We use a slightly different color per instance in the old code (maybe not? it was hardcoded 0x1a1a1a)
        // If we want color variation, we can't fully batch, but reusing the base material and cloning is still better,
        // or just sharing one material if they are identical.
        // The previous code had: color: 0x1a1a1a, opacity: 0.85. Identical for all.
        // So we can share ONE material per texture.

        dinoMaterials[i] = new THREE.SpriteMaterial({
            map: texture,
            color: 0x1a1a1a,
            transparent: true,
            opacity: 0.85,
            fog: true,
        });
    }
    dinoResourcesLoaded = true;
}

/**
 * Add dinosaur vector silhouettes to the background
 */
function addJurassicDinosaurs(group: THREE.Group, offset: number, progress: number): void {
    // Ensure textures/materials are loading
    loadDinoResources();

    // PERFORMANCE: Limit count based on quality/progress
    const dinoCount = 5 + Math.floor(progress * 4);

    for (let i = 0; i < dinoCount; i++) {
        const seed = 400000 + i * 999;
        const random = seededRandom(seed);

        const dinoIndex = Math.floor(random() * 13);

        // Use Cached Material
        if (!dinoMaterials[dinoIndex]) continue; // Skip if not ready (though sync in logic, async in reality)
        const material = dinoMaterials[dinoIndex];

        // Random placement
        const side = random() > 0.5 ? 1 : -1;
        const distFromCenter = 40 + random() * 80;
        const height = 5 + random() * 20;
        const depth = (random() - 0.5) * 400 + offset;

        // Size variation
        const scale = 15 + random() * 25;

        const sprite = new THREE.Sprite(material);
        sprite.position.set(side * distFromCenter, height, depth);

        // Variable scale
        sprite.scale.set(scale, scale, 1);

        // Randomly flip horizontally
        if (random() > 0.5) {
            sprite.center.set(0.5, 0.5);
            sprite.scale.x = -scale;
        }

        sprite.userData.scrollable = true;
        sprite.userData.isDinosaur = true; // Mark for specialized update logic
        sprite.userData.era = 1;

        group.add(sprite);
    }
}

/**
 * Distant volcanic mountains with atmospheric perspective
 */
function addJurassicMountains(group: THREE.Group, offset: number): void {
    const mountainMat = new THREE.MeshStandardMaterial({
        color: 0x3a4a5a,
        roughness: 1.0,
        metalness: 0,
        transparent: true,
        opacity: 0.6,  // Faded by atmospheric perspective
    });

    // Create 4-6 mountain peaks on each side
    for (let i = 0; i < 10; i++) {
        const seed = 100000 + i * 1234;
        const random = seededRandom(seed);

        const side = i % 2 === 0 ? 1 : -1;
        const height = 40 + random() * 60;
        const width = 30 + random() * 50;

        // Mountain shape - irregular cone
        const mountainGeo = new THREE.ConeGeometry(width, height, 6 + Math.floor(random() * 4));
        const mountain = new THREE.Mesh(mountainGeo, mountainMat);

        // Position far back, well away from board
        mountain.position.set(
            side * (80 + random() * 60),  // Far to sides
            height * 0.4,                  // Base at ground
            (random() - 0.5) * 400 + offset
        );

        // Slight random rotation for variety
        mountain.rotation.y = random() * 0.5;

        mountain.userData.scrollable = true;
        mountain.userData.era = 1;
        mountain.castShadow = false; // Disable shadows for distant environment assets
        mountain.receiveShadow = false;
        group.add(mountain);
    }
}

/**
 * Dense treeline of ancient conifers in middle distance
 */
function addJurassicTreeline(group: THREE.Group, offset: number): void {
    // Create rows of trees on both sides
    for (let i = 0; i < 30; i++) {
        const seed = 200000 + i * 567;
        const random = seededRandom(seed);

        const side = i % 2 === 0 ? 1 : -1;

        // Distance from center - keep well clear of board (min 20 units)
        const dist = 25 + random() * 35;

        // Create ancient conifer tree
        const tree = createJurassicConifer(random);

        tree.position.set(
            side * dist,
            0,
            (random() - 0.5) * 350 + offset
        );

        tree.userData.scrollable = true;
        tree.userData.era = 1;
        tree.traverse((child) => { // Disable shadows for environment assets
            if (child instanceof THREE.Mesh) {
                child.castShadow = false;
                child.receiveShadow = false;
            }
        });
        group.add(tree);
    }
}

/**
 * Create a realistic ancient conifer tree (Araucaria-style)
 */
function createJurassicConifer(random: () => number): THREE.Group {
    const tree = new THREE.Group();

    const height = 12 + random() * 18;
    const trunkRadius = 0.4 + random() * 0.3;

    // Trunk - weathered bark texture implied by color variation
    const trunkGeo = new THREE.CylinderGeometry(
        trunkRadius * 0.6,  // Top
        trunkRadius,         // Bottom
        height * 0.7,
        8
    );
    const trunkMat = new THREE.MeshStandardMaterial({
        color: 0x3d2817,
        roughness: 0.9,
        metalness: 0,
    });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = height * 0.35;
    trunk.castShadow = true;
    tree.add(trunk);

    // Foliage layers - multiple tiers of branches
    const foliageMat = new THREE.MeshStandardMaterial({
        color: 0x1a4a2a,
        roughness: 0.8,
        metalness: 0,
    });

    const tiers = 4 + Math.floor(random() * 3);
    for (let t = 0; t < tiers; t++) {
        const tierY = height * (0.4 + t * 0.15);
        const tierRadius = (3 + random() * 2) * (1 - t * 0.15);

        // Each tier is a flattened cone
        const foliageGeo = new THREE.ConeGeometry(tierRadius, 3, 8);
        const foliage = new THREE.Mesh(foliageGeo, foliageMat);
        foliage.position.y = tierY;
        foliage.castShadow = true;
        foliage.receiveShadow = true;
        tree.add(foliage);
    }

    return tree;
}

/**
 * Atmospheric mist layers for depth
 */
function addJurassicMist(group: THREE.Group, offset: number): void {
    // Ground-level mist planes
    const mistMat = new THREE.MeshBasicMaterial({
        color: 0x8aaa9a,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false,
    });

    for (let i = 0; i < 6; i++) {
        const mistGeo = new THREE.PlaneGeometry(200, 8);
        const mist = new THREE.Mesh(mistGeo, mistMat);

        mist.position.set(
            0,
            1 + i * 2,  // Low to ground
            -80 + i * 50 + offset
        );
        mist.rotation.x = -Math.PI / 2;

        mist.userData.scrollable = true;
        mist.userData.era = 1;
        mist.castShadow = false; // Disable shadows for environment assets
        mist.receiveShadow = false;
        group.add(mist);
    }
}

/**
 * Ground cover - ferns, moss, low vegetation
 */
function addJurassicGroundCover(group: THREE.Group, offset: number): void {
    // Create ground fern patches on both sides
    for (let i = 0; i < 40; i++) {
        const seed = 300000 + i * 789;
        const random = seededRandom(seed);

        const side = random() > 0.5 ? 1 : -1;
        const dist = 10 + random() * 25;  // Closer to path but not blocking

        const fern = createGroundFern(random);

        fern.position.set(
            side * dist,
            0,
            (random() - 0.5) * 300 + offset
        );
        fern.rotation.y = random() * Math.PI * 2;

        fern.userData.scrollable = true;
        fern.userData.era = 1;
        fern.traverse((child) => { // Disable shadows for environment assets
            if (child instanceof THREE.Mesh) {
                child.castShadow = false;
                child.receiveShadow = false;
            }
        });
        group.add(fern);
    }
}

/**
 * Create a ground fern cluster
 */
function createGroundFern(random: () => number): THREE.Group {
    const fern = new THREE.Group();

    const fernMat = new THREE.MeshStandardMaterial({
        color: 0x2a5a3a,
        roughness: 0.7,
        metalness: 0,
        side: THREE.DoubleSide,
    });

    // Create 5-8 fronds radiating outward
    const frondCount = 5 + Math.floor(random() * 4);
    for (let f = 0; f < frondCount; f++) {
        const angle = (f / frondCount) * Math.PI * 2 + random() * 0.3;
        const length = 1.5 + random() * 1.5;

        // Simple elongated shape for frond
        const frondGeo = new THREE.ConeGeometry(0.4, length, 4);
        const frond = new THREE.Mesh(frondGeo, fernMat);

        frond.position.set(
            Math.cos(angle) * 0.3,
            length * 0.3,
            Math.sin(angle) * 0.3
        );
        frond.rotation.x = 0.8 + random() * 0.4;
        frond.rotation.y = angle;

        fern.add(frond);
    }

    const scale = 0.8 + random() * 0.6;
    fern.scale.setScalar(scale);

    return fern;
}

/**
 * Larger foreground foliage - giant ferns and cycads
 */
function addJurassicFoliage(group: THREE.Group, offset: number, progress: number): void {
    // Giant ferns and cycads scattered around
    const count = 15 + Math.floor(progress * 10);

    for (let i = 0; i < count; i++) {
        const seed = 400000 + i * 321;
        const random = seededRandom(seed);

        const side = random() > 0.5 ? 1 : -1;
        // Keep minimum 12 units from center to avoid board
        const dist = 12 + random() * 30;

        const plant = random() > 0.5
            ? createGiantFern(random)
            : createCycad(random);

        plant.position.set(
            side * dist,
            0,
            (random() - 0.5) * 350 + offset
        );
        plant.rotation.y = random() * Math.PI * 2;

        plant.userData.scrollable = true;
        plant.userData.era = 1;
        plant.traverse((child) => { // Disable shadows for environment assets
            if (child instanceof THREE.Mesh) {
                child.castShadow = false;
                child.receiveShadow = false;
            }
        });
        group.add(plant);
    }
}

/**
 * Create a giant tree fern
 */
function createGiantFern(random: () => number): THREE.Group {
    const fern = new THREE.Group();

    const height = 4 + random() * 6;

    // Fibrous trunk
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, height, 8);
    const trunkMat = new THREE.MeshStandardMaterial({
        color: 0x4a3a2a,
        roughness: 1.0,
        metalness: 0,
    });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = height * 0.5;
    fern.add(trunk);

    // Crown of fronds
    const frondMat = new THREE.MeshStandardMaterial({
        color: 0x2a6a3a,
        roughness: 0.6,
        metalness: 0,
        side: THREE.DoubleSide,
    });

    const frondCount = 8 + Math.floor(random() * 6);
    for (let f = 0; f < frondCount; f++) {
        const angle = (f / frondCount) * Math.PI * 2;
        const frondLength = 3 + random() * 2;

        const frondGeo = new THREE.ConeGeometry(0.6, frondLength, 4);
        const frond = new THREE.Mesh(frondGeo, frondMat);

        frond.position.set(
            Math.cos(angle) * 0.5,
            height,
            Math.sin(angle) * 0.5
        );
        frond.rotation.x = 0.6 + random() * 0.5;
        frond.rotation.y = angle;

        fern.add(frond);
    }

    return fern;
}

/**
 * Create a cycad (palm-like prehistoric plant)
 */
function createCycad(random: () => number): THREE.Group {
    const cycad = new THREE.Group();

    // Thick short trunk
    const trunkGeo = new THREE.CylinderGeometry(0.6, 0.8, 2, 8);
    const trunkMat = new THREE.MeshStandardMaterial({
        color: 0x5a4a3a,
        roughness: 0.9,
        metalness: 0,
    });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1;
    cycad.add(trunk);

    // Stiff palm-like fronds
    const frondMat = new THREE.MeshStandardMaterial({
        color: 0x3a5a2a,
        roughness: 0.5,
        metalness: 0,
        side: THREE.DoubleSide,
    });

    const frondCount = 10 + Math.floor(random() * 6);
    for (let f = 0; f < frondCount; f++) {
        const angle = (f / frondCount) * Math.PI * 2;
        const frondLength = 2.5 + random() * 1.5;

        const frondGeo = new THREE.BoxGeometry(0.3, frondLength, 0.05);
        const frond = new THREE.Mesh(frondGeo, frondMat);

        frond.position.set(
            Math.cos(angle) * 0.7,
            2 + frondLength * 0.3,
            Math.sin(angle) * 0.7
        );
        frond.rotation.x = 0.4 + random() * 0.4;
        frond.rotation.y = angle;

        cycad.add(frond);
    }

    const scale = 1.0 + random() * 1.0;
    cycad.scale.setScalar(scale);

    return cycad;
}

/**
 * Floating ambient particles - pollen, spores, dust motes
 */
function addJurassicParticles(group: THREE.Group, offset: number): void {
    const particleCount = 150;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        // Spread particles in a wide area but not too close to board
        const x = (Math.random() - 0.5) * 100;
        const y = 2 + Math.random() * 20;
        const z = (Math.random() - 0.5) * 300 + offset;

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: 0xd0e8c0,
        size: 0.15,
        transparent: true,
        opacity: 0.4,
        sizeAttenuation: true,
    });

    const particles = new THREE.Points(geometry, material);
    particles.userData.scrollable = true;
    particles.userData.era = 1;
    particles.userData.isParticles = true;
    particles.castShadow = false; // Disable shadows for environment assets
    particles.receiveShadow = false;

    group.add(particles);
}

/**
 * Add a visible glowing sun sphere in the sky - REMOVED (was blocking visibility)
 * Keeping function stub for compatibility but does nothing
 */
function addVisibleSun(group: THREE.Group, offset: number): void {
    // Removed - was blocking visibility with yellow sphere
    // Lighting is now handled properly by the dynamic lighting system
}


// Helper to create dino skin texture with CACHING to prevent memory crashes
const dinoTextureCache: Map<string, THREE.CanvasTexture> = new Map();

function createDinoSkinTexture(baseColor: number, spotsColor: number): THREE.CanvasTexture {
    const key = `${baseColor}-${spotsColor}`;
    if (dinoTextureCache.has(key)) {
        return dinoTextureCache.get(key)!;
    }

    try {
        const canvas = document.createElement('canvas');
        canvas.width = 256; // Reduced texture size for performance
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            console.warn('Could not get 2d context for dino texture');
            return new THREE.CanvasTexture(canvas);
        }

        // Base scale color
        ctx.fillStyle = '#' + new THREE.Color(baseColor).getHexString();
        ctx.fillRect(0, 0, 256, 256);

        // Creates scales pattern
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        for (let y = 0; y < 256; y += 16) {
            for (let x = 0; x < 256; x += 16) {
                if (Math.random() > 0.5) {
                    ctx.beginPath();
                    ctx.arc(x + 8, y + 8, 7, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
        }

        // Add simple spots
        ctx.fillStyle = '#' + new THREE.Color(spotsColor).getHexString();
        for (let i = 0; i < 15; i++) {
            const cx = Math.random() * 256;
            const cy = Math.random() * 256;
            const r = 5 + Math.random() * 20;
            ctx.beginPath();
            ctx.ellipse(cx, cy, r, r * (0.5 + Math.random()), Math.random() * 3, 0, Math.PI * 2);
            ctx.fill();
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;

        dinoTextureCache.set(key, tex);
        return tex;
    } catch (e) {
        console.error("Error creating dino texture:", e);
        return new THREE.CanvasTexture(document.createElement('canvas'));
    }
}

/**
 * Add distant dinosaur silhouettes near the mountains on the horizon
 * Shadow shapes in the CENTER of the view, far back like the reference image
 */
function addDistantDinoSilhouettes(group: THREE.Group, offset: number): void {
    const silhouetteCount = 8;

    // Very dark silhouette material - like shadows against the sky
    const silhouetteMat = new THREE.MeshBasicMaterial({
        color: 0x151520,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
    });

    // Lighter for furthest ones (atmospheric fade)
    const distantSilhouetteMat = new THREE.MeshBasicMaterial({
        color: 0x252535,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
    });

    for (let i = 0; i < silhouetteCount; i++) {
        const seed = 7500 + i * 173;
        const random = seededRandom(seed);

        // Only big iconic dinosaurs
        const typeRoll = random();
        let type: 'trex' | 'trike' | 'stego' | 'brachi' | 'ptera';
        if (typeRoll > 0.75) type = 'trex';
        else if (typeRoll > 0.55) type = 'trike';
        else if (typeRoll > 0.35) type = 'stego';
        else if (typeRoll > 0.15) type = 'brachi';
        else type = 'ptera';

        const silhouetteGroup = new THREE.Group();

        // Z distance - far back near the mountains
        const zDist = -180 - random() * 80;
        const useFarMat = zDist < -220;
        const mat = useFarMat ? distantSilhouetteMat : silhouetteMat;

        // Create silhouette shape
        const shape = createDinoSilhouetteShape(type, random);
        const shapeGeo = new THREE.ShapeGeometry(shape);
        const silhouette = new THREE.Mesh(shapeGeo, mat);
        silhouetteGroup.add(silhouette);

        // Scale small - distant shadows
        const baseScale = type === 'ptera' ? 0.14 : 0.10;
        const scale = baseScale + random() * 0.05;
        silhouetteGroup.scale.set(scale, scale, scale);

        // Position in CENTER spread (not sides), near mountains
        const xSpread = (random() - 0.5) * 140;  // -70 to +70 (CENTER)

        silhouetteGroup.position.set(
            xSpread,
            type === 'ptera' ? 15 + random() * 20 : 1 + random() * 4,
            zDist + offset
        );

        // No rotation - flat facing camera

        silhouetteGroup.userData.scrollable = true;
        silhouetteGroup.userData.isDinoSilhouette = true;
        silhouetteGroup.userData.era = 1;
        silhouetteGroup.userData.walkSpeed = 0.01 + random() * 0.015;
        silhouetteGroup.traverse((child) => { // Disable shadows for environment assets
            if (child instanceof THREE.Mesh) {
                child.castShadow = false;
                child.receiveShadow = false;
            }
        });

        group.add(silhouetteGroup);
    }
}


/**
 * Create dinosaur silhouettes using simple geometric primitives
 * These create cleaner, more recognizable shapes from a distance
 */
function createDinoSilhouetteShape(type: string, _random: () => number): THREE.Shape {
    const shape = new THREE.Shape();

    switch (type) {
        case 'trex': {
            // T-Rex - big oval body, large head, thin tail
            // Body oval
            const bodyW = 40, bodyH = 25;
            shape.ellipse(0, 15, bodyW, bodyH, 0, Math.PI * 2, false, 0);

            // Head - separate large circle-ish shape
            const headShape = new THREE.Path();
            headShape.ellipse(55, 35, 20, 15, 0, Math.PI * 2, false, 0);
            shape.holes.push(headShape as unknown as THREE.Path);

            // Actually let's just draw the full outline as one shape
            shape.moveTo(-50, 5);  // Tail tip
            shape.quadraticCurveTo(-30, 10, -10, 15);  // Tail to body
            shape.quadraticCurveTo(10, 25, 25, 28);    // Body curve up
            shape.quadraticCurveTo(35, 32, 45, 40);    // Neck
            shape.quadraticCurveTo(55, 48, 70, 45);    // Head top
            shape.quadraticCurveTo(80, 42, 85, 35);    // Snout
            shape.quadraticCurveTo(80, 28, 65, 25);    // Jaw back
            shape.quadraticCurveTo(50, 22, 40, 18);    // Throat
            shape.quadraticCurveTo(30, 12, 20, 5);     // Chest to leg
            shape.quadraticCurveTo(25, 0, 30, 0);      // Front foot
            shape.quadraticCurveTo(20, 5, 10, 8);      // Leg back
            shape.quadraticCurveTo(-5, 10, -20, 8);    // Under body
            shape.quadraticCurveTo(-35, 5, -50, 5);    // Tail return
            break;
        }

        case 'trike': {
            // Triceratops - round body, big frill, horns
            shape.moveTo(50, 5);  // Tail tip
            shape.quadraticCurveTo(35, 8, 20, 12);     // Tail to body
            shape.quadraticCurveTo(0, 18, -15, 22);    // Body 
            shape.quadraticCurveTo(-25, 28, -30, 35);  // Shoulder up
            shape.lineTo(-35, 55);                      // Frill edge
            shape.quadraticCurveTo(-45, 60, -55, 55);  // Frill top
            shape.quadraticCurveTo(-60, 48, -55, 40);  // Frill front
            shape.lineTo(-50, 45);                      // Horn 1
            shape.lineTo(-52, 38);
            shape.lineTo(-58, 42);                      // Horn 2  
            shape.lineTo(-56, 35);
            shape.lineTo(-65, 30);                      // Nose horn
            shape.quadraticCurveTo(-68, 25, -65, 20);  // Beak
            shape.quadraticCurveTo(-55, 15, -40, 12);  // Under head
            shape.quadraticCurveTo(-20, 8, 0, 5);      // Chest
            shape.quadraticCurveTo(15, 0, 20, 0);      // Front leg
            shape.quadraticCurveTo(25, 5, 35, 5);      // Under body
            shape.quadraticCurveTo(45, 3, 50, 5);      // Tail return
            break;
        }

        case 'stego': {
            // Stegosaurus - low body, distinctive plates, spiked tail
            shape.moveTo(-40, 8);   // Head
            shape.quadraticCurveTo(-35, 12, -25, 10);  // Neck
            shape.quadraticCurveTo(-15, 12, -5, 15);   // Body rise
            // Plates as triangles
            shape.lineTo(-5, 30);   // Plate 1
            shape.lineTo(0, 15);
            shape.lineTo(8, 35);    // Plate 2 (big)
            shape.lineTo(15, 15);
            shape.lineTo(22, 32);   // Plate 3
            shape.lineTo(28, 15);
            shape.lineTo(35, 28);   // Plate 4
            shape.lineTo(40, 12);
            shape.lineTo(48, 22);   // Plate 5
            shape.lineTo(55, 10);   // Tail base
            // Spikes
            shape.lineTo(70, 18);   // Spike 1
            shape.lineTo(65, 8);
            shape.lineTo(78, 12);   // Spike 2
            shape.lineTo(80, 5);    // Tail tip
            shape.quadraticCurveTo(60, 3, 40, 5);   // Tail under
            shape.quadraticCurveTo(20, 5, 0, 6);    // Belly
            shape.quadraticCurveTo(-20, 5, -35, 6); // Under head
            shape.quadraticCurveTo(-40, 6, -40, 8); // Close
            break;
        }

        case 'brachi': {
            // Brachiosaurus - VERY long neck, small head, 4 legs
            shape.moveTo(-40, 3);   // Tail tip
            shape.quadraticCurveTo(-25, 5, -10, 8);   // Tail
            shape.quadraticCurveTo(5, 12, 15, 18);    // Body
            shape.quadraticCurveTo(20, 25, 22, 40);   // Neck start
            shape.quadraticCurveTo(25, 60, 28, 80);   // Neck mid
            shape.quadraticCurveTo(30, 95, 35, 105);  // Neck high
            shape.quadraticCurveTo(42, 112, 50, 110); // Head top
            shape.quadraticCurveTo(55, 108, 52, 102); // Snout
            shape.quadraticCurveTo(45, 100, 38, 98);  // Chin
            shape.quadraticCurveTo(32, 85, 28, 65);   // Neck back
            shape.quadraticCurveTo(25, 45, 28, 30);   // Upper body
            shape.quadraticCurveTo(35, 22, 45, 15);   // Back
            shape.quadraticCurveTo(50, 8, 55, 3);     // Rear
            shape.quadraticCurveTo(40, 5, 20, 6);     // Under
            shape.quadraticCurveTo(0, 5, -20, 4);     // Belly
            shape.quadraticCurveTo(-35, 3, -40, 3);   // Tail close
            break;
        }

        case 'ptera': {
            // Pterodactyl - wide wings, pointed beak, crest
            shape.moveTo(-70, 5);  // Left wing tip
            shape.quadraticCurveTo(-55, 12, -40, 10); // Wing edge
            shape.quadraticCurveTo(-25, 8, -15, 8);   // Wing to body
            shape.quadraticCurveTo(-12, 12, -15, 18); // Head crest
            shape.quadraticCurveTo(-20, 16, -28, 10); // Beak tip
            shape.quadraticCurveTo(-22, 6, -15, 5);   // Under beak
            shape.quadraticCurveTo(-5, 4, 5, 5);      // Body
            shape.quadraticCurveTo(15, 4, 25, 8);     // Right side
            shape.quadraticCurveTo(40, 10, 55, 12);   // Right wing
            shape.quadraticCurveTo(70, 5, 70, 5);     // Right wing tip
            shape.quadraticCurveTo(55, 8, 40, 6);     // Wing under
            shape.quadraticCurveTo(20, 3, 5, 2);      // Body under
            shape.quadraticCurveTo(-10, 0, -20, 2);   // Feet area
            shape.quadraticCurveTo(-40, 3, -55, 3);   // Left wing under
            shape.quadraticCurveTo(-65, 4, -70, 5);   // Close
            break;
        }
    }

    return shape;
}


/**
 * Add giant prehistoric trees (Sequoia/Redwood style)
 * Tall trees for scale and atmosphere
 */
function addGiantPrehistoricTrees(group: THREE.Group, offset: number, progress: number): void {
    const treeCount = 8 + Math.floor(progress * 4);

    // Tree materials
    const trunkMat = new THREE.MeshStandardMaterial({
        color: 0x4a3020,
        roughness: 0.95,
    });
    const foliageMat = new THREE.MeshStandardMaterial({
        color: 0x2a5a2a,
        roughness: 0.85,
    });

    for (let i = 0; i < treeCount; i++) {
        const seed = 7800 + i * 200;
        const random = seededRandom(seed);
        const side = random() > 0.5 ? 1 : -1;

        const treeGroup = new THREE.Group();

        // Giant trunk
        const height = 35 + random() * 25;
        const radius = 1.5 + random() * 1;
        const trunkGeo = new THREE.CylinderGeometry(radius * 0.7, radius, height, 12);
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = height / 2;
        trunk.castShadow = false; // Disable shadows for environment assets
        trunk.receiveShadow = false;
        treeGroup.add(trunk);

        // Multiple foliage layers (conical shape)
        const layerCount = 4 + Math.floor(random() * 2);
        for (let l = 0; l < layerCount; l++) {
            const layerHeight = height * 0.3 + l * (height * 0.15);
            const layerRadius = (8 - l * 1.5) * (1 + random() * 0.2);

            const coneGeo = new THREE.ConeGeometry(layerRadius, 8 + l * 2, 8);
            const cone = new THREE.Mesh(coneGeo, foliageMat);
            cone.position.y = layerHeight;
            cone.castShadow = false; // Disable shadows for environment assets
            cone.receiveShadow = false;
            treeGroup.add(cone);
        }

        // Position trees at mid-distance
        const distance = 18 + random() * 25;
        treeGroup.position.set(
            side * distance,
            -1.5,
            (random() - 0.5) * 250 + offset
        );

        // Slight random rotation
        treeGroup.rotation.y = random() * Math.PI * 2;

        treeGroup.userData.scrollable = true;
        treeGroup.userData.era = 1;

        group.add(treeGroup);
    }
}

/**
 * Add walking dinosaurs - CINEMA QUALITY ORGANIC ANATOMY
 */
function addWalkingDinosaurs(group: THREE.Group, offset: number, progress: number): void {
    try {
        // Fewer detailed dinos (silhouettes handle distant ones now)
        const dinoCount = 4 + Math.floor(progress * 2);

        for (let i = 0; i < dinoCount; i++) {
            const dinoGroup = new THREE.Group();
            const seed = 6000 + i * 1000;
            const random = seededRandom(seed);

            // Choose dino type
            const typeRoll = random();
            const type = typeRoll > 0.7 ? 'trex' : typeRoll > 0.4 ? 'brachio' : 'trike';

            // Cinema-quality natural colors with subsurface look
            const colorPalette = [
                { base: 0x4a5d3a, detail: 0x2d3a24, belly: 0x7a8a6a }, // Forest Green
                { base: 0x6b5344, detail: 0x3d2f26, belly: 0x9a8373 }, // Earth Brown
                { base: 0x5a5a5a, detail: 0x2a2a2a, belly: 0x8a8a7a }, // Slate Grey
                { base: 0x7a5a3a, detail: 0x4a3020, belly: 0xaa8a6a }, // Tan
                { base: 0x4a4a3a, detail: 0x2a2a1a, belly: 0x7a7a6a }, // Olive Drab
            ];
            const colors = colorPalette[Math.floor(random() * colorPalette.length)];

            // Main skin material - Subsurface Scattering simulation
            const mainMat = new THREE.MeshPhysicalMaterial({
                color: colors.base,
                roughness: 0.85,
                metalness: 0.0,
                clearcoat: 0.1,
                clearcoatRoughness: 0.8,
                sheen: 0.3,
                sheenRoughness: 0.6,
                sheenColor: new THREE.Color(colors.belly),
            });

            // Belly/underside material (lighter)
            const bellyMat = new THREE.MeshPhysicalMaterial({
                color: colors.belly,
                roughness: 0.9,
                metalness: 0.0,
            });

            // Detail material (darker stripes/spots)
            const detailMat = new THREE.MeshPhysicalMaterial({
                color: colors.detail,
                roughness: 0.8,
                metalness: 0.0,
            });

            // Eye material
            const eyeMat = new THREE.MeshStandardMaterial({
                color: 0x222211,
                emissive: 0x111100,
                emissiveIntensity: 0.2,
                roughness: 0.1,
                metalness: 0.3,
            });

            // Claw/tooth material
            const boneMat = new THREE.MeshStandardMaterial({
                color: 0xf5f0e0,
                roughness: 0.4,
                metalness: 0.0,
            });

            if (type === 'trex') {
                const scale = 1.8 + random() * 0.6;
                dinoGroup.scale.setScalar(scale);

                // === TORSO - Organic barrel shape ===
                const torsoGeo = new THREE.SphereGeometry(1, 24, 24);
                torsoGeo.scale(1.3, 1.0, 0.85);
                const torso = new THREE.Mesh(torsoGeo, mainMat);
                torso.position.set(0, 2.6, 0);
                torso.castShadow = true;
                torso.receiveShadow = true;
                dinoGroup.add(torso);

                // Belly underside
                const bellyGeo = new THREE.SphereGeometry(0.7, 16, 16);
                bellyGeo.scale(1.0, 0.5, 0.7);
                const belly = new THREE.Mesh(bellyGeo, bellyMat);
                belly.position.set(0, 1.9, 0.1);
                dinoGroup.add(belly);

                // === TAIL - Smooth connected taper ===
                const tailSegments = 8;
                let prevTailPos = new THREE.Vector3(0, 2.4, -0.8);
                for (let t = 0; t < tailSegments; t++) {
                    const tRatio = t / tailSegments;
                    const radius = 0.5 * (1 - tRatio * 0.85);
                    const segGeo = new THREE.SphereGeometry(radius, 12, 12);
                    segGeo.scale(1.0, 0.9, 1.2);
                    const seg = new THREE.Mesh(segGeo, mainMat);

                    // Smooth curve downward
                    const zOff = -0.55 * (t + 1);
                    const yOff = -0.08 * t - 0.02 * t * t;
                    seg.position.set(0, prevTailPos.y + yOff, prevTailPos.z + zOff);
                    prevTailPos.copy(seg.position);
                    seg.castShadow = true;
                    dinoGroup.add(seg);
                }

                // === NECK - Connected to body ===
                const neckBase = new THREE.Mesh(
                    new THREE.SphereGeometry(0.55, 16, 16),
                    mainMat
                );
                neckBase.scale.set(0.9, 1.0, 0.8);
                neckBase.position.set(0, 3.2, 0.7);
                neckBase.castShadow = true;
                dinoGroup.add(neckBase);

                const neckMid = new THREE.Mesh(
                    new THREE.SphereGeometry(0.45, 16, 16),
                    mainMat
                );
                neckMid.scale.set(0.85, 1.1, 0.8);
                neckMid.position.set(0, 3.7, 1.0);
                neckMid.castShadow = true;
                dinoGroup.add(neckMid);

                // === HEAD - Detailed skull ===
                const headGroup = new THREE.Group();
                headGroup.position.set(0, 4.1, 1.4);
                dinoGroup.add(headGroup);

                // Skull top
                const skullTop = new THREE.Mesh(
                    new THREE.BoxGeometry(0.75, 0.6, 1.0),
                    mainMat
                );
                skullTop.geometry.translate(0, 0.1, 0);
                skullTop.castShadow = true;
                headGroup.add(skullTop);

                // Snout
                const snout = new THREE.Mesh(
                    new THREE.BoxGeometry(0.55, 0.5, 0.9),
                    mainMat
                );
                snout.position.set(0, -0.05, 0.75);
                snout.castShadow = true;
                headGroup.add(snout);

                // Upper jaw ridge
                const jawRidge = new THREE.Mesh(
                    new THREE.BoxGeometry(0.6, 0.15, 0.8),
                    detailMat
                );
                jawRidge.position.set(0, -0.25, 0.6);
                headGroup.add(jawRidge);

                // Lower jaw
                const lowerJaw = new THREE.Mesh(
                    new THREE.BoxGeometry(0.45, 0.25, 0.85),
                    mainMat
                );
                lowerJaw.position.set(0, -0.5, 0.55);
                lowerJaw.castShadow = true;
                headGroup.add(lowerJaw);

                // Teeth
                for (let ti = 0; ti < 6; ti++) {
                    const tooth = new THREE.Mesh(
                        new THREE.ConeGeometry(0.03, 0.15, 6),
                        boneMat
                    );
                    tooth.position.set((ti - 2.5) * 0.12, -0.35, 0.9 + Math.abs(ti - 2.5) * 0.05);
                    tooth.rotation.x = Math.PI;
                    headGroup.add(tooth);
                }

                // Eyes with reflective surface
                const eyeGeo = new THREE.SphereGeometry(0.1, 16, 16);
                const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
                eyeL.position.set(0.3, 0.15, 0.35);
                headGroup.add(eyeL);
                const eyeR = eyeL.clone();
                eyeR.position.x = -0.3;
                headGroup.add(eyeR);

                // Brow ridges
                const browGeo = new THREE.BoxGeometry(0.18, 0.08, 0.2);
                const browL = new THREE.Mesh(browGeo, detailMat);
                browL.position.set(0.32, 0.28, 0.3);
                browL.rotation.z = -0.3;
                headGroup.add(browL);
                const browR = browL.clone();
                browR.position.x = -0.32;
                browR.rotation.z = 0.3;
                headGroup.add(browR);

                // === LEGS - Muscular with joints ===
                // Right leg
                const hipR = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), mainMat);
                hipR.position.set(0.5, 2.0, 0.1);
                hipR.castShadow = true;
                dinoGroup.add(hipR);

                const thighR = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.25, 1.0, 12), mainMat);
                thighR.position.set(0.55, 1.3, 0.1);
                thighR.rotation.z = -0.15;
                thighR.castShadow = true;
                dinoGroup.add(thighR);

                const kneeR = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), mainMat);
                kneeR.position.set(0.6, 0.85, 0.1);
                dinoGroup.add(kneeR);

                const shinR = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.9, 10), mainMat);
                shinR.position.set(0.58, 0.35, 0.15);
                shinR.rotation.x = 0.1;
                shinR.castShadow = true;
                dinoGroup.add(shinR);

                const footR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.5), mainMat);
                footR.position.set(0.55, -0.05, 0.25);
                footR.castShadow = true;
                footR.receiveShadow = true;
                dinoGroup.add(footR);

                // Left leg (mirrored)
                const hipL = hipR.clone();
                hipL.position.x = -0.5;
                dinoGroup.add(hipL);
                const thighL = thighR.clone();
                thighL.position.x = -0.55;
                thighL.rotation.z = 0.15;
                dinoGroup.add(thighL);
                const kneeL = kneeR.clone();
                kneeL.position.x = -0.6;
                dinoGroup.add(kneeL);
                const shinL = shinR.clone();
                shinL.position.x = -0.58;
                dinoGroup.add(shinL);
                const footL = footR.clone();
                footL.position.x = -0.55;
                dinoGroup.add(footL);

                // === TINY ARMS ===
                const armGeo = new THREE.CylinderGeometry(0.08, 0.06, 0.5, 8);
                const armR = new THREE.Mesh(armGeo, mainMat);
                armR.position.set(0.55, 2.7, 0.65);
                armR.rotation.x = -0.7;
                armR.rotation.z = -0.3;
                dinoGroup.add(armR);
                const armL = armR.clone();
                armL.position.x = -0.55;
                armL.rotation.z = 0.3;
                dinoGroup.add(armL);

                // Claws on arms
                const clawGeo = new THREE.ConeGeometry(0.025, 0.12, 6);
                const clawArmR = new THREE.Mesh(clawGeo, boneMat);
                clawArmR.position.set(0.55, 2.45, 0.85);
                clawArmR.rotation.x = -0.5;
                dinoGroup.add(clawArmR);
                const clawArmL = clawArmR.clone();
                clawArmL.position.x = -0.55;
                dinoGroup.add(clawArmL);

            } else if (type === 'brachio') {
                const scale = 2.2 + random() * 0.4;
                dinoGroup.scale.setScalar(scale);

                // === MASSIVE BODY ===
                const bodyGeo = new THREE.SphereGeometry(1.6, 24, 24);
                bodyGeo.scale(1.6, 1.1, 1.0);
                const body = new THREE.Mesh(bodyGeo, mainMat);
                body.position.set(0, 4.0, 0);
                body.castShadow = true;
                body.receiveShadow = true;
                dinoGroup.add(body);

                // Belly
                const bellyGeo = new THREE.SphereGeometry(1.2, 16, 16);
                bellyGeo.scale(1.3, 0.6, 0.9);
                const belly = new THREE.Mesh(bellyGeo, bellyMat);
                belly.position.set(0, 3.0, 0);
                dinoGroup.add(belly);

                // === LONG NECK - Smooth continuous curve ===
                const neckSegments = 12;
                let neckPrevY = 4.5;
                let neckPrevZ = 1.2;
                for (let n = 0; n < neckSegments; n++) {
                    const nRatio = n / neckSegments;
                    const radius = 0.55 - nRatio * 0.25;
                    const neckSeg = new THREE.Mesh(
                        new THREE.SphereGeometry(radius, 14, 14),
                        mainMat
                    );
                    // Graceful upward curve
                    const yStep = 0.7 + nRatio * 0.15;
                    const zStep = 0.35 - nRatio * 0.1;
                    neckPrevY += yStep;
                    neckPrevZ += zStep;
                    neckSeg.position.set(0, neckPrevY, neckPrevZ);
                    neckSeg.castShadow = true;
                    dinoGroup.add(neckSeg);
                }

                // === HEAD - Small and gentle ===
                const headGeo = new THREE.SphereGeometry(0.4, 16, 16);
                headGeo.scale(0.8, 0.9, 1.2);
                const head = new THREE.Mesh(headGeo, mainMat);
                head.position.set(0, neckPrevY + 0.5, neckPrevZ + 0.3);
                head.castShadow = true;
                dinoGroup.add(head);

                // Snout
                const snout = new THREE.Mesh(
                    new THREE.SphereGeometry(0.25, 12, 12),
                    mainMat
                );
                snout.scale.set(0.7, 0.6, 1.0);
                snout.position.set(0, neckPrevY + 0.35, neckPrevZ + 0.7);
                dinoGroup.add(snout);

                // Eyes
                const eyeGeo = new THREE.SphereGeometry(0.08, 12, 12);
                const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
                eyeL.position.set(0.2, neckPrevY + 0.6, neckPrevZ + 0.35);
                dinoGroup.add(eyeL);
                const eyeR = eyeL.clone();
                eyeR.position.x = -0.2;
                dinoGroup.add(eyeR);

                // Nostrils (raised bump on snout)
                const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), mainMat);
                nostril.position.set(0, neckPrevY + 0.55, neckPrevZ + 0.7);
                dinoGroup.add(nostril);

                // === TAIL - Thick and tapered ===
                const tailSegments = 10;
                let tailPrevY = 3.8;
                let tailPrevZ = -1.4;
                for (let t = 0; t < tailSegments; t++) {
                    const tRatio = t / tailSegments;
                    const radius = 0.6 * (1 - tRatio * 0.8);
                    const tailSeg = new THREE.Mesh(
                        new THREE.SphereGeometry(radius, 12, 12),
                        mainMat
                    );
                    tailPrevY -= 0.1 + tRatio * 0.05;
                    tailPrevZ -= 0.65;
                    tailSeg.position.set(0, tailPrevY, tailPrevZ);
                    tailSeg.castShadow = true;
                    dinoGroup.add(tailSeg);
                }

                // === PILLAR LEGS ===
                const legPositions = [
                    { x: 1.0, z: 0.8 },
                    { x: -1.0, z: 0.8 },
                    { x: 1.0, z: -0.8 },
                    { x: -1.0, z: -0.8 },
                ];

                for (const lp of legPositions) {
                    // Thigh
                    const thigh = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.5, 0.45, 2.0, 14),
                        mainMat
                    );
                    thigh.position.set(lp.x, 2.5, lp.z);
                    thigh.castShadow = true;
                    dinoGroup.add(thigh);

                    // Shin
                    const shin = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.4, 0.5, 1.8, 12),
                        mainMat
                    );
                    shin.position.set(lp.x, 0.9, lp.z);
                    shin.castShadow = true;
                    dinoGroup.add(shin);

                    // Foot
                    const foot = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.55, 0.65, 0.3, 12),
                        mainMat
                    );
                    foot.position.set(lp.x, 0.05, lp.z);
                    foot.castShadow = true;
                    foot.receiveShadow = true;
                    dinoGroup.add(foot);
                }

            } else {
                // === TRICERATOPS ===
                const scale = 1.4 + random() * 0.3;
                dinoGroup.scale.setScalar(scale);

                // === BODY ===
                const bodyGeo = new THREE.SphereGeometry(1.3, 24, 24);
                bodyGeo.scale(1.5, 1.0, 1.0);
                const body = new THREE.Mesh(bodyGeo, mainMat);
                body.position.set(0, 1.7, 0);
                body.castShadow = true;
                body.receiveShadow = true;
                dinoGroup.add(body);

                // Belly
                const bellyGeo = new THREE.SphereGeometry(0.9, 14, 14);
                bellyGeo.scale(1.2, 0.5, 0.9);
                const belly = new THREE.Mesh(bellyGeo, bellyMat);
                belly.position.set(0, 1.0, 0);
                dinoGroup.add(belly);

                // === NECK CONNECTION ===
                const neckBase = new THREE.Mesh(
                    new THREE.SphereGeometry(0.7, 14, 14),
                    mainMat
                );
                neckBase.position.set(0, 2.0, 1.3);
                neckBase.castShadow = true;
                dinoGroup.add(neckBase);

                // === HEAD WITH FRILL ===
                const headGroup = new THREE.Group();
                headGroup.position.set(0, 2.2, 1.9);
                dinoGroup.add(headGroup);

                // Skull
                const skull = new THREE.Mesh(
                    new THREE.SphereGeometry(0.75, 18, 18),
                    mainMat
                );
                skull.scale.set(0.9, 0.85, 1.1);
                skull.castShadow = true;
                headGroup.add(skull);

                // Beak
                const beak = new THREE.Mesh(
                    new THREE.ConeGeometry(0.35, 0.6, 12),
                    boneMat
                );
                beak.position.set(0, -0.1, 0.8);
                beak.rotation.x = Math.PI / 2;
                headGroup.add(beak);

                // Frill (Shield)
                const frillGeo = new THREE.CylinderGeometry(1.1, 1.3, 0.12, 24);
                const frill = new THREE.Mesh(frillGeo, mainMat);
                frill.rotation.x = Math.PI / 2 - 0.5;
                frill.position.set(0, 0.4, -0.5);
                frill.castShadow = true;
                headGroup.add(frill);

                // Frill edge bumps
                for (let fi = 0; fi < 8; fi++) {
                    const angle = (fi / 8) * Math.PI + Math.PI / 2;
                    const bump = new THREE.Mesh(
                        new THREE.SphereGeometry(0.12, 8, 8),
                        detailMat
                    );
                    bump.position.set(
                        Math.sin(angle) * 1.2,
                        0.4 + Math.cos(angle) * 0.3,
                        -0.5 - Math.abs(Math.cos(angle)) * 0.2
                    );
                    headGroup.add(bump);
                }

                // Main horns
                const hornGeo = new THREE.ConeGeometry(0.12, 1.2, 10);
                const hornL = new THREE.Mesh(hornGeo, boneMat);
                hornL.position.set(0.45, 0.5, 0.3);
                hornL.rotation.x = -0.6;
                hornL.rotation.z = -0.15;
                hornL.castShadow = true;
                headGroup.add(hornL);

                const hornR = hornL.clone();
                hornR.position.x = -0.45;
                hornR.rotation.z = 0.15;
                headGroup.add(hornR);

                // Nose horn
                const noseHorn = new THREE.Mesh(
                    new THREE.ConeGeometry(0.08, 0.35, 8),
                    boneMat
                );
                noseHorn.position.set(0, 0.1, 0.6);
                noseHorn.rotation.x = -0.3;
                headGroup.add(noseHorn);

                // Eyes
                const eyeGeo = new THREE.SphereGeometry(0.09, 12, 12);
                const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
                eyeL.position.set(0.4, 0.1, 0.35);
                headGroup.add(eyeL);
                const eyeR = eyeL.clone();
                eyeR.position.x = -0.4;
                headGroup.add(eyeR);

                // === TAIL ===
                const tailSegs = 6;
                let tY = 1.5, tZ = -1.3;
                for (let t = 0; t < tailSegs; t++) {
                    const tRatio = t / tailSegs;
                    const seg = new THREE.Mesh(
                        new THREE.SphereGeometry(0.4 * (1 - tRatio * 0.7), 10, 10),
                        mainMat
                    );
                    tY -= 0.08;
                    tZ -= 0.5;
                    seg.position.set(0, tY, tZ);
                    seg.castShadow = true;
                    dinoGroup.add(seg);
                }

                // === LEGS ===
                const legPos = [
                    { x: 0.8, z: 0.5, front: true },
                    { x: -0.8, z: 0.5, front: true },
                    { x: 0.9, z: -0.7, front: false },
                    { x: -0.9, z: -0.7, front: false },
                ];

                for (const lp of legPos) {
                    const legLen = lp.front ? 1.1 : 1.3;
                    const legRad = lp.front ? 0.25 : 0.35;

                    const leg = new THREE.Mesh(
                        new THREE.CylinderGeometry(legRad, legRad * 0.85, legLen, 12),
                        mainMat
                    );
                    leg.position.set(lp.x, legLen / 2 + 0.1, lp.z);
                    leg.castShadow = true;
                    dinoGroup.add(leg);

                    const foot = new THREE.Mesh(
                        new THREE.CylinderGeometry(legRad * 1.1, legRad * 1.3, 0.15, 10),
                        mainMat
                    );
                    foot.position.set(lp.x, 0.08, lp.z);
                    foot.receiveShadow = true;
                    dinoGroup.add(foot);
                }
            }

            // === POSITIONING ===
            const side = random() > 0.5 ? 1 : -1;
            const distFromCenter = 18 + random() * 55;
            dinoGroup.position.set(
                side * distFromCenter,
                -0.5,
                (random() - 0.5) * 260 + offset
            );

            // Face toward the path
            dinoGroup.rotation.y = side > 0 ? -Math.PI / 2 + (random() - 0.5) * 0.4 : Math.PI / 2 + (random() - 0.5) * 0.4;
            dinoGroup.userData.scrollable = true;
            dinoGroup.userData.era = 1;

            group.add(dinoGroup);
        }
    } catch (e) {
        console.error("Error generating dinosaurs:", e);
    }
}

/**
 * Add close-by vegetation (ferns, rocks, bushes right next to the platform)
 */
function addClosebyVegetation(group: THREE.Group, offset: number, progress: number): void {
    const plantCount = 30;

    for (let i = 0; i < plantCount; i++) {
        const seed = 8000 + i * 500;
        const random = seededRandom(seed);
        const type = random();

        let plant: THREE.Group | THREE.Mesh;

        if (type < 0.4) {
            // Small fern
            plant = new THREE.Group();
            const fernColor = 0x2d5a2d;
            const frondCount = 5 + Math.floor(random() * 3);
            for (let f = 0; f < frondCount; f++) {
                const angle = (f / frondCount) * Math.PI * 2;
                const frondGeo = new THREE.PlaneGeometry(0.3, 0.8);
                const frondMat = new THREE.MeshStandardMaterial({
                    color: fernColor,
                    roughness: 0.8,
                    side: THREE.DoubleSide
                });
                const frond = new THREE.Mesh(frondGeo, frondMat);
                frond.position.set(Math.cos(angle) * 0.15, 0.4, Math.sin(angle) * 0.15);
                frond.rotation.x = -0.6;
                frond.rotation.y = angle;
                (plant as THREE.Group).add(frond);
            }
        } else if (type < 0.7) {
            // Small rock
            const rockGeo = new THREE.DodecahedronGeometry(0.2 + random() * 0.3, 0);
            const rockMat = new THREE.MeshStandardMaterial({
                color: 0x5a4a3a,
                roughness: 0.95,
                flatShading: true
            });
            plant = new THREE.Mesh(rockGeo, rockMat);
            plant.scale.y = 0.6;
        } else {
            // Flowering bush
            plant = new THREE.Group();
            const bushGeo = new THREE.SphereGeometry(0.3, 8, 8);
            const bushMat = new THREE.MeshStandardMaterial({ color: 0x2a5a2a, roughness: 0.9 });
            const bush = new THREE.Mesh(bushGeo, bushMat);
            bush.scale.y = 0.7;
            (plant as THREE.Group).add(bush);

            // Add small flowers
            const flowerCount = 3 + Math.floor(random() * 4);
            const colors = [0xff6090, 0xffaa50, 0xffff60, 0xff4080];
            for (let fl = 0; fl < flowerCount; fl++) {
                const flGeo = new THREE.SphereGeometry(0.05, 6, 6);
                const flMat = new THREE.MeshStandardMaterial({
                    color: colors[fl % colors.length],
                    emissive: colors[fl % colors.length],
                    emissiveIntensity: 0.2
                });
                const flower = new THREE.Mesh(flGeo, flMat);
                flower.position.set(
                    (random() - 0.5) * 0.4,
                    0.2 + random() * 0.2,
                    (random() - 0.5) * 0.4
                );
                (plant as THREE.Group).add(flower);
            }
        }

        // Position close to the board (within 3-8 units)
        const side = random() > 0.5 ? 1 : -1;
        const distFromCenter = 5 + random() * 4;
        plant.position.set(
            side * distFromCenter,
            -1.2, // Align with ground
            (random() - 0.5) * 200 + offset
        );

        plant.userData.scrollable = true;
        plant.userData.era = 1;

        group.add(plant);
    }
}

/**
 * Add distant horizon mountains/volcanoes
 */
function addHorizonMountains(group: THREE.Group, offset: number): void {
    // Create a horizon line of mountains on both sides
    const mountainCount = 12;

    for (let i = 0; i < mountainCount; i++) {
        for (const side of [-1, 1]) {
            const seed = 9000 + i * 100 + (side > 0 ? 50 : 0);
            const random = seededRandom(seed);

            // Mountain/volcano
            const height = 15 + random() * 25;
            const width = 8 + random() * 12;
            const isVolcano = random() > 0.7;

            // FIXED: Use 24 sides instead of 6 to avoid pyramid look
            const mountainGeo = new THREE.ConeGeometry(width, height, 24);

            // Add vertex displacement for organic mountain shape
            const positions = mountainGeo.attributes.position.array as Float32Array;
            for (let v = 0; v < positions.length; v += 3) {
                // Don't displace the peak (top vertex) or base
                const y = positions[v + 1];
                if (y > -height * 0.4 && y < height * 0.4) {
                    const displaceAmount = width * 0.08;
                    positions[v] += (seededRandom(seed + v)() - 0.5) * displaceAmount;
                    positions[v + 2] += (seededRandom(seed + v + 1)() - 0.5) * displaceAmount;
                }
            }
            mountainGeo.attributes.position.needsUpdate = true;
            mountainGeo.computeVertexNormals();

            const mountainMat = new THREE.MeshStandardMaterial({
                color: isVolcano ? 0x3a2820 : 0x4a5a4a,
                roughness: 0.95,
                flatShading: true
            });
            const mountain = new THREE.Mesh(mountainGeo, mountainMat);

            mountain.position.set(
                side * (60 + random() * 40),
                height / 2 - 1,
                -100 + i * 30 + random() * 20
            );

            // Slight random rotation for variety
            mountain.rotation.y = random() * 0.3;

            if (isVolcano) {
                // Add glowing crater
                const craterGeo = new THREE.CylinderGeometry(width * 0.15, width * 0.2, 1, 8);
                const craterMat = new THREE.MeshStandardMaterial({
                    color: 0xff3300,
                    emissive: 0xff2200,
                    emissiveIntensity: 1.5
                });
                const crater = new THREE.Mesh(craterGeo, craterMat);
                crater.position.y = height - 0.5;
                mountain.add(crater);

                // Smoke plume (simple sphere)
                const smokeGeo = new THREE.SphereGeometry(3, 8, 8);
                const smokeMat = new THREE.MeshStandardMaterial({
                    color: 0x555555,
                    transparent: true,
                    opacity: 0.4
                });
                const smoke = new THREE.Mesh(smokeGeo, smokeMat);
                smoke.position.y = height + 3;
                smoke.scale.set(1, 2, 1);
                mountain.add(smoke);
            }

            // Mountains don't scroll (they're at infinity essentially)
            mountain.userData.isHorizon = true;
            mountain.userData.era = 1;

            group.add(mountain);
        }
    }

    // Add a hazy horizon plane
    const horizonGeo = new THREE.PlaneGeometry(400, 60);
    const horizonMat = new THREE.MeshBasicMaterial({
        color: 0x708090,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    });
    const horizonPlane = new THREE.Mesh(horizonGeo, horizonMat);
    horizonPlane.position.set(0, 20, -120);
    horizonPlane.userData.isHorizon = true;
    group.add(horizonPlane);
}

/**
 * Add occasional storm lightning in the distant background
 */
function addStormLightning(group: THREE.Group, offset: number): void {
    // Create lightning bolts that will flash occasionally
    const lightningCount = 4;

    for (let i = 0; i < lightningCount; i++) {
        const seed = 7500 + i * 200;
        const random = seededRandom(seed);

        const lightningGroup = new THREE.Group();

        // Create jagged lightning bolt shape
        const points: THREE.Vector3[] = [];
        let y = 40 + random() * 20;
        let x = 0;
        const segmentCount = 6 + Math.floor(random() * 4);

        for (let s = 0; s <= segmentCount; s++) {
            points.push(new THREE.Vector3(x, y, 0));
            y -= (4 + random() * 3);
            x += (random() - 0.5) * 6;
        }

        // Main bolt
        const curve = new THREE.CatmullRomCurve3(points);
        const boltGeo = new THREE.TubeGeometry(curve, 20, 0.3, 6, false);
        const boltMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0
        });
        const bolt = new THREE.Mesh(boltGeo, boltMat);
        lightningGroup.add(bolt);

        // Glow around lightning
        const glowGeo = new THREE.TubeGeometry(curve, 20, 1.5, 6, false);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0x8080ff,
            transparent: true,
            opacity: 0
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        lightningGroup.add(glow);

        // Branch bolts
        for (let b = 0; b < 2; b++) {
            const branchStart = Math.floor(random() * (points.length - 2)) + 1;
            const branchPoints: THREE.Vector3[] = [];
            let by = points[branchStart].y;
            let bx = points[branchStart].x;
            const branchSegs = 3;
            for (let bs = 0; bs <= branchSegs; bs++) {
                branchPoints.push(new THREE.Vector3(bx, by, 0));
                by -= (2 + random() * 2);
                bx += (random() - 0.5) * 4 + (b === 0 ? 1 : -1) * 2;
            }
            const branchCurve = new THREE.CatmullRomCurve3(branchPoints);
            const branchGeo = new THREE.TubeGeometry(branchCurve, 12, 0.15, 4, false);
            const branch = new THREE.Mesh(branchGeo, boltMat.clone());
            lightningGroup.add(branch);
        }

        // Point light for flash effect
        const flashLight = new THREE.PointLight(0x8080ff, 0, 100);
        flashLight.position.set(0, 30, 0);
        lightningGroup.add(flashLight);

        // Position in distant background
        const side = random() > 0.5 ? 1 : -1;
        lightningGroup.position.set(
            side * (50 + random() * 40),
            0,
            -80 + random() * 40 + offset
        );

        lightningGroup.userData.isLightning = true;
        lightningGroup.userData.flashTimer = random() * 10; // Random start time
        lightningGroup.userData.flashInterval = 5 + random() * 15; // Flash every 5-20 seconds
        lightningGroup.userData.isHorizon = true; // Don't scroll
        lightningGroup.userData.era = 1;

        group.add(lightningGroup);
    }

    // Add storm clouds in background
    for (let c = 0; c < 6; c++) {
        const seed = 7800 + c * 100;
        const random = seededRandom(seed);

        const cloudGroup = new THREE.Group();
        const cloudCount = 3 + Math.floor(random() * 3);

        for (let cc = 0; cc < cloudCount; cc++) {
            const cloudGeo = new THREE.SphereGeometry(5 + random() * 8, 8, 8);
            const cloudMat = new THREE.MeshStandardMaterial({
                color: 0x3a3a4a,
                roughness: 1,
                transparent: true,
                opacity: 0.7
            });
            const cloud = new THREE.Mesh(cloudGeo, cloudMat);
            cloud.position.set(
                (random() - 0.5) * 15,
                (random() - 0.5) * 5,
                (random() - 0.5) * 10
            );
            cloud.scale.set(1.5, 0.6, 1);
            cloudGroup.add(cloud);
        }

        const side = random() > 0.5 ? 1 : -1;
        cloudGroup.position.set(
            side * (40 + random() * 50),
            35 + random() * 15,
            -60 + random() * 80
        );

        cloudGroup.userData.isHorizon = true;
        cloudGroup.userData.isStormCloud = true;
        cloudGroup.userData.era = 1;

        group.add(cloudGroup);
    }
}

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

function addLavaPools(group: THREE.Group, offset: number, progress: number): void {
    const poolCount = 3 + Math.floor(progress * 2);

    for (let i = 0; i < poolCount; i++) {
        const poolGeo = new THREE.CircleGeometry(1 + Math.random() * 2, 16);
        const poolMat = new THREE.MeshStandardMaterial({
            color: 0xff4400,
            emissive: 0xff2200,
            emissiveIntensity: 2 + Math.sin(i) * 0.5,
        });
        const pool = new THREE.Mesh(poolGeo, poolMat);
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(
            (Math.random() - 0.5) * 60,
            -1.18, // Slightly above ground
            (Math.random() - 0.5) * 150 + offset
        );
        pool.userData.scrollable = true;
        pool.userData.isLava = true;
        group.add(pool);
    }
}

function addIceCrystals(group: THREE.Group, offset: number, progress: number): void {
    const crystalCount = 5 + Math.floor(progress * 5);

    for (let i = 0; i < crystalCount; i++) {
        const crystalGeo = new THREE.OctahedronGeometry(0.5 + Math.random() * 1, 0);
        const crystalMat = new THREE.MeshStandardMaterial({
            color: 0xc0e0ff,
            roughness: 0.1,
            metalness: 0.2,
            transparent: true,
            opacity: 0.7,
        });
        const crystal = new THREE.Mesh(crystalGeo, crystalMat);
        crystal.position.set(
            (Math.random() - 0.5) * 80,
            0.5 + Math.random() * 2,
            (Math.random() - 0.5) * 150 + offset
        );
        crystal.rotation.set(Math.random(), Math.random(), Math.random());
        crystal.userData.scrollable = true;
        group.add(crystal);
    }
}

// =============================================================================
// ICE AGE SPECIFIC ELEMENTS - Pixar Ice Age meets Monet
// 35 MPH through frozen tundra with glaciers, rushing water, and chase scenes
// =============================================================================

/**
 * Add Monet-style low winter sun - icy white, subtle glow
 */
function addIceAgeSun(group: THREE.Group, offset: number): void {
    const sunGroup = new THREE.Group();

    // Soft winter sun - icy white, not warm
    const sunGeo = new THREE.SphereGeometry(10, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({
        color: 0xf8f8ff,  // Cool white
        transparent: false,
    });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    sunGroup.add(sun);

    // Subtle icy corona
    const coronaGeo = new THREE.SphereGeometry(16, 32, 32);
    const coronaMat = new THREE.MeshBasicMaterial({
        color: 0xd0e0f0,  // Icy blue-white
        transparent: true,
        opacity: 0.2,
        side: THREE.BackSide,
    });
    sunGroup.add(new THREE.Mesh(coronaGeo, coronaMat));

    // Very subtle outer haze
    const hazeGeo = new THREE.SphereGeometry(25, 32, 32);
    const hazeMat = new THREE.MeshBasicMaterial({
        color: 0xc8d8e8,
        transparent: true,
        opacity: 0.08,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
    });
    sunGroup.add(new THREE.Mesh(hazeGeo, hazeMat));

    // Position higher in sky (less prominent)
    sunGroup.position.set(60, 40, -150 + offset);
    sunGroup.userData.scrollable = false;
    group.add(sunGroup);
}

/**
 * Add rolling snowy hills to the sides - Monet soft shapes
 */
function addIceAgeHills(group: THREE.Group, offset: number): void {
    const hillCount = 16;

    for (let i = 0; i < hillCount; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const hillWidth = 18 + Math.random() * 30;
        const hillHeight = 4 + Math.random() * 10;

        // Create hill as half-sphere - soft Monet shapes
        const hillGeo = new THREE.SphereGeometry(hillWidth, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);

        // Monet snow colors - soft whites with blue/pink hints
        const colors = [0xe8f0f8, 0xf0e8f0, 0xe0e8f0, 0xf0f0e8];
        const hillMat = new THREE.MeshStandardMaterial({
            color: colors[i % colors.length],
            roughness: 0.95,
            metalness: 0.0,
        });
        const hill = new THREE.Mesh(hillGeo, hillMat);

        hill.scale.y = hillHeight / hillWidth;
        hill.position.set(
            side * (18 + Math.random() * 35),
            -0.5,
            (i / hillCount) * 350 - 175 + offset
        );
        hill.rotation.x = -Math.PI / 2;

        hill.userData.scrollable = true;
        group.add(hill);
    }
}

/**
 * Add MASSIVE glacial walls - towering ice cliffs on both sides
 * Inspired by Ice Age canyon scenes
 */
function addGlacialWalls(group: THREE.Group, offset: number): void {
    // Create dramatic ice materials
    const iceMat = new THREE.MeshStandardMaterial({
        color: 0xa8d0e8,
        roughness: 0.4,
        metalness: 0.15,
        transparent: true,
        opacity: 0.9,
    });

    const deepIceMat = new THREE.MeshStandardMaterial({
        color: 0x70a0c8,
        roughness: 0.3,
        metalness: 0.2,
        transparent: true,
        opacity: 0.85,
    });

    // Left glacial wall - towering and jagged
    for (let i = 0; i < 8; i++) {
        const height = 50 + Math.random() * 40;
        const width = 40 + Math.random() * 30;
        const wallGeo = new THREE.BoxGeometry(width, height, 60);
        const wall = new THREE.Mesh(wallGeo, i % 2 === 0 ? iceMat : deepIceMat);
        wall.position.set(
            -55 - Math.random() * 30,
            height / 2 - 5,
            i * 50 - 200 + offset
        );
        wall.rotation.y = (Math.random() - 0.5) * 0.3;
        wall.userData.scrollable = true;
        group.add(wall);
    }

    // Right glacial wall
    for (let i = 0; i < 8; i++) {
        const height = 50 + Math.random() * 40;
        const width = 40 + Math.random() * 30;
        const wallGeo = new THREE.BoxGeometry(width, height, 60);
        const wall = new THREE.Mesh(wallGeo, i % 2 === 0 ? deepIceMat : iceMat);
        wall.position.set(
            55 + Math.random() * 30,
            height / 2 - 5,
            i * 50 - 200 + offset
        );
        wall.rotation.y = (Math.random() - 0.5) * 0.3;
        wall.userData.scrollable = true;
        group.add(wall);
    }

    // Far back massive glacier (horizon)
    const backWallGeo = new THREE.BoxGeometry(400, 80, 30);
    const backWallMat = new THREE.MeshStandardMaterial({
        color: 0x90b8d0,
        roughness: 0.5,
        metalness: 0.1,
        transparent: true,
        opacity: 0.5,
    });
    const backWall = new THREE.Mesh(backWallGeo, backWallMat);
    backWall.position.set(0, 35, -250 + offset);
    backWall.userData.scrollable = false;
    group.add(backWall);

    // Add icicles hanging from walls
    addIcicles(group, offset);
}

/**
 * Add icicles hanging from glacial walls
 */
function addIcicles(group: THREE.Group, offset: number): void {
    const icicleCount = 40;
    const icicleMat = new THREE.MeshStandardMaterial({
        color: 0xc8e8ff,
        roughness: 0.2,
        metalness: 0.3,
        transparent: true,
        opacity: 0.8,
    });

    for (let i = 0; i < icicleCount; i++) {
        const length = 2 + Math.random() * 8;
        const icicleGeo = new THREE.ConeGeometry(0.2 + Math.random() * 0.3, length, 6);
        const icicle = new THREE.Mesh(icicleGeo, icicleMat);

        const side = i % 2 === 0 ? -1 : 1;
        icicle.position.set(
            side * (35 + Math.random() * 25),
            35 + Math.random() * 20,
            (Math.random() - 0.5) * 350 + offset
        );
        icicle.rotation.z = Math.PI; // Point downward
        icicle.userData.scrollable = true;
        group.add(icicle);
    }
}

/**
 * Add rushing meltwater passing underneath - dramatic water effects
 */
function addRushingMeltwater(group: THREE.Group, offset: number): void {
    // Create animated water plane that appears to rush underneath
    const waterWidth = 80;
    const waterLength = 500;
    const waterGeo = new THREE.PlaneGeometry(waterWidth, waterLength, 64, 64);

    // Monet water colors - deep blue-green
    const waterMat = new THREE.MeshStandardMaterial({
        color: 0x2a5070,
        roughness: 0.1,
        metalness: 0.3,
        transparent: true,
        opacity: 0.85,
    });

    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -3, offset);
    water.userData.scrollable = false;
    water.userData.isRushingWater = true;
    group.add(water);

    // Add foam/splash effects at edges
    addWaterFoam(group, offset);

    // Add water spray particles
    addWaterSpray(group, offset);
}

/**
 * Add foam at the water edges
 */
function addWaterFoam(group: THREE.Group, offset: number): void {
    const foamCount = 30;
    const foamMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
    });

    for (let i = 0; i < foamCount; i++) {
        const size = 2 + Math.random() * 4;
        const foamGeo = new THREE.CircleGeometry(size, 12);
        const foam = new THREE.Mesh(foamGeo, foamMat);
        foam.rotation.x = -Math.PI / 2;

        const side = i % 2 === 0 ? -1 : 1;
        foam.position.set(
            side * (25 + Math.random() * 10),
            -2.8,
            (Math.random() - 0.5) * 350 + offset
        );
        foam.userData.scrollable = true;
        foam.userData.isFoam = true;
        group.add(foam);
    }
}

/**
 * Add water spray mist
 */
function addWaterSpray(group: THREE.Group, offset: number): void {
    const sprayCount = 200;
    const positions = new Float32Array(sprayCount * 3);

    for (let i = 0; i < sprayCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 60;
        positions[i * 3 + 1] = -2 + Math.random() * 3;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 300 + offset;
    }

    const sprayGeo = new THREE.BufferGeometry();
    sprayGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const sprayMat = new THREE.PointsMaterial({
        color: 0xc8e0f0,
        size: 0.3,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
    });

    const spray = new THREE.Points(sprayGeo, sprayMat);
    spray.userData.scrollable = true;
    spray.userData.isWaterSpray = true;
    group.add(spray);
}

/**
 * MAMMOTH AND CAVEMAN CHASE - Shadows fleeing across the tundra!
 * Inspired by Ice Age movie - mammoths running from primitive hunters
 */
function addMammothCavemanChase(group: THREE.Group, offset: number): void {
    // Create multiple chase groups on different sides
    for (let chase = 0; chase < 3; chase++) {
        const side = chase === 1 ? 1 : -1;
        const distance = 40 + chase * 20;
        const baseZ = chase * 120 - 150 + offset;

        // Add 2-3 mammoth shadows (running)
        for (let m = 0; m < 2 + Math.floor(Math.random() * 2); m++) {
            const mammoth = createMammothShadow();
            mammoth.position.set(
                side * distance + (Math.random() - 0.5) * 15,
                0.5,
                baseZ + m * 15
            );
            mammoth.userData.scrollable = true;
            mammoth.userData.isMammothShadow = true;
            mammoth.userData.runPhase = Math.random() * Math.PI * 2;
            group.add(mammoth);
        }

        // Add 3-4 cavemen shadows with staffs (chasing)
        for (let c = 0; c < 3 + Math.floor(Math.random() * 2); c++) {
            const caveman = createCavemanShadow();
            caveman.position.set(
                side * (distance - 10) + (Math.random() - 0.5) * 12,
                0.5,
                baseZ - 20 + c * 8
            );
            caveman.userData.scrollable = true;
            caveman.userData.isCavemanShadow = true;
            caveman.userData.runPhase = Math.random() * Math.PI * 2;
            group.add(caveman);
        }
    }
}

/**
 * Create a running mammoth silhouette/shadow
 */
function createMammothShadow(): THREE.Group {
    const mammothGroup = new THREE.Group();

    // Shadow material - dark semi-transparent
    const shadowMat = new THREE.MeshBasicMaterial({
        color: 0x1a2530,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
    });

    // Body (large ellipse)
    const bodyGeo = new THREE.SphereGeometry(4, 16, 12);
    const body = new THREE.Mesh(bodyGeo, shadowMat);
    body.scale.set(1.8, 1.0, 1.2);
    body.position.set(0, 3, 0);
    mammothGroup.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(2, 12, 10);
    const head = new THREE.Mesh(headGeo, shadowMat);
    head.position.set(5, 3.5, 0);
    mammothGroup.add(head);

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.4, 0.6, 4, 8);
    const trunk = new THREE.Mesh(trunkGeo, shadowMat);
    trunk.position.set(7, 1.5, 0);
    trunk.rotation.z = Math.PI / 3;
    mammothGroup.add(trunk);

    // Tusks
    const tuskGeo = new THREE.CylinderGeometry(0.15, 0.25, 3, 6);
    const tuskL = new THREE.Mesh(tuskGeo, shadowMat);
    tuskL.position.set(6.5, 2, 1);
    tuskL.rotation.z = Math.PI / 4;
    mammothGroup.add(tuskL);

    const tuskR = new THREE.Mesh(tuskGeo, shadowMat);
    tuskR.position.set(6.5, 2, -1);
    tuskR.rotation.z = Math.PI / 4;
    mammothGroup.add(tuskR);

    // Hump on back
    const humpGeo = new THREE.SphereGeometry(2.5, 10, 8);
    const hump = new THREE.Mesh(humpGeo, shadowMat);
    hump.position.set(-1, 5, 0);
    hump.scale.set(1, 0.8, 0.8);
    mammothGroup.add(hump);

    // Legs (4)
    const legGeo = new THREE.CylinderGeometry(0.5, 0.4, 3, 6);
    const legPositions = [
        [-2.5, 0.5, 1.5], [-2.5, 0.5, -1.5],
        [2, 0.5, 1.5], [2, 0.5, -1.5]
    ];
    legPositions.forEach(pos => {
        const leg = new THREE.Mesh(legGeo, shadowMat);
        leg.position.set(pos[0], pos[1], pos[2]);
        mammothGroup.add(leg);
    });

    mammothGroup.scale.setScalar(1.5);
    return mammothGroup;
}

/**
 * Create a running caveman silhouette with staff
 */
function createCavemanShadow(): THREE.Group {
    const cavemanGroup = new THREE.Group();

    const shadowMat = new THREE.MeshBasicMaterial({
        color: 0x1a2530,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
    });

    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.4, 0.5, 1.5, 8);
    const body = new THREE.Mesh(bodyGeo, shadowMat);
    body.position.set(0, 1.5, 0);
    cavemanGroup.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.4, 10, 8);
    const head = new THREE.Mesh(headGeo, shadowMat);
    head.position.set(0, 2.6, 0);
    cavemanGroup.add(head);

    // Arms (one holding staff raised)
    const armGeo = new THREE.CylinderGeometry(0.12, 0.12, 1, 6);
    const armL = new THREE.Mesh(armGeo, shadowMat);
    armL.position.set(-0.5, 2, 0);
    armL.rotation.z = -Math.PI / 4;
    cavemanGroup.add(armL);

    const armR = new THREE.Mesh(armGeo, shadowMat);
    armR.position.set(0.5, 2.3, 0);
    armR.rotation.z = Math.PI / 3; // Raised arm with staff
    cavemanGroup.add(armR);

    // Staff/Spear
    const staffGeo = new THREE.CylinderGeometry(0.05, 0.05, 3, 6);
    const staff = new THREE.Mesh(staffGeo, shadowMat);
    staff.position.set(1.2, 3.2, 0);
    staff.rotation.z = Math.PI / 3;
    cavemanGroup.add(staff);

    // Spear tip
    const tipGeo = new THREE.ConeGeometry(0.12, 0.4, 6);
    const tip = new THREE.Mesh(tipGeo, shadowMat);
    tip.position.set(2.2, 4.5, 0);
    tip.rotation.z = Math.PI / 3 + Math.PI / 2;
    cavemanGroup.add(tip);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.15, 0.12, 1.2, 6);
    const legL = new THREE.Mesh(legGeo, shadowMat);
    legL.position.set(-0.2, 0.4, 0);
    legL.rotation.z = 0.2;
    cavemanGroup.add(legL);

    const legR = new THREE.Mesh(legGeo, shadowMat);
    legR.position.set(0.2, 0.4, 0);
    legR.rotation.z = -0.2;
    cavemanGroup.add(legR);

    cavemanGroup.scale.setScalar(1.2);
    return cavemanGroup;
}

/**
 * Add procedurally varied snow-covered pine trees - every tree looks unique
 */
function addMonetSnowPines(group: THREE.Group, offset: number): void {
    const treeCount = 28;

    for (let i = 0; i < treeCount; i++) {
        const seed = 20000 + i * 137;  // Unique seed per tree
        const tree = createMonetSnowPine(seed);
        const random = seededRandom(seed);

        const side = random() > 0.5 ? 1 : -1;
        const distance = 10 + random() * 40;

        tree.position.set(
            side * distance,
            -0.5 + random() * 0.5,  // Slight ground variation
            (random() - 0.5) * 380 + offset
        );

        // More scale variation
        const baseScale = 0.6 + random() * 0.8;
        tree.scale.set(
            baseScale * (0.9 + random() * 0.2),  // Slight width variation
            baseScale * (0.85 + random() * 0.3), // Height variation
            baseScale * (0.9 + random() * 0.2)   // Depth variation
        );

        // Random Y rotation
        tree.rotation.y = random() * Math.PI * 2;

        tree.userData.scrollable = true;
        group.add(tree);
    }
}


/**
 * Create a Pixar Ice Age style snow-laden pine tree with procedural variation
 * Every tree is unique - varied layer sizes, colors, snow amounts
 */
function createMonetSnowPine(seed: number = 0): THREE.Group {
    const random = seededRandom(seed);
    const treeGroup = new THREE.Group();

    // Varied trunk dimensions
    const trunkHeight = 3 + random() * 2;
    const trunkTopRadius = 0.2 + random() * 0.15;
    const trunkBottomRadius = 0.4 + random() * 0.2;

    const trunkGeo = new THREE.CylinderGeometry(trunkTopRadius, trunkBottomRadius, trunkHeight, 8);

    // Slightly varied trunk color
    const trunkColor = new THREE.Color().setHSL(
        0.07 + random() * 0.03,  // Hue: brown range
        0.5 + random() * 0.2,   // Saturation
        0.15 + random() * 0.1   // Lightness
    );
    const trunkMat = new THREE.MeshStandardMaterial({
        color: trunkColor,
        roughness: 0.8 + random() * 0.15,
    });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = trunkHeight / 2;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    // Varied green color for foliage
    const greenColor = new THREE.Color().setHSL(
        0.35 + random() * 0.08,  // Hue: green range with variation
        0.55 + random() * 0.3,   // Saturation: 55-85%
        0.15 + random() * 0.15   // Lightness: 15-30%
    );
    const greenMat = new THREE.MeshStandardMaterial({
        color: greenColor,
        roughness: 0.7 + random() * 0.15,
    });

    // Snow brightness variation
    const snowBrightness = 0.95 + random() * 0.05;
    const snowMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(snowBrightness, snowBrightness, snowBrightness + random() * 0.02),
        roughness: 0.6 + random() * 0.2,
        emissive: 0x222233,
        emissiveIntensity: 0.05 + random() * 0.1,
    });

    // Number of layers varies (2-4)
    const numLayers = 2 + Math.floor(random() * 3);
    let currentY = trunkHeight + 1;
    let currentRadius = 3 + random() * 1.5;

    for (let i = 0; i < numLayers; i++) {
        const layerHeight = 3 + random() * 2;
        const layerRadius = currentRadius * (0.9 - i * 0.15 + random() * 0.1);

        // Foliage layer
        const layerGeo = new THREE.ConeGeometry(layerRadius, layerHeight, 6 + Math.floor(random() * 4));
        const layer = new THREE.Mesh(layerGeo, greenMat);
        layer.position.y = currentY;
        layer.rotation.y = random() * Math.PI / 4;  // Slight rotation variation
        layer.castShadow = true;
        treeGroup.add(layer);

        // Snow cap - varies in thickness
        const snowThickness = 1 + random() * 1.2;
        const snowRadius = layerRadius * (1 + random() * 0.1);
        const snowGeo = new THREE.ConeGeometry(snowRadius, snowThickness, 6 + Math.floor(random() * 4));
        const snow = new THREE.Mesh(snowGeo, snowMat);
        snow.position.y = currentY + layerHeight * 0.35;
        snow.rotation.y = random() * Math.PI / 3;
        treeGroup.add(snow);

        currentY += layerHeight * 0.7 + random() * 0.5;
        currentRadius *= 0.7;
    }

    return treeGroup;
}


/**
 * Add HEAVY snowfall - thick blizzard-like snow
 */
function addHeavySnowfall(group: THREE.Group, offset: number): void {
    const snowCount = 800;
    const positions = new Float32Array(snowCount * 3);
    const sizes = new Float32Array(snowCount);

    for (let i = 0; i < snowCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 120;
        positions[i * 3 + 1] = Math.random() * 50;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 250 + offset;

        // Varying snowflake sizes for depth
        sizes[i] = 0.1 + Math.random() * 0.25;
    }

    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    snowGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const snowMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.2,
        transparent: true,
        opacity: 0.85,
        fog: true,
    });

    const snow = new THREE.Points(snowGeo, snowMat);
    snow.userData.scrollable = false;
    snow.userData.isHeavySnow = true;
    group.add(snow);
}

// =============================================================================
// ICE AGE SCAFFOLD - NEW EPIC ELEMENTS
// =============================================================================

/**
 * MASSIVE glacial canyon walls - Pixar Ice Age style
 * Every ice block is unique - varied colors, shapes, and positions
 */
function addGlacialCanyon(group: THREE.Group, offset: number): void {
    // LEFT CANYON WALL - Multiple layers for depth with seeded variation
    for (let layer = 0; layer < 2; layer++) {
        const baseX = -45 - layer * 35;
        const segmentCount = 6;

        for (let i = 0; i < segmentCount; i++) {
            const seed = 50000 + layer * 1000 + i * 137;
            const random = seededRandom(seed);

            const height = 65 + random() * 70 + layer * 25;
            const width = 30 + random() * 35;
            const depth = 40 + random() * 40;

            // Unique ice color for each block
            const hue = 0.54 + random() * 0.06;  // Cyan-blue range
            const sat = 0.5 + random() * 0.3;
            const light = 0.55 + random() * 0.2;
            const iceColor = new THREE.Color().setHSL(hue, sat, light);

            const iceMat = new THREE.MeshStandardMaterial({
                color: iceColor,
                roughness: 0.2 + random() * 0.2,
                metalness: 0.05 + random() * 0.1,
                transparent: true,
                opacity: 0.85 + random() * 0.1,
                emissive: new THREE.Color().setHSL(hue, 0.3, 0.1),
                emissiveIntensity: 0.05 + random() * 0.1,
            });

            const wallGeo = new THREE.BoxGeometry(width, height, depth);
            const wall = new THREE.Mesh(wallGeo, iceMat);

            wall.position.set(
                baseX + (random() - 0.5) * 18,
                height / 2 - 12 + random() * 5,
                i * 45 - 220 + offset + (random() - 0.5) * 30
            );
            wall.rotation.y = (random() - 0.5) * 0.35;
            wall.rotation.z = (random() - 0.5) * 0.08;  // Slight tilt
            wall.castShadow = true;
            wall.receiveShadow = true;
            wall.userData.scrollable = true;
            group.add(wall);
        }
    }

    // RIGHT CANYON WALL - Mirror with different seed
    for (let layer = 0; layer < 2; layer++) {
        const baseX = 45 + layer * 35;
        const segmentCount = 6;

        for (let i = 0; i < segmentCount; i++) {
            const seed = 60000 + layer * 1000 + i * 151;  // Different seed
            const random = seededRandom(seed);

            const height = 65 + random() * 70 + layer * 25;
            const width = 30 + random() * 35;
            const depth = 40 + random() * 40;

            // Unique ice color for each block
            const hue = 0.53 + random() * 0.07;
            const sat = 0.45 + random() * 0.35;
            const light = 0.5 + random() * 0.25;
            const iceColor = new THREE.Color().setHSL(hue, sat, light);

            const iceMat = new THREE.MeshStandardMaterial({
                color: iceColor,
                roughness: 0.2 + random() * 0.2,
                metalness: 0.05 + random() * 0.1,
                transparent: true,
                opacity: 0.85 + random() * 0.1,
                emissive: new THREE.Color().setHSL(hue, 0.3, 0.1),
                emissiveIntensity: 0.05 + random() * 0.1,
            });

            const wallGeo = new THREE.BoxGeometry(width, height, depth);
            const wall = new THREE.Mesh(wallGeo, iceMat);

            wall.position.set(
                baseX + (random() - 0.5) * 18,
                height / 2 - 12 + random() * 5,
                i * 45 - 220 + offset + (random() - 0.5) * 30
            );
            wall.rotation.y = (random() - 0.5) * 0.35;
            wall.rotation.z = (random() - 0.5) * 0.08;
            wall.castShadow = true;
            wall.receiveShadow = true;
            wall.userData.scrollable = true;
            group.add(wall);
        }
    }

    // Add icicles to canyon walls
    addCanyonIcicles(group, offset);
}


/**
 * Icicles hanging from canyon walls
 */
function addCanyonIcicles(group: THREE.Group, offset: number): void {
    const icicleMat = new THREE.MeshStandardMaterial({
        color: 0xc0e8ff,
        roughness: 0.15,
        metalness: 0.25,
        transparent: true,
        opacity: 0.85,
    });

    const icicleCount = 20;
    for (let i = 0; i < icicleCount; i++) {
        const length = 3 + Math.random() * 12;
        const radius = 0.15 + Math.random() * 0.4;
        const icicleGeo = new THREE.ConeGeometry(radius, length, 6);
        const icicle = new THREE.Mesh(icicleGeo, icicleMat);

        const side = i % 2 === 0 ? -1 : 1;
        icicle.position.set(
            side * (30 + Math.random() * 35),
            40 + Math.random() * 30,
            (Math.random() - 0.5) * 400 + offset
        );
        icicle.rotation.z = Math.PI; // Point downward
        icicle.userData.scrollable = true;
        group.add(icicle);
    }
}

/**
 * Distant mountain range on the horizon - Pixar Ice Age / Kirkjufell style
 * Bright cartoon colors with dramatic pointed peaks
 */
function addDistantMountainRange(group: THREE.Group, offset: number): void {
    // Brighter, more saturated Pixar-style colors
    const mountainMat = new THREE.MeshStandardMaterial({
        color: 0x6090b8,  // Bright blue-gray mountain
        roughness: 0.75,
        metalness: 0,
        transparent: true,
        opacity: 0.85,
    });

    const snowCapMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,  // Pure white snow
        roughness: 0.6,
        metalness: 0,
        emissive: 0x222230,
        emissiveIntensity: 0.1,
    });

    // Background haze mountains (furthest, most faded)
    const hazeMat = new THREE.MeshStandardMaterial({
        color: 0x8ab0d0,
        roughness: 0.9,
        metalness: 0,
        transparent: true,
        opacity: 0.5,
    });

    // === KIRKJUFELL-STYLE MAIN PEAK (center, dramatic) ===
    // Pointed mountain like Iceland's famous peak
    const mainHeight = 120;
    const mainWidth = 45;

    // Create a distinctive arrow/pyramid shape
    const mainShape = new THREE.Shape();
    mainShape.moveTo(-mainWidth, 0);
    mainShape.lineTo(-mainWidth * 0.3, mainHeight * 0.5);  // Left shoulder
    mainShape.lineTo(0, mainHeight);                        // Peak
    mainShape.lineTo(mainWidth * 0.3, mainHeight * 0.5);   // Right shoulder
    mainShape.lineTo(mainWidth, 0);
    mainShape.closePath();

    const mainGeo = new THREE.ExtrudeGeometry(mainShape, {
        depth: 40,
        bevelEnabled: false,
    });
    const mainMountain = new THREE.Mesh(mainGeo, mountainMat);
    mainMountain.position.set(0, -5, -350 + offset);
    mainMountain.rotation.x = -0.05;  // Slight tilt back
    mainMountain.userData.scrollable = false;
    mainMountain.castShadow = true;
    group.add(mainMountain);

    // Snow patch on main peak
    const peakSnowShape = new THREE.Shape();
    peakSnowShape.moveTo(-mainWidth * 0.25, mainHeight * 0.6);
    peakSnowShape.lineTo(0, mainHeight);
    peakSnowShape.lineTo(mainWidth * 0.25, mainHeight * 0.6);
    peakSnowShape.closePath();

    const peakSnowGeo = new THREE.ExtrudeGeometry(peakSnowShape, {
        depth: 42,
        bevelEnabled: false,
    });
    const peakSnow = new THREE.Mesh(peakSnowGeo, snowCapMat);
    peakSnow.position.set(0, -5, -349 + offset);
    peakSnow.userData.scrollable = false;
    group.add(peakSnow);

    // === SECONDARY PEAKS (left and right) ===
    const peaks = [
        { x: -100, height: 80, width: 35 },
        { x: -60, height: 70, width: 30 },
        { x: 70, height: 85, width: 38 },
        { x: 120, height: 65, width: 28 },
    ];

    peaks.forEach((peak, i) => {
        const shape = new THREE.Shape();
        shape.moveTo(-peak.width, 0);
        shape.lineTo(-peak.width * 0.4, peak.height * 0.6);
        shape.lineTo(0, peak.height);
        shape.lineTo(peak.width * 0.4, peak.height * 0.6);
        shape.lineTo(peak.width, 0);
        shape.closePath();

        const geo = new THREE.ExtrudeGeometry(shape, {
            depth: 30 + i * 5,
            bevelEnabled: false,
        });
        const mountain = new THREE.Mesh(geo, i % 2 === 0 ? mountainMat : hazeMat);
        mountain.position.set(peak.x, -5, -320 - i * 20 + offset);
        mountain.userData.scrollable = false;
        group.add(mountain);

        // Snow caps
        const snowShape = new THREE.Shape();
        snowShape.moveTo(-peak.width * 0.3, peak.height * 0.65);
        snowShape.lineTo(0, peak.height);
        snowShape.lineTo(peak.width * 0.3, peak.height * 0.65);
        snowShape.closePath();

        const snowGeo = new THREE.ExtrudeGeometry(snowShape, {
            depth: 32 + i * 5,
            bevelEnabled: false,
        });
        const snow = new THREE.Mesh(snowGeo, snowCapMat);
        snow.position.set(peak.x, -5, -319 - i * 20 + offset);
        snow.userData.scrollable = false;
        group.add(snow);
    });

    // === HAZE LAYER (very distant, atmospheric) ===
    for (let i = 0; i < 3; i++) {
        const hazeGeo = new THREE.PlaneGeometry(400, 60);
        const haze = new THREE.Mesh(hazeGeo, new THREE.MeshBasicMaterial({
            color: 0xb0d0e8,
            transparent: true,
            opacity: 0.25 - i * 0.05,
        }));
        haze.position.set(0, 25 + i * 10, -400 - i * 30 + offset);
        haze.userData.scrollable = false;
        group.add(haze);
    }
}


/**
 * Frozen waterfalls cascading down glacier walls
 */
function addFrozenWaterfalls(group: THREE.Group, offset: number): void {
    const frozenMat = new THREE.MeshStandardMaterial({
        color: 0xb8e0f8,
        roughness: 0.2,
        metalness: 0.3,
        transparent: true,
        opacity: 0.75,
    });

    const waterfallCount = 3;
    for (let i = 0; i < waterfallCount; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const height = 30 + Math.random() * 40;
        const width = 4 + Math.random() * 6;

        // Main frozen cascade
        const cascadeGeo = new THREE.BoxGeometry(width, height, 2);
        const cascade = new THREE.Mesh(cascadeGeo, frozenMat);
        cascade.position.set(
            side * (35 + Math.random() * 10),
            height / 2,
            i * 60 - 150 + offset
        );
        cascade.userData.scrollable = true;
        group.add(cascade);

        // Ice pool at base
        const poolGeo = new THREE.CylinderGeometry(width * 1.5, width * 2, 2, 12);
        const pool = new THREE.Mesh(poolGeo, frozenMat);
        pool.position.set(
            cascade.position.x,
            0,
            cascade.position.z
        );
        pool.userData.scrollable = true;
        group.add(pool);

        // Icicle formations on waterfall
        for (let j = 0; j < 5; j++) {
            const icicleLen = 2 + Math.random() * 4;
            const icicleGeo = new THREE.ConeGeometry(0.3, icicleLen, 5);
            const icicle = new THREE.Mesh(icicleGeo, frozenMat);
            icicle.position.set(
                cascade.position.x + (Math.random() - 0.5) * width,
                height * 0.3 + Math.random() * height * 0.5,
                cascade.position.z + 1
            );
            icicle.rotation.z = Math.PI;
            icicle.userData.scrollable = true;
            group.add(icicle);
        }
    }
}

/**
 * Ice cave openings visible in glacier walls
 */
function addIceCaves(group: THREE.Group, offset: number): void {
    const caveMat = new THREE.MeshStandardMaterial({
        color: 0x203040,
        roughness: 0.9,
        metalness: 0,
    });

    const caveRimMat = new THREE.MeshStandardMaterial({
        color: 0x80b0d0,
        roughness: 0.3,
        metalness: 0.2,
    });

    const caveCount = 2;
    for (let i = 0; i < caveCount; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const caveWidth = 8 + Math.random() * 6;
        const caveHeight = 10 + Math.random() * 8;

        // Cave opening (dark interior)
        const caveGeo = new THREE.CircleGeometry(caveWidth / 2, 16);
        const cave = new THREE.Mesh(caveGeo, caveMat);
        cave.scale.y = caveHeight / caveWidth;
        cave.position.set(
            side * (32 + Math.random() * 5),
            caveHeight / 2 + 2,
            i * 100 - 150 + offset
        );
        cave.rotation.y = side * Math.PI / 2;
        cave.userData.scrollable = true;
        group.add(cave);

        // Ice rim around cave
        const rimGeo = new THREE.TorusGeometry(caveWidth / 2 + 1, 1, 8, 16);
        const rim = new THREE.Mesh(rimGeo, caveRimMat);
        rim.position.copy(cave.position);
        rim.scale.y = caveHeight / caveWidth;
        rim.rotation.y = side * Math.PI / 2;
        rim.userData.scrollable = true;
        group.add(rim);
    }
}

/**
 * Scattered ice boulders on the ground
 */
function addIceBoulders(group: THREE.Group, offset: number): void {
    const boulderMats = [
        new THREE.MeshStandardMaterial({ color: 0xc8e0f0, roughness: 0.5, metalness: 0.1 }),
        new THREE.MeshStandardMaterial({ color: 0xa0c8e0, roughness: 0.4, metalness: 0.15 }),
        new THREE.MeshStandardMaterial({ color: 0xe0e8f0, roughness: 0.6, metalness: 0.05 }),
    ];

    const boulderCount = 10;
    for (let i = 0; i < boulderCount; i++) {
        const size = 1 + Math.random() * 3;
        const boulderGeo = new THREE.IcosahedronGeometry(size, 0);
        const boulder = new THREE.Mesh(boulderGeo, boulderMats[i % 3]);

        boulder.position.set(
            (Math.random() - 0.5) * 60,
            size * 0.5,
            (Math.random() - 0.5) * 350 + offset
        );
        boulder.rotation.set(Math.random(), Math.random(), Math.random());
        boulder.userData.scrollable = true;
        group.add(boulder);
    }
}

/**
 * Low-lying ground fog for atmosphere
 */
function addGroundFog(group: THREE.Group, offset: number): void {
    const fogMat = new THREE.MeshBasicMaterial({
        color: 0xc8d8e8,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
        depthWrite: false,
    });

    // Multiple fog layers at different heights
    for (let layer = 0; layer < 3; layer++) {
        const fogGeo = new THREE.PlaneGeometry(150, 400);
        const fog = new THREE.Mesh(fogGeo, fogMat.clone());
        fog.material.opacity = 0.15 - layer * 0.03;
        fog.rotation.x = -Math.PI / 2;
        fog.position.set(
            0,
            0.5 + layer * 2,
            offset
        );
        fog.userData.scrollable = false;
        fog.userData.isGroundFog = true;
        fog.userData.fogLayer = layer;
        group.add(fog);
    }
}

/**
 * Add mammoth silhouettes in the distance (2D sprites - no 3D modeling needed)
 */
function addMammothSilhouettes(group: THREE.Group, offset: number): void {
    const mammothCount = 6;

    for (let i = 0; i < mammothCount; i++) {
        // Create mammoth silhouette using canvas
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 96;
        const ctx = canvas.getContext('2d')!;

        // Draw mammoth silhouette shape
        ctx.fillStyle = '#1a2530';
        ctx.beginPath();
        // Body
        ctx.ellipse(64, 55, 35, 25, 0, 0, Math.PI * 2);
        ctx.fill();
        // Head
        ctx.beginPath();
        ctx.ellipse(95, 45, 18, 15, 0.2, 0, Math.PI * 2);
        ctx.fill();
        // Trunk
        ctx.beginPath();
        ctx.moveTo(108, 50);
        ctx.quadraticCurveTo(120, 65, 115, 80);
        ctx.quadraticCurveTo(110, 85, 105, 75);
        ctx.quadraticCurveTo(100, 55, 100, 45);
        ctx.fill();
        // Tusks
        ctx.strokeStyle = '#3a4550';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(100, 55);
        ctx.quadraticCurveTo(115, 40, 105, 30);
        ctx.stroke();
        // Legs
        ctx.fillStyle = '#1a2530';
        ctx.fillRect(40, 70, 10, 20);
        ctx.fillRect(55, 70, 10, 20);
        ctx.fillRect(70, 70, 10, 20);
        ctx.fillRect(85, 70, 10, 20);
        // Hump/back
        ctx.beginPath();
        ctx.ellipse(55, 35, 20, 15, -0.2, 0, Math.PI * 2);
        ctx.fill();

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0.7,
            fog: true,
        });
        const sprite = new THREE.Sprite(spriteMat);

        const side = Math.random() > 0.5 ? 1 : -1;
        const distance = 40 + Math.random() * 40;
        const scale = 8 + Math.random() * 6;

        sprite.scale.set(scale * 1.3, scale, 1);
        sprite.position.set(
            side * distance,
            scale / 2 + 1,
            (Math.random() - 0.5) * 250 + offset
        );

        sprite.userData.scrollable = true;
        group.add(sprite);
    }
}

/**
 * Add distant pine trees (simple 2D sprites)
 */
function addDistantTrees(group: THREE.Group, offset: number): void {
    const treeCount = 20;

    for (let i = 0; i < treeCount; i++) {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 128;
        const ctx = canvas.getContext('2d')!;

        // Draw simple pine tree silhouette
        ctx.fillStyle = '#2a3540';
        // Trunk
        ctx.fillRect(28, 90, 8, 35);
        // Tree layers (triangles)
        ctx.beginPath();
        ctx.moveTo(32, 5);
        ctx.lineTo(10, 45);
        ctx.lineTo(54, 45);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(32, 25);
        ctx.lineTo(5, 75);
        ctx.lineTo(59, 75);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(32, 50);
        ctx.lineTo(0, 100);
        ctx.lineTo(64, 100);
        ctx.closePath();
        ctx.fill();

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0.8,
            fog: true,
        });
        const sprite = new THREE.Sprite(spriteMat);

        const side = i % 2 === 0 ? 1 : -1;
        const distance = 15 + Math.random() * 35;
        const scale = 3 + Math.random() * 4;

        sprite.scale.set(scale * 0.5, scale, 1);
        sprite.position.set(
            side * distance,
            scale / 2,
            (Math.random() - 0.5) * 300 + offset
        );

        sprite.userData.scrollable = true;
        group.add(sprite);
    }
}

/**
 * Add flying birds in the distance (simple V shapes)
 */
function addFlyingBirds(group: THREE.Group, offset: number): void {
    const flockCount = 4;

    for (let f = 0; f < flockCount; f++) {
        const birdCount = 5 + Math.floor(Math.random() * 8);
        const flockX = (Math.random() - 0.5) * 60;
        const flockY = 15 + Math.random() * 25;
        const flockZ = (Math.random() - 0.5) * 200 + offset;

        for (let i = 0; i < birdCount; i++) {
            // Create bird as simple V shape
            const birdGeo = new THREE.BufferGeometry();
            const vertices = new Float32Array([
                -0.5, 0, 0,
                0, 0.1, 0,
                0.5, 0, 0,
            ]);
            birdGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

            const birdMat = new THREE.LineBasicMaterial({
                color: 0x1a2530,
                linewidth: 2,
            });
            const bird = new THREE.Line(birdGeo, birdMat);

            bird.position.set(
                flockX + (Math.random() - 0.5) * 10,
                flockY + (Math.random() - 0.5) * 5,
                flockZ + (Math.random() - 0.5) * 15
            );
            bird.scale.setScalar(0.8 + Math.random() * 0.4);

            bird.userData.scrollable = true;
            bird.userData.isBird = true;
            bird.userData.flapPhase = Math.random() * Math.PI * 2;
            bird.userData.flapSpeed = 5 + Math.random() * 3;
            group.add(bird);
        }
    }
}

/**
 * Add tundra grass patches on the ground
 */
function addTundraGrassPatches(group: THREE.Group, offset: number): void {
    const patchCount = 30;

    for (let i = 0; i < patchCount; i++) {
        const patchGeo = new THREE.CircleGeometry(1 + Math.random() * 2, 8);
        const patchMat = new THREE.MeshStandardMaterial({
            color: Math.random() > 0.5 ? 0x5a6858 : 0x4a5848,
            roughness: 1.0,
            metalness: 0.0,
        });
        const patch = new THREE.Mesh(patchGeo, patchMat);

        patch.rotation.x = -Math.PI / 2;
        patch.position.set(
            (Math.random() - 0.5) * 50,
            0.02,
            (Math.random() - 0.5) * 280 + offset
        );

        patch.userData.scrollable = true;
        group.add(patch);
    }

    // Add some tufts of grass (small vertical planes)
    const tuftCount = 40;
    for (let i = 0; i < tuftCount; i++) {
        const tuftGeo = new THREE.PlaneGeometry(0.3, 0.5 + Math.random() * 0.3);
        const tuftMat = new THREE.MeshStandardMaterial({
            color: 0x6a7868,
            roughness: 0.9,
            side: THREE.DoubleSide,
        });
        const tuft = new THREE.Mesh(tuftGeo, tuftMat);

        tuft.position.set(
            (Math.random() - 0.5) * 50,
            0.25,
            (Math.random() - 0.5) * 280 + offset
        );
        tuft.rotation.y = Math.random() * Math.PI;

        tuft.userData.scrollable = true;
        group.add(tuft);
    }
}

/**
 * Add heavy snowfall particles
 */
function addSnowfall(group: THREE.Group, offset: number): void {
    const snowCount = 500;
    const positions = new Float32Array(snowCount * 3);
    const velocities = new Float32Array(snowCount * 3);

    for (let i = 0; i < snowCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 100;
        positions[i * 3 + 1] = Math.random() * 40;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 200 + offset;

        velocities[i * 3] = (Math.random() - 0.5) * 0.02; // Drift X
        velocities[i * 3 + 1] = -0.05 - Math.random() * 0.1; // Fall speed
        velocities[i * 3 + 2] = 0; // Z drift
    }

    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    snowGeo.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));

    const snowMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.15,
        transparent: true,
        opacity: 0.8,
        fog: true,
    });

    const snow = new THREE.Points(snowGeo, snowMat);
    snow.userData.scrollable = false; // Snow doesn't scroll with terrain
    snow.userData.isSnowfall = true;
    group.add(snow);
}

function addHolograms(group: THREE.Group, offset: number, progress: number): void {
    const holoCount = 4 + Math.floor(progress * 4);
    const holoColors = [0xff00ff, 0x00ffff, 0xff0080, 0x80ff00];

    for (let i = 0; i < holoCount; i++) {
        const holoGeo = new THREE.PlaneGeometry(2, 3);
        const holoMat = new THREE.MeshStandardMaterial({
            color: holoColors[i % holoColors.length],
            emissive: holoColors[i % holoColors.length],
            emissiveIntensity: 1.5,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
        });
        const holo = new THREE.Mesh(holoGeo, holoMat);

        const side = i % 2 === 0 ? 1 : -1;
        holo.position.set(
            side * (16 + Math.random() * 20),
            6 + Math.random() * 12,
            (Math.random() - 0.5) * 140 + offset
        );
        holo.rotation.y = side * Math.PI / 4;
        holo.userData.scrollable = true;
        holo.userData.isHologram = true;
        group.add(holo);
    }
}

function addEnergyFields(group: THREE.Group, offset: number, progress: number, era: EraConfig): void {
    const fieldCount = 2 + Math.floor(progress * 3);

    for (let i = 0; i < fieldCount; i++) {
        const fieldGeo = new THREE.TorusGeometry(3 + Math.random() * 4, 0.1, 8, 32);
        const fieldMat = new THREE.MeshStandardMaterial({
            color: era.accentLightColor,
            emissive: era.accentLightColor,
            emissiveIntensity: 2,
            transparent: true,
            opacity: 0.4,
        });
        const field = new THREE.Mesh(fieldGeo, fieldMat);

        field.position.set(
            (Math.random() - 0.5) * 60,
            12 + Math.random() * 22,
            (Math.random() - 0.5) * 140 + offset
        );
        field.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        field.userData.scrollable = true;
        field.userData.isEnergyField = true;
        field.userData.rotationSpeed = 0.5 + Math.random() * 0.5;
        group.add(field);
    }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function seededRandom(seed: number): () => number {
    return () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };
}

function getAssetDensity(era: EraConfig, progress: number): number {
    // Base density varies by era - OPTIMIZED for performance
    const baseDensity: Record<number, number> = {
        1: 18,   // Cretaceous - prehistoric forest
        2: 12,   // Ice Age - sparse tundra
        3: 15,   // Stone Age
        4: 18,   // Bronze Age
        5: 20,   // Classical
        6: 22,   // Medieval
        7: 20,   // Renaissance
        8: 25,   // Industrial - factories
        9: 22,   // Modern
        10: 28,  // Digital - buildings
        11: 25,  // Near Future
        12: 30,  // Cyberpunk - megacity
        13: 15,  // Space Age - sparse
        14: 10,  // Lunar - very sparse
        15: 12,  // Mars
        16: 10,  // Solar System - sparse
        17: 18,  // Type I
        18: 15,  // Type II
        19: 12,  // Type II.5
        20: 20,  // Type III - cosmic structures
    };

    const base = baseDensity[era.id] || 15;
    return base * (0.8 + progress * 0.4) * assetDensityScale;
}

function getSpreadX(era: EraConfig): number {
    // How far from center assets spread
    const baseSpread: Record<number, number> = {
        1: 30,   // Cretaceous
        2: 35,   // Ice Age
        3: 25,   // Stone Age
        4: 30,   // Bronze Age
        5: 35,   // Classical
        6: 30,   // Medieval
        7: 35,   // Renaissance
        8: 40,   // Industrial
        9: 35,   // Modern
        10: 40,  // Digital
        11: 45,  // Near Future
        12: 50,  // Cyberpunk - wide megacity
        13: 60,  // Space Age
        14: 40,  // Lunar
        15: 50,  // Mars
        16: 80,  // Solar System - very wide
        17: 60,  // Type I
        18: 80,  // Type II
        19: 100, // Type II.5
        20: 120, // Type III - galactic scale
    };

    return baseSpread[era.id] || 30;
}

function getGroundLevel(era: EraConfig, random: number): number {
    // Ground level variation by era
    switch (era.id) {
        case 13: case 14: case 15: case 16: // Space eras - floating
            return -5 + random * 15;
        case 17: case 18: case 19: case 20: // Type civilizations - floating
            return -10 + random * 30;
        default:
            return 0;
    }
}

function getParticleSpread(era: EraConfig): number {
    return era.id >= 13 ? 80 : 50; // Wider for space eras
}

function getParticleSize(era: EraConfig): number {
    const baseSizes: Record<string, number> = {
        'leaves': 0.3,
        'snow': 0.25,
        'ash': 0.2,
        'dust': 0.15,
        'rain': 0.1,
        'sparks': 0.2,
        'data': 0.15,
        'energy': 0.25,
        'stars': 0.2,
        'cosmic': 0.3,
    };

    return baseSizes[era.particleType] || 0.2;
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

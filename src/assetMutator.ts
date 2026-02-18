// src/assetMutator.ts
// Procedural Asset Mutation System
// Creates era-specific assets with procedural variations based on ELO

import * as THREE from 'three';
import { EraConfig, getEraForElo, getEraProgress, interpolateEraValue } from './eraSystem';

// =============================================================================
// ASSET MUTATION INTERFACE
// =============================================================================

export interface MutatedAssetConfig {
    scale: THREE.Vector3;
    colorShift: number;
    rotationOffset: THREE.Euler;
    detailLevel: number;
    glowIntensity: number;
    emissiveColor: number;
}

// =============================================================================
// ERA-SPECIFIC ASSET CREATORS
// =============================================================================

/**
 * Create a mutated asset based on era and ELO
 */
export function createEraAsset(
    assetType: string,
    elo: number,
    instanceSeed: number
): THREE.Group {
    const era = getEraForElo(elo);
    const progress = getEraProgress(elo);
    const mutation = getMutationConfig(era, progress, instanceSeed);

    switch (era.id) {
        case 1: return createCretaceousAsset(assetType, mutation, instanceSeed);
        case 2: return createIceAgeAsset(assetType, mutation, instanceSeed);
        case 3: return createStoneAgeAsset(assetType, mutation, instanceSeed);
        case 4: return createBronzeAgeAsset(assetType, mutation, instanceSeed);
        case 5: return createClassicalAsset(assetType, mutation, instanceSeed);
        case 6: return createMedievalAsset(assetType, mutation, instanceSeed);
        case 7: return createRenaissanceAsset(assetType, mutation, instanceSeed);
        case 8: return createIndustrialAsset(assetType, mutation, instanceSeed);
        case 9: return createModernAsset(assetType, mutation, instanceSeed);
        case 10: return createDigitalAsset(assetType, mutation, instanceSeed);
        case 11: return createNearFutureAsset(assetType, mutation, instanceSeed);
        case 12: return createCyberpunkAsset(assetType, mutation, instanceSeed);
        case 13: return createSpaceAgeAsset(assetType, mutation, instanceSeed);
        case 14: return createLunarAsset(assetType, mutation, instanceSeed);
        case 15: return createMarsAsset(assetType, mutation, instanceSeed);
        case 16: return createSolarSystemAsset(assetType, mutation, instanceSeed);
        case 17: return createType1Asset(assetType, mutation, instanceSeed);
        case 18: return createType2Asset(assetType, mutation, instanceSeed);
        case 19: return createType25Asset(assetType, mutation, instanceSeed);
        case 20: return createType3Asset(assetType, mutation, instanceSeed);
        default: return createGenericAsset(mutation);
    }
}

/**
 * Calculate mutation config based on era, progress, and seed
 */
function getMutationConfig(era: EraConfig, progress: number, seed: number): MutatedAssetConfig {
    const random = seededRandom(seed);

    const scaleVariance = era.assetScaleMax - era.assetScaleMin;
    const baseScale = era.assetScaleMin + (random() * scaleVariance);
    const scaleY = baseScale * (0.8 + random() * 0.4);

    return {
        scale: new THREE.Vector3(baseScale, scaleY, baseScale),
        colorShift: (random() - 0.5) * era.assetColorVariance,
        rotationOffset: new THREE.Euler(
            (random() - 0.5) * 0.1,
            random() * Math.PI * 2,
            (random() - 0.5) * 0.1
        ),
        detailLevel: era.assetDetailLevel,
        glowIntensity: progress * 0.5,
        emissiveColor: era.accentLightColor,
    };
}

/**
 * Seeded random number generator
 */
function seededRandom(seed: number): () => number {
    return () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };
}

/**
 * Shift a color by hue amount
 */
function shiftColor(baseColor: number, shift: number): number {
    const color = new THREE.Color(baseColor);
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    hsl.h = (hsl.h + shift + 1) % 1;
    color.setHSL(hsl.h, hsl.s, hsl.l);
    return color.getHex();
}

// =============================================================================
// L-SYSTEM PROCEDURAL TREE GENERATOR
// =============================================================================

interface LSystemRule {
    axiom: string;
    rules: Record<string, string>;
    angle: number;       // Branch angle in radians
    lengthFactor: number; // Branch length shrink per iteration
    iterations: number;
    trunkColor: number;
    leafColor: number;
    leafSize: number;
}

const L_SYSTEM_PRESETS: Record<string, LSystemRule> = {
    // Tall narrow cypress — iconic Italian garden look
    cypress: {
        axiom: 'F',
        rules: { 'F': 'FF+[+F-F-F]-[-F+F+F]' },
        angle: Math.PI / 9,      // 20° — tight branches
        lengthFactor: 0.55,
        iterations: 3,
        trunkColor: 0x3d2817,
        leafColor: 0x1a5c2a,
        leafSize: 0.35,
    },

    // Broader ornamental garden tree
    garden_tree: {
        axiom: 'X',
        rules: { 'X': 'F+[[X]-X]-F[-FX]+X', 'F': 'FF' },
        angle: Math.PI / 7,      // ~25°
        lengthFactor: 0.5,
        iterations: 4,
        trunkColor: 0x4a3020,
        leafColor: 0x2d6b3e,
        leafSize: 0.5,
    },

    // Oak-like spreading tree for Classical/Medieval eras
    oak: {
        axiom: 'F',
        rules: { 'F': 'F[+F]F[-F][F]' },
        angle: Math.PI / 5.5,    // ~33°
        lengthFactor: 0.6,
        iterations: 3,
        trunkColor: 0x5a3a1a,
        leafColor: 0x3a7a3a,
        leafSize: 0.6,
    },
};

/**
 * Create an L-system procedural tree
 * Uses Lindenmayer string rewriting + turtle graphics to build branching geometry
 */
function createLSystemTree(
    group: THREE.Group,
    config: MutatedAssetConfig,
    random: () => number,
    preset: string
): void {
    const rule = L_SYSTEM_PRESETS[preset] || L_SYSTEM_PRESETS.cypress;

    // Step 1: Generate L-system string
    let lString = rule.axiom;
    for (let iter = 0; iter < rule.iterations; iter++) {
        let next = '';
        for (const ch of lString) {
            next += rule.rules[ch] ?? ch;
        }
        lString = next;
    }

    // Step 2: Interpret with turtle graphics to build branch segments
    const branchRadius = 0.15 + random() * 0.1;
    const baseLength = 1.2 + random() * 0.8;

    // Turtle state: position, direction, depth
    interface TurtleState {
        pos: THREE.Vector3;
        dir: THREE.Vector3;
        depth: number;
    }

    const stack: TurtleState[] = [];
    let pos = new THREE.Vector3(0, 0, 0);
    let dir = new THREE.Vector3(0, 1, 0); // Start pointing up
    let depth = 0;
    let segmentLength = baseLength;

    const trunkMat = new THREE.MeshStandardMaterial({
        color: shiftColor(rule.trunkColor, config.colorShift),
        roughness: 0.9,
    });
    const leafMat = new THREE.MeshStandardMaterial({
        color: shiftColor(rule.leafColor, config.colorShift),
        roughness: 0.7,
    });

    // Limit total geometry to keep performance reasonable
    let branchCount = 0;
    const MAX_BRANCHES = 80;
    let leafCount = 0;
    const MAX_LEAVES = 40;

    for (const ch of lString) {
        if (branchCount >= MAX_BRANCHES) break;

        switch (ch) {
            case 'F': {
                // Draw a branch segment
                const len = segmentLength * Math.pow(rule.lengthFactor, depth);
                const rad = Math.max(0.03, branchRadius * Math.pow(0.7, depth));

                const cyl = new THREE.CylinderGeometry(rad * 0.7, rad, len, 5, 1);
                const branch = new THREE.Mesh(cyl, trunkMat);

                // Position at midpoint of segment
                const mid = pos.clone().addScaledVector(dir, len * 0.5);
                branch.position.copy(mid);

                // Orient cylinder along direction
                const up = new THREE.Vector3(0, 1, 0);
                const quat = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
                branch.setRotationFromQuaternion(quat);

                group.add(branch);
                branchCount++;

                // Move turtle forward
                pos = pos.clone().addScaledVector(dir, len);

                // Add leaf cluster at branch tips (deeper branches)
                if (depth >= 2 && leafCount < MAX_LEAVES && random() > 0.3) {
                    const leafGeo = new THREE.SphereGeometry(
                        rule.leafSize * (0.6 + random() * 0.6),
                        6, 5
                    );
                    const leaf = new THREE.Mesh(leafGeo, leafMat);
                    leaf.position.copy(pos);
                    // Slight random offset for natural look
                    leaf.position.x += (random() - 0.5) * 0.3;
                    leaf.position.z += (random() - 0.5) * 0.3;
                    group.add(leaf);
                    leafCount++;
                }
                break;
            }
            case '+': {
                // Turn right (rotate around Z axis with some random X component)
                const angle = rule.angle * (0.8 + random() * 0.4);
                const axis = new THREE.Vector3(
                    (random() - 0.5) * 0.3,
                    0,
                    1
                ).normalize();
                dir = dir.clone().applyAxisAngle(axis, angle).normalize();
                break;
            }
            case '-': {
                // Turn left
                const angle = rule.angle * (0.8 + random() * 0.4);
                const axis = new THREE.Vector3(
                    (random() - 0.5) * 0.3,
                    0,
                    1
                ).normalize();
                dir = dir.clone().applyAxisAngle(axis, -angle).normalize();
                break;
            }
            case '[': {
                // Push state (start a branch)
                stack.push({ pos: pos.clone(), dir: dir.clone(), depth });
                depth++;
                break;
            }
            case ']': {
                // Pop state (end branch, return to junction)
                const state = stack.pop();
                if (state) {
                    pos = state.pos;
                    dir = state.dir;
                    depth = state.depth;
                }
                break;
            }
            // 'X' is a placeholder — interpreted only by rules, not by turtle
        }
    }
}

// =============================================================================
// ERA 1: JURASSIC ASSETS - HIGH-END PREHISTORIC VEGETATION
// =============================================================================


function createCretaceousAsset(type: string, config: MutatedAssetConfig, seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    switch (type) {
        case 'jurassic_tree':
            createRealisticConifer(group, config, random);
            break;
        case 'giant_fern':
            createRealisticGiantFern(group, config, random);
            break;
        case 'ancient_conifer':
            createAncientConifer(group, config, random);
            break;
        case 'cycad_palm':
            createRealisticCycad(group, config, random);
            break;
        case 'fern_cluster':
            createFernCluster(group, config, random);
            break;
        case 'moss_rock':
            createMossyRock(group, config, random);
            break;
        case 'fallen_log':
            createFallenLog(group, config, random);
            break;
        case 'ground_fern':
            createGroundFernAsset(group, config, random);
            break;
        default:
            createMossyRock(group, config, random);
    }

    group.scale.copy(config.scale);
    group.rotation.copy(config.rotationOffset);
    return group;
}

// 🌿 HIGH-END JURASSIC VEGETATION 🌿

function createRealisticConifer(group: THREE.Group, config: MutatedAssetConfig, random: () => number): void {
    const height = 15 + random() * 20;
    
    // Realistic bark-textured trunk
    const trunkGeo = new THREE.CylinderGeometry(0.4, 0.8, height * 0.7, 12);
    const trunkMat = new THREE.MeshStandardMaterial({
        color: 0x3d2817,
        roughness: 0.95,
        metalness: 0,
    });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = height * 0.35;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);
    
    // Layered foliage canopy
    const foliageMat = new THREE.MeshStandardMaterial({
        color: 0x1a4a2a,
        roughness: 0.8,
        metalness: 0,
    });
    
    const tiers = 5 + Math.floor(random() * 3);
    for (let t = 0; t < tiers; t++) {
        const tierY = height * (0.35 + t * 0.12);
        const tierRadius = (4 + random() * 2) * (1 - t * 0.12);
        
        const foliageGeo = new THREE.ConeGeometry(tierRadius, 4, 8);
        const foliage = new THREE.Mesh(foliageGeo, foliageMat);
        foliage.position.y = tierY;
        foliage.castShadow = true;
        foliage.receiveShadow = true;
        group.add(foliage);
    }
}

function createRealisticGiantFern(group: THREE.Group, config: MutatedAssetConfig, random: () => number): void {
    const height = 6 + random() * 8;
    
    // Fibrous trunk
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, height, 10);
    const trunkMat = new THREE.MeshStandardMaterial({
        color: 0x4a3a2a,
        roughness: 1.0,
        metalness: 0,
    });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = height * 0.5;
    trunk.castShadow = true;
    group.add(trunk);
    
    // Radiating fronds
    const frondMat = new THREE.MeshStandardMaterial({
        color: 0x2a6a3a,
        roughness: 0.6,
        metalness: 0,
        side: THREE.DoubleSide,
    });
    
    const frondCount = 10 + Math.floor(random() * 8);
    for (let f = 0; f < frondCount; f++) {
        const angle = (f / frondCount) * Math.PI * 2 + random() * 0.2;
        const frondLength = 4 + random() * 3;
        
        // Tapered frond shape
        const frondGeo = new THREE.ConeGeometry(0.8, frondLength, 4);
        const frond = new THREE.Mesh(frondGeo, frondMat);
        
        frond.position.set(
            Math.cos(angle) * 0.5,
            height,
            Math.sin(angle) * 0.5
        );
        frond.rotation.x = 0.5 + random() * 0.6;
        frond.rotation.y = angle;
        frond.castShadow = true;
        
        group.add(frond);
    }
}

function createAncientConifer(group: THREE.Group, config: MutatedAssetConfig, random: () => number): void {
    const height = 20 + random() * 15;
    
    // Tall straight trunk
    const trunkGeo = new THREE.CylinderGeometry(0.5, 0.9, height * 0.8, 10);
    const trunkMat = new THREE.MeshStandardMaterial({
        color: 0x4a3020,
        roughness: 0.9,
        metalness: 0,
    });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = height * 0.4;
    trunk.castShadow = true;
    group.add(trunk);
    
    // Dense conical canopy
    const canopyMat = new THREE.MeshStandardMaterial({
        color: 0x1a5030,
        roughness: 0.85,
        metalness: 0,
    });
    
    const canopyGeo = new THREE.ConeGeometry(6, height * 0.6, 8);
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.y = height * 0.7;
    canopy.castShadow = true;
    canopy.receiveShadow = true;
    group.add(canopy);
}

function createRealisticCycad(group: THREE.Group, config: MutatedAssetConfig, random: () => number): void {
    // Thick pineapple-like trunk
    const trunkGeo = new THREE.CylinderGeometry(0.5, 0.7, 2.5, 10);
    const trunkMat = new THREE.MeshStandardMaterial({
        color: 0x5a4530,
        roughness: 0.85,
        metalness: 0,
    });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.25;
    trunk.castShadow = true;
    group.add(trunk);
    
    // Stiff radiating fronds
    const frondMat = new THREE.MeshStandardMaterial({
        color: 0x3a5a2a,
        roughness: 0.5,
        metalness: 0,
        side: THREE.DoubleSide,
    });
    
    const frondCount = 12 + Math.floor(random() * 8);
    for (let f = 0; f < frondCount; f++) {
        const angle = (f / frondCount) * Math.PI * 2;
        const frondLength = 3 + random() * 2;
        
        const frondGeo = new THREE.BoxGeometry(0.25, frondLength, 0.04);
        const frond = new THREE.Mesh(frondGeo, frondMat);
        
        frond.position.set(
            Math.cos(angle) * 0.6,
            2.5 + frondLength * 0.25,
            Math.sin(angle) * 0.6
        );
        frond.rotation.x = 0.3 + random() * 0.5;
        frond.rotation.y = angle;
        frond.castShadow = true;
        
        group.add(frond);
    }
}

function createFernCluster(group: THREE.Group, config: MutatedAssetConfig, random: () => number): void {
    const fernMat = new THREE.MeshStandardMaterial({
        color: 0x2a5a3a,
        roughness: 0.7,
        metalness: 0,
        side: THREE.DoubleSide,
    });
    
    // Multiple small ferns in cluster
    const fernCount = 3 + Math.floor(random() * 4);
    for (let n = 0; n < fernCount; n++) {
        const offsetX = (random() - 0.5) * 1.5;
        const offsetZ = (random() - 0.5) * 1.5;
        
        const frondCount = 6 + Math.floor(random() * 4);
        for (let f = 0; f < frondCount; f++) {
            const angle = (f / frondCount) * Math.PI * 2 + random() * 0.3;
            const length = 1 + random() * 1;
            
            const frondGeo = new THREE.ConeGeometry(0.3, length, 4);
            const frond = new THREE.Mesh(frondGeo, fernMat);
            
            frond.position.set(
                offsetX + Math.cos(angle) * 0.2,
                length * 0.3,
                offsetZ + Math.sin(angle) * 0.2
            );
            frond.rotation.x = 0.7 + random() * 0.5;
            frond.rotation.y = angle;
            
            group.add(frond);
        }
    }
}

function createMossyRock(group: THREE.Group, config: MutatedAssetConfig, random: () => number): void {
    // Organic rock shape
    const rockGeo = new THREE.DodecahedronGeometry(1.5, 1);
    const rockMat = new THREE.MeshStandardMaterial({
        color: 0x5a5a5a,
        roughness: 0.95,
        metalness: 0,
    });
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.scale.set(1 + random() * 0.5, 0.6 + random() * 0.4, 1 + random() * 0.5);
    rock.position.y = 0.3;
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
    
    // Moss patches
    const mossMat = new THREE.MeshStandardMaterial({
        color: 0x3a5a3a,
        roughness: 1.0,
        metalness: 0,
    });
    
    for (let m = 0; m < 3 + Math.floor(random() * 3); m++) {
        const mossGeo = new THREE.SphereGeometry(0.3 + random() * 0.3, 6, 4);
        const moss = new THREE.Mesh(mossGeo, mossMat);
        
        const theta = random() * Math.PI * 2;
        const phi = random() * Math.PI * 0.5;
        moss.position.set(
            Math.cos(theta) * Math.sin(phi) * 1.2,
            0.5 + Math.cos(phi) * 0.5,
            Math.sin(theta) * Math.sin(phi) * 1.2
        );
        moss.scale.y = 0.3;
        
        group.add(moss);
    }
}

function createFallenLog(group: THREE.Group, config: MutatedAssetConfig, random: () => number): void {
    const length = 4 + random() * 6;
    
    // Main log
    const logGeo = new THREE.CylinderGeometry(0.4, 0.5, length, 10);
    const logMat = new THREE.MeshStandardMaterial({
        color: 0x4a3520,
        roughness: 0.95,
        metalness: 0,
    });
    const log = new THREE.Mesh(logGeo, logMat);
    log.rotation.z = Math.PI / 2;
    log.position.y = 0.4;
    log.castShadow = true;
    log.receiveShadow = true;
    group.add(log);
    
    // Moss/fungus patches
    const mossMat = new THREE.MeshStandardMaterial({
        color: 0x4a6a4a,
        roughness: 1.0,
        metalness: 0,
    });
    
    for (let m = 0; m < 4 + Math.floor(random() * 4); m++) {
        const mossGeo = new THREE.BoxGeometry(0.3, 0.1, 0.3 + random() * 0.3);
        const moss = new THREE.Mesh(mossGeo, mossMat);
        
        moss.position.set(
            (random() - 0.5) * length * 0.8,
            0.6,
            (random() - 0.5) * 0.3
        );
        
        group.add(moss);
    }
}

function createGroundFernAsset(group: THREE.Group, config: MutatedAssetConfig, random: () => number): void {
    const fernMat = new THREE.MeshStandardMaterial({
        color: 0x2a5a3a,
        roughness: 0.7,
        metalness: 0,
        side: THREE.DoubleSide,
    });
    
    const frondCount = 8 + Math.floor(random() * 6);
    for (let f = 0; f < frondCount; f++) {
        const angle = (f / frondCount) * Math.PI * 2 + random() * 0.3;
        const length = 1.5 + random() * 1.5;
        
        const frondGeo = new THREE.ConeGeometry(0.4, length, 4);
        const frond = new THREE.Mesh(frondGeo, fernMat);
        
        frond.position.set(
            Math.cos(angle) * 0.3,
            length * 0.3,
            Math.sin(angle) * 0.3
        );
        frond.rotation.x = 0.8 + random() * 0.4;
        frond.rotation.y = angle;
        
        group.add(frond);
    }
}

// =============================================================================
// ERA 2-7: Historical Assets (Simplified for brevity)
// =============================================================================

function createIceAgeAsset(type: string, config: MutatedAssetConfig, seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    // Glacier / Mammoth / Ice formations
    const glacierGeo = new THREE.IcosahedronGeometry(2, 1);
    const glacierMat = new THREE.MeshStandardMaterial({
        color: shiftColor(0xa0d0e0, config.colorShift),
        roughness: 0.2,
        metalness: 0.1,
        transparent: true,
        opacity: 0.85,
    });
    const glacier = new THREE.Mesh(glacierGeo, glacierMat);
    glacier.scale.set(1 + random() * 0.5, 1.5 + random() * 0.5, 1 + random() * 0.3);
    group.add(glacier);

    group.scale.copy(config.scale);
    group.rotation.copy(config.rotationOffset);
    return group;
}

function createStoneAgeAsset(type: string, config: MutatedAssetConfig, seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    if (type === 'campfire') {
        // Fire pit
        const pitGeo = new THREE.CylinderGeometry(0.8, 1, 0.3, 8);
        const pitMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 1 });
        const pit = new THREE.Mesh(pitGeo, pitMat);
        group.add(pit);

        // Flames
        const flameGeo = new THREE.ConeGeometry(0.4, 1.2, 6);
        const flameMat = new THREE.MeshStandardMaterial({
            color: 0xff6600,
            emissive: 0xff4400,
            emissiveIntensity: 2,
        });
        const flame = new THREE.Mesh(flameGeo, flameMat);
        flame.position.y = 0.7;
        group.add(flame);
    } else {
        // Stone circle / cave entrance
        for (let i = 0; i < 5; i++) {
            const stoneGeo = new THREE.BoxGeometry(0.5, 1 + random() * 1.5, 0.4);
            const stoneMat = new THREE.MeshStandardMaterial({
                color: shiftColor(0x6a6a6a, config.colorShift),
                roughness: 0.9,
            });
            const stone = new THREE.Mesh(stoneGeo, stoneMat);
            const angle = (i / 5) * Math.PI * 2;
            stone.position.set(Math.cos(angle) * 1.5, 0.5, Math.sin(angle) * 1.5);
            stone.rotation.y = angle;
            group.add(stone);
        }
    }

    group.scale.copy(config.scale);
    group.rotation.copy(config.rotationOffset);
    return group;
}

function createBronzeAgeAsset(type: string, config: MutatedAssetConfig, seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    // Pyramid
    const pyramidGeo = new THREE.ConeGeometry(3, 4, 4);
    const pyramidMat = new THREE.MeshStandardMaterial({
        color: shiftColor(0xd4b896, config.colorShift),
        roughness: 0.8,
        flatShading: true,
    });
    const pyramid = new THREE.Mesh(pyramidGeo, pyramidMat);
    pyramid.position.y = 2;
    pyramid.rotation.y = Math.PI / 4;
    group.add(pyramid);

    group.scale.copy(config.scale);
    group.rotation.copy(config.rotationOffset);
    return group;
}

function createClassicalAsset(type: string, config: MutatedAssetConfig, seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    if (type === 'olive_tree') {
        createLSystemTree(group, config, random, 'oak');
        group.scale.copy(config.scale);
        group.rotation.copy(config.rotationOffset);
        return group;
    }

    // Greek temple with columns
    const baseGeo = new THREE.BoxGeometry(4, 0.3, 2.5);
    const marbleMat = new THREE.MeshStandardMaterial({
        color: shiftColor(0xf0ebe0, config.colorShift),
        roughness: 0.4,
    });
    const base = new THREE.Mesh(baseGeo, marbleMat);
    base.position.y = 0.15;
    group.add(base);

    // Columns
    for (let i = 0; i < 4; i++) {
        const colGeo = new THREE.CylinderGeometry(0.15, 0.18, 2.5, 12);
        const col = new THREE.Mesh(colGeo, marbleMat);
        col.position.set(-1.3 + i * 0.87, 1.5, 0);
        group.add(col);
    }

    // Roof
    const roofGeo = new THREE.BoxGeometry(4.2, 0.2, 2.7);
    const roof = new THREE.Mesh(roofGeo, marbleMat);
    roof.position.y = 2.85;
    group.add(roof);

    // Pediment
    const pedimentGeo = new THREE.ConeGeometry(2.2, 0.8, 3);
    const pediment = new THREE.Mesh(pedimentGeo, marbleMat);
    pediment.position.y = 3.35;
    pediment.rotation.x = Math.PI / 2;
    pediment.rotation.z = Math.PI / 2;
    pediment.scale.z = 0.5;
    group.add(pediment);

    group.scale.copy(config.scale);
    group.rotation.copy(config.rotationOffset);
    return group;
}

function createMedievalAsset(type: string, config: MutatedAssetConfig, seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    // Castle tower
    const towerGeo = new THREE.CylinderGeometry(1, 1.2, 5, 8);
    const stoneMat = new THREE.MeshStandardMaterial({
        color: shiftColor(0x5a5a5a, config.colorShift),
        roughness: 0.9,
    });
    const tower = new THREE.Mesh(towerGeo, stoneMat);
    tower.position.y = 2.5;
    group.add(tower);

    // Roof
    const roofGeo = new THREE.ConeGeometry(1.3, 1.5, 8);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.8 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 5.75;
    group.add(roof);

    // Battlements
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const battGeo = new THREE.BoxGeometry(0.3, 0.4, 0.2);
        const batt = new THREE.Mesh(battGeo, stoneMat);
        batt.position.set(Math.cos(angle) * 1.1, 5.2, Math.sin(angle) * 1.1);
        group.add(batt);
    }

    group.scale.copy(config.scale);
    group.rotation.copy(config.rotationOffset);
    return group;
}

function createRenaissanceAsset(type: string, config: MutatedAssetConfig, seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    switch (type) {
        case 'cypress_tree':
            createLSystemTree(group, config, random, 'cypress');
            break;
        case 'garden':
            createLSystemTree(group, config, random, 'garden_tree');
            break;
        default: {
            // Dome building (palazzo, dome, fountain, sculpture, archway)
            const baseGeo = new THREE.BoxGeometry(3, 2, 3);
            const stuccoMat = new THREE.MeshStandardMaterial({
                color: shiftColor(0xf5e6d3, config.colorShift),
                roughness: 0.6,
            });
            const base = new THREE.Mesh(baseGeo, stuccoMat);
            base.position.y = 1;
            group.add(base);

            const domeGeo = new THREE.SphereGeometry(1.8, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
            const domeMat = new THREE.MeshStandardMaterial({
                color: 0xc87533,
                roughness: 0.7,
            });
            const dome = new THREE.Mesh(domeGeo, domeMat);
            dome.position.y = 2;
            group.add(dome);
            break;
        }
    }

    group.scale.copy(config.scale);
    group.rotation.copy(config.rotationOffset);
    return group;
}

function createIndustrialAsset(type: string, config: MutatedAssetConfig, seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    // Factory with smokestack
    const factoryGeo = new THREE.BoxGeometry(4, 3, 3);
    const brickMat = new THREE.MeshStandardMaterial({
        color: shiftColor(0x8b4513, config.colorShift),
        roughness: 0.9,
    });
    const factory = new THREE.Mesh(factoryGeo, brickMat);
    factory.position.y = 1.5;
    group.add(factory);

    // Smokestack
    const stackGeo = new THREE.CylinderGeometry(0.4, 0.5, 5, 8);
    const stack = new THREE.Mesh(stackGeo, brickMat);
    stack.position.set(1.5, 4, 0);
    group.add(stack);

    // Smoke
    const smokeGeo = new THREE.SphereGeometry(0.8, 8, 8);
    const smokeMat = new THREE.MeshStandardMaterial({
        color: 0x404040,
        transparent: true,
        opacity: 0.6,
    });
    for (let i = 0; i < 3; i++) {
        const smoke = new THREE.Mesh(smokeGeo, smokeMat);
        smoke.position.set(1.5 + random() * 0.5, 6.5 + i * 1.2, random() * 0.5);
        smoke.scale.setScalar(0.8 + i * 0.3);
        group.add(smoke);
    }

    group.scale.copy(config.scale);
    group.rotation.copy(config.rotationOffset);
    return group;
}

// =============================================================================
// ERA 9-12: Modern to Cyberpunk
// =============================================================================

function createModernAsset(type: string, config: MutatedAssetConfig, seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    // Art deco building
    const buildingGeo = new THREE.BoxGeometry(2, 6, 2);
    const concreteMat = new THREE.MeshStandardMaterial({
        color: shiftColor(0xc0b8a8, config.colorShift),
        roughness: 0.5,
    });
    const building = new THREE.Mesh(buildingGeo, concreteMat);
    building.position.y = 3;
    group.add(building);

    // Neon sign
    const signGeo = new THREE.BoxGeometry(1.5, 0.3, 0.1);
    const neonMat = new THREE.MeshStandardMaterial({
        color: 0xff0080,
        emissive: 0xff0080,
        emissiveIntensity: 1,
    });
    const sign = new THREE.Mesh(signGeo, neonMat);
    sign.position.set(0, 4, 1.1);
    group.add(sign);

    group.scale.copy(config.scale);
    group.rotation.copy(config.rotationOffset);
    return group;
}

function createDigitalAsset(type: string, config: MutatedAssetConfig, seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    // Glass tower
    const towerGeo = new THREE.BoxGeometry(2, 8, 2);
    const glassMat = new THREE.MeshStandardMaterial({
        color: shiftColor(0x4080c0, config.colorShift),
        roughness: 0.1,
        metalness: 0.8,
        transparent: true,
        opacity: 0.7,
    });
    const tower = new THREE.Mesh(towerGeo, glassMat);
    tower.position.y = 4;
    group.add(tower);

    // LED strips
    for (let i = 0; i < 5; i++) {
        const stripGeo = new THREE.BoxGeometry(2.1, 0.05, 0.1);
        const ledMat = new THREE.MeshStandardMaterial({
            color: 0x00ff80,
            emissive: 0x00ff80,
            emissiveIntensity: 1.5,
        });
        const strip = new THREE.Mesh(stripGeo, ledMat);
        strip.position.set(0, 1 + i * 1.5, 1.05);
        group.add(strip);
    }

    group.scale.copy(config.scale);
    group.rotation.copy(config.rotationOffset);
    return group;
}

function createNearFutureAsset(type: string, config: MutatedAssetConfig, seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    // Eco tower with vegetation
    const towerGeo = new THREE.CylinderGeometry(1.5, 2, 7, 12);
    const whiteMat = new THREE.MeshStandardMaterial({
        color: shiftColor(0xf0f0f0, config.colorShift),
        roughness: 0.3,
    });
    const tower = new THREE.Mesh(towerGeo, whiteMat);
    tower.position.y = 3.5;
    group.add(tower);

    // Green terraces
    for (let i = 0; i < 4; i++) {
        const terrace = new THREE.Mesh(
            new THREE.TorusGeometry(1.6 + i * 0.1, 0.2, 8, 16),
            new THREE.MeshStandardMaterial({ color: 0x40a040, roughness: 0.7 })
        );
        terrace.position.y = 1 + i * 1.5;
        terrace.rotation.x = Math.PI / 2;
        group.add(terrace);
    }

    group.scale.copy(config.scale);
    group.rotation.copy(config.rotationOffset);
    return group;
}

function createCyberpunkAsset(type: string, config: MutatedAssetConfig, seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    // Megacity block
    const heights = [8, 12, 6, 10];
    const neonColors = [0xff00ff, 0x00ffff, 0xff0080, 0x80ff00];

    heights.forEach((h, i) => {
        const blockGeo = new THREE.BoxGeometry(1.5, h, 1.5);
        const darkMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a2a,
            roughness: 0.3,
            metalness: 0.7,
        });
        const block = new THREE.Mesh(blockGeo, darkMat);
        block.position.set((i - 1.5) * 1.8, h / 2, 0);
        group.add(block);

        // Neon strips
        const neonGeo = new THREE.BoxGeometry(1.6, 0.1, 0.05);
        const neonMat = new THREE.MeshStandardMaterial({
            color: neonColors[i],
            emissive: neonColors[i],
            emissiveIntensity: 2,
        });
        for (let j = 0; j < 3; j++) {
            const neon = new THREE.Mesh(neonGeo, neonMat);
            neon.position.set((i - 1.5) * 1.8, 2 + j * 3, 0.8);
            group.add(neon);
        }
    });

    group.scale.copy(config.scale);
    group.rotation.copy(config.rotationOffset);
    return group;
}

// =============================================================================
// ERA 13-20: Space to Type III
// =============================================================================

function createSpaceAgeAsset(type: string, config: MutatedAssetConfig, seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    // Rocket
    const rocketGeo = new THREE.CylinderGeometry(0.3, 0.5, 4, 12);
    const metalMat = new THREE.MeshStandardMaterial({
        color: 0xd0d0d0,
        roughness: 0.2,
        metalness: 0.9,
    });
    const rocket = new THREE.Mesh(rocketGeo, metalMat);
    rocket.position.y = 2;
    group.add(rocket);

    // Nose cone
    const noseGeo = new THREE.ConeGeometry(0.3, 1, 12);
    const nose = new THREE.Mesh(noseGeo, metalMat);
    nose.position.y = 4.5;
    group.add(nose);

    // Fins
    for (let i = 0; i < 4; i++) {
        const finGeo = new THREE.BoxGeometry(0.6, 1, 0.1);
        const fin = new THREE.Mesh(finGeo, metalMat);
        const angle = (i / 4) * Math.PI * 2;
        fin.position.set(Math.cos(angle) * 0.5, 0.5, Math.sin(angle) * 0.5);
        fin.rotation.y = angle;
        group.add(fin);
    }

    // Engine glow
    const glowGeo = new THREE.ConeGeometry(0.4, 1.5, 12);
    const glowMat = new THREE.MeshStandardMaterial({
        color: 0xff6600,
        emissive: 0xff4400,
        emissiveIntensity: 3,
        transparent: true,
        opacity: 0.8,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = -0.5;
    glow.rotation.x = Math.PI;
    group.add(glow);

    group.scale.copy(config.scale);
    group.rotation.copy(config.rotationOffset);
    return group;
}

function createLunarAsset(type: string, config: MutatedAssetConfig, seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    // Moon dome
    const domeGeo = new THREE.SphereGeometry(2, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshStandardMaterial({
        color: shiftColor(0xf0f0f0, config.colorShift),
        roughness: 0.2,
        metalness: 0.3,
        transparent: true,
        opacity: 0.6,
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    group.add(dome);

    // Base ring
    const ringGeo = new THREE.TorusGeometry(2, 0.3, 8, 24);
    const metalMat = new THREE.MeshStandardMaterial({
        color: 0xc0c0c0,
        roughness: 0.3,
        metalness: 0.8,
    });
    const ring = new THREE.Mesh(ringGeo, metalMat);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    group.scale.copy(config.scale);
    group.rotation.copy(config.rotationOffset);
    return group;
}

function createMarsAsset(type: string, config: MutatedAssetConfig, seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    // Terraformer
    const baseGeo = new THREE.CylinderGeometry(1.5, 2, 1, 12);
    const metalMat = new THREE.MeshStandardMaterial({
        color: 0x808080,
        roughness: 0.4,
        metalness: 0.7,
    });
    const base = new THREE.Mesh(baseGeo, metalMat);
    base.position.y = 0.5;
    group.add(base);

    // Energy beam
    const beamGeo = new THREE.CylinderGeometry(0.3, 0.1, 6, 8);
    const beamMat = new THREE.MeshStandardMaterial({
        color: 0x40ff80,
        emissive: 0x20ff40,
        emissiveIntensity: 2,
        transparent: true,
        opacity: 0.7,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 4;
    group.add(beam);

    group.scale.copy(config.scale);
    group.rotation.copy(config.rotationOffset);
    return group;
}

function createSolarSystemAsset(type: string, config: MutatedAssetConfig, seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    // Asteroid station
    const asteroidGeo = new THREE.IcosahedronGeometry(2, 1);
    const rockMat = new THREE.MeshStandardMaterial({
        color: 0x5a5a5a,
        roughness: 1,
        flatShading: true,
    });
    const asteroid = new THREE.Mesh(asteroidGeo, rockMat);
    group.add(asteroid);

    // Mining structures
    for (let i = 0; i < 3; i++) {
        const structGeo = new THREE.BoxGeometry(0.5, 0.8, 0.5);
        const metalMat = new THREE.MeshStandardMaterial({
            color: 0xc0c0c0,
            roughness: 0.3,
            metalness: 0.8,
        });
        const struct = new THREE.Mesh(structGeo, metalMat);
        const angle = (i / 3) * Math.PI * 2;
        struct.position.set(Math.cos(angle) * 2.2, random() * 0.5, Math.sin(angle) * 2.2);
        group.add(struct);
    }

    group.scale.copy(config.scale);
    group.rotation.copy(config.rotationOffset);
    return group;
}

function createType1Asset(type: string, config: MutatedAssetConfig, seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    // Dyson mirror
    const mirrorGeo = new THREE.RingGeometry(1, 3, 32);
    const mirrorMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.1,
        metalness: 1,
        emissive: 0xffffaa,
        emissiveIntensity: 0.5,
        side: THREE.DoubleSide,
    });
    const mirror = new THREE.Mesh(mirrorGeo, mirrorMat);
    mirror.rotation.x = Math.PI / 4;
    group.add(mirror);

    // Energy beam
    const beamGeo = new THREE.CylinderGeometry(0.5, 0.2, 8, 8);
    const beamMat = new THREE.MeshStandardMaterial({
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 2,
        transparent: true,
        opacity: 0.6,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = -4;
    beam.rotation.z = Math.PI / 4;
    group.add(beam);

    group.scale.copy(config.scale);
    group.rotation.copy(config.rotationOffset);
    return group;
}

function createType2Asset(type: string, config: MutatedAssetConfig, seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    // Dyson sphere segment
    const sphereGeo = new THREE.SphereGeometry(3, 32, 32, 0, Math.PI / 2, 0, Math.PI / 2);
    const sphereMat = new THREE.MeshStandardMaterial({
        color: 0x4040a0,
        roughness: 0.2,
        metalness: 0.9,
        emissive: 0x2020a0,
        emissiveIntensity: 0.5,
        side: THREE.DoubleSide,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    group.add(sphere);

    // Star glow at center
    const starGeo = new THREE.SphereGeometry(1, 16, 16);
    const starMat = new THREE.MeshStandardMaterial({
        color: 0xffffaa,
        emissive: 0xffff00,
        emissiveIntensity: 5,
    });
    const star = new THREE.Mesh(starGeo, starMat);
    group.add(star);

    group.scale.copy(config.scale);
    group.rotation.copy(config.rotationOffset);
    return group;
}

function createType25Asset(type: string, config: MutatedAssetConfig, seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    // Interstellar ship
    const hullGeo = new THREE.CylinderGeometry(0.5, 1.5, 6, 8);
    const hullMat = new THREE.MeshStandardMaterial({
        color: 0xa0a0c0,
        roughness: 0.2,
        metalness: 0.9,
        emissive: 0x4040a0,
        emissiveIntensity: 0.3,
    });
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.rotation.x = Math.PI / 2;
    group.add(hull);

    // Engine glow
    const engineGeo = new THREE.SphereGeometry(0.8, 16, 16);
    const engineMat = new THREE.MeshStandardMaterial({
        color: 0xff80ff,
        emissive: 0xff00ff,
        emissiveIntensity: 4,
        transparent: true,
        opacity: 0.7,
    });
    const engine = new THREE.Mesh(engineGeo, engineMat);
    engine.position.z = -3.5;
    engine.scale.z = 2;
    group.add(engine);

    group.scale.copy(config.scale);
    group.rotation.copy(config.rotationOffset);
    return group;
}

function createType3Asset(type: string, config: MutatedAssetConfig, seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    // Galactic structure
    const coreGeo = new THREE.SphereGeometry(2, 32, 32);
    const coreMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 3,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // Spiral arms
    for (let arm = 0; arm < 4; arm++) {
        const armAngle = (arm / 4) * Math.PI * 2;
        for (let i = 0; i < 20; i++) {
            const t = i / 20;
            const spiralAngle = armAngle + t * Math.PI * 1.5;
            const radius = 2 + t * 6;

            const starGeo = new THREE.SphereGeometry(0.1 + random() * 0.15, 6, 6);
            const starMat = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                emissive: 0xaaaaff,
                emissiveIntensity: 1 + random(),
            });
            const star = new THREE.Mesh(starGeo, starMat);
            star.position.set(
                Math.cos(spiralAngle) * radius,
                (random() - 0.5) * 0.5,
                Math.sin(spiralAngle) * radius
            );
            group.add(star);
        }
    }

    group.scale.copy(config.scale);
    group.rotation.copy(config.rotationOffset);
    return group;
}

function createGenericAsset(config: MutatedAssetConfig): THREE.Group {
    const group = new THREE.Group();

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x808080 });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);

    group.scale.copy(config.scale);
    return group;
}

// src/eraBuildings.ts
// High-Quality Era-Specific Building Generators
// Uses proper 3D modeling techniques: LatheGeometry, ExtrudeGeometry, BufferGeometry

import * as THREE from 'three';

// =============================================================================
// SHARED MATERIALS - PBR with proper roughness/metalness
// =============================================================================

// Stone materials
const createStoneMaterial = (color: number, roughness = 0.85) => new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness: 0.0,
    clearcoat: 0.05,
});

const MATERIALS = {
    // Ancient stone
    ancientStone: createStoneMaterial(0x8a8a7a, 0.9),
    limestone: createStoneMaterial(0xd4c8a8, 0.75),
    sandstone: createStoneMaterial(0xc4a060, 0.8),
    granite: createStoneMaterial(0x6a6a6a, 0.7),

    // Marble - polished
    marbleWhite: new THREE.MeshPhysicalMaterial({
        color: 0xf5f0e8,
        roughness: 0.15,
        metalness: 0.0,
        clearcoat: 0.3,
        clearcoatRoughness: 0.1,
    }),
    marbleGray: new THREE.MeshPhysicalMaterial({
        color: 0xb0a8a0,
        roughness: 0.2,
        metalness: 0.0,
        clearcoat: 0.2,
    }),

    // Medieval
    castleStone: createStoneMaterial(0x5a5a50, 0.9),
    darkStone: createStoneMaterial(0x3a3a35, 0.85),
    woodDark: new THREE.MeshPhysicalMaterial({
        color: 0x3d2817,
        roughness: 0.7,
        metalness: 0.0,
    }),
    woodLight: new THREE.MeshPhysicalMaterial({
        color: 0x8b6914,
        roughness: 0.65,
        metalness: 0.0,
    }),
    thatch: new THREE.MeshPhysicalMaterial({
        color: 0x8b7355,
        roughness: 0.95,
        metalness: 0.0,
    }),

    // Roof materials
    roofTile: new THREE.MeshPhysicalMaterial({
        color: 0x8b4513,
        roughness: 0.7,
        metalness: 0.0,
    }),
    roofSlate: new THREE.MeshPhysicalMaterial({
        color: 0x4a4a4a,
        roughness: 0.6,
        metalness: 0.1,
    }),
    roofCopper: new THREE.MeshPhysicalMaterial({
        color: 0x5a8a6a,
        roughness: 0.4,
        metalness: 0.6,
    }),

    // Renaissance
    terracotta: new THREE.MeshPhysicalMaterial({
        color: 0xc45a30,
        roughness: 0.6,
        metalness: 0.0,
    }),
    plaster: new THREE.MeshPhysicalMaterial({
        color: 0xf0e8d8,
        roughness: 0.5,
        metalness: 0.0,
    }),
    gold: new THREE.MeshPhysicalMaterial({
        color: 0xffd700,
        roughness: 0.2,
        metalness: 0.9,
    }),

    // Window/door darkness
    windowDark: new THREE.MeshBasicMaterial({ color: 0x1a1a1a }),
};

// =============================================================================
// ERA 3: STONE AGE (50,000 BC)
// =============================================================================

/**
 * Stonehenge-style megalith standing stones
 * Uses LatheGeometry for organic, slightly tapered shape
 */
export function createMegalith(seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    // Create standing stone using LatheGeometry for organic shape
    const height = 4 + random() * 3;
    const baseRadius = 0.6 + random() * 0.3;

    // Irregular stone profile
    const points: THREE.Vector2[] = [];
    const segments = 8;
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const y = t * height;
        // Taper toward top with random wobble
        let r = baseRadius * (1 - t * 0.4) + (random() - 0.5) * 0.15;
        if (i === segments) r = baseRadius * 0.3; // Narrow top
        points.push(new THREE.Vector2(r, y));
    }

    const stoneGeo = new THREE.LatheGeometry(points, 8);
    const stone = new THREE.Mesh(stoneGeo, MATERIALS.ancientStone);
    stone.castShadow = true;
    stone.receiveShadow = true;

    // Slight random tilt for weathered look
    stone.rotation.x = (random() - 0.5) * 0.1;
    stone.rotation.z = (random() - 0.5) * 0.1;

    group.add(stone);

    // Add moss patches using simple geometry
    if (random() > 0.5) {
        const mossMat = new THREE.MeshStandardMaterial({
            color: 0x3a5a3a,
            roughness: 0.95,
        });
        const mossGeo = new THREE.SphereGeometry(0.3, 8, 8);
        mossGeo.scale(1, 0.3, 1);
        const moss = new THREE.Mesh(mossGeo, mossMat);
        moss.position.set(
            (random() - 0.5) * baseRadius,
            random() * height * 0.5,
            baseRadius * 0.8
        );
        group.add(moss);
    }

    return group;
}

/**
 * Stonehenge-style stone circle - massive iconic monument in the distance
 * Creates the famous trilithon arrangement with outer circle
 */
export function createStonehenge(seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    const stoneMat = MATERIALS.ancientStone.clone();
    stoneMat.color.setHex(0x7a7a6a + Math.floor(random() * 0x101010));

    // Outer circle of standing stones (sarsen circle)
    const outerRadius = 8;
    const outerStoneCount = 12;
    for (let i = 0; i < outerStoneCount; i++) {
        const angle = (i / outerStoneCount) * Math.PI * 2;
        const x = Math.cos(angle) * outerRadius;
        const z = Math.sin(angle) * outerRadius;
        
        // Standing stone
        const height = 4 + random() * 0.5;
        const stoneGeo = new THREE.BoxGeometry(1.2, height, 0.8);
        const stone = new THREE.Mesh(stoneGeo, stoneMat);
        stone.position.set(x, height / 2, z);
        stone.rotation.y = angle + Math.PI / 2;
        stone.castShadow = true;
        stone.receiveShadow = true;
        group.add(stone);
    }

    // Lintel stones connecting the outer circle
    for (let i = 0; i < outerStoneCount; i++) {
        const angle1 = (i / outerStoneCount) * Math.PI * 2;
        const angle2 = ((i + 1) / outerStoneCount) * Math.PI * 2;
        const x1 = Math.cos(angle1) * outerRadius;
        const z1 = Math.sin(angle1) * outerRadius;
        const x2 = Math.cos(angle2) * outerRadius;
        const z2 = Math.sin(angle2) * outerRadius;
        
        const lintelLength = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
        const lintelGeo = new THREE.BoxGeometry(lintelLength + 0.4, 0.6, 0.9);
        const lintel = new THREE.Mesh(lintelGeo, stoneMat);
        lintel.position.set((x1 + x2) / 2, 4.3, (z1 + z2) / 2);
        lintel.rotation.y = Math.atan2(z2 - z1, x2 - x1);
        lintel.castShadow = true;
        group.add(lintel);
    }

    // Inner horseshoe of trilithons (5 massive pairs)
    const innerRadius = 4.5;
    const trilithonAngles = [-0.8, -0.4, 0, 0.4, 0.8]; // Horseshoe arrangement
    for (const angleOffset of trilithonAngles) {
        const angle = angleOffset;
        const x = Math.sin(angle) * innerRadius;
        const z = -Math.cos(angle) * innerRadius;
        
        // Two tall uprights
        const height = 6 + random() * 0.5;
        for (let side = -1; side <= 1; side += 2) {
            const uprightGeo = new THREE.BoxGeometry(1.5, height, 1);
            const upright = new THREE.Mesh(uprightGeo, stoneMat);
            const offsetX = Math.cos(angle + Math.PI / 2) * side * 1.2;
            const offsetZ = Math.sin(angle + Math.PI / 2) * side * 1.2;
            upright.position.set(x + offsetX, height / 2, z + offsetZ);
            upright.rotation.y = angle;
            upright.castShadow = true;
            upright.receiveShadow = true;
            group.add(upright);
        }
        
        // Lintel on top
        const lintelGeo = new THREE.BoxGeometry(4, 0.8, 1.2);
        const lintel = new THREE.Mesh(lintelGeo, stoneMat);
        lintel.position.set(x, height + 0.4, z);
        lintel.rotation.y = angle + Math.PI / 2;
        lintel.castShadow = true;
        group.add(lintel);
    }

    // Central altar stone
    const altarGeo = new THREE.BoxGeometry(3, 0.6, 1.5);
    const altar = new THREE.Mesh(altarGeo, stoneMat);
    altar.position.set(0, 0.3, 0);
    altar.receiveShadow = true;
    group.add(altar);

    return group;
}

/**
 * Dolmen - prehistoric stone tomb/burial chamber
 * Three or more upright stones supporting a flat capstone
 */
export function createDolmen(seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    const stoneMat = MATERIALS.ancientStone.clone();
    stoneMat.color.setHex(0x6a6a5a + Math.floor(random() * 0x151515));

    // Variation: 3-4 support stones
    const supportCount = 3 + (random() > 0.5 ? 1 : 0);
    const radius = 1.2 + random() * 0.3;
    const supportHeight = 1.8 + random() * 0.6;

    // Support stones (uprights)
    for (let i = 0; i < supportCount; i++) {
        const angle = (i / supportCount) * Math.PI * 2 + random() * 0.2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        
        // Irregular slab shape
        const width = 0.8 + random() * 0.4;
        const depth = 0.3 + random() * 0.2;
        const height = supportHeight + (random() - 0.5) * 0.3;
        
        const supportGeo = new THREE.BoxGeometry(width, height, depth);
        const support = new THREE.Mesh(supportGeo, stoneMat);
        support.position.set(x, height / 2, z);
        support.rotation.y = angle + Math.PI / 2 + (random() - 0.5) * 0.2;
        // Slight lean for weathered look
        support.rotation.x = (random() - 0.5) * 0.1;
        support.rotation.z = (random() - 0.5) * 0.1;
        support.castShadow = true;
        support.receiveShadow = true;
        group.add(support);
    }

    // Capstone (large flat stone on top)
    const capWidth = 2.5 + random() * 0.5;
    const capDepth = 2 + random() * 0.5;
    const capThickness = 0.4 + random() * 0.2;
    
    // Use beveled box for more natural stone look
    const capShape = new THREE.Shape();
    const hw = capWidth / 2;
    const hd = capDepth / 2;
    capShape.moveTo(-hw + 0.1, -hd);
    capShape.lineTo(hw - 0.1, -hd);
    capShape.lineTo(hw, -hd + 0.1);
    capShape.lineTo(hw, hd - 0.1);
    capShape.lineTo(hw - 0.1, hd);
    capShape.lineTo(-hw + 0.1, hd);
    capShape.lineTo(-hw, hd - 0.1);
    capShape.lineTo(-hw, -hd + 0.1);
    capShape.closePath();
    
    const capGeo = new THREE.ExtrudeGeometry(capShape, {
        depth: capThickness,
        bevelEnabled: false,
    });
    capGeo.rotateX(-Math.PI / 2);
    
    const capstone = new THREE.Mesh(capGeo, stoneMat);
    capstone.position.set(0, supportHeight + capThickness / 2, 0);
    // Slight tilt for natural look
    capstone.rotation.x = (random() - 0.5) * 0.05;
    capstone.rotation.z = (random() - 0.5) * 0.05;
    capstone.castShadow = true;
    capstone.receiveShadow = true;
    group.add(capstone);

    return group;
}

/**
 * Cave dwelling - rock formation with cave opening
 * Uses multiple spheres sculpted together
 */
export function createCaveDwelling(seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    // Main rock formation - multiple merged-looking spheres
    const rockMat = MATERIALS.granite.clone();
    rockMat.color.setHex(0x5a5a50 + Math.floor(random() * 0x101010));

    // Base rock mound
    const baseGeo = new THREE.SphereGeometry(3, 16, 12);
    baseGeo.scale(1.5, 0.8, 1.2);
    const base = new THREE.Mesh(baseGeo, rockMat);
    base.position.y = 1.5;
    base.castShadow = true;
    group.add(base);

    // Additional rock bumps
    for (let i = 0; i < 5; i++) {
        const bumpGeo = new THREE.SphereGeometry(1 + random() * 1.5, 12, 10);
        bumpGeo.scale(1, 0.7 + random() * 0.4, 1);
        const bump = new THREE.Mesh(bumpGeo, rockMat);
        bump.position.set(
            (random() - 0.5) * 3,
            1 + random() * 2,
            (random() - 0.5) * 2
        );
        bump.castShadow = true;
        group.add(bump);
    }

    // Cave entrance - dark opening
    const caveGeo = new THREE.CircleGeometry(1.2, 16);
    const cave = new THREE.Mesh(caveGeo, MATERIALS.windowDark);
    cave.position.set(0, 1.2, 1.9);
    group.add(cave);

    // Add entrance arch detail
    const archGeo = new THREE.TorusGeometry(1.3, 0.2, 8, 16, Math.PI);
    const arch = new THREE.Mesh(archGeo, rockMat);
    arch.position.set(0, 1.2, 1.85);
    arch.rotation.z = Math.PI / 2;
    group.add(arch);

    return group;
}

/**
 * Primitive shelter - A-frame thatched lean-to
 */
export function createPrimitiveShelter(seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    const width = 2 + random() * 1;
    const height = 2 + random() * 0.5;
    const depth = 3 + random() * 1;

    // Main wooden poles forming A-frame
    const poleMat = MATERIALS.woodDark;
    const poleRadius = 0.08;

    // Front A-frame poles
    const poleGeo = new THREE.CylinderGeometry(poleRadius, poleRadius * 1.2, height * 1.4, 6);

    const leftPole = new THREE.Mesh(poleGeo, poleMat);
    leftPole.position.set(-width / 2, height * 0.65, depth / 2);
    leftPole.rotation.z = 0.35;
    leftPole.castShadow = true;
    group.add(leftPole);

    const rightPole = new THREE.Mesh(poleGeo, poleMat);
    rightPole.position.set(width / 2, height * 0.65, depth / 2);
    rightPole.rotation.z = -0.35;
    rightPole.castShadow = true;
    group.add(rightPole);

    // Ridge pole
    const ridgeGeo = new THREE.CylinderGeometry(poleRadius, poleRadius, depth, 6);
    const ridge = new THREE.Mesh(ridgeGeo, poleMat);
    ridge.rotation.x = Math.PI / 2;
    ridge.position.set(0, height, 0);
    ridge.castShadow = true;
    group.add(ridge);

    // Thatch covering - using extruded triangle
    const thatchShape = new THREE.Shape();
    thatchShape.moveTo(0, height);
    thatchShape.lineTo(-width * 0.7, 0);
    thatchShape.lineTo(width * 0.7, 0);
    thatchShape.closePath();

    const thatchGeo = new THREE.ExtrudeGeometry(thatchShape, {
        depth: depth,
        bevelEnabled: false,
    });
    const thatch = new THREE.Mesh(thatchGeo, MATERIALS.thatch);
    thatch.position.z = -depth / 2;
    thatch.castShadow = true;
    thatch.receiveShadow = true;
    group.add(thatch);

    return group;
}

/**
 * Burning Campfire - Stone Age fire with animated flames and glowing embers
 * Includes point light for dynamic illumination
 */
export function createCampfire(seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    // Fire pit - ring of stones
    const stoneMat = MATERIALS.ancientStone.clone();
    stoneMat.color.setHex(0x4a4a40);
    
    const stoneCount = 8 + Math.floor(random() * 4);
    const pitRadius = 0.6 + random() * 0.2;
    
    for (let i = 0; i < stoneCount; i++) {
        const angle = (i / stoneCount) * Math.PI * 2;
        const stoneSize = 0.15 + random() * 0.1;
        const stoneGeo = new THREE.SphereGeometry(stoneSize, 6, 5);
        stoneGeo.scale(1, 0.6, 1); // Flatten stones
        const stone = new THREE.Mesh(stoneGeo, stoneMat);
        stone.position.set(
            Math.cos(angle) * pitRadius,
            stoneSize * 0.3,
            Math.sin(angle) * pitRadius
        );
        stone.rotation.set(random() * 0.3, random() * Math.PI, random() * 0.3);
        stone.castShadow = true;
        stone.receiveShadow = true;
        group.add(stone);
    }

    // Charred logs inside
    const logMat = new THREE.MeshStandardMaterial({
        color: 0x1a1008,
        roughness: 1,
        emissive: 0x331100,
        emissiveIntensity: 0.3,
    });
    
    const logCount = 3 + Math.floor(random() * 2);
    for (let i = 0; i < logCount; i++) {
        const logGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.8 + random() * 0.3, 6);
        const log = new THREE.Mesh(logGeo, logMat);
        const angle = (i / logCount) * Math.PI * 2 + random() * 0.5;
        log.position.set(
            Math.cos(angle) * 0.15,
            0.1,
            Math.sin(angle) * 0.15
        );
        log.rotation.z = Math.PI / 2 + (random() - 0.5) * 0.5;
        log.rotation.y = angle;
        group.add(log);
    }

    // Glowing embers at base
    const emberMat = new THREE.MeshStandardMaterial({
        color: 0xff2200,
        emissive: 0xff4400,
        emissiveIntensity: 2,
        transparent: true,
        opacity: 0.9,
    });
    const emberGeo = new THREE.SphereGeometry(0.25, 8, 6);
    emberGeo.scale(1, 0.3, 1);
    const embers = new THREE.Mesh(emberGeo, emberMat);
    embers.position.y = 0.08;
    group.add(embers);

    // Main flames - multiple overlapping cones for realistic fire shape
    const flameMat = new THREE.MeshStandardMaterial({
        color: 0xff6600,
        emissive: 0xff4400,
        emissiveIntensity: 3,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
    });
    
    const flameInnerMat = new THREE.MeshStandardMaterial({
        color: 0xffcc00,
        emissive: 0xffaa00,
        emissiveIntensity: 4,
        transparent: true,
        opacity: 0.9,
    });

    // Center tall flame
    const mainFlameGeo = new THREE.ConeGeometry(0.25, 1.2 + random() * 0.3, 8);
    const mainFlame = new THREE.Mesh(mainFlameGeo, flameMat);
    mainFlame.position.y = 0.7;
    mainFlame.userData.isFlame = true;
    mainFlame.userData.flameSpeed = 8 + random() * 4;
    mainFlame.userData.flamePhase = random() * Math.PI * 2;
    mainFlame.userData.baseY = 0.7;
    mainFlame.userData.baseScale = 1;
    group.add(mainFlame);

    // Inner bright flame
    const innerFlameGeo = new THREE.ConeGeometry(0.12, 0.8, 6);
    const innerFlame = new THREE.Mesh(innerFlameGeo, flameInnerMat);
    innerFlame.position.y = 0.55;
    innerFlame.userData.isFlame = true;
    innerFlame.userData.flameSpeed = 10 + random() * 5;
    innerFlame.userData.flamePhase = random() * Math.PI * 2;
    innerFlame.userData.baseY = 0.55;
    innerFlame.userData.baseScale = 1;
    group.add(innerFlame);

    // Side flames (smaller, dancing)
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + random() * 0.5;
        const dist = 0.12 + random() * 0.08;
        const height = 0.5 + random() * 0.4;
        
        const sideFlameGeo = new THREE.ConeGeometry(0.1 + random() * 0.05, height, 6);
        const sideFlame = new THREE.Mesh(sideFlameGeo, flameMat);
        sideFlame.position.set(
            Math.cos(angle) * dist,
            0.35 + height / 2,
            Math.sin(angle) * dist
        );
        sideFlame.rotation.x = (random() - 0.5) * 0.3;
        sideFlame.rotation.z = (random() - 0.5) * 0.3;
        sideFlame.userData.isFlame = true;
        sideFlame.userData.flameSpeed = 6 + random() * 6;
        sideFlame.userData.flamePhase = random() * Math.PI * 2;
        sideFlame.userData.baseY = sideFlame.position.y;
        sideFlame.userData.baseScale = 1;
        group.add(sideFlame);
    }

    // Point light for fire glow
    const fireLight = new THREE.PointLight(0xff6622, 2.5, 15, 1.5);
    fireLight.position.set(0, 0.8, 0);
    fireLight.castShadow = true;
    fireLight.shadow.mapSize.width = 512;
    fireLight.shadow.mapSize.height = 512;
    fireLight.userData.isFireLight = true;
    fireLight.userData.baseIntensity = 2.5;
    group.add(fireLight);

    // Mark group for animation
    group.userData.isCampfire = true;

    return group;
}

// =============================================================================
// ERA 4: BRONZE AGE (3000 BC)
// =============================================================================

/**
 * Ziggurat - Mesopotamian stepped temple
 * Uses stacked boxes with proper proportions
 */
export function createZiggurat(seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    const levels = 5 + Math.floor(random() * 3);
    const baseSize = 12 + random() * 6;
    const stepHeight = 1.5 + random() * 0.5;

    // Create brick material with subtle color variation
    const brickMat = new THREE.MeshPhysicalMaterial({
        color: 0xa08050 + Math.floor(random() * 0x101010),
        roughness: 0.85,
        metalness: 0.0,
    });

    let currentSize = baseSize;
    let currentY = 0;

    for (let i = 0; i < levels; i++) {
        const geo = new THREE.BoxGeometry(currentSize, stepHeight, currentSize);
        const step = new THREE.Mesh(geo, brickMat);
        step.position.y = currentY + stepHeight / 2;
        step.castShadow = true;
        step.receiveShadow = true;
        group.add(step);

        // Add stairway on front
        if (i < levels - 1) {
            const stairWidth = currentSize * 0.15;
            const stairGeo = new THREE.BoxGeometry(stairWidth, stepHeight * 0.95, currentSize * 0.15);
            const stair = new THREE.Mesh(stairGeo, brickMat);
            stair.position.set(0, currentY + stepHeight / 2, currentSize / 2 + stairWidth * 0.3);
            stair.castShadow = true;
            group.add(stair);
        }

        currentY += stepHeight;
        currentSize *= 0.8; // Each level smaller
    }

    // Temple at top
    const templeGeo = new THREE.BoxGeometry(currentSize * 0.6, stepHeight * 1.5, currentSize * 0.6);
    const temple = new THREE.Mesh(templeGeo, brickMat);
    temple.position.y = currentY + stepHeight * 0.75;
    temple.castShadow = true;
    group.add(temple);

    return group;
}

/**
 * Pyramid - Egyptian style with smooth faces
 */
export function createPyramid(seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    const baseSize = 15 + random() * 10;
    const height = baseSize * (0.6 + random() * 0.2);

    // Main pyramid geometry
    const pyramidGeo = new THREE.ConeGeometry(baseSize / Math.SQRT2, height, 4);
    pyramidGeo.rotateY(Math.PI / 4); // Align edges with axes

    const pyramidMat = new THREE.MeshPhysicalMaterial({
        color: 0xe0c890,
        roughness: 0.6,
        metalness: 0.0,
        clearcoat: 0.1,
    });

    const pyramid = new THREE.Mesh(pyramidGeo, pyramidMat);
    pyramid.position.y = height / 2;
    pyramid.castShadow = true;
    pyramid.receiveShadow = true;
    group.add(pyramid);

    // Capstone (pyramidion) - slightly shinier
    const capSize = baseSize * 0.08;
    const capHeight = height * 0.06;
    const capGeo = new THREE.ConeGeometry(capSize / Math.SQRT2, capHeight, 4);
    capGeo.rotateY(Math.PI / 4);

    const capMat = new THREE.MeshPhysicalMaterial({
        color: 0xffd700,
        roughness: 0.3,
        metalness: 0.7,
    });

    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = height - capHeight / 2 + 0.1;
    group.add(cap);

    return group;
}

/**
 * Obelisk - Tall stone monument with inscriptions
 */
export function createObelisk(seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    const height = 8 + random() * 6;
    const baseWidth = height * 0.08;

    // Main shaft - tapered box
    const shaftGeo = new THREE.BoxGeometry(baseWidth, height, baseWidth);
    // Scale top to be narrower
    const positions = shaftGeo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const y = positions.getY(i);
        if (y > 0) {
            const scale = 0.7; // Top is 70% of base
            positions.setX(i, positions.getX(i) * scale);
            positions.setZ(i, positions.getZ(i) * scale);
        }
    }
    positions.needsUpdate = true;
    shaftGeo.computeVertexNormals();

    const shaft = new THREE.Mesh(shaftGeo, MATERIALS.granite);
    shaft.position.y = height / 2;
    shaft.castShadow = true;
    group.add(shaft);

    // Pyramidion top
    const topHeight = height * 0.1;
    const topGeo = new THREE.ConeGeometry(baseWidth * 0.5, topHeight, 4);
    topGeo.rotateY(Math.PI / 4);

    const top = new THREE.Mesh(topGeo, MATERIALS.gold);
    top.position.y = height + topHeight / 2;
    group.add(top);

    // Base platform
    const baseGeo = new THREE.BoxGeometry(baseWidth * 2, 0.5, baseWidth * 2);
    const base = new THREE.Mesh(baseGeo, MATERIALS.granite);
    base.position.y = 0.25;
    base.receiveShadow = true;
    group.add(base);

    return group;
}

// =============================================================================
// ERA 5: CLASSICAL (500 BC)
// =============================================================================

/**
 * Greek Temple - Doric columns, pediment, proper proportions
 * Uses LatheGeometry for authentic column profile with entasis
 */
export function createGreekTemple(seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    const columnCount = 6 + Math.floor(random() * 2) * 2; // 6 or 8
    const columnSpacing = 1.8;
    const templeWidth = (columnCount - 1) * columnSpacing + 2;
    const templeDepth = templeWidth * 0.6;
    const columnHeight = 5 + random() * 1;

    // === STYLOBATE (stepped base) ===
    for (let i = 0; i < 3; i++) {
        const stepWidth = templeWidth + 1.5 - i * 0.4;
        const stepDepth = templeDepth + 1.5 - i * 0.4;
        const stepGeo = new THREE.BoxGeometry(stepWidth, 0.25, stepDepth);
        const step = new THREE.Mesh(stepGeo, MATERIALS.marbleWhite);
        step.position.y = i * 0.25 + 0.125;
        step.receiveShadow = true;
        step.castShadow = true;
        group.add(step);
    }
    const baseHeight = 0.75;

    // === COLUMNS with Doric profile ===
    // Classical Doric column has slight entasis (bulge) and capital
    const columnProfile: THREE.Vector2[] = [
        new THREE.Vector2(0.35, 0),                   // Base
        new THREE.Vector2(0.38, columnHeight * 0.1),  // Slight flare at bottom
        new THREE.Vector2(0.40, columnHeight * 0.3),  // Maximum entasis
        new THREE.Vector2(0.38, columnHeight * 0.7),  // Taper
        new THREE.Vector2(0.34, columnHeight * 0.9),  // Near top
        new THREE.Vector2(0.32, columnHeight * 0.92), // Necking
        new THREE.Vector2(0.32, columnHeight * 0.94), // Echinus start
        new THREE.Vector2(0.45, columnHeight * 0.98), // Echinus flare
        new THREE.Vector2(0.50, columnHeight),        // Abacus
    ];

    const columnGeo = new THREE.LatheGeometry(columnProfile, 20);

    // Add fluting (channels) - simplified as material variation
    const columnMat = MATERIALS.marbleWhite.clone();

    // Front and back colonnade
    for (let i = 0; i < columnCount; i++) {
        const x = (i - (columnCount - 1) / 2) * columnSpacing;

        // Front column
        const frontCol = new THREE.Mesh(columnGeo, columnMat);
        frontCol.position.set(x, baseHeight, templeDepth / 2 - 0.8);
        frontCol.castShadow = true;
        group.add(frontCol);

        // Back column
        const backCol = new THREE.Mesh(columnGeo, columnMat);
        backCol.position.set(x, baseHeight, -templeDepth / 2 + 0.8);
        backCol.castShadow = true;
        group.add(backCol);
    }

    // === ENTABLATURE (beam above columns) ===
    const entablatureHeight = columnHeight * 0.15;
    const entGeo = new THREE.BoxGeometry(templeWidth + 0.5, entablatureHeight, templeDepth + 0.5);
    const entablature = new THREE.Mesh(entGeo, MATERIALS.marbleWhite);
    entablature.position.y = baseHeight + columnHeight + entablatureHeight / 2;
    entablature.castShadow = true;
    group.add(entablature);

    // === PEDIMENT (triangular gable) ===
    const pedimentHeight = templeWidth * 0.15;
    const pedimentShape = new THREE.Shape();
    pedimentShape.moveTo(-templeWidth / 2 - 0.3, 0);
    pedimentShape.lineTo(0, pedimentHeight);
    pedimentShape.lineTo(templeWidth / 2 + 0.3, 0);
    pedimentShape.closePath();

    const pedimentGeo = new THREE.ExtrudeGeometry(pedimentShape, {
        depth: 0.5,
        bevelEnabled: false,
    });

    // Front pediment
    const frontPediment = new THREE.Mesh(pedimentGeo, MATERIALS.marbleWhite);
    frontPediment.position.set(0, baseHeight + columnHeight + entablatureHeight, templeDepth / 2);
    frontPediment.castShadow = true;
    group.add(frontPediment);

    // Back pediment
    const backPediment = new THREE.Mesh(pedimentGeo, MATERIALS.marbleWhite);
    backPediment.position.set(0, baseHeight + columnHeight + entablatureHeight, -templeDepth / 2 - 0.5);
    backPediment.castShadow = true;
    group.add(backPediment);

    // === ROOF ===
    const roofGeo = new THREE.BoxGeometry(templeWidth + 1, 0.3, templeDepth + 1);
    // Shape into sloped roof using vertex manipulation would be complex,
    // so we use two tilted planes instead
    const roofMat = MATERIALS.terracotta;

    const roofHalfGeo = new THREE.BoxGeometry(templeWidth / 2 + 0.6, 0.15, templeDepth + 0.5);

    const leftRoof = new THREE.Mesh(roofHalfGeo, roofMat);
    leftRoof.position.set(-templeWidth / 4, baseHeight + columnHeight + entablatureHeight + pedimentHeight * 0.5, 0);
    leftRoof.rotation.z = 0.2;
    leftRoof.castShadow = true;
    group.add(leftRoof);

    const rightRoof = new THREE.Mesh(roofHalfGeo, roofMat);
    rightRoof.position.set(templeWidth / 4, baseHeight + columnHeight + entablatureHeight + pedimentHeight * 0.5, 0);
    rightRoof.rotation.z = -0.2;
    rightRoof.castShadow = true;
    group.add(rightRoof);

    return group;
}

/**
 * Classical Colonnade - Row of columns forming a covered walkway
 */
export function createColonnade(seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    const columnCount = 8 + Math.floor(random() * 6);
    const spacing = 1.6 + random() * 0.4;
    const columnHeight = 4 + random() * 1;

    // Simplified Ionic column profile
    const columnProfile: THREE.Vector2[] = [
        new THREE.Vector2(0.25, 0),
        new THREE.Vector2(0.28, columnHeight * 0.05),
        new THREE.Vector2(0.30, columnHeight * 0.4),
        new THREE.Vector2(0.27, columnHeight * 0.9),
        new THREE.Vector2(0.35, columnHeight * 0.95),
        new THREE.Vector2(0.35, columnHeight),
    ];

    const columnGeo = new THREE.LatheGeometry(columnProfile, 16);

    // Base platform
    const baseLength = (columnCount - 1) * spacing + 2;
    const baseGeo = new THREE.BoxGeometry(baseLength, 0.4, 2);
    const base = new THREE.Mesh(baseGeo, MATERIALS.marbleGray);
    base.position.y = 0.2;
    base.receiveShadow = true;
    group.add(base);

    // Columns
    for (let i = 0; i < columnCount; i++) {
        const col = new THREE.Mesh(columnGeo, MATERIALS.marbleWhite);
        col.position.set((i - (columnCount - 1) / 2) * spacing, 0.4, 0);
        col.castShadow = true;
        group.add(col);
    }

    // Entablature
    const entGeo = new THREE.BoxGeometry(baseLength, 0.5, 1.5);
    const ent = new THREE.Mesh(entGeo, MATERIALS.marbleWhite);
    ent.position.y = 0.4 + columnHeight + 0.25;
    ent.castShadow = true;
    group.add(ent);

    return group;
}

// =============================================================================
// ERA 6: MEDIEVAL (1000 AD)
// =============================================================================

/**
 * Castle Tower - Round tower with battlements and conical roof
 * Uses LatheGeometry for tower body, accurate crenellations
 */
export function createCastleTower(seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    const radius = 2 + random() * 1;
    const height = 12 + random() * 8;
    const isRound = random() > 0.4; // 60% round, 40% square

    // === TOWER BODY ===
    let bodyGeo: THREE.BufferGeometry;
    if (isRound) {
        // Slightly tapered cylinder
        bodyGeo = new THREE.CylinderGeometry(radius * 0.92, radius, height, 24);
    } else {
        bodyGeo = new THREE.BoxGeometry(radius * 1.8, height, radius * 1.8);
    }

    const body = new THREE.Mesh(bodyGeo, MATERIALS.castleStone);
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // === BATTLEMENTS (Crenellations) ===
    const merlonCount = isRound ? 16 : 8;
    const merlonHeight = 1.2;
    const merlonWidth = isRound ? 0.6 : radius * 0.35;

    for (let i = 0; i < merlonCount; i++) {
        if (i % 2 === 0) { // Only every other position gets a merlon
            const merlonGeo = new THREE.BoxGeometry(merlonWidth, merlonHeight, 0.5);
            const merlon = new THREE.Mesh(merlonGeo, MATERIALS.castleStone);

            if (isRound) {
                const angle = (i / merlonCount) * Math.PI * 2;
                merlon.position.set(
                    Math.cos(angle) * (radius - 0.1),
                    height + merlonHeight / 2,
                    Math.sin(angle) * (radius - 0.1)
                );
                merlon.rotation.y = -angle + Math.PI / 2;
            } else {
                // Square tower - position on edges
                const side = Math.floor(i / 2) % 4;
                const pos = (i % 2) * 2 - 1;
                const offset = radius * 0.9;
                switch (side) {
                    case 0: merlon.position.set(pos * offset * 0.5, height + merlonHeight / 2, offset); break;
                    case 1: merlon.position.set(offset, height + merlonHeight / 2, pos * offset * 0.5); merlon.rotation.y = Math.PI / 2; break;
                    case 2: merlon.position.set(pos * offset * 0.5, height + merlonHeight / 2, -offset); break;
                    case 3: merlon.position.set(-offset, height + merlonHeight / 2, pos * offset * 0.5); merlon.rotation.y = Math.PI / 2; break;
                }
            }
            merlon.castShadow = true;
            group.add(merlon);
        }
    }

    // === CONICAL ROOF ===
    const roofHeight = height * 0.25;
    const roofGeo = new THREE.ConeGeometry(radius * 1.2, roofHeight, isRound ? 24 : 4);
    if (!isRound) roofGeo.rotateY(Math.PI / 4);

    const roof = new THREE.Mesh(roofGeo, MATERIALS.roofSlate);
    roof.position.y = height + merlonHeight + roofHeight / 2;
    roof.castShadow = true;
    group.add(roof);

    // === ARROW SLITS ===
    const slitLevels = 3;
    const slitsPerLevel = isRound ? 6 : 4;

    for (let level = 0; level < slitLevels; level++) {
        const y = height * 0.25 + level * (height * 0.25);

        for (let i = 0; i < slitsPerLevel; i++) {
            const slitGeo = new THREE.BoxGeometry(0.15, 1.2, 0.1);
            const slit = new THREE.Mesh(slitGeo, MATERIALS.windowDark);

            if (isRound) {
                const angle = (i / slitsPerLevel) * Math.PI * 2 + level * 0.5;
                slit.position.set(
                    Math.cos(angle) * (radius + 0.01),
                    y,
                    Math.sin(angle) * (radius + 0.01)
                );
                slit.rotation.y = -angle + Math.PI / 2;
            } else {
                const side = i % 4;
                const r = radius * 0.91;
                switch (side) {
                    case 0: slit.position.set(0, y, r); break;
                    case 1: slit.position.set(r, y, 0); slit.rotation.y = Math.PI / 2; break;
                    case 2: slit.position.set(0, y, -r); break;
                    case 3: slit.position.set(-r, y, 0); slit.rotation.y = Math.PI / 2; break;
                }
            }
            group.add(slit);
        }
    }

    // === ENTRANCE ===
    const doorWidth = radius * 0.5;
    const doorHeight = height * 0.15;
    const doorGeo = new THREE.BoxGeometry(doorWidth, doorHeight, 0.1);
    const door = new THREE.Mesh(doorGeo, MATERIALS.windowDark);
    door.position.set(0, doorHeight / 2, isRound ? radius + 0.01 : radius * 0.91);
    group.add(door);

    // Door arch
    const archGeo = new THREE.TorusGeometry(doorWidth / 2, 0.15, 8, 12, Math.PI);
    const arch = new THREE.Mesh(archGeo, MATERIALS.castleStone);
    arch.position.set(0, doorHeight, isRound ? radius : radius * 0.9);
    arch.rotation.x = Math.PI / 2;
    arch.rotation.z = Math.PI / 2;
    group.add(arch);

    return group;
}

/**
 * Gothic Cathedral - Pointed arches, rose window, flying buttresses
 */
export function createGothicCathedral(seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    const width = 10 + random() * 4;
    const height = 18 + random() * 8;
    const depth = width * 2;

    // === MAIN NAVE ===
    const naveGeo = new THREE.BoxGeometry(width, height * 0.7, depth);
    const nave = new THREE.Mesh(naveGeo, MATERIALS.castleStone);
    nave.position.y = height * 0.35;
    nave.castShadow = true;
    group.add(nave);

    // === ROOF (pitched) ===
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-width / 2 - 0.3, 0);
    roofShape.lineTo(0, height * 0.25);
    roofShape.lineTo(width / 2 + 0.3, 0);
    roofShape.closePath();

    const roofGeo = new THREE.ExtrudeGeometry(roofShape, {
        depth: depth,
        bevelEnabled: false,
    });
    const roof = new THREE.Mesh(roofGeo, MATERIALS.roofSlate);
    roof.position.set(0, height * 0.7, -depth / 2);
    roof.castShadow = true;
    group.add(roof);

    // === TWIN TOWERS (facade) ===
    const towerHeight = height * 1.1;
    const towerWidth = width * 0.25;

    for (const side of [-1, 1]) {
        const towerGeo = new THREE.BoxGeometry(towerWidth, towerHeight, towerWidth);
        const tower = new THREE.Mesh(towerGeo, MATERIALS.castleStone);
        tower.position.set(side * (width / 2 - towerWidth / 4), towerHeight / 2, depth / 2);
        tower.castShadow = true;
        group.add(tower);

        // Spire
        const spireGeo = new THREE.ConeGeometry(towerWidth * 0.6, towerHeight * 0.2, 4);
        spireGeo.rotateY(Math.PI / 4);
        const spire = new THREE.Mesh(spireGeo, MATERIALS.roofSlate);
        spire.position.set(side * (width / 2 - towerWidth / 4), towerHeight + towerHeight * 0.1, depth / 2);
        spire.castShadow = true;
        group.add(spire);
    }

    // === ROSE WINDOW (front, between towers) ===
    const roseRadius = width * 0.2;
    const roseGeo = new THREE.CircleGeometry(roseRadius, 24);
    const roseMat = new THREE.MeshBasicMaterial({ color: 0x4466aa, transparent: true, opacity: 0.7 });
    const rose = new THREE.Mesh(roseGeo, roseMat);
    rose.position.set(0, height * 0.55, depth / 2 + 0.05);
    group.add(rose);

    // Rose frame
    const roseFrameGeo = new THREE.TorusGeometry(roseRadius, 0.15, 8, 24);
    const roseFrame = new THREE.Mesh(roseFrameGeo, MATERIALS.castleStone);
    roseFrame.position.set(0, height * 0.55, depth / 2 + 0.02);
    group.add(roseFrame);

    // === FLYING BUTTRESSES ===
    for (let i = 0; i < 4; i++) {
        const z = -depth / 2 + (i + 1) * (depth / 5);

        for (const side of [-1, 1]) {
            // Buttress pier
            const pierGeo = new THREE.BoxGeometry(1, height * 0.5, 1);
            const pier = new THREE.Mesh(pierGeo, MATERIALS.castleStone);
            pier.position.set(side * (width / 2 + 2), height * 0.25, z);
            pier.castShadow = true;
            group.add(pier);

            // Flying arch (simplified as angled box)
            const archLength = 2.5;
            const archGeo = new THREE.BoxGeometry(archLength, 0.4, 0.5);
            const arch = new THREE.Mesh(archGeo, MATERIALS.castleStone);
            arch.position.set(side * (width / 2 + 1), height * 0.55, z);
            arch.rotation.z = side * 0.4;
            arch.castShadow = true;
            group.add(arch);
        }
    }

    // === MAIN ENTRANCE ===
    const doorHeight = height * 0.25;
    const doorWidth = width * 0.2;

    // Pointed arch door shape
    const doorShape = new THREE.Shape();
    doorShape.moveTo(-doorWidth / 2, 0);
    doorShape.lineTo(-doorWidth / 2, doorHeight * 0.6);
    doorShape.quadraticCurveTo(-doorWidth / 2, doorHeight, 0, doorHeight);
    doorShape.quadraticCurveTo(doorWidth / 2, doorHeight, doorWidth / 2, doorHeight * 0.6);
    doorShape.lineTo(doorWidth / 2, 0);
    doorShape.closePath();

    const doorGeo = new THREE.ShapeGeometry(doorShape);
    const door = new THREE.Mesh(doorGeo, MATERIALS.windowDark);
    door.position.set(0, 0, depth / 2 + 0.05);
    group.add(door);

    return group;
}

// =============================================================================
// ERA 7: RENAISSANCE (1500 AD)
// =============================================================================

/**
 * Renaissance Dome - Florence-style dome with lantern
 * Uses LatheGeometry for authentic dome profile
 */
export function createRenaissanceDome(seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    const baseRadius = 6 + random() * 3;
    const domeHeight = baseRadius * (0.8 + random() * 0.3);

    // === OCTAGONAL DRUM (base) ===
    const drumHeight = domeHeight * 0.4;
    const drumGeo = new THREE.CylinderGeometry(baseRadius, baseRadius, drumHeight, 8);
    const drum = new THREE.Mesh(drumGeo, MATERIALS.marbleWhite);
    drum.position.y = drumHeight / 2;
    drum.castShadow = true;
    group.add(drum);

    // Pilasters on drum
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const pilasterGeo = new THREE.BoxGeometry(0.5, drumHeight * 0.9, 0.3);
        const pilaster = new THREE.Mesh(pilasterGeo, MATERIALS.marbleGray);
        pilaster.position.set(
            Math.cos(angle) * (baseRadius + 0.1),
            drumHeight / 2,
            Math.sin(angle) * (baseRadius + 0.1)
        );
        pilaster.rotation.y = -angle;
        group.add(pilaster);
    }

    // === DOME ===
    // Create dome profile - slightly pointed like Brunelleschi's dome
    const domeProfile: THREE.Vector2[] = [];
    const domeSegments = 16;
    for (let i = 0; i <= domeSegments; i++) {
        const t = i / domeSegments;
        const angle = t * Math.PI / 2;
        // Slightly pointed profile
        const r = baseRadius * Math.cos(angle) * (1 - t * 0.1);
        const y = domeHeight * (Math.sin(angle) + t * 0.15);
        domeProfile.push(new THREE.Vector2(r, y));
    }
    domeProfile.push(new THREE.Vector2(0, domeHeight));

    const domeGeo = new THREE.LatheGeometry(domeProfile, 24);
    const dome = new THREE.Mesh(domeGeo, MATERIALS.terracotta);
    dome.position.y = drumHeight;
    dome.castShadow = true;
    group.add(dome);

    // Ribs on dome
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const ribProfile: THREE.Vector2[] = [];
        for (let j = 0; j <= 12; j++) {
            const t = j / 12;
            ribProfile.push(new THREE.Vector2(0.15, t * domeHeight));
        }
        const ribGeo = new THREE.LatheGeometry(ribProfile, 4);
        const rib = new THREE.Mesh(ribGeo, MATERIALS.marbleWhite);
        rib.position.set(
            Math.cos(angle) * baseRadius * 0.9,
            drumHeight,
            Math.sin(angle) * baseRadius * 0.9
        );
        rib.scale.x = 0.3;
        group.add(rib);
    }

    // === LANTERN (top) ===
    const lanternRadius = baseRadius * 0.15;
    const lanternHeight = domeHeight * 0.25;

    const lanternGeo = new THREE.CylinderGeometry(lanternRadius, lanternRadius * 1.1, lanternHeight, 8);
    const lantern = new THREE.Mesh(lanternGeo, MATERIALS.marbleWhite);
    lantern.position.y = drumHeight + domeHeight + lanternHeight / 2;
    group.add(lantern);

    // Lantern columns
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const colGeo = new THREE.CylinderGeometry(0.1, 0.1, lanternHeight * 0.7, 8);
        const col = new THREE.Mesh(colGeo, MATERIALS.marbleWhite);
        col.position.set(
            Math.cos(angle) * lanternRadius,
            drumHeight + domeHeight + lanternHeight * 0.35,
            Math.sin(angle) * lanternRadius
        );
        group.add(col);
    }

    // Lantern roof
    const lanternRoofGeo = new THREE.ConeGeometry(lanternRadius * 1.3, lanternHeight * 0.4, 8);
    const lanternRoof = new THREE.Mesh(lanternRoofGeo, MATERIALS.roofCopper);
    lanternRoof.position.y = drumHeight + domeHeight + lanternHeight + lanternHeight * 0.2;
    group.add(lanternRoof);

    // Cross on top
    const crossVertGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 6);
    const crossVert = new THREE.Mesh(crossVertGeo, MATERIALS.gold);
    crossVert.position.y = drumHeight + domeHeight + lanternHeight * 1.5 + 0.5;
    group.add(crossVert);

    const crossHorizGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6);
    const crossHoriz = new THREE.Mesh(crossHorizGeo, MATERIALS.gold);
    crossHoriz.position.y = drumHeight + domeHeight + lanternHeight * 1.5 + 0.7;
    crossHoriz.rotation.z = Math.PI / 2;
    group.add(crossHoriz);

    return group;
}

/**
 * Palazzo - Italian Renaissance palace facade
 */
export function createPalazzo(seed: number): THREE.Group {
    const group = new THREE.Group();
    const random = seededRandom(seed);

    const width = 12 + random() * 6;
    const height = 10 + random() * 5;
    const depth = 3 + random() * 2;
    const floors = 3;
    const floorHeight = height / floors;

    // === MAIN FACADE ===
    const facadeGeo = new THREE.BoxGeometry(width, height, depth);
    const facade = new THREE.Mesh(facadeGeo, MATERIALS.plaster);
    facade.position.y = height / 2;
    facade.castShadow = true;
    facade.receiveShadow = true;
    group.add(facade);

    // === RUSTICATED BASE (ground floor) ===
    const rustCount = Math.floor(width / 1.5);
    for (let i = 0; i < rustCount; i++) {
        const rustGeo = new THREE.BoxGeometry(1.3, floorHeight * 0.9, 0.2);
        const rust = new THREE.Mesh(rustGeo, MATERIALS.limestone);
        rust.position.set(
            (i - (rustCount - 1) / 2) * 1.5,
            floorHeight / 2,
            depth / 2 + 0.05
        );
        group.add(rust);
    }

    // === WINDOWS ===
    const windowsPerFloor = Math.floor(width / 2.5);
    const windowWidth = 1.2;
    const windowHeight = floorHeight * 0.5;

    for (let floor = 1; floor < floors; floor++) {
        const y = floor * floorHeight + floorHeight / 2;

        for (let i = 0; i < windowsPerFloor; i++) {
            const x = (i - (windowsPerFloor - 1) / 2) * 2.5;

            // Window opening
            const winGeo = new THREE.BoxGeometry(windowWidth, windowHeight, 0.1);
            const win = new THREE.Mesh(winGeo, MATERIALS.windowDark);
            win.position.set(x, y, depth / 2 + 0.1);
            group.add(win);

            // Window frame/pediment
            const frameGeo = new THREE.BoxGeometry(windowWidth + 0.3, 0.2, 0.2);
            const frame = new THREE.Mesh(frameGeo, MATERIALS.limestone);
            frame.position.set(x, y + windowHeight / 2 + 0.1, depth / 2 + 0.15);
            group.add(frame);

            // Triangular pediment on upper floor
            if (floor === 2 && i % 2 === 0) {
                const pedShape = new THREE.Shape();
                pedShape.moveTo(-windowWidth / 2 - 0.2, 0);
                pedShape.lineTo(0, 0.5);
                pedShape.lineTo(windowWidth / 2 + 0.2, 0);
                pedShape.closePath();

                const pedGeo = new THREE.ExtrudeGeometry(pedShape, { depth: 0.15, bevelEnabled: false });
                const ped = new THREE.Mesh(pedGeo, MATERIALS.limestone);
                ped.position.set(x, y + windowHeight / 2 + 0.3, depth / 2 + 0.1);
                group.add(ped);
            }
        }
    }

    // === CORNICE (roof edge) ===
    const corniceGeo = new THREE.BoxGeometry(width + 0.6, 0.6, depth + 0.4);
    const cornice = new THREE.Mesh(corniceGeo, MATERIALS.limestone);
    cornice.position.y = height + 0.3;
    cornice.castShadow = true;
    group.add(cornice);

    // === MAIN ENTRANCE ===
    const doorWidth = 2;
    const doorHeight = floorHeight * 0.8;

    const doorGeo = new THREE.BoxGeometry(doorWidth, doorHeight, 0.1);
    const door = new THREE.Mesh(doorGeo, MATERIALS.windowDark);
    door.position.set(0, doorHeight / 2, depth / 2 + 0.1);
    group.add(door);

    // Arch over door
    const archGeo = new THREE.TorusGeometry(doorWidth / 2, 0.2, 8, 12, Math.PI);
    const arch = new THREE.Mesh(archGeo, MATERIALS.limestone);
    arch.position.set(0, doorHeight, depth / 2 + 0.1);
    arch.rotation.x = Math.PI / 2;
    arch.rotation.z = Math.PI / 2;
    group.add(arch);

    return group;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function seededRandom(seed: number): () => number {
    return function () {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
    };
}

// =============================================================================
// EXPORTS
// =============================================================================

export const ERA_BUILDINGS = {
    // Era 3: Stone Age
    megalith: createMegalith,
    caveDwelling: createCaveDwelling,
    primitiveShelter: createPrimitiveShelter,

    // Era 4: Bronze Age
    ziggurat: createZiggurat,
    pyramid: createPyramid,
    obelisk: createObelisk,

    // Era 5: Classical
    greekTemple: createGreekTemple,
    colonnade: createColonnade,

    // Era 6: Medieval
    castleTower: createCastleTower,
    gothicCathedral: createGothicCathedral,

    // Era 7: Renaissance
    renaissanceDome: createRenaissanceDome,
    palazzo: createPalazzo,
};

import * as THREE from 'three';
import { seededRandom } from './helpers';

/**
 * Add the Ice Age Environment (Era 2)
 * Pixar Ice Age meets Monet style - frozen tundra, glaciers, rushing water
 */
export function addIceAgeEnvironment(group: THREE.Group, offset: number, progress: number): void {
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

import * as THREE from 'three';
import { seededRandom } from './helpers';

// =============================================================================
// ERA 1: JURASSIC - HIGH-END PREHISTORIC JUNGLE ENVIRONMENT
// Industry-standard quality with realistic vegetation, atmospheric effects,
// and proper composition. NO weird dinosaurs or blocking elements.
// =============================================================================

/**
 * Create the complete Jurassic environment - lush prehistoric jungle
 */
export function addJurassicEnvironment(group: THREE.Group, offset: number, progress: number): void {
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

// Classify sprites by type based on actual image proportions:
// Flyers: very wide aspect ratio (pterodactyl silhouettes)
// Ground: taller/squarish (T-Rex, Stego, Trike, Brachi, etc.)
const FLYER_INDICES = new Set([3, 9, 12]);  // ratio>2.0: dino_3(2.19), dino_9(2.52), dino_12(17.6)
const GROUND_INDICES = [0, 1, 2, 4, 5, 6, 7, 8, 10, 11];  // all ground-walkers

function loadDinoResources() {
    if (dinoResourcesLoaded) return;

    const loader = new THREE.TextureLoader();
    // Load 13 dinosaur sprites
    for (let i = 0; i < 13; i++) {
        const texture = loader.load(`/assets/dinos/dino_${i}.png`);
        texture.colorSpace = THREE.SRGBColorSpace;
        dinoTextures[i] = texture;

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
 * Add dinosaur silhouette sprites to the background
 * Flyers go in the sky, ground-walkers stay on the ground
 */
function addJurassicDinosaurs(group: THREE.Group, offset: number, progress: number): void {
    // Ensure textures/materials are loading
    loadDinoResources();

    // PERFORMANCE: Limit count based on quality/progress
    const dinoCount = 5 + Math.floor(progress * 4);

    for (let i = 0; i < dinoCount; i++) {
        const seed = 400000 + i * 999;
        const random = seededRandom(seed);

        // Decide: ~20% chance of flyer, ~80% ground  
        const isFlyer = random() < 0.2;
        let dinoIndex: number;
        if (isFlyer) {
            const flyerArr = Array.from(FLYER_INDICES);
            dinoIndex = flyerArr[Math.floor(random() * flyerArr.length)];
        } else {
            dinoIndex = GROUND_INDICES[Math.floor(random() * GROUND_INDICES.length)];
        }

        // Use Cached Material
        if (!dinoMaterials[dinoIndex]) continue;
        const material = dinoMaterials[dinoIndex];

        const side = random() > 0.5 ? 1 : -1;
        const depth = (random() - 0.5) * 400 + offset;

        let yPos: number;
        let scale: number;
        let distFromCenter: number;

        if (isFlyer) {
            // Flyers: high in the sky, further out, smaller scale for realism
            yPos = 20 + random() * 35;            // 20-55 units up in the sky
            scale = 8 + random() * 12;            // smaller (they're far away)
            distFromCenter = 30 + random() * 60;  // moderate lateral spread
        } else {
            // Ground walkers: firmly on the ground, larger since they're "closer"
            yPos = 0;                              // bottom-anchored at ground level
            scale = 15 + random() * 25;            // larger silhouettes
            distFromCenter = 40 + random() * 80;   // further to the sides
        }

        const sprite = new THREE.Sprite(material);

        if (isFlyer) {
            // Center-anchor for flyers (they float in the sky)
            sprite.center.set(0.5, 0.5);
        } else {
            // Bottom-anchor for ground walkers
            sprite.center.set(0.5, 0);
        }

        sprite.position.set(side * distFromCenter, yPos, depth);
        sprite.scale.set(scale, scale, 1);

        // Randomly flip horizontally
        if (random() > 0.5) {
            sprite.scale.x = -scale;
        }

        sprite.userData.scrollable = true;
        sprite.userData.isDinosaur = true;
        sprite.userData.isFlyer = isFlyer;
        sprite.userData.era = 1;

        if (isFlyer) {
            // Flyers: gentle soaring motion
            sprite.userData.walkSpeed = 0.08 + random() * 0.15;  // slow drift
            sprite.userData.bobSpeed = 0.5 + random() * 1.0;     // lazy wing flap rhythm
            sprite.userData.bobAmount = 0.5 + random() * 1.5;    // vertical soar range
            sprite.userData.baseScale = scale;
            sprite.userData.baseY = yPos;                         // remember sky height
        } else {
            // Ground: walking variation
            sprite.userData.walkSpeed = 0.15 + random() * 0.45;
            sprite.userData.bobSpeed = 1.0 + random() * 3.0;
            sprite.userData.bobAmount = 0.02 + random() * 0.12;
            sprite.userData.baseScale = scale;
        }

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

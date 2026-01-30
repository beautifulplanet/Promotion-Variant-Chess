// src/worlds.ts
// World Environment System - 4 distinct worlds the ribbon travels through

import * as THREE from 'three';

// =============================================================================
// WORLD TYPES
// =============================================================================

export interface WorldConfig {
    name: string;
    skyTopColor: number;
    skyBottomColor: number;
    fogColor: number;
    fogNear: number;
    fogFar: number;
    ambientColor: number;
    ambientIntensity: number;
    directionalColor: number;
    directionalIntensity: number;
    particleColor?: number;
}

export type WorldType = 'forest' | 'city' | 'space' | 'ocean';

// =============================================================================
// WORLD CONFIGURATIONS
// =============================================================================

export const WORLDS: Record<WorldType, WorldConfig> = {
    forest: {
        name: 'Ancient Forest',
        skyTopColor: 0x87ceeb,
        skyBottomColor: 0x90ee90,
        fogColor: 0xc0e0c0,
        fogNear: 40,
        fogFar: 120,
        ambientColor: 0x808080, // Neutral grey ambient
        ambientIntensity: 1.0,
        directionalColor: 0xffffff, // Pure white sunlight (fixes yellow tint)
        directionalIntensity: 1.2,
        particleColor: 0x90ee90,
    },
    city: {
        name: 'Neon City',
        skyTopColor: 0x2a1a4a,
        skyBottomColor: 0x4a2a6e,
        fogColor: 0x3a3a5e,
        fogNear: 35,
        fogFar: 100,
        ambientColor: 0x606080,
        ambientIntensity: 1.0,
        directionalColor: 0xffffff,
        directionalIntensity: 1.2,
        particleColor: 0x00ffff,
    },
    space: {
        name: 'Cosmic Voyage',
        skyTopColor: 0x0a0a2a,
        skyBottomColor: 0x2a1a4a,
        fogColor: 0x1a1a3a,
        fogNear: 80,
        fogFar: 250,
        ambientColor: 0x505080,
        ambientIntensity: 1.0,
        directionalColor: 0xffffff,
        directionalIntensity: 1.3,
        particleColor: 0xffffff,
    },
    ocean: {
        name: 'Crystal Ocean',
        skyTopColor: 0x2060a0,
        skyBottomColor: 0x40a0c0,
        fogColor: 0x3080a0,
        fogNear: 30,
        fogFar: 100,
        ambientColor: 0x4090b0,
        ambientIntensity: 1.2,
        directionalColor: 0xc0e0ff,
        directionalIntensity: 1.3,
        particleColor: 0x80ffff,
    },
};

export const WORLD_ORDER: WorldType[] = ['forest', 'city', 'space', 'ocean'];

// =============================================================================
// WORLD ENVIRONMENT BUILDER
// =============================================================================

export function createWorldEnvironment(
    world: WorldType,
    group: THREE.Group,
    scrollOffset: number
): void {
    // Clear existing environment
    while (group.children.length > 0) {
        const child = group.children[0];
        group.remove(child);
        if ((child as THREE.Mesh).geometry) {
            (child as THREE.Mesh).geometry.dispose();
        }
    }

    switch (world) {
        case 'forest':
            createForestEnvironment(group, scrollOffset);
            break;
        case 'city':
            createCityEnvironment(group, scrollOffset);
            break;
        case 'space':
            createSpaceEnvironment(group, scrollOffset);
            break;
        case 'ocean':
            createOceanEnvironment(group, scrollOffset);
            break;
    }
}

// =============================================================================
// FOREST WORLD
// =============================================================================

function createForestEnvironment(group: THREE.Group, offset: number): void {
    const treeCount = 40;
    const spreadX = 30;
    const spreadZ = 150;

    for (let i = 0; i < treeCount; i++) {
        const tree = createTree();
        const side = Math.random() > 0.5 ? 1 : -1;
        tree.position.set(
            side * (6 + Math.random() * spreadX),
            0,
            (Math.random() - 0.5) * spreadZ + offset
        );
        tree.scale.setScalar(0.8 + Math.random() * 1.5);
        group.add(tree);
    }

    // Add floating particles (leaves)
    addParticles(group, 0x90ee90, 200, offset);
}

function createTree(): THREE.Group {
    const tree = new THREE.Group();

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 4, 8);
    const trunkMat = new THREE.MeshStandardMaterial({
        color: 0x4a3728,
        roughness: 1,
    });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 2;
    trunk.castShadow = true;
    tree.add(trunk);

    // Foliage layers (bushy ancient tree)
    const foliageColors = [0x228b22, 0x2e8b57, 0x3cb371];
    for (let i = 0; i < 3; i++) {
        const size = 2.5 - i * 0.5;
        const foliageGeo = new THREE.SphereGeometry(size, 8, 6);
        const foliageMat = new THREE.MeshStandardMaterial({
            color: foliageColors[i % foliageColors.length],
            roughness: 0.8,
        });
        const foliage = new THREE.Mesh(foliageGeo, foliageMat);
        foliage.position.y = 4 + i * 1.5;
        foliage.position.x = (Math.random() - 0.5) * 0.5;
        foliage.castShadow = true;
        tree.add(foliage);
    }

    return tree;
}

// =============================================================================
// CITY WORLD
// =============================================================================

function createCityEnvironment(group: THREE.Group, offset: number): void {
    const buildingCount = 50;
    const spreadX = 40;
    const spreadZ = 150;

    for (let i = 0; i < buildingCount; i++) {
        const building = createNeonBuilding();
        const side = Math.random() > 0.5 ? 1 : -1;
        building.position.set(
            side * (8 + Math.random() * spreadX),
            0,
            (Math.random() - 0.5) * spreadZ + offset
        );
        group.add(building);
    }

    // Add neon particles
    addParticles(group, 0x00ffff, 150, offset);
}

function createNeonBuilding(): THREE.Group {
    const building = new THREE.Group();

    const height = 5 + Math.random() * 20;
    const width = 2 + Math.random() * 4;
    const depth = 2 + Math.random() * 4;

    // Main structure
    const buildingGeo = new THREE.BoxGeometry(width, height, depth);
    const buildingMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.7, 0.3, 0.15),
        roughness: 0.3,
        metalness: 0.7,
    });
    const mesh = new THREE.Mesh(buildingGeo, buildingMat);
    mesh.position.y = height / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    building.add(mesh);

    // Neon strips
    const neonColors = [0xff00ff, 0x00ffff, 0xff0080, 0x00ff80];
    const stripCount = Math.floor(2 + Math.random() * 4);
    for (let i = 0; i < stripCount; i++) {
        const stripColor = neonColors[Math.floor(Math.random() * neonColors.length)];
        const stripGeo = new THREE.BoxGeometry(width * 1.1, 0.2, 0.1);
        const stripMat = new THREE.MeshBasicMaterial({
            color: stripColor,
        });
        const strip = new THREE.Mesh(stripGeo, stripMat);
        strip.position.set(0, 2 + i * (height / stripCount), depth / 2 + 0.1);
        building.add(strip);

        // Add point light to simulate lamp/glow
        const light = new THREE.PointLight(stripColor, 2, 15);
        light.position.set(0, 0, 0.5);
        strip.add(light);
    }

    return building;
}

// =============================================================================
// SPACE WORLD
// =============================================================================

function createSpaceEnvironment(group: THREE.Group, offset: number): void {
    // Asteroids
    const asteroidCount = 30;
    for (let i = 0; i < asteroidCount; i++) {
        const asteroid = createAsteroid();
        asteroid.position.set(
            (Math.random() - 0.5) * 80,
            (Math.random() - 0.5) * 40,
            (Math.random() - 0.5) * 150 + offset
        );
        group.add(asteroid);
    }

    // Distant planets
    for (let i = 0; i < 3; i++) {
        const planet = createPlanet();
        planet.position.set(
            (Math.random() - 0.5) * 100,
            10 + Math.random() * 30,
            -50 - i * 50 + offset
        );
        group.add(planet);
    }

    // Stars (particles)
    addParticles(group, 0xffffff, 500, offset, 100);
}

function createAsteroid(): THREE.Mesh {
    const geo = new THREE.IcosahedronGeometry(1 + Math.random() * 3, 0);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x555555,
        roughness: 1,
        flatShading: true,
    });
    const asteroid = new THREE.Mesh(geo, mat);
    asteroid.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
    );
    asteroid.castShadow = true;
    return asteroid;
}

function createPlanet(): THREE.Mesh {
    const size = 5 + Math.random() * 15;
    const geo = new THREE.SphereGeometry(size, 32, 32);
    const hue = Math.random();
    const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(hue, 0.6, 0.4),
        roughness: 0.8,
    });
    const planet = new THREE.Mesh(geo, mat);

    // Add ring to some planets
    if (Math.random() > 0.5) {
        const ringGeo = new THREE.RingGeometry(size * 1.3, size * 1.8, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(hue, 0.3, 0.6),
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.6,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        planet.add(ring);
    }

    // Add glowing light to planet
    const planetLight = new THREE.PointLight(new THREE.Color().setHSL(hue, 0.6, 0.5), 2, 50);
    planetLight.position.set(0, 0, 0);
    planet.add(planetLight);

    return planet;
}

// =============================================================================
// OCEAN WORLD
// =============================================================================

function createOceanEnvironment(group: THREE.Group, offset: number): void {
    // Coral formations
    const coralCount = 40;
    for (let i = 0; i < coralCount; i++) {
        const coral = createCoral();
        const side = Math.random() > 0.5 ? 1 : -1;
        coral.position.set(
            side * (5 + Math.random() * 25),
            -5 + Math.random() * 3,
            (Math.random() - 0.5) * 150 + offset
        );
        group.add(coral);
    }

    // Fish schools (simple spheres for now)
    for (let i = 0; i < 10; i++) {
        const school = createFishSchool();
        school.position.set(
            (Math.random() - 0.5) * 30,
            Math.random() * 10,
            (Math.random() - 0.5) * 100 + offset
        );
        group.add(school);
    }

    // Bubbles
    addParticles(group, 0x80ffff, 300, offset, 30);
}

function createCoral(): THREE.Group {
    const coral = new THREE.Group();
    const coralColors = [0xff6b6b, 0xff9f43, 0xee5a24, 0xf368e0, 0x10ac84];

    const branchCount = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < branchCount; i++) {
        const height = 2 + Math.random() * 4;
        const geo = new THREE.CylinderGeometry(0.1, 0.4, height, 6);
        const mat = new THREE.MeshStandardMaterial({
            color: coralColors[Math.floor(Math.random() * coralColors.length)],
            roughness: 0.7,
        });
        const branch = new THREE.Mesh(geo, mat);
        branch.position.set(
            (Math.random() - 0.5) * 2,
            height / 2,
            (Math.random() - 0.5) * 2
        );
        branch.rotation.set(
            (Math.random() - 0.5) * 0.5,
            0,
            (Math.random() - 0.5) * 0.5
        );
        coral.add(branch);
    }

    return coral;
}

function createFishSchool(): THREE.Group {
    const school = new THREE.Group();
    const fishCount = 10 + Math.floor(Math.random() * 20);
    const color = new THREE.Color().setHSL(Math.random() * 0.2 + 0.5, 0.8, 0.5);

    for (let i = 0; i < fishCount; i++) {
        const geo = new THREE.ConeGeometry(0.1, 0.3, 4);
        const mat = new THREE.MeshStandardMaterial({ color });
        const fish = new THREE.Mesh(geo, mat);
        fish.rotation.x = Math.PI / 2;
        fish.position.set(
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 3,
            (Math.random() - 0.5) * 5
        );
        school.add(fish);
    }

    return school;
}

// =============================================================================
// PARTICLES
// =============================================================================

function addParticles(
    group: THREE.Group,
    color: number,
    count: number,
    offset: number,
    spread: number = 50
): void {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * spread * 2;
        positions[i * 3 + 1] = Math.random() * spread;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 150 + offset;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color,
        size: 0.3,
        transparent: true,
        opacity: 0.7,
    });

    const particles = new THREE.Points(geometry, material);
    particles.userData.isParticles = true;
    group.add(particles);
}

// =============================================================================
// EXPORTS
// =============================================================================

export function getWorldConfig(world: WorldType): WorldConfig {
    return WORLDS[world];
}

export function getNextWorld(current: WorldType): WorldType {
    const index = WORLD_ORDER.indexOf(current);
    return WORLD_ORDER[(index + 1) % WORLD_ORDER.length];
}

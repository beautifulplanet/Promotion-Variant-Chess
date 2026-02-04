import * as THREE from 'three';
import { seededRandom } from './helpers';
import * as EraBuildings from '../eraBuildings';

/**
 * Stone Age (Era 3) - Megaliths, cave dwellings, primitive shelters, Stonehenge, dolmens
 */
export function addStoneAgeEnvironment(group: THREE.Group, offset: number, progress: number): void {
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

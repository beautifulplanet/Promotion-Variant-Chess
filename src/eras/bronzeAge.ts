import * as THREE from 'three';
import { seededRandom } from './helpers';
import * as EraBuildings from '../eraBuildings';

/**
 * Bronze Age (Era 4) - Ziggurats, pyramids, obelisks
 */
export function addBronzeAgeEnvironment(group: THREE.Group, offset: number, progress: number): void {
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

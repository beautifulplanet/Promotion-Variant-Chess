import * as THREE from 'three';
import { seededRandom } from './helpers';
import * as EraBuildings from '../eraBuildings';

/**
 * Classical (Era 5) - Greek temples, colonnades
 */
export function addClassicalEnvironment(group: THREE.Group, offset: number, progress: number): void {
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

import * as THREE from 'three';
import { seededRandom } from './helpers';
import * as EraBuildings from '../eraBuildings';

/**
 * Medieval (Era 6) - Castle towers, gothic cathedrals
 */
export function addMedievalEnvironment(group: THREE.Group, offset: number, progress: number): void {
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

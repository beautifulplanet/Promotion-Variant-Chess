import * as THREE from 'three';
import { seededRandom } from './helpers';
import * as EraBuildings from '../eraBuildings';

/**
 * Renaissance (Era 7) - Domes, palazzos
 */
export function addRenaissanceEnvironment(group: THREE.Group, offset: number, progress: number): void {
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

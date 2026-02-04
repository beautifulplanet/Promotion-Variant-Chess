import * as THREE from 'three';
import { EraConfig } from '../eraSystem';

/**
 * Cyberpunk (Era 12) - Holographic ads
 */
export function addCyberpunkEnvironment(group: THREE.Group, offset: number, progress: number): void {
    const holoCount = 4 + Math.floor(progress * 4);
    const holoColors = [0xff00ff, 0x00ffff, 0xff0080, 0x80ff00];

    for (let i = 0; i < holoCount; i++) {
        const holoGeo = new THREE.PlaneGeometry(2, 3);
        const holoMat = new THREE.MeshStandardMaterial({
            color: holoColors[i % holoColors.length],
            emissive: holoColors[i % holoColors.length],
            emissiveIntensity: 1.5,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
        });
        const holo = new THREE.Mesh(holoGeo, holoMat);

        const side = i % 2 === 0 ? 1 : -1;
        holo.position.set(
            side * (16 + Math.random() * 20),
            6 + Math.random() * 12,
            (Math.random() - 0.5) * 140 + offset
        );
        holo.rotation.y = side * Math.PI / 4;
        holo.userData.scrollable = true;
        holo.userData.isHologram = true;
        group.add(holo);
    }
}

/**
 * Type I-III (Eras 17-20) - Energy fields
 */
export function addTypeCivilizationEnvironment(group: THREE.Group, offset: number, progress: number, era: EraConfig): void {
    const fieldCount = 2 + Math.floor(progress * 3);

    for (let i = 0; i < fieldCount; i++) {
        const fieldGeo = new THREE.TorusGeometry(3 + Math.random() * 4, 0.1, 8, 32);
        const fieldMat = new THREE.MeshStandardMaterial({
            color: era.accentLightColor,
            emissive: era.accentLightColor,
            emissiveIntensity: 2,
            transparent: true,
            opacity: 0.4,
        });
        const field = new THREE.Mesh(fieldGeo, fieldMat);

        field.position.set(
            (Math.random() - 0.5) * 60,
            12 + Math.random() * 22,
            (Math.random() - 0.5) * 140 + offset
        );
        field.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        field.userData.scrollable = true;
        field.userData.isEnergyField = true;
        field.userData.rotationSpeed = 0.5 + Math.random() * 0.5;
        group.add(field);
    }
}

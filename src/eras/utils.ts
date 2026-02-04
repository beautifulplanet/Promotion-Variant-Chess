import * as THREE from 'three';

/**
 * Recursively dispose of an object and all its children
 * Prevents memory leaks from geometries and materials
 */
export function disposeObject(obj: THREE.Object3D): void {
    // Dispose mesh geometry and materials
    if (obj instanceof THREE.Mesh) {
        if (obj.geometry) {
            obj.geometry.dispose();
        }
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach((m) => disposeMaterial(m));
            } else {
                disposeMaterial(obj.material);
            }
        }
    }

    // Dispose particle systems
    if (obj instanceof THREE.Points) {
        if (obj.geometry) {
            obj.geometry.dispose();
        }
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach((m) => m.dispose());
            } else {
                obj.material.dispose();
            }
        }
    }

    // Dispose sprite materials
    if (obj instanceof THREE.Sprite) {
        if (obj.material) {
            if (obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
        }
    }

    // Recursively dispose children
    if (obj.children) {
        for (let i = obj.children.length - 1; i >= 0; i--) {
            disposeObject(obj.children[i]);
        }
    }
}

/**
 * Helper to dispose of a material and all its textures
 */
function disposeMaterial(material: THREE.Material): void {
    const mat = material as THREE.Material & Record<string, any>;

    // Dispose ALL texture types
    if (mat.map) mat.map.dispose();
    if (mat.normalMap) mat.normalMap.dispose();
    if (mat.roughnessMap) mat.roughnessMap.dispose();
    if (mat.metalnessMap) mat.metalnessMap.dispose();
    if (mat.emissiveMap) mat.emissiveMap.dispose();
    if (mat.envMap) mat.envMap.dispose();
    if (mat.lightMap) mat.lightMap.dispose();
    if (mat.aoMap) mat.aoMap.dispose();
    if (mat.alphaMap) mat.alphaMap.dispose();
    if (mat.bumpMap) mat.bumpMap.dispose();
    if (mat.displacementMap) mat.displacementMap.dispose();

    mat.dispose();
}

// Clear all objects from environment group
export function clearEnvironment(group: THREE.Group): void {
    if (!group) return;

    while (group.children.length > 0) {
        const child = group.children[0];
        group.remove(child);
        disposeObject(child);
    }
}

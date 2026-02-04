import { EraConfig } from '../eraSystem';

export function seededRandom(seed: number): () => number {
    return () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };
}

export function getAssetDensity(era: EraConfig, progress: number, scale: number): number {
    // Base density varies by era - OPTIMIZED for performance
    const baseDensity: Record<number, number> = {
        1: 18,   // Cretaceous - prehistoric forest
        2: 12,   // Ice Age - sparse tundra
        3: 15,   // Stone Age
        4: 18,   // Bronze Age
        5: 20,   // Classical
        6: 22,   // Medieval
        7: 20,   // Renaissance
        8: 25,   // Industrial - factories
        9: 22,   // Modern
        10: 28,  // Digital - buildings
        11: 25,  // Near Future
        12: 30,  // Cyberpunk - megacity
        13: 15,  // Space Age - sparse
        14: 10,  // Lunar - very sparse
        15: 12,  // Mars
        16: 10,  // Solar System - sparse
        17: 18,  // Type I
        18: 15,  // Type II
        19: 12,  // Type II.5
        20: 20,  // Type III - cosmic structures
    };

    const base = baseDensity[era.id] || 15;
    return base * (0.8 + progress * 0.4) * scale;
}

export function getSpreadX(era: EraConfig): number {
    // How far from center assets spread
    const baseSpread: Record<number, number> = {
        1: 30,   // Cretaceous
        2: 35,   // Ice Age
        3: 25,   // Stone Age
        4: 30,   // Bronze Age
        5: 35,   // Classical
        6: 30,   // Medieval
        7: 35,   // Renaissance
        8: 40,   // Industrial
        9: 35,   // Modern
        10: 40,  // Digital
        11: 45,  // Near Future
        12: 50,  // Cyberpunk - wide megacity
        13: 60,  // Space Age
        14: 40,  // Lunar
        15: 50,  // Mars
        16: 80,  // Solar System - very wide
        17: 60,  // Type I
        18: 80,  // Type II
        19: 100, // Type II.5
        20: 120, // Type III - galactic scale
    };

    return baseSpread[era.id] || 30;
}

export function getGroundLevel(era: EraConfig, random: number): number {
    // Ground level variation by era
    switch (era.id) {
        case 13: case 14: case 15: case 16: // Space eras - floating
            return -5 + random * 15;
        case 17: case 18: case 19: case 20: // Type civilizations - floating
            return -10 + random * 30;
        default:
            return 0;
    }
}

export function getParticleSpread(era: EraConfig): number {
    return era.id >= 13 ? 80 : 50; // Wider for space eras
}

export function getParticleSize(era: EraConfig): number {
    const baseSizes: Record<string, number> = {
        'leaves': 0.3,
        'snow': 0.25,
        'ash': 0.2,
        'dust': 0.15,
        'rain': 0.1,
        'sparks': 0.2,
        'data': 0.15,
        'energy': 0.25,
        'stars': 0.2,
        'cosmic': 0.3,
    };

    return baseSizes[era.particleType] || 0.2;
}

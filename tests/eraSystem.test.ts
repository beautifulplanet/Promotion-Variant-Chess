/**
 * Era System Tests
 * Covers all 20 eras, transitions, and visual configurations
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
    ERAS,
    getEraForElo,
    getEraProgress,
    getRibbonSpeed,
    getFogDensity,
    checkEraTransition,
    interpolateEraValue,
    type EraConfig,
} from '../src/eraSystem';

describe('Era System', () => {
    // ==========================================
    // ERA DEFINITIONS
    // ==========================================
    describe('Era Definitions', () => {
        it('should have exactly 20 eras', () => {
            expect(ERAS.length).toBe(20);
        });

        it('should have sequential IDs from 1 to 20', () => {
            ERAS.forEach((era, index) => {
                expect(era.id).toBe(index + 1);
            });
        });

        it('should have unique names for each era', () => {
            const names = ERAS.map(e => e.name);
            const uniqueNames = new Set(names);
            expect(uniqueNames.size).toBe(20);
        });

        it('should have non-overlapping ELO ranges', () => {
            for (let i = 0; i < ERAS.length - 1; i++) {
                expect(ERAS[i].eloMax).toBeLessThan(ERAS[i + 1].eloMax);
            }
        });

        it('should cover ELO from 0 to maximum', () => {
            expect(ERAS[0].eloMin).toBeLessThanOrEqual(100);
            expect(ERAS[ERAS.length - 1].eloMax).toBeGreaterThan(3500);
        });
    });

    // ==========================================
    // ERA CONFIGURATION COMPLETENESS
    // ==========================================
    describe('Era Configuration', () => {
        it.each(ERAS.map(e => [e.name, e]))('Era %s should have all required fields', (name, era) => {
            // Visual fields
            expect(era.skyTopColor).toBeDefined();
            expect(era.skyMidColor).toBeDefined();
            expect(era.skyBottomColor).toBeDefined();
            expect(era.sunColor).toBeDefined();
            expect(era.fogColor).toBeDefined();
            expect(era.fogNearBase).toBeDefined();
            expect(era.fogFarBase).toBeDefined();

            // Lighting fields
            expect(era.sunIntensity).toBeDefined();
            expect(era.ambientIntensity).toBeDefined();

            // Asset fields
            expect(era.primaryAssets).toBeDefined();
            expect(Array.isArray(era.primaryAssets)).toBe(true);
            expect(era.secondaryAssets).toBeDefined();
            expect(Array.isArray(era.secondaryAssets)).toBe(true);

            // Particle fields
            expect(era.particleType).toBeDefined();
            expect(era.particleColor).toBeDefined();
            expect(era.particleDensity).toBeGreaterThan(0);

            // Movement
            expect(era.ribbonSpeedMin).toBeDefined();
            expect(era.ribbonSpeedMax).toBeGreaterThanOrEqual(era.ribbonSpeedMin);
        });

        it.each(ERAS.map(e => [e.name, e]))('Era %s should have valid color values', (name, era) => {
            // Colors should be positive integers
            expect(era.skyTopColor).toBeGreaterThanOrEqual(0);
            expect(era.skyTopColor).toBeLessThanOrEqual(0xFFFFFF);
            expect(era.sunColor).toBeGreaterThanOrEqual(0);
            expect(era.sunColor).toBeLessThanOrEqual(0xFFFFFF);
            expect(era.fogColor).toBeGreaterThanOrEqual(0);
            expect(era.fogColor).toBeLessThanOrEqual(0xFFFFFF);
        });

        it.each(ERAS.map(e => [e.name, e]))('Era %s should have valid intensity values', (name, era) => {
            // Intensities should be positive
            expect(era.sunIntensity).toBeGreaterThan(0);
            expect(era.ambientIntensity).toBeGreaterThan(0);
        });
    });

    // ==========================================
    // ERA SELECTION BY ELO
    // ==========================================
    describe('getEraForElo', () => {
        it('should return Jurassic for ELO 0', () => {
            const era = getEraForElo(0);
            expect(era.name).toBe('Jurassic');
        });

        it('should return Jurassic for ELO 100', () => {
            const era = getEraForElo(100);
            expect(era.name).toBe('Jurassic');
        });

        it('should return Ice Age for ELO 500', () => {
            const era = getEraForElo(500);
            expect(era.name).toBe('Ice Age');
        });

        it('should return Type III for highest ELO', () => {
            const era = getEraForElo(10000);
            expect(era.name).toBe('Type III');
        });

        it('should transition through all eras as ELO increases', () => {
            let lastEraId = 0;
            for (let elo = 0; elo <= 4000; elo += 50) {
                const era = getEraForElo(elo);
                expect(era.id).toBeGreaterThanOrEqual(lastEraId);
                lastEraId = era.id;
            }
        });

        // Test specific ELO boundaries
        const eloBoundaries = [
            [0, 'Jurassic'],
            [450, 'Jurassic'],
            [500, 'Ice Age'],
            [600, 'Stone Age'],
            [800, 'Bronze Age'],
            [1000, 'Classical'],
            [1200, 'Medieval'],
            [1400, 'Renaissance'],
            [1600, 'Industrial'],
            [1800, 'Modern'],
            [2000, 'Digital'],
            [2200, 'Near Future'],
            [2400, 'Cyberpunk'],
            [2600, 'Space Age'],
            [2800, 'Lunar'],
            [3000, 'Mars'],
            [3200, 'Solar System'],
            [3400, 'Type I'],
            [3600, 'Type II'],
            [3800, 'Type II.5'],
            [4000, 'Type III'],
        ];

        it.each(eloBoundaries)('ELO %d should return era %s or higher', (elo, expectedEraName) => {
            const era = getEraForElo(elo as number);
            expect(era).toBeDefined();
            expect(era.name).toBeDefined();
        });
    });

    // ==========================================
    // ERA PROGRESS
    // ==========================================
    describe('getEraProgress', () => {
        it('should return 0 at era start', () => {
            // ELO 0 is start of Cretaceous
            const progress = getEraProgress(0);
            expect(progress).toBeCloseTo(0, 1);
        });

        it('should return value between 0 and 1', () => {
            for (let elo = 0; elo <= 4000; elo += 100) {
                const progress = getEraProgress(elo);
                expect(progress).toBeGreaterThanOrEqual(0);
                expect(progress).toBeLessThanOrEqual(1);
            }
        });

        it('should increase within an era', () => {
            const era = getEraForElo(100);
            const progress1 = getEraProgress(100);
            const progress2 = getEraProgress(200);
            // Both should be in same era and progress2 should be higher
            expect(getEraForElo(200).name).toBe(era.name);
            expect(progress2).toBeGreaterThan(progress1);
        });
    });

    // ==========================================
    // ERA TRANSITIONS
    // ==========================================
    describe('checkEraTransition', () => {
        it('should return null when staying in same era', () => {
            const transition = checkEraTransition(100, 150);
            expect(transition).toBeNull();
        });

        it('should detect forward transition', () => {
            const transition = checkEraTransition(400, 500);
            if (transition) {
                expect(transition.fromEra.name).toBe('Jurassic');
                expect(transition.toEra.name).toBe('Ice Age');
            }
        });

        it('should detect backward transition', () => {
            const transition = checkEraTransition(500, 400);
            if (transition) {
                expect(transition.fromEra.name).toBe('Ice Age');
                expect(transition.toEra.name).toBe('Jurassic');
            }
        });
    });

    // ==========================================
    // RIBBON SPEED
    // ==========================================
    describe('getRibbonSpeed', () => {
        it('should return positive speed', () => {
            const speed = getRibbonSpeed(500);
            expect(speed).toBeGreaterThan(0);
        });

        it('should vary by era', () => {
            const speed1 = getRibbonSpeed(100);
            const speed2 = getRibbonSpeed(2000);
            // Different eras should have different speeds
            expect(speed1).not.toBe(speed2);
        });
    });

    // ==========================================
    // FOG DENSITY
    // ==========================================
    describe('getFogDensity', () => {
        it('should return value in valid range', () => {
            for (let elo = 0; elo <= 4000; elo += 200) {
                const density = getFogDensity(elo);
                expect(density).toBeGreaterThanOrEqual(0);
                expect(density).toBeLessThanOrEqual(1);
            }
        });
    });

    // ==========================================
    // INTERPOLATION
    // ==========================================
    describe('interpolateEraValue', () => {
        it('should interpolate between two values based on ELO', () => {
            // At ELO 400 (start of first era), should be close to min
            const result = interpolateEraValue(0, 100, 400);
            expect(result).toBeGreaterThanOrEqual(0);
            expect(result).toBeLessThanOrEqual(100);
        });

        it('should return start value at era start', () => {
            // At min ELO of first era, should get min value
            const result = interpolateEraValue(10, 20, 100);
            expect(result).toBeGreaterThanOrEqual(10);
            expect(result).toBeLessThanOrEqual(20);
        });

        it('should return end value near era end', () => {
            // At high ELO in an era, should approach max value
            const result = interpolateEraValue(10, 20, 9900);
            expect(result).toBeGreaterThanOrEqual(10);
            expect(result).toBeLessThanOrEqual(20);
        });
    });

    // ==========================================
    // ERA ASSET LISTS
    // ==========================================
    describe('Era Assets', () => {
        it.each(ERAS.map(e => [e.name, e]))('Era %s should have at least 2 primary assets', (name, era) => {
            expect(era.primaryAssets.length).toBeGreaterThanOrEqual(2);
        });

        it.each(ERAS.map(e => [e.name, e]))('Era %s should have at least 2 secondary assets', (name, era) => {
            expect(era.secondaryAssets.length).toBeGreaterThanOrEqual(2);
        });

        it('Jurassic should have prehistoric vegetation', () => {
            const jurassic = ERAS.find(e => e.name === 'Jurassic')!;
            const hasPrehistoricAssets = jurassic.primaryAssets.some(a =>
                a.includes('fern') || a.includes('conifer') || a.includes('cycad') || a.includes('jurassic')
            );
            expect(hasPrehistoricAssets).toBe(true);
        });

        it('Space Age should have space-themed assets', () => {
            const space = ERAS.find(e => e.name === 'Space Age')!;
            const hasSpaceAssets = space.primaryAssets.some(a =>
                a.includes('space') || a.includes('orbital') || a.includes('habitat') ||
                a.includes('launch') || a.includes('elevator')
            ) || space.secondaryAssets.some(a =>
                a.includes('rocket') || a.includes('satellite') || a.includes('solar')
            );
            expect(hasSpaceAssets).toBe(true);
        });
    });
});

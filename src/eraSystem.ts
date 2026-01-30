// src/eraSystem.ts
// ELO-Based Era System - 20 distinct eras from 65M years ago to Type 3 civilization
// Each era has unique visual identity, assets, and atmospheric properties

import * as THREE from 'three';

// =============================================================================
// ERA CONFIGURATION INTERFACE
// =============================================================================

export interface EraConfig {
    id: number;
    name: string;
    eloMin: number;
    eloMax: number;
    timePeriod: string;
    description: string;

    // Sky & Atmosphere (procedural functions take progress 0-1)
    skyTopColor: number;
    skyMidColor: number;
    skyBottomColor: number;
    horizonGlow: number;
    starDensity: number;
    nebulaIntensity: number;
    auroraIntensity: number;

    // Fog (varies with progress)
    fogColor: number;
    fogNearBase: number;
    fogFarBase: number;
    fogDensityMin: number;
    fogDensityMax: number;

    // Lighting
    sunColor: number;
    sunIntensity: number;
    sunAngleBase: number;    // Radians
    ambientColor: number;
    ambientIntensity: number;
    rimLightColor: number;
    rimLightIntensity: number;

    // Motion & Speed
    ribbonSpeedMin: number;
    ribbonSpeedMax: number;

    // Era-specific point lights
    accentLightColor: number;
    accentLightIntensity: number;

    // Asset configuration
    primaryAssets: string[];
    secondaryAssets: string[];
    particleType: 'leaves' | 'snow' | 'ash' | 'dust' | 'rain' | 'sparks' | 'data' | 'energy' | 'stars' | 'cosmic';
    particleColor: number;
    particleDensity: number;

    // Asset mutation parameters
    assetScaleMin: number;
    assetScaleMax: number;
    assetColorVariance: number;
    assetDetailLevel: number;
}

// =============================================================================
// THE 20 ERAS - From Cretaceous to Type 3 Civilization
// =============================================================================

export const ERAS: EraConfig[] = [
    // ERA 1: JURASSIC (150 Million Years Ago)
    // INDUSTRY STANDARD - Photorealistic prehistoric jungle environment
    {
        id: 1,
        name: 'Jurassic',
        eloMin: 0,
        eloMax: 450,
        timePeriod: '150 Million Years Ago',
        description: 'Lush prehistoric jungle - towering ferns, ancient conifers, misty atmosphere',

        // Sky: Clear blue prehistoric sky - NO YELLOW GLOW
        skyTopColor: 0x2a5080,    // Clear deep blue zenith
        skyMidColor: 0x5090b0,    // Soft sky blue
        skyBottomColor: 0x8ac0d8, // Pale blue horizon
        horizonGlow: 0x90b8c8,    // Subtle blue-gray (NO YELLOW)
        starDensity: 0,
        nebulaIntensity: 0,
        auroraIntensity: 0,

        // Fog: Atmospheric jungle mist for depth
        fogColor: 0x6a8a7a,       // Green-tinted mist
        fogNearBase: 30,
        fogFarBase: 150,
        fogDensityMin: 0.15,
        fogDensityMax: 0.35,

        // Lighting: Natural white sunlight - NOT YELLOW
        sunColor: 0xffffff,       // Pure white sunlight
        sunIntensity: 1.0,        // Standard intensity
        sunAngleBase: 0.6,        // Late afternoon angle
        ambientColor: 0x4a6a5a,   // Cool green ambient from foliage
        ambientIntensity: 0.6,
        rimLightColor: 0x8ab090,  // Subtle green rim from environment
        rimLightIntensity: 0.3,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0xb0c8a0,  // Soft green accent (NO YELLOW)
        accentLightIntensity: 0.3,

        // Assets: Realistic prehistoric vegetation (NO DINOSAURS - just environment)
        primaryAssets: ['jurassic_tree', 'giant_fern', 'ancient_conifer', 'cycad_palm'],
        secondaryAssets: ['fern_cluster', 'moss_rock', 'fallen_log', 'ground_fern'],
        particleType: 'dust',
        particleColor: 0xc0d8b0,    // Soft green-tinted particles (pollen/spores)
        particleDensity: 80,        // Light ambient particles

        assetScaleMin: 1.0,
        assetScaleMax: 2.5,
        assetColorVariance: 0.08,
        assetDetailLevel: 1.0,      // HIGH DETAIL
    },

    // ERA 2: ICE AGE (2 Million Years Ago) - Pixar's Ice Age meets Monet
    // Fast-paced 35mph journey through frozen tundra with glacial walls,
    // rushing meltwater, mammoth/caveman silhouettes, and heavy snowfall
    {
        id: 2,
        name: 'Ice Age',
        eloMin: 451,
        eloMax: 599,
        timePeriod: '2 Million Years Ago',
        description: 'Monet-style frozen wonderland - glaciers, mammoths fleeing cavemen, rushing water',

        // Sky: Icy Monet-inspired soft blues - cold winter atmosphere
        skyTopColor: 0x1a2a4a,      // Deep steel blue
        skyMidColor: 0x5a7a9a,      // Soft Monet blue-grey
        skyBottomColor: 0xb8c8d8,   // Pale icy horizon
        horizonGlow: 0xc0d0e8,      // Subtle cool glow (no yellow)
        starDensity: 0.05,
        nebulaIntensity: 0,
        auroraIntensity: 0.4,       // Softer aurora

        // Fog: Soft icy mist
        fogColor: 0xc0d0e0,         // Cool blue-grey mist
        fogNearBase: 15,
        fogFarBase: 80,
        fogDensityMin: 0.25,
        fogDensityMax: 0.5,

        // Lighting: Cold winter light
        sunColor: 0xf0f8ff,         // Cool white sun
        sunIntensity: 1.2,
        sunAngleBase: 0.35,         // Low winter sun
        ambientColor: 0x8090b8,     // Cool blue ambient
        ambientIntensity: 1.0,
        rimLightColor: 0xa0d0ff,    // Icy rim light
        rimLightIntensity: 0.5,

        // Motion: 35 MPH feel - fast but not extreme
        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0x80e0ff,
        accentLightIntensity: 1.0,

        primaryAssets: ['glacier', 'mammoth', 'frozen_waterfall', 'ice_cave'],
        secondaryAssets: ['snow_drift', 'frozen_tree', 'ice_crystal', 'snow_pine'],
        particleType: 'snow',
        particleColor: 0xffffff,
        particleDensity: 600,       // Heavy snowfall

        assetScaleMin: 1.2,
        assetScaleMax: 2.5,
        assetColorVariance: 0.15,
        assetDetailLevel: 1.0,
    },

    // ERA 3: STONE AGE (50,000 BC)
    {
        id: 3,
        name: 'Stone Age',
        eloMin: 500,
        eloMax: 699,
        timePeriod: '50,000 BC',
        description: 'Early humans, cave paintings, campfires',

        skyTopColor: 0x2a3a5a,
        skyMidColor: 0x5a7090,
        skyBottomColor: 0xf0a060,
        horizonGlow: 0xff8040,
        starDensity: 0.3,
        nebulaIntensity: 0,
        auroraIntensity: 0,

        fogColor: 0x706050,
        fogNearBase: 25,
        fogFarBase: 120,
        fogDensityMin: 0.2,
        fogDensityMax: 0.5,

        sunColor: 0xffd080,
        sunIntensity: 1.0,
        sunAngleBase: 0.4,
        ambientColor: 0x605040,
        ambientIntensity: 0.6,
        rimLightColor: 0xff6020,
        rimLightIntensity: 0.6,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0xff4400,
        accentLightIntensity: 1.5,

        primaryAssets: ['cave', 'campfire', 'stone_circle', 'primitive_hut'],
        secondaryAssets: ['rock_formation', 'dead_tree', 'animal_bones'],
        particleType: 'sparks',
        particleColor: 0xff6600,
        particleDensity: 100,

        assetScaleMin: 0.7,
        assetScaleMax: 1.5,
        assetColorVariance: 0.15,
        assetDetailLevel: 1.0,
    },

    // ERA 4: BRONZE AGE (3000 BC)
    {
        id: 4,
        name: 'Bronze Age',
        eloMin: 700,
        eloMax: 899,
        timePeriod: '3000 BC',
        description: 'First cities, pyramids, Mesopotamia',

        skyTopColor: 0x1a3050,
        skyMidColor: 0x4080b0,
        skyBottomColor: 0xf0d090,
        horizonGlow: 0xffc060,
        starDensity: 0.1,
        nebulaIntensity: 0,
        auroraIntensity: 0,

        fogColor: 0xd0c0a0,
        fogNearBase: 30,
        fogFarBase: 150,
        fogDensityMin: 0.15,
        fogDensityMax: 0.4,

        sunColor: 0xfff0c0,
        sunIntensity: 1.4,
        sunAngleBase: 0.6,
        ambientColor: 0xc0a080,
        ambientIntensity: 0.8,
        rimLightColor: 0xffd080,
        rimLightIntensity: 0.3,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0xffa020,
        accentLightIntensity: 1.0,

        primaryAssets: ['pyramid', 'ziggurat', 'obelisk', 'sphinx'],
        secondaryAssets: ['palm_tree', 'sandstone_pillar', 'ancient_vessel'],
        particleType: 'dust',
        particleColor: 0xd0b080,
        particleDensity: 150,

        assetScaleMin: 1.0,
        assetScaleMax: 3.0,
        assetColorVariance: 0.1,
        assetDetailLevel: 1.2,
    },

    // ERA 5: CLASSICAL (500 BC)
    {
        id: 5,
        name: 'Classical',
        eloMin: 900,
        eloMax: 1099,
        timePeriod: '500 BC',
        description: 'Greek temples, philosophy, Mediterranean glory',

        skyTopColor: 0x2050a0,
        skyMidColor: 0x60a0e0,
        skyBottomColor: 0xf0e8d0,
        horizonGlow: 0xfffaf0,
        starDensity: 0.05,
        nebulaIntensity: 0,
        auroraIntensity: 0,

        fogColor: 0xe0e8f0,
        fogNearBase: 35,
        fogFarBase: 180,
        fogDensityMin: 0.1,
        fogDensityMax: 0.3,

        sunColor: 0xfffff0,
        sunIntensity: 1.3,
        sunAngleBase: 0.7,
        ambientColor: 0xa0b0c0,
        ambientIntensity: 0.9,
        rimLightColor: 0xffffff,
        rimLightIntensity: 0.4,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0xfff8e0,
        accentLightIntensity: 0.8,

        primaryAssets: ['greek_temple', 'colosseum', 'statue', 'aqueduct'],
        secondaryAssets: ['olive_tree', 'marble_column', 'amphora'],
        particleType: 'leaves',
        particleColor: 0x80a060,
        particleDensity: 80,

        assetScaleMin: 1.2,
        assetScaleMax: 2.5,
        assetColorVariance: 0.08,
        assetDetailLevel: 1.5,
    },

    // ERA 6: MEDIEVAL (1000 AD)
    {
        id: 6,
        name: 'Medieval',
        eloMin: 1100,
        eloMax: 1299,
        timePeriod: '1000 AD',
        description: 'Castles, knights, dark forests',

        skyTopColor: 0x1a2030,
        skyMidColor: 0x3a5070,
        skyBottomColor: 0x8090a0,
        horizonGlow: 0x606870,
        starDensity: 0.15,
        nebulaIntensity: 0,
        auroraIntensity: 0,

        fogColor: 0x4a5a6a,
        fogNearBase: 20,
        fogFarBase: 100,
        fogDensityMin: 0.4,
        fogDensityMax: 0.7,

        sunColor: 0xd0d8e0,
        sunIntensity: 0.8,
        sunAngleBase: 0.4,
        ambientColor: 0x404850,
        ambientIntensity: 0.5,
        rimLightColor: 0xc0c8d0,
        rimLightIntensity: 0.3,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0xff8040,
        accentLightIntensity: 1.5,

        primaryAssets: ['castle', 'cathedral', 'windmill', 'watchtower'],
        secondaryAssets: ['dark_oak', 'torch', 'banner', 'stone_bridge'],
        particleType: 'leaves',
        particleColor: 0x604020,
        particleDensity: 120,

        assetScaleMin: 1.5,
        assetScaleMax: 4.0,
        assetColorVariance: 0.12,
        assetDetailLevel: 1.8,
    },

    // ERA 7: RENAISSANCE (1500 AD)
    {
        id: 7,
        name: 'Renaissance',
        eloMin: 1300,
        eloMax: 1499,
        timePeriod: '1500 AD',
        description: 'Art, innovation, ornate architecture',

        skyTopColor: 0x3060a0,
        skyMidColor: 0x80b0e0,
        skyBottomColor: 0xfff0d0,
        horizonGlow: 0xffe8c0,
        starDensity: 0.08,
        nebulaIntensity: 0,
        auroraIntensity: 0,

        fogColor: 0xc0d0e0,
        fogNearBase: 40,
        fogFarBase: 160,
        fogDensityMin: 0.15,
        fogDensityMax: 0.35,

        sunColor: 0xfff8e0,
        sunIntensity: 1.2,
        sunAngleBase: 0.6,
        ambientColor: 0xa0a8b0,
        ambientIntensity: 0.8,
        rimLightColor: 0xfff0d0,
        rimLightIntensity: 0.4,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0xffd090,
        accentLightIntensity: 1.0,

        primaryAssets: ['palazzo', 'dome', 'fountain', 'garden'],
        secondaryAssets: ['cypress_tree', 'sculpture', 'archway'],
        particleType: 'leaves',
        particleColor: 0x60a040,
        particleDensity: 60,

        assetScaleMin: 1.3,
        assetScaleMax: 3.0,
        assetColorVariance: 0.1,
        assetDetailLevel: 2.0,
    },

    // ERA 8: INDUSTRIAL (1800 AD)
    {
        id: 8,
        name: 'Industrial',
        eloMin: 1500,
        eloMax: 1699,
        timePeriod: '1850 AD',
        description: 'Steam power, factories, iron and coal',

        skyTopColor: 0x2a2a3a,
        skyMidColor: 0x4a4a5a,
        skyBottomColor: 0x6a5a4a,
        horizonGlow: 0x8a6a4a,
        starDensity: 0,
        nebulaIntensity: 0,
        auroraIntensity: 0,

        fogColor: 0x5a5040,
        fogNearBase: 15,
        fogFarBase: 70,
        fogDensityMin: 0.5,
        fogDensityMax: 0.85,

        sunColor: 0xd0c0a0,
        sunIntensity: 0.7,
        sunAngleBase: 0.35,
        ambientColor: 0x504840,
        ambientIntensity: 0.4,
        rimLightColor: 0x806040,
        rimLightIntensity: 0.2,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0xff6020,
        accentLightIntensity: 2.0,

        primaryAssets: ['factory', 'smokestack', 'steam_train', 'iron_bridge'],
        secondaryAssets: ['coal_heap', 'gas_lamp', 'warehouse'],
        particleType: 'ash',
        particleColor: 0x303030,
        particleDensity: 350,

        assetScaleMin: 1.5,
        assetScaleMax: 4.0,
        assetColorVariance: 0.08,
        assetDetailLevel: 2.2,
    },

    // ERA 9: MODERN (1950 AD)
    {
        id: 9,
        name: 'Modern',
        eloMin: 1700,
        eloMax: 1899,
        timePeriod: '1960 AD',
        description: 'Cars, suburbs, neon signs',

        skyTopColor: 0x1a2a4a,
        skyMidColor: 0x4060a0,
        skyBottomColor: 0xff8060,
        horizonGlow: 0xff6040,
        starDensity: 0.05,
        nebulaIntensity: 0,
        auroraIntensity: 0,

        fogColor: 0x6a5a6a,
        fogNearBase: 30,
        fogFarBase: 120,
        fogDensityMin: 0.2,
        fogDensityMax: 0.45,

        sunColor: 0xffd0a0,
        sunIntensity: 1.0,
        sunAngleBase: 0.3,
        ambientColor: 0x705060,
        ambientIntensity: 0.6,
        rimLightColor: 0xff8060,
        rimLightIntensity: 0.5,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0xff00ff,
        accentLightIntensity: 1.5,

        primaryAssets: ['skyscraper_retro', 'diner', 'drive_in', 'motel'],
        secondaryAssets: ['vintage_car', 'neon_sign', 'street_lamp'],
        particleType: 'dust',
        particleColor: 0x806080,
        particleDensity: 50,

        assetScaleMin: 1.2,
        assetScaleMax: 3.5,
        assetColorVariance: 0.15,
        assetDetailLevel: 2.5,
    },

    // ERA 10: DIGITAL (2000 AD)
    {
        id: 10,
        name: 'Digital',
        eloMin: 1900,
        eloMax: 2099,
        timePeriod: '2010 AD',
        description: 'Internet age, glass towers, screens everywhere',

        skyTopColor: 0x0a1a2a,
        skyMidColor: 0x2040a0,
        skyBottomColor: 0x102050,
        horizonGlow: 0x00ffff,
        starDensity: 0.1,
        nebulaIntensity: 0,
        auroraIntensity: 0,

        fogColor: 0x102030,
        fogNearBase: 40,
        fogFarBase: 150,
        fogDensityMin: 0.15,
        fogDensityMax: 0.35,

        sunColor: 0xffffff,
        sunIntensity: 1.1,
        sunAngleBase: 0.5,
        ambientColor: 0x2040a0,
        ambientIntensity: 0.7,
        rimLightColor: 0x00ffff,
        rimLightIntensity: 0.6,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0x00ff80,
        accentLightIntensity: 1.8,

        primaryAssets: ['glass_tower', 'server_farm', 'antenna_array', 'tech_campus'],
        secondaryAssets: ['led_billboard', 'wifi_tower', 'solar_panel'],
        particleType: 'data',
        particleColor: 0x00ff80,
        particleDensity: 200,

        assetScaleMin: 1.5,
        assetScaleMax: 5.0,
        assetColorVariance: 0.1,
        assetDetailLevel: 3.0,
    },

    // ERA 11: NEAR FUTURE (2050 AD)
    {
        id: 11,
        name: 'Near Future',
        eloMin: 2100,
        eloMax: 2299,
        timePeriod: '2050 AD',
        description: 'Drones, holograms, clean energy',

        skyTopColor: 0x1020a0,
        skyMidColor: 0x4080ff,
        skyBottomColor: 0x80c0ff,
        horizonGlow: 0xffffff,
        starDensity: 0.15,
        nebulaIntensity: 0,
        auroraIntensity: 0.2,

        fogColor: 0x4080c0,
        fogNearBase: 50,
        fogFarBase: 200,
        fogDensityMin: 0.1,
        fogDensityMax: 0.25,

        sunColor: 0xffffff,
        sunIntensity: 1.4,
        sunAngleBase: 0.7,
        ambientColor: 0x4080ff,
        ambientIntensity: 0.9,
        rimLightColor: 0x80ffff,
        rimLightIntensity: 0.7,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0x80ffff,
        accentLightIntensity: 1.5,

        primaryAssets: ['eco_tower', 'maglev_track', 'wind_farm', 'drone_hub'],
        secondaryAssets: ['hologram_ad', 'flying_car', 'robot_worker'],
        particleType: 'energy',
        particleColor: 0x80ffff,
        particleDensity: 150,

        assetScaleMin: 2.0,
        assetScaleMax: 6.0,
        assetColorVariance: 0.08,
        assetDetailLevel: 3.5,
    },

    // ERA 12: CYBERPUNK (2100 AD)
    {
        id: 12,
        name: 'Cyberpunk',
        eloMin: 2300,
        eloMax: 2499,
        timePeriod: '2100 AD',
        description: 'Megacities, neon rain, AR overlays',

        skyTopColor: 0x0a0a2a,
        skyMidColor: 0x2a1060,
        skyBottomColor: 0x4a2080,
        horizonGlow: 0xff00ff,
        starDensity: 0.05,
        nebulaIntensity: 0.1,
        auroraIntensity: 0,

        fogColor: 0x201040,
        fogNearBase: 20,
        fogFarBase: 80,
        fogDensityMin: 0.4,
        fogDensityMax: 0.7,

        sunColor: 0xff80ff,
        sunIntensity: 0.6,
        sunAngleBase: 0.2,
        ambientColor: 0x4020a0,
        ambientIntensity: 0.5,
        rimLightColor: 0xff00ff,
        rimLightIntensity: 1.0,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0x00ffff,
        accentLightIntensity: 2.5,

        primaryAssets: ['megacity_block', 'neon_tower', 'sky_bridge', 'arcology'],
        secondaryAssets: ['hover_bike', 'hologram_geisha', 'rain_gutter', 'neon_kanji'],
        particleType: 'rain',
        particleColor: 0xff80ff,
        particleDensity: 500,

        assetScaleMin: 3.0,
        assetScaleMax: 10.0,
        assetColorVariance: 0.2,
        assetDetailLevel: 4.0,
    },

    // ERA 13: SPACE AGE (2200 AD)
    {
        id: 13,
        name: 'Space Age',
        eloMin: 2500,
        eloMax: 2699,
        timePeriod: '2200 AD',
        description: 'Orbital stations, rocket launches',

        skyTopColor: 0x000010,
        skyMidColor: 0x000030,
        skyBottomColor: 0x2050a0,
        horizonGlow: 0x4080ff,
        starDensity: 0.6,
        nebulaIntensity: 0.1,
        auroraIntensity: 0.3,

        fogColor: 0x102040,
        fogNearBase: 60,
        fogFarBase: 250,
        fogDensityMin: 0.05,
        fogDensityMax: 0.2,

        sunColor: 0xffffff,
        sunIntensity: 1.8,
        sunAngleBase: 0.8,
        ambientColor: 0x2040a0,
        ambientIntensity: 0.4,
        rimLightColor: 0x80c0ff,
        rimLightIntensity: 0.8,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0xff8040,
        accentLightIntensity: 3.0,

        primaryAssets: ['space_elevator', 'launch_pad', 'orbital_ring', 'habitat_dome'],
        secondaryAssets: ['rocket', 'satellite_dish', 'solar_array'],
        particleType: 'stars',
        particleColor: 0xffffff,
        particleDensity: 300,

        assetScaleMin: 2.0,
        assetScaleMax: 8.0,
        assetColorVariance: 0.05,
        assetDetailLevel: 4.5,
    },

    // ERA 14: LUNAR COLONY (2300 AD)
    {
        id: 14,
        name: 'Lunar Colony',
        eloMin: 2700,
        eloMax: 2899,
        timePeriod: '2300 AD',
        description: 'Moon bases, Earth in the sky',

        skyTopColor: 0x000000,
        skyMidColor: 0x000005,
        skyBottomColor: 0x101010,
        horizonGlow: 0x202020,
        starDensity: 0.9,
        nebulaIntensity: 0.05,
        auroraIntensity: 0,

        fogColor: 0x101010,
        fogNearBase: 80,
        fogFarBase: 300,
        fogDensityMin: 0.02,
        fogDensityMax: 0.1,

        sunColor: 0xffffff,
        sunIntensity: 2.0,
        sunAngleBase: 0.6,
        ambientColor: 0x303040,
        ambientIntensity: 0.3,
        rimLightColor: 0x4080ff,
        rimLightIntensity: 0.5,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0x80ffff,
        accentLightIntensity: 2.0,

        primaryAssets: ['moon_dome', 'lunar_rover', 'mining_rig', 'earth_view'],
        secondaryAssets: ['crater', 'regolith_mound', 'solar_collector'],
        particleType: 'dust',
        particleColor: 0x606060,
        particleDensity: 100,

        assetScaleMin: 1.5,
        assetScaleMax: 5.0,
        assetColorVariance: 0.03,
        assetDetailLevel: 4.0,
    },

    // ERA 15: MARS COLONY (2400 AD)
    {
        id: 15,
        name: 'Mars Colony',
        eloMin: 2900,
        eloMax: 3099,
        timePeriod: '2400 AD',
        description: 'Red landscape, terraforming begins',

        skyTopColor: 0x200808,
        skyMidColor: 0x401010,
        skyBottomColor: 0x804020,
        horizonGlow: 0xc06030,
        starDensity: 0.5,
        nebulaIntensity: 0,
        auroraIntensity: 0,

        fogColor: 0x603020,
        fogNearBase: 40,
        fogFarBase: 180,
        fogDensityMin: 0.2,
        fogDensityMax: 0.5,

        sunColor: 0xffd0a0,
        sunIntensity: 0.9,
        sunAngleBase: 0.5,
        ambientColor: 0x804020,
        ambientIntensity: 0.5,
        rimLightColor: 0xff8040,
        rimLightIntensity: 0.6,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0x40ff80,
        accentLightIntensity: 2.0,

        primaryAssets: ['mars_dome', 'terraformer', 'ice_mine', 'olympus_mons'],
        secondaryAssets: ['red_rock', 'dust_devil', 'greenhouse'],
        particleType: 'dust',
        particleColor: 0xc06040,
        particleDensity: 250,

        assetScaleMin: 2.0,
        assetScaleMax: 8.0,
        assetColorVariance: 0.1,
        assetDetailLevel: 4.5,
    },

    // ERA 16: SOLAR SYSTEM (2500 AD)
    {
        id: 16,
        name: 'Solar System',
        eloMin: 3100,
        eloMax: 3499,
        timePeriod: '2500 AD',
        description: 'Asteroid mining, gas giant stations',

        skyTopColor: 0x000008,
        skyMidColor: 0x000020,
        skyBottomColor: 0x102040,
        horizonGlow: 0x4080c0,
        starDensity: 0.95,
        nebulaIntensity: 0.2,
        auroraIntensity: 0,

        fogColor: 0x081020,
        fogNearBase: 100,
        fogFarBase: 400,
        fogDensityMin: 0.01,
        fogDensityMax: 0.08,

        sunColor: 0xfff0e0,
        sunIntensity: 0.6,
        sunAngleBase: 0.4,
        ambientColor: 0x203050,
        ambientIntensity: 0.3,
        rimLightColor: 0xffa080,
        rimLightIntensity: 0.4,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0xff8040,
        accentLightIntensity: 2.5,

        primaryAssets: ['asteroid_station', 'gas_harvester', 'jupiter_view', 'ring_station'],
        secondaryAssets: ['asteroid', 'mining_ship', 'relay_beacon'],
        particleType: 'cosmic',
        particleColor: 0x8080ff,
        particleDensity: 400,

        assetScaleMin: 3.0,
        assetScaleMax: 15.0,
        assetColorVariance: 0.15,
        assetDetailLevel: 5.0,
    },

    // ERA 17: TYPE 1 CIVILIZATION (3000 AD)
    {
        id: 17,
        name: 'Type I',
        eloMin: 3500,
        eloMax: 3999,
        timePeriod: '3000 AD',
        description: 'Planetary control, Dyson swarm beginnings',

        skyTopColor: 0x000010,
        skyMidColor: 0x1020a0,
        skyBottomColor: 0x4080ff,
        horizonGlow: 0x80c0ff,
        starDensity: 0.7,
        nebulaIntensity: 0.3,
        auroraIntensity: 0.5,

        fogColor: 0x2040a0,
        fogNearBase: 80,
        fogFarBase: 350,
        fogDensityMin: 0.05,
        fogDensityMax: 0.15,

        sunColor: 0xffffff,
        sunIntensity: 2.5,
        sunAngleBase: 0.6,
        ambientColor: 0x4080ff,
        ambientIntensity: 0.8,
        rimLightColor: 0xffff80,
        rimLightIntensity: 1.0,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0xffff00,
        accentLightIntensity: 3.0,

        primaryAssets: ['dyson_mirror', 'world_engine', 'orbital_city', 'matter_forge'],
        secondaryAssets: ['energy_beam', 'drone_swarm', 'mega_satellite'],
        particleType: 'energy',
        particleColor: 0xffff80,
        particleDensity: 300,

        assetScaleMin: 5.0,
        assetScaleMax: 25.0,
        assetColorVariance: 0.1,
        assetDetailLevel: 5.5,
    },

    // ERA 18: TYPE 2 CIVILIZATION (5000 AD)
    {
        id: 18,
        name: 'Type II',
        eloMin: 4000,
        eloMax: 4499,
        timePeriod: '5000 AD',
        description: 'Star-harvesting megastructures',

        skyTopColor: 0x100020,
        skyMidColor: 0x4010a0,
        skyBottomColor: 0xa040ff,
        horizonGlow: 0xff80ff,
        starDensity: 0.8,
        nebulaIntensity: 0.5,
        auroraIntensity: 0.7,

        fogColor: 0x4020a0,
        fogNearBase: 100,
        fogFarBase: 500,
        fogDensityMin: 0.02,
        fogDensityMax: 0.1,

        sunColor: 0xffffff,
        sunIntensity: 3.0,
        sunAngleBase: 0.5,
        ambientColor: 0xa040ff,
        ambientIntensity: 1.0,
        rimLightColor: 0xff40ff,
        rimLightIntensity: 1.2,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0xff00ff,
        accentLightIntensity: 4.0,

        primaryAssets: ['dyson_sphere', 'star_lifter', 'warp_gate', 'stellar_forge'],
        secondaryAssets: ['plasma_stream', 'energy_collector', 'megaship'],
        particleType: 'cosmic',
        particleColor: 0xff80ff,
        particleDensity: 400,

        assetScaleMin: 10.0,
        assetScaleMax: 50.0,
        assetColorVariance: 0.2,
        assetDetailLevel: 6.0,
    },

    // ERA 19: TYPE 2.5 (10000 AD)
    {
        id: 19,
        name: 'Type II.5',
        eloMin: 4500,
        eloMax: 4999,
        timePeriod: '10,000 AD',
        description: 'Interstellar travel, nebula harvesting',

        skyTopColor: 0x200040,
        skyMidColor: 0x8020c0,
        skyBottomColor: 0xff60ff,
        horizonGlow: 0xffaaff,
        starDensity: 0.9,
        nebulaIntensity: 0.8,
        auroraIntensity: 0.9,

        fogColor: 0x6020a0,
        fogNearBase: 120,
        fogFarBase: 600,
        fogDensityMin: 0.01,
        fogDensityMax: 0.06,

        sunColor: 0xffffff,
        sunIntensity: 2.0,
        sunAngleBase: 0.4,
        ambientColor: 0xff60ff,
        ambientIntensity: 1.2,
        rimLightColor: 0xffaaff,
        rimLightIntensity: 1.5,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0xaa00ff,
        accentLightIntensity: 5.0,

        primaryAssets: ['nebula_harvester', 'starship_armada', 'void_station', 'hyperlane'],
        secondaryAssets: ['wormhole', 'cosmic_string', 'dark_matter_collector'],
        particleType: 'cosmic',
        particleColor: 0xffaaff,
        particleDensity: 500,

        assetScaleMin: 15.0,
        assetScaleMax: 75.0,
        assetColorVariance: 0.25,
        assetDetailLevel: 6.5,
    },

    // ERA 20: TYPE 3 CIVILIZATION (Beyond)
    {
        id: 20,
        name: 'Type III',
        eloMin: 5000,
        eloMax: 9999,
        timePeriod: 'Beyond Time',
        description: 'Galaxy-spanning civilization, cosmic transcendence',

        skyTopColor: 0x400080,
        skyMidColor: 0xc040ff,
        skyBottomColor: 0xffffff,
        horizonGlow: 0xffffff,
        starDensity: 1.0,
        nebulaIntensity: 1.0,
        auroraIntensity: 1.0,

        fogColor: 0xa060ff,
        fogNearBase: 150,
        fogFarBase: 800,
        fogDensityMin: 0.005,
        fogDensityMax: 0.03,

        sunColor: 0xffffff,
        sunIntensity: 4.0,
        sunAngleBase: 0.5,
        ambientColor: 0xffffff,
        ambientIntensity: 1.5,
        rimLightColor: 0xffffff,
        rimLightIntensity: 2.0,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0xffffff,
        accentLightIntensity: 6.0,

        primaryAssets: ['galactic_hub', 'reality_engine', 'dimension_gate', 'cosmic_entity'],
        secondaryAssets: ['galaxy_arm', 'quasar', 'black_hole', 'cosmic_web'],
        particleType: 'cosmic',
        particleColor: 0xffffff,
        particleDensity: 800,

        assetScaleMin: 25.0,
        assetScaleMax: 150.0,
        assetColorVariance: 0.3,
        assetDetailLevel: 7.0,
    },
];

// =============================================================================
// ERA HELPER FUNCTIONS
// =============================================================================

/**
 * Get the era configuration for a given ELO
 */
export function getEraForElo(elo: number): EraConfig {
    for (const era of ERAS) {
        if (elo >= era.eloMin && elo <= era.eloMax) {
            return era;
        }
    }
    // Default to highest era if beyond max
    return ERAS[ERAS.length - 1];
}

/**
 * Get progress within current era (0-1)
 */
export function getEraProgress(elo: number): number {
    const era = getEraForElo(elo);
    const range = era.eloMax - era.eloMin;
    const progress = (elo - era.eloMin) / range;
    return Math.max(0, Math.min(1, progress));
}

/**
 * Interpolate a value based on era progress
 */
export function interpolateEraValue(min: number, max: number, elo: number): number {
    const progress = getEraProgress(elo);
    return min + (max - min) * progress;
}

/**
 * Get interpolated color between two hex colors
 */
export function interpolateColor(color1: number, color2: number, t: number): number {
    const r1 = (color1 >> 16) & 0xff;
    const g1 = (color1 >> 8) & 0xff;
    const b1 = color1 & 0xff;

    const r2 = (color2 >> 16) & 0xff;
    const g2 = (color2 >> 8) & 0xff;
    const b2 = color2 & 0xff;

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return (r << 16) | (g << 8) | b;
}

/**
 * Check if transitioning between eras
 */
export function checkEraTransition(oldElo: number, newElo: number): { fromEra: EraConfig; toEra: EraConfig } | null {
    const oldEra = getEraForElo(oldElo);
    const newEra = getEraForElo(newElo);

    if (oldEra.id !== newEra.id) {
        return { fromEra: oldEra, toEra: newEra };
    }
    return null;
}

/**
 * Get current ribbon speed based on ELO
 */
export function getRibbonSpeed(elo: number): number {
    const era = getEraForElo(elo);
    return interpolateEraValue(era.ribbonSpeedMin, era.ribbonSpeedMax, elo);
}

/**
 * Get current fog density based on ELO
 */
export function getFogDensity(elo: number): number {
    const era = getEraForElo(elo);
    return interpolateEraValue(era.fogDensityMin, era.fogDensityMax, elo);
}

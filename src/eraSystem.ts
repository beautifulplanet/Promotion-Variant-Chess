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
    particleType: 'leaves' | 'snow' | 'ash' | 'dust' | 'rain' | 'sparks' | 'data' | 'energy' | 'stars' | 'cosmic' | 'lorenz';
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
        // PALETTE: Emerald + amber dapple (Ghibli jungle)
        skyTopColor: 0x1a4848,    // Deep teal zenith
        skyMidColor: 0x3a7a62,    // Rich jungle midtone
        skyBottomColor: 0x90c8a0, // Pale sage horizon
        horizonGlow: 0xa0d4b0,    // Soft green haze
        starDensity: 0,
        nebulaIntensity: 0,
        auroraIntensity: 0,

        // Fog: Atmospheric jungle mist
        fogColor: 0x5a8a6a,       // Emerald mist
        fogNearBase: 30,
        fogFarBase: 150,
        fogDensityMin: 0.15,
        fogDensityMax: 0.35,

        // Lighting: Warm dappled light through canopy
        sunColor: 0xffe8c0,       // Warm amber dapple
        sunIntensity: 1.0,
        sunAngleBase: 0.6,
        ambientColor: 0x3a6a4a,   // Deep emerald ambient
        ambientIntensity: 0.6,
        rimLightColor: 0x80c890,  // Green halo rim
        rimLightIntensity: 0.3,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0xd4a840,  // Warm amber accent (complement!)
        accentLightIntensity: 0.4,

        // Assets: Realistic prehistoric vegetation
        primaryAssets: ['jurassic_tree', 'giant_fern', 'ancient_conifer', 'cycad_palm'],
        secondaryAssets: ['fern_cluster', 'moss_rock', 'fallen_log', 'ground_fern'],
        particleType: 'dust',
        particleColor: 0xa0d890,    // Bright green pollen
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

        // PALETTE: Steel blue monochrome + rose dawn accent (Celeste)
        skyTopColor: 0x0a1830,      // Deep steel zenith
        skyMidColor: 0x4a6a90,      // Desaturated blue
        skyBottomColor: 0xc8d0d8,   // Pale silver horizon
        horizonGlow: 0xd8c0c8,      // Subtle dawn rose!
        starDensity: 0.05,
        nebulaIntensity: 0,
        auroraIntensity: 0.4,

        // Fog: Silver mist
        fogColor: 0xb0c0d0,         // Silver-blue mist
        fogNearBase: 15,
        fogFarBase: 80,
        fogDensityMin: 0.25,
        fogDensityMax: 0.5,

        // Lighting: Cold with rose warmth
        sunColor: 0xe8f0ff,         // Blue-white sun
        sunIntensity: 1.2,
        sunAngleBase: 0.35,
        ambientColor: 0x6078a0,     // Steel blue ambient
        ambientIntensity: 1.0,
        rimLightColor: 0x90b8e0,    // Pale blue rim
        rimLightIntensity: 0.5,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0xd0a0b0, // Rose accent (warm complement!)
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

        // PALETTE: Deep indigo sky + rich campfire (Journey hearth)
        skyTopColor: 0x1a1830,    // Dark indigo zenith
        skyMidColor: 0x3a3050,    // Dusky purple
        skyBottomColor: 0xe08848, // Sunset amber horizon
        horizonGlow: 0xff6830,    // Intense fire glow
        starDensity: 0.3,
        nebulaIntensity: 0,
        auroraIntensity: 0,

        fogColor: 0x604838,       // Warm smoke
        fogNearBase: 25,
        fogFarBase: 120,
        fogDensityMin: 0.2,
        fogDensityMax: 0.5,

        sunColor: 0xffb870,       // Golden amber
        sunIntensity: 1.0,
        sunAngleBase: 0.4,
        ambientColor: 0x4a3828,   // Warm earth
        ambientIntensity: 0.6,
        rimLightColor: 0xff5020,  // Fire orange rim
        rimLightIntensity: 0.6,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0xff3800,   // Intense campfire
        accentLightIntensity: 1.5,

        primaryAssets: ['cave', 'campfire', 'stone_circle', 'primitive_hut'],
        secondaryAssets: ['rock_formation', 'dead_tree', 'animal_bones'],
        particleType: 'sparks',
        particleColor: 0xff7020,   // Vivid fire sparks
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

        // PALETTE: Lapis lazuli sky + rich gold (Egyptian majesty)
        skyTopColor: 0x183868,    // Deep lapis zenith
        skyMidColor: 0x4888c0,    // Vivid sky blue
        skyBottomColor: 0xf0c870, // Rich gold horizon
        horizonGlow: 0xf0a840,    // Bronze glow
        starDensity: 0.1,
        nebulaIntensity: 0,
        auroraIntensity: 0,

        fogColor: 0xc8b088,       // Desert haze
        fogNearBase: 30,
        fogFarBase: 150,
        fogDensityMin: 0.15,
        fogDensityMax: 0.4,

        sunColor: 0xfff0b0,       // Bright gold
        sunIntensity: 1.4,
        sunAngleBase: 0.6,
        ambientColor: 0xb89060,   // Warm sandstone
        ambientIntensity: 0.8,
        rimLightColor: 0xf0c060,  // Gold rim
        rimLightIntensity: 0.3,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0xe89020, // Deep bronze accent
        accentLightIntensity: 1.0,

        primaryAssets: ['pyramid', 'ziggurat', 'obelisk', 'sphinx'],
        secondaryAssets: ['palm_tree', 'sandstone_pillar', 'ancient_vessel'],
        particleType: 'dust',
        particleColor: 0xd8b078,   // Warm sand dust
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

        // PALETTE: Deep blue-black + torchlight gold (Hollow Knight)
        skyTopColor: 0x101828,    // Near-black blue zenith
        skyMidColor: 0x283848,    // Dark blue-grey
        skyBottomColor: 0x506070, // Moody slate horizon
        horizonGlow: 0x485060,    // Muted steel glow
        starDensity: 0.15,
        nebulaIntensity: 0,
        auroraIntensity: 0,

        fogColor: 0x384050,       // Dark blue mist
        fogNearBase: 20,
        fogFarBase: 100,
        fogDensityMin: 0.4,
        fogDensityMax: 0.7,

        sunColor: 0xc0b8a8,       // Dim watery sun
        sunIntensity: 0.8,
        sunAngleBase: 0.4,
        ambientColor: 0x303840,   // Very dark cool
        ambientIntensity: 0.5,
        rimLightColor: 0x806040,  // Faint warm rim
        rimLightIntensity: 0.3,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0xff7030,  // STRONG torchlight (the star of the palette!)
        accentLightIntensity: 1.8,

        primaryAssets: ['castle', 'cathedral', 'windmill', 'watchtower'],
        secondaryAssets: ['dark_oak', 'torch', 'banner', 'stone_bridge'],
        particleType: 'leaves',
        particleColor: 0x804828,   // Warm dead leaves
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

        // PALETTE: Graphite + tarnished copper + furnace orange (Limbo/Inside)
        skyTopColor: 0x1a1a28,    // Dark graphite
        skyMidColor: 0x383848,    // Slate
        skyBottomColor: 0x685040, // Smoky brown horizon
        horizonGlow: 0x986838,    // Tarnished copper glow
        starDensity: 0,
        nebulaIntensity: 0,
        auroraIntensity: 0,

        fogColor: 0x484038,       // Thick soot
        fogNearBase: 15,
        fogFarBase: 70,
        fogDensityMin: 0.5,
        fogDensityMax: 0.85,

        sunColor: 0xc8a880,       // Filtered through smog
        sunIntensity: 0.7,
        sunAngleBase: 0.35,
        ambientColor: 0x3a3430,   // Dark warm ambient
        ambientIntensity: 0.4,
        rimLightColor: 0x906840,  // Copper rim
        rimLightIntensity: 0.3,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0xff5010,  // INTENSE furnace red-orange
        accentLightIntensity: 2.2,

        primaryAssets: ['factory', 'smokestack', 'steam_train', 'iron_bridge'],
        secondaryAssets: ['coal_heap', 'gas_lamp', 'warehouse'],
        particleType: 'ash',
        particleColor: 0x484040,   // Dark soot ash
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

        // PALETTE: Indigo twilight + neon coral (Outrun/synthwave)
        skyTopColor: 0x101838,    // Deep indigo
        skyMidColor: 0x283060,    // Twilight blue
        skyBottomColor: 0xd06848, // Warm coral band
        horizonGlow: 0xff5838,    // Neon coral glow
        starDensity: 0.05,
        nebulaIntensity: 0,
        auroraIntensity: 0,

        fogColor: 0x504058,       // Mauve haze
        fogNearBase: 30,
        fogFarBase: 120,
        fogDensityMin: 0.2,
        fogDensityMax: 0.45,

        sunColor: 0xffc080,       // Golden sunset
        sunIntensity: 1.0,
        sunAngleBase: 0.3,
        ambientColor: 0x483850,   // Cool mauve
        ambientIntensity: 0.6,
        rimLightColor: 0xe06848,  // Coral rim
        rimLightIntensity: 0.5,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0xff2060,  // Neon pink accent!
        accentLightIntensity: 1.5,

        primaryAssets: ['skyscraper_retro', 'diner', 'drive_in', 'motel'],
        secondaryAssets: ['vintage_car', 'neon_sign', 'street_lamp'],
        particleType: 'dust',
        particleColor: 0x886078,   // Mauve dust
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
        particleType: 'lorenz',
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

        // PALETTE: Clean teal + solar gold accent (Abzu optimism)
        skyTopColor: 0x103850,    // Teal zenith
        skyMidColor: 0x40a0b8,    // Bright teal
        skyBottomColor: 0x90e0e8, // Pale cyan horizon
        horizonGlow: 0xf0f8f0,    // Clean white glow
        starDensity: 0.15,
        nebulaIntensity: 0,
        auroraIntensity: 0.2,

        fogColor: 0x60a0b0,       // Teal-grey mist
        fogNearBase: 50,
        fogFarBase: 200,
        fogDensityMin: 0.1,
        fogDensityMax: 0.25,

        sunColor: 0xfff8f0,       // Warm clean white
        sunIntensity: 1.4,
        sunAngleBase: 0.7,
        ambientColor: 0x50a0b8,   // Teal ambient
        ambientIntensity: 0.9,
        rimLightColor: 0xb0f0f0,  // Pale cyan rim
        rimLightIntensity: 0.7,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0xf0c030,  // Solar gold accent!
        accentLightIntensity: 1.5,

        primaryAssets: ['eco_tower', 'maglev_track', 'wind_farm', 'drone_hub'],
        secondaryAssets: ['hologram_ad', 'flying_car', 'robot_worker'],
        particleType: 'energy',
        particleColor: 0x80e8d0,   // Teal-mint energy
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

        // PALETTE: Cosmic navy + warm amber + nebula lavender
        skyTopColor: 0x000008,    // Deepest void
        skyMidColor: 0x080818,    // Near-black
        skyBottomColor: 0x182848, // Deep navy horizon
        horizonGlow: 0x3060a0,    // Cool blue glow
        starDensity: 0.95,
        nebulaIntensity: 0.2,
        auroraIntensity: 0,

        fogColor: 0x081020,       // Void fog
        fogNearBase: 100,
        fogFarBase: 400,
        fogDensityMin: 0.01,
        fogDensityMax: 0.08,

        sunColor: 0xfff0d0,       // Warm distant sun
        sunIntensity: 0.6,
        sunAngleBase: 0.4,
        ambientColor: 0x182840,   // Cold deep ambient
        ambientIntensity: 0.3,
        rimLightColor: 0xd0a060,  // Warm distant orange
        rimLightIntensity: 0.4,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0xffa040, // Amber engine accent
        accentLightIntensity: 2.5,

        primaryAssets: ['asteroid_station', 'gas_harvester', 'jupiter_view', 'ring_station'],
        secondaryAssets: ['asteroid', 'mining_ship', 'relay_beacon'],
        particleType: 'cosmic',
        particleColor: 0x7070c0,   // Nebula lavender
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

        // PALETTE: Deep sapphire + brilliant gold (Dyson energy)
        skyTopColor: 0x000818,    // Deepest sapphire
        skyMidColor: 0x1030a0,    // Rich blue
        skyBottomColor: 0x3868d0, // Vivid sapphire
        horizonGlow: 0x60a0f0,    // Bright blue glow
        starDensity: 0.7,
        nebulaIntensity: 0.3,
        auroraIntensity: 0.5,

        fogColor: 0x182860,       // Deep blue fog
        fogNearBase: 80,
        fogFarBase: 350,
        fogDensityMin: 0.05,
        fogDensityMax: 0.15,

        sunColor: 0xfff8e0,       // Warm white
        sunIntensity: 2.5,
        sunAngleBase: 0.6,
        ambientColor: 0x3060c0,   // Blue ambient
        ambientIntensity: 0.8,
        rimLightColor: 0xffd860,  // Gold energy rim!
        rimLightIntensity: 1.0,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0xffcc00, // Brilliant gold energy
        accentLightIntensity: 3.0,

        primaryAssets: ['dyson_mirror', 'world_engine', 'orbital_city', 'matter_forge'],
        secondaryAssets: ['energy_beam', 'drone_swarm', 'mega_satellite'],
        particleType: 'energy',
        particleColor: 0xffe080,   // Gold energy particles
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

        // PALETTE: Deep crimson + stellar orange + plasma (stellar forge warmth)
        skyTopColor: 0x180008,    // Deep crimson-black
        skyMidColor: 0x601030,    // Dark wine
        skyBottomColor: 0xc04020, // Molten orange-red horizon
        horizonGlow: 0xff6030,    // Stellar orange glow
        starDensity: 0.8,
        nebulaIntensity: 0.5,
        auroraIntensity: 0.7,

        fogColor: 0x401020,       // Dark wine fog
        fogNearBase: 100,
        fogFarBase: 500,
        fogDensityMin: 0.02,
        fogDensityMax: 0.1,

        sunColor: 0xfffaf0,       // Super bright white
        sunIntensity: 3.0,
        sunAngleBase: 0.5,
        ambientColor: 0x802018,   // Deep red ambient
        ambientIntensity: 1.0,
        rimLightColor: 0xff8040,  // Stellar orange rim
        rimLightIntensity: 1.2,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0xff4000,  // Intense stellar orange
        accentLightIntensity: 4.0,

        primaryAssets: ['dyson_sphere', 'star_lifter', 'warp_gate', 'stellar_forge'],
        secondaryAssets: ['plasma_stream', 'energy_collector', 'megaship'],
        particleType: 'cosmic',
        particleColor: 0xff9060,   // Warm stellar particles
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

        // PALETTE: Void black + bending-light indigo + gravitational gold
        skyTopColor: 0x000010,    // Absolute void
        skyMidColor: 0x100830,    // Deep indigo
        skyBottomColor: 0x3020a0, // Vivid indigo horizon
        horizonGlow: 0x6040c0,    // Purple gravitational glow
        starDensity: 0.9,
        nebulaIntensity: 0.8,
        auroraIntensity: 0.9,

        fogColor: 0x180828,       // Dark indigo fog
        fogNearBase: 120,
        fogFarBase: 600,
        fogDensityMin: 0.01,
        fogDensityMax: 0.06,

        sunColor: 0xffffff,       // White
        sunIntensity: 2.0,
        sunAngleBase: 0.4,
        ambientColor: 0x3818a0,   // Deep indigo ambient
        ambientIntensity: 1.2,
        rimLightColor: 0x80a0ff,  // Blue-white rim
        rimLightIntensity: 1.5,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0xf0d020,  // Gravitational gold accent!
        accentLightIntensity: 5.0,

        primaryAssets: ['nebula_harvester', 'starship_armada', 'void_station', 'hyperlane'],
        secondaryAssets: ['wormhole', 'cosmic_string', 'dark_matter_collector'],
        particleType: 'cosmic',
        particleColor: 0x8060c0,   // Indigo cosmic particles
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

        // PALETTE: Cosmic violet → blinding white (transcendent prismatic)
        skyTopColor: 0x300068,    // Deep cosmic violet
        skyMidColor: 0xa050e0,    // Vivid purple midtone
        skyBottomColor: 0xf0e0ff, // Pale lavender horizon (not full white)
        horizonGlow: 0xffffff,    // Pure white glow
        starDensity: 1.0,
        nebulaIntensity: 1.0,
        auroraIntensity: 1.0,

        fogColor: 0x8040c0,       // Violet cosmic fog
        fogNearBase: 150,
        fogFarBase: 800,
        fogDensityMin: 0.005,
        fogDensityMax: 0.03,

        sunColor: 0xffffff,       // Pure white
        sunIntensity: 4.0,
        sunAngleBase: 0.5,
        ambientColor: 0xe0d0ff,   // Pale violet ambient
        ambientIntensity: 1.5,
        rimLightColor: 0xffffff,  // White rim
        rimLightIntensity: 2.0,

        ribbonSpeedMin: 0.4,
        ribbonSpeedMax: 0.8,

        accentLightColor: 0xffffff, // Pure white accent
        accentLightIntensity: 6.0,

        primaryAssets: ['galactic_hub', 'reality_engine', 'dimension_gate', 'cosmic_entity'],
        secondaryAssets: ['galaxy_arm', 'quasar', 'black_hole', 'cosmic_web'],
        particleType: 'cosmic',
        particleColor: 0xf0e0ff,   // Pale lavender cosmic
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

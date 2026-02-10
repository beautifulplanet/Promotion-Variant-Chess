// src/dynamicLighting.ts
// Dynamic Lighting System - ELO-Based Atmospheric Lighting
// 2026 Studio Quality: Volumetric effects, god rays, era-specific eerie atmospheres

import * as THREE from 'three';
import { EraConfig, getEraForElo, getEraProgress, interpolateEraValue } from './eraSystem';

// =============================================================================
// DYNAMIC LIGHTING CLASS
// =============================================================================

export class DynamicLighting {
    private scene: THREE.Scene;

    // Core lights
    private sun: THREE.DirectionalLight;
    private ambient: THREE.AmbientLight;
    private rimLight: THREE.DirectionalLight;
    private rimLight2: THREE.DirectionalLight;
    private hemisphere: THREE.HemisphereLight;
    private fillLight: THREE.DirectionalLight;

    // Era-specific accent lights
    private accentLights: THREE.PointLight[] = [];
    private maxAccentLights: number = 12;

    // God ray effect (volumetric light)
    private godRayMesh: THREE.Mesh | null = null;

    // Eerie ground fog plane
    private eerieFogMesh: THREE.Mesh | null = null;
    
    // Board spotlight - always illuminates the chess board
    private boardSpotlight: THREE.SpotLight;
    
    // Black side spotlights - illuminates black pieces for better contrast
    private blackSideSpotlight1: THREE.SpotLight;
    private blackSideSpotlight2: THREE.SpotLight;
    private blackSideFill: THREE.PointLight;

    // Eerie underlighting - lights from below for horror/dramatic effect
    private eerieUnderlight1: THREE.PointLight;
    private eerieUnderlight2: THREE.PointLight;
    private eerieUnderlight3: THREE.PointLight;

    // Eerie orbiting light - slowly circles the board
    private eerieOrbiter: THREE.PointLight;

    // Debug toggle
    private enabled: boolean = true;

    // Current state
    private currentElo: number = 400;
    private targetElo: number = 400;
    private transitionProgress: number = 1.0;

    // Animation state
    private time: number = 0;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // Create sun (main directional light) - ENHANCED SHADOWS
        this.sun = new THREE.DirectionalLight(0xffffff, 2.0);
        this.sun.position.set(50, 80, 50);
        this.sun.castShadow = true;
        // Performance-optimized shadow map (2048 is plenty for this game)
        this.sun.shadow.mapSize.width = 2048;
        this.sun.shadow.mapSize.height = 2048;
        this.sun.shadow.camera.near = 0.5;
        this.sun.shadow.camera.far = 250;
        this.sun.shadow.camera.left = -60;
        this.sun.shadow.camera.right = 60;
        this.sun.shadow.camera.top = 60;
        this.sun.shadow.camera.bottom = -60;
        this.sun.shadow.bias = -0.0003;
        this.sun.shadow.normalBias = 0.02;
        this.sun.shadow.radius = 2; // Soft shadow edges
        this.sun.name = 'era_sun';
        scene.add(this.sun);

        // Create ambient light - ENHANCED
        this.ambient = new THREE.AmbientLight(0x404050, 0.4);
        this.ambient.name = 'era_ambient';
        scene.add(this.ambient);

        // Create rim light (backlight for dramatic silhouettes) - ENHANCED
        this.rimLight = new THREE.DirectionalLight(0x6090ff, 0.6);
        this.rimLight.position.set(-40, 30, -60);
        this.rimLight.castShadow = false; // Only main light casts shadows
        this.rimLight.name = 'era_rim';
        scene.add(this.rimLight);
        
        // Add secondary rim light from opposite side for balanced fill
        this.rimLight2 = new THREE.DirectionalLight(0xff9060, 0.3);
        this.rimLight2.position.set(40, 20, -40);
        this.rimLight2.name = 'era_rim2';
        scene.add(this.rimLight2);

        // Create hemisphere light (sky/ground color blend) - ENHANCED
        this.hemisphere = new THREE.HemisphereLight(0x87ceeb, 0x3d5c3d, 0.5);
        this.hemisphere.name = 'era_hemisphere';
        scene.add(this.hemisphere);
        
        // Add fill light from below for piece visibility
        this.fillLight = new THREE.DirectionalLight(0xffffff, 0.2);
        this.fillLight.position.set(0, -10, 0);
        this.fillLight.name = 'era_fill';
        scene.add(this.fillLight);

        // Initialize accent lights pool
        for (let i = 0; i < this.maxAccentLights; i++) {
            const light = new THREE.PointLight(0xff0000, 0, 20);
            light.name = `era_accent_${i}`;
            light.visible = false;
            scene.add(light);
            this.accentLights.push(light);
        }

        // Create board spotlight - always illuminates the chess board
        this.boardSpotlight = new THREE.SpotLight(0xffffff, 1.5);
        this.boardSpotlight.position.set(3.5, 15, 3.5); // Centered above board
        this.boardSpotlight.target.position.set(3.5, 0, 3.5); // Target board center
        this.boardSpotlight.angle = Math.PI / 6; // 30 degree cone
        this.boardSpotlight.penumbra = 0.3; // Soft edges
        this.boardSpotlight.decay = 1.5;
        this.boardSpotlight.distance = 30;
        this.boardSpotlight.castShadow = true;
        this.boardSpotlight.shadow.mapSize.width = 1024;
        this.boardSpotlight.shadow.mapSize.height = 1024;
        this.boardSpotlight.shadow.camera.near = 1;
        this.boardSpotlight.shadow.camera.far = 25;
        this.boardSpotlight.name = 'board_spotlight';
        scene.add(this.boardSpotlight);
        scene.add(this.boardSpotlight.target);

        // Create black side spotlight 1 - front angled light for black pieces
        this.blackSideSpotlight1 = new THREE.SpotLight(0xffffff, 2.0);
        this.blackSideSpotlight1.position.set(0, 12, -8); // In front of black pieces
        this.blackSideSpotlight1.target.position.set(3.5, 0, 1); // Target black piece row
        this.blackSideSpotlight1.angle = Math.PI / 5; // 36 degree cone
        this.blackSideSpotlight1.penumbra = 0.5; // Soft edges
        this.blackSideSpotlight1.decay = 1.2;
        this.blackSideSpotlight1.distance = 25;
        this.blackSideSpotlight1.castShadow = false; // No shadow to avoid conflicts
        this.blackSideSpotlight1.name = 'black_side_spotlight_1';
        scene.add(this.blackSideSpotlight1);
        scene.add(this.blackSideSpotlight1.target);

        // Create black side spotlight 2 - side angled light for rim highlights on black pieces
        this.blackSideSpotlight2 = new THREE.SpotLight(0xe8e8ff, 1.5);
        this.blackSideSpotlight2.position.set(10, 10, -5); // Side angle
        this.blackSideSpotlight2.target.position.set(3.5, 0, 0.5); // Target black piece row
        this.blackSideSpotlight2.angle = Math.PI / 5;
        this.blackSideSpotlight2.penumbra = 0.6;
        this.blackSideSpotlight2.decay = 1.3;
        this.blackSideSpotlight2.distance = 22;
        this.blackSideSpotlight2.castShadow = false;
        this.blackSideSpotlight2.name = 'black_side_spotlight_2';
        scene.add(this.blackSideSpotlight2);
        scene.add(this.blackSideSpotlight2.target);

        // Create black side fill light - point light for ambient fill on black pieces
        this.blackSideFill = new THREE.PointLight(0xffffff, 1.0, 15, 1);
        this.blackSideFill.position.set(3.5, 5, -2); // Just in front and above black pieces
        this.blackSideFill.castShadow = false;
        this.blackSideFill.name = 'black_side_fill';
        scene.add(this.blackSideFill);

        // =====================================================================
        // EERIE LIGHTING SYSTEM
        // Underlights cast light upward from below the board for dramatic shadows
        // Orbiter slowly circles the board creating moving shadow play
        // =====================================================================

        // Eerie underlight 1 - left corner glow from beneath
        this.eerieUnderlight1 = new THREE.PointLight(0xff0000, 0, 18, 2);
        this.eerieUnderlight1.position.set(0, -2, 0);
        this.eerieUnderlight1.name = 'eerie_underlight_1';
        scene.add(this.eerieUnderlight1);

        // Eerie underlight 2 - center glow from beneath
        this.eerieUnderlight2 = new THREE.PointLight(0x0000ff, 0, 18, 2);
        this.eerieUnderlight2.position.set(3.5, -2, 3.5);
        this.eerieUnderlight2.name = 'eerie_underlight_2';
        scene.add(this.eerieUnderlight2);

        // Eerie underlight 3 - right corner glow from beneath
        this.eerieUnderlight3 = new THREE.PointLight(0x00ff00, 0, 18, 2);
        this.eerieUnderlight3.position.set(7, -2, 7);
        this.eerieUnderlight3.name = 'eerie_underlight_3';
        scene.add(this.eerieUnderlight3);

        // Eerie orbiting light - slowly moves around the board
        this.eerieOrbiter = new THREE.PointLight(0xff00ff, 0, 25, 1.5);
        this.eerieOrbiter.position.set(15, 3, 0);
        this.eerieOrbiter.castShadow = true;
        this.eerieOrbiter.shadow.mapSize.width = 512;
        this.eerieOrbiter.shadow.mapSize.height = 512;
        this.eerieOrbiter.name = 'eerie_orbiter';
        scene.add(this.eerieOrbiter);

        // Create god ray mesh
        this.createGodRays();

        // Create eerie ground fog
        this.createEerieFog();
    }

    /**
     * Create volumetric god ray effect
     */
    private createGodRays(): void {
        const geometry = new THREE.ConeGeometry(30, 80, 32, 1, true);
        const material = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(0xffffcc) },
                intensity: { value: 0.3 },
                time: { value: 0 },
            },
            vertexShader: `
                varying vec3 vPosition;
                varying float vHeight;
                void main() {
                    vPosition = position;
                    vHeight = (position.y + 40.0) / 80.0;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform float intensity;
                uniform float time;
                varying vec3 vPosition;
                varying float vHeight;
                
                void main() {
                    float fade = pow(vHeight, 2.0);
                    float noise = sin(vPosition.x * 0.5 + time) * sin(vPosition.z * 0.5 + time * 0.7) * 0.5 + 0.5;
                    float alpha = fade * intensity * (0.5 + noise * 0.5);
                    alpha *= smoothstep(0.0, 0.2, vHeight) * smoothstep(1.0, 0.8, vHeight);
                    gl_FragColor = vec4(color, alpha * 0.15);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
        });

        this.godRayMesh = new THREE.Mesh(geometry, material);
        this.godRayMesh.rotation.x = Math.PI;
        this.godRayMesh.position.set(0, 60, -30);
        this.godRayMesh.visible = true;
        this.scene.add(this.godRayMesh);
    }

    /**
     * Create eerie ground fog effect - a glowing mist plane around the board
     */
    private createEerieFog(): void {
        const geometry = new THREE.PlaneGeometry(60, 60, 32, 32);
        const material = new THREE.ShaderMaterial({
            uniforms: {
                color1: { value: new THREE.Color(0x200030) },
                color2: { value: new THREE.Color(0x000020) },
                intensity: { value: 0.4 },
                time: { value: 0 },
                pulseSpeed: { value: 1.0 },
            },
            vertexShader: `
                varying vec2 vUv;
                varying float vDist;
                void main() {
                    vUv = uv;
                    vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
                    vDist = length(worldPos.xz - vec2(3.5, 3.5)) / 30.0;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color1;
                uniform vec3 color2;
                uniform float intensity;
                uniform float time;
                uniform float pulseSpeed;
                varying vec2 vUv;
                varying float vDist;
                
                void main() {
                    // Swirling fog pattern
                    float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
                    float swirl = sin(angle * 3.0 + time * pulseSpeed * 0.5 + vDist * 10.0) * 0.5 + 0.5;
                    float ripple = sin(vDist * 15.0 - time * pulseSpeed * 0.8) * 0.5 + 0.5;
                    
                    // Combine patterns  
                    float pattern = swirl * 0.6 + ripple * 0.4;
                    
                    // Mix colors
                    vec3 col = mix(color2, color1, pattern);
                    
                    // Fade at edges and near board center
                    float edgeFade = 1.0 - smoothstep(0.3, 1.0, vDist);
                    float centerFade = smoothstep(0.0, 0.15, vDist);
                    float alpha = edgeFade * centerFade * intensity * pattern;
                    
                    // Breathing effect
                    alpha *= 0.7 + 0.3 * sin(time * pulseSpeed * 0.3);
                    
                    gl_FragColor = vec4(col, alpha * 0.25);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
        });

        this.eerieFogMesh = new THREE.Mesh(geometry, material);
        this.eerieFogMesh.rotation.x = -Math.PI / 2;
        this.eerieFogMesh.position.set(3.5, 0.05, 3.5); // Just above the ground plane
        this.eerieFogMesh.visible = true;
        this.scene.add(this.eerieFogMesh);
    }

    /**
     * Update lighting for current ELO
     */
    updateForElo(elo: number, instant: boolean = false): void {
        if (!this.enabled) return;
        if (instant) {
            this.currentElo = elo;
            this.targetElo = elo;
            this.transitionProgress = 1.0;
            this.applyEraSettings(elo);
        } else if (elo !== this.targetElo) {
            this.targetElo = elo;
            this.transitionProgress = 0;
        }
    }

    /**
     * Apply era-specific lighting settings
     */
    private applyEraSettings(elo: number): void {
        const era = getEraForElo(elo);
        const progress = getEraProgress(elo);

        // Update sun
        this.sun.color.setHex(era.sunColor);
        this.sun.intensity = era.sunIntensity;

        // Calculate sun position based on era
        const sunAngle = era.sunAngleBase + progress * 0.3;
        const sunHeight = Math.sin(sunAngle) * 60 + 40;
        const sunDistance = 100;
        this.sun.position.set(
            Math.cos(sunAngle) * sunDistance,
            sunHeight,
            Math.sin(sunAngle * 0.5) * sunDistance * 0.5 - 20
        );

        // Update ambient
        this.ambient.color.setHex(era.ambientColor);
        this.ambient.intensity = era.ambientIntensity;

        // Update rim light
        this.rimLight.color.setHex(era.rimLightColor);
        this.rimLight.intensity = era.rimLightIntensity;

        // Update hemisphere
        this.hemisphere.color.setHex(era.skyTopColor);
        this.hemisphere.groundColor.setHex(era.skyBottomColor);
        this.hemisphere.intensity = era.ambientIntensity * 0.5;

        // Update god rays
        if (this.godRayMesh) {
            const material = this.godRayMesh.material as THREE.ShaderMaterial;
            material.uniforms.color.value.setHex(era.sunColor);
            material.uniforms.intensity.value = era.sunIntensity * 0.3;

            // Position god rays at sun direction
            this.godRayMesh.position.copy(this.sun.position).normalize().multiplyScalar(40);
            this.godRayMesh.lookAt(0, 0, 0);
        }

        // Update eerie fog colors based on era  
        if (this.eerieFogMesh) {
            const fogMat = this.eerieFogMesh.material as THREE.ShaderMaterial;
            const eerieConfig = this.getEerieConfig(era);
            fogMat.uniforms.color1.value.setHex(eerieConfig.fogColor1);
            fogMat.uniforms.color2.value.setHex(eerieConfig.fogColor2);
            fogMat.uniforms.intensity.value = eerieConfig.fogIntensity;
            fogMat.uniforms.pulseSpeed.value = eerieConfig.fogPulseSpeed;
        }

        // Update eerie underlights based on era
        const eerieConfig = this.getEerieConfig(era);
        this.eerieUnderlight1.color.setHex(eerieConfig.underColor1);
        this.eerieUnderlight1.intensity = eerieConfig.underIntensity1;
        this.eerieUnderlight2.color.setHex(eerieConfig.underColor2);
        this.eerieUnderlight2.intensity = eerieConfig.underIntensity2;
        this.eerieUnderlight3.color.setHex(eerieConfig.underColor3);
        this.eerieUnderlight3.intensity = eerieConfig.underIntensity3;

        // Update orbiter
        this.eerieOrbiter.color.setHex(eerieConfig.orbiterColor);
        this.eerieOrbiter.intensity = eerieConfig.orbiterIntensity;

        // Setup accent lights based on era
        this.setupAccentLights(era, progress);
    }

    /**
     * Configure era-specific accent lights
     */
    private setupAccentLights(era: EraConfig, progress: number): void {
        // Reset all accent lights
        this.accentLights.forEach(light => {
            light.visible = false;
            light.intensity = 0;
        });

        // Era-specific accent light configurations
        const accentConfigs = this.getAccentLightConfig(era);

        accentConfigs.forEach((config, i) => {
            if (i < this.accentLights.length) {
                const light = this.accentLights[i];
                light.visible = true;
                light.color.setHex(config.color);
                light.intensity = config.intensity * (0.5 + progress * 0.5);
                light.distance = config.distance;
                light.position.copy(config.position);
            }
        });
    }

    /**
     * Get accent light configurations for each era - EERIE edition
     * Every era gets atmospheric, unsettling accent lighting from dramatic angles
     */
    private getAccentLightConfig(era: EraConfig): Array<{
        color: number;
        intensity: number;
        distance: number;
        position: THREE.Vector3;
    }> {
        const baseColor = era.accentLightColor;
        const baseIntensity = era.accentLightIntensity;

        switch (era.id) {
            case 1: // Jurassic - Bioluminescent underglow, predator eyes in the dark
                return [
                    { color: 0x40ff60, intensity: baseIntensity * 1.2, distance: 25, position: new THREE.Vector3(-15, 1, -20) },
                    { color: 0x20ff80, intensity: baseIntensity * 0.8, distance: 20, position: new THREE.Vector3(20, 0.5, -35) },
                    { color: 0xff3300, intensity: baseIntensity * 0.6, distance: 12, position: new THREE.Vector3(-25, 2, -45) },
                    { color: 0xff2200, intensity: baseIntensity * 0.5, distance: 8, position: new THREE.Vector3(30, 2, -50) },
                    { color: 0x60ffa0, intensity: baseIntensity * 0.4, distance: 30, position: new THREE.Vector3(0, -1, -30) },
                ];

            case 2: // Ice Age - Aurora borealis, frozen spirits
                return [
                    { color: 0x40ff90, intensity: baseIntensity * 0.9, distance: 35, position: new THREE.Vector3(-20, 25, -25) },
                    { color: 0x6080ff, intensity: baseIntensity * 1.0, distance: 30, position: new THREE.Vector3(20, 20, -30) },
                    { color: 0xa040ff, intensity: baseIntensity * 0.7, distance: 25, position: new THREE.Vector3(0, 30, -40) },
                    { color: 0x80ffff, intensity: baseIntensity * 0.5, distance: 20, position: new THREE.Vector3(-10, 1, -50) },
                ];

            case 3: // Stone Age - Campfire shadows, cave paintings come alive
                return [
                    { color: 0xff3800, intensity: baseIntensity * 1.3, distance: 18, position: new THREE.Vector3(-12, 3, -15) },
                    { color: 0xff6020, intensity: baseIntensity * 0.9, distance: 15, position: new THREE.Vector3(15, 2, -20) },
                    { color: 0xff2000, intensity: baseIntensity * 0.6, distance: 10, position: new THREE.Vector3(-5, 1, -10) },
                    { color: 0x802000, intensity: baseIntensity * 0.4, distance: 25, position: new THREE.Vector3(0, 8, -40) },
                ];

            case 4: // Bronze Age - Ritualistic golden pulse, temple torches
                return [
                    { color: 0xffd040, intensity: baseIntensity * 1.1, distance: 22, position: new THREE.Vector3(-18, 5, -18) },
                    { color: 0xff8020, intensity: baseIntensity * 0.9, distance: 18, position: new THREE.Vector3(18, 8, -25) },
                    { color: 0xffa030, intensity: baseIntensity * 0.7, distance: 15, position: new THREE.Vector3(0, 2, -35) },
                    { color: 0x804010, intensity: baseIntensity * 0.5, distance: 30, position: new THREE.Vector3(-25, 1, -45) },
                ];

            case 5: // Classical - Ghostly marble glow, ethereal mist lights
                return [
                    { color: 0xe0e8ff, intensity: baseIntensity * 0.8, distance: 25, position: new THREE.Vector3(-15, 0.5, -22) },
                    { color: 0xc0d0ff, intensity: baseIntensity * 0.7, distance: 20, position: new THREE.Vector3(18, 1, -30) },
                    { color: 0xfff0e0, intensity: baseIntensity * 0.5, distance: 22, position: new THREE.Vector3(0, 12, -40) },
                    { color: 0x8090c0, intensity: baseIntensity * 0.4, distance: 18, position: new THREE.Vector3(-20, 3, -50) },
                ];

            case 6: // Medieval - Torchlight flicker, dungeon shadows
                return [
                    { color: 0xff7030, intensity: baseIntensity * 1.2, distance: 15, position: new THREE.Vector3(-15, 8, -20) },
                    { color: 0xff6020, intensity: baseIntensity * 1.0, distance: 12, position: new THREE.Vector3(18, 10, -35) },
                    { color: 0xff4010, intensity: baseIntensity * 0.8, distance: 10, position: new THREE.Vector3(-8, 4, -12) },
                    { color: 0x301808, intensity: baseIntensity * 0.6, distance: 20, position: new THREE.Vector3(0, 1, -45) },
                    { color: 0xff5020, intensity: baseIntensity * 0.5, distance: 14, position: new THREE.Vector3(25, 6, -25) },
                ];

            case 7: // Renaissance - Candlelight mystery, Da Vinci shadows
                return [
                    { color: 0xffd080, intensity: baseIntensity * 0.9, distance: 18, position: new THREE.Vector3(-12, 6, -18) },
                    { color: 0xffb060, intensity: baseIntensity * 0.7, distance: 15, position: new THREE.Vector3(15, 8, -28) },
                    { color: 0xff9040, intensity: baseIntensity * 0.5, distance: 12, position: new THREE.Vector3(0, 3, -38) },
                    { color: 0x604020, intensity: baseIntensity * 0.4, distance: 25, position: new THREE.Vector3(-20, 1, -48) },
                ];

            case 8: // Industrial - Furnace hellfire, mechanical rhythm
                return [
                    { color: 0xff4010, intensity: baseIntensity * 1.4, distance: 20, position: new THREE.Vector3(-20, 3, -15) },
                    { color: 0xff6020, intensity: baseIntensity * 1.1, distance: 18, position: new THREE.Vector3(22, 2, -25) },
                    { color: 0xff2000, intensity: baseIntensity * 0.8, distance: 15, position: new THREE.Vector3(-10, 1, -35) },
                    { color: 0xcc3300, intensity: baseIntensity * 0.6, distance: 22, position: new THREE.Vector3(0, 8, -45) },
                    { color: 0xff8040, intensity: baseIntensity * 0.5, distance: 12, position: new THREE.Vector3(15, 0.5, -10) },
                ];

            case 9: // Modern - Neon flicker, urban uncanny valley
                return [
                    { color: 0xff2060, intensity: baseIntensity * 1.0, distance: 22, position: new THREE.Vector3(-18, 6, -15) },
                    { color: 0x20ff60, intensity: baseIntensity * 0.8, distance: 18, position: new THREE.Vector3(20, 4, -25) },
                    { color: 0x4080ff, intensity: baseIntensity * 0.7, distance: 20, position: new THREE.Vector3(-5, 2, -40) },
                    { color: 0xff6000, intensity: baseIntensity * 0.5, distance: 15, position: new THREE.Vector3(25, 1, -50) },
                ];

            case 10: // Digital - Matrix cascade, data corruption pulses
                return [
                    { color: 0x00ff40, intensity: baseIntensity * 1.2, distance: 25, position: new THREE.Vector3(-15, 8, -18) },
                    { color: 0x00ff80, intensity: baseIntensity * 0.9, distance: 20, position: new THREE.Vector3(18, 5, -28) },
                    { color: 0x40ff00, intensity: baseIntensity * 0.6, distance: 22, position: new THREE.Vector3(0, 1, -40) },
                    { color: 0x008040, intensity: baseIntensity * 0.5, distance: 18, position: new THREE.Vector3(-22, 3, -55) },
                    { color: 0x00ffcc, intensity: baseIntensity * 0.4, distance: 15, position: new THREE.Vector3(25, 0.5, -15) },
                ];

            case 11: // Near Future - Holographic shimmer, scanner beams
                return [
                    { color: 0x40e0d0, intensity: baseIntensity * 1.0, distance: 28, position: new THREE.Vector3(-20, 10, -20) },
                    { color: 0xf0c030, intensity: baseIntensity * 0.8, distance: 22, position: new THREE.Vector3(20, 8, -30) },
                    { color: 0x60ffb0, intensity: baseIntensity * 0.6, distance: 20, position: new THREE.Vector3(0, 2, -45) },
                    { color: 0x2080ff, intensity: baseIntensity * 0.5, distance: 18, position: new THREE.Vector3(-15, 15, -50) },
                ];

            case 12: // Cyberpunk - Neon rain, hacker terminal glow
                return [
                    { color: 0xff00ff, intensity: baseIntensity * 1.2, distance: 25, position: new THREE.Vector3(-25, 15, -20) },
                    { color: 0x00ffff, intensity: baseIntensity * 1.1, distance: 25, position: new THREE.Vector3(25, 12, -30) },
                    { color: 0xff0080, intensity: baseIntensity * 0.8, distance: 20, position: new THREE.Vector3(0, 2, -40) },
                    { color: 0x00ff80, intensity: baseIntensity * 0.6, distance: 18, position: new THREE.Vector3(-30, 1, -50) },
                    { color: 0x8000ff, intensity: baseIntensity * 0.5, distance: 22, position: new THREE.Vector3(15, 0.5, -10) },
                ];

            case 13: // Space Age - Emergency beacons, cold void contrast
                return [
                    { color: 0xff2000, intensity: baseIntensity * 0.9, distance: 20, position: new THREE.Vector3(-18, 5, -20) },
                    { color: 0x4080ff, intensity: baseIntensity * 1.0, distance: 28, position: new THREE.Vector3(20, 15, -30) },
                    { color: 0xff8040, intensity: baseIntensity * 0.7, distance: 22, position: new THREE.Vector3(0, 2, -45) },
                    { color: 0x2040ff, intensity: baseIntensity * 0.5, distance: 25, position: new THREE.Vector3(-25, 10, -55) },
                ];

            case 14: // Lunar Colony - Harsh sun/shadow, Earthglow
                return [
                    { color: 0x4080ff, intensity: baseIntensity * 1.1, distance: 30, position: new THREE.Vector3(0, 20, -25) },
                    { color: 0x80ffff, intensity: baseIntensity * 0.7, distance: 22, position: new THREE.Vector3(-20, 3, -35) },
                    { color: 0x202040, intensity: baseIntensity * 0.5, distance: 25, position: new THREE.Vector3(25, 1, -45) },
                    { color: 0x6090ff, intensity: baseIntensity * 0.4, distance: 18, position: new THREE.Vector3(-10, 8, -55) },
                ];

            case 15: // Mars Colony - Dust storm warnings, terraforming glow
                return [
                    { color: 0xff4020, intensity: baseIntensity * 1.0, distance: 25, position: new THREE.Vector3(-15, 4, -18) },
                    { color: 0x40ff80, intensity: baseIntensity * 0.8, distance: 20, position: new THREE.Vector3(18, 6, -30) },
                    { color: 0xff8040, intensity: baseIntensity * 0.6, distance: 22, position: new THREE.Vector3(0, 1, -40) },
                    { color: 0xc04020, intensity: baseIntensity * 0.5, distance: 18, position: new THREE.Vector3(-22, 2, -50) },
                ];

            case 16: // Solar System - Nebula colors, distant engine signatures
                return [
                    { color: 0xffa040, intensity: baseIntensity * 1.0, distance: 30, position: new THREE.Vector3(-20, 10, -25) },
                    { color: 0x7070c0, intensity: baseIntensity * 0.8, distance: 28, position: new THREE.Vector3(22, 15, -35) },
                    { color: 0xff6020, intensity: baseIntensity * 0.6, distance: 22, position: new THREE.Vector3(0, 3, -50) },
                    { color: 0xa060d0, intensity: baseIntensity * 0.5, distance: 25, position: new THREE.Vector3(-25, 8, -60) },
                    { color: 0xd0a040, intensity: baseIntensity * 0.4, distance: 20, position: new THREE.Vector3(15, 1, -15) },
                ];

            case 17: // Type I - Dyson energy field hum
                return [
                    { color: 0xffcc00, intensity: baseIntensity * 1.1, distance: 40, position: new THREE.Vector3(0, 30, -30) },
                    { color: 0xffd860, intensity: baseIntensity * 0.9, distance: 35, position: new THREE.Vector3(-30, 20, -40) },
                    { color: 0x80c0ff, intensity: baseIntensity * 0.7, distance: 30, position: new THREE.Vector3(30, 25, -35) },
                    { color: 0xff8040, intensity: baseIntensity * 0.5, distance: 28, position: new THREE.Vector3(0, 5, -55) },
                ];

            case 18: // Type II - Stellar forge flares, plasma eruptions
                return [
                    { color: 0xff4000, intensity: baseIntensity * 1.3, distance: 40, position: new THREE.Vector3(-25, 15, -25) },
                    { color: 0xff8040, intensity: baseIntensity * 1.0, distance: 35, position: new THREE.Vector3(25, 20, -35) },
                    { color: 0xffc080, intensity: baseIntensity * 0.8, distance: 30, position: new THREE.Vector3(0, 30, -45) },
                    { color: 0xff2000, intensity: baseIntensity * 0.6, distance: 25, position: new THREE.Vector3(-20, 2, -55) },
                    { color: 0xffcc60, intensity: baseIntensity * 0.5, distance: 28, position: new THREE.Vector3(20, 5, -15) },
                ];

            case 19: // Type II.5 - Gravitational lensing distortion, wormhole glow
                return [
                    { color: 0xf0d020, intensity: baseIntensity * 1.2, distance: 45, position: new THREE.Vector3(0, 25, -30) },
                    { color: 0x8060c0, intensity: baseIntensity * 1.0, distance: 38, position: new THREE.Vector3(-30, 15, -40) },
                    { color: 0x6040ff, intensity: baseIntensity * 0.8, distance: 35, position: new THREE.Vector3(30, 20, -35) },
                    { color: 0xc0a0ff, intensity: baseIntensity * 0.6, distance: 30, position: new THREE.Vector3(0, 35, -55) },
                    { color: 0xffe080, intensity: baseIntensity * 0.5, distance: 25, position: new THREE.Vector3(-15, 2, -20) },
                ];

            case 20: // Type III - Reality-bending prismatic transcendence
                return [
                    { color: 0xff60ff, intensity: baseIntensity * 1.2, distance: 50, position: new THREE.Vector3(0, 35, -30) },
                    { color: 0x60ffff, intensity: baseIntensity * 1.0, distance: 45, position: new THREE.Vector3(-30, 25, -40) },
                    { color: 0xffff60, intensity: baseIntensity * 0.9, distance: 40, position: new THREE.Vector3(30, 30, -35) },
                    { color: 0xff8060, intensity: baseIntensity * 0.7, distance: 35, position: new THREE.Vector3(0, 40, -55) },
                    { color: 0x60ff80, intensity: baseIntensity * 0.6, distance: 38, position: new THREE.Vector3(-20, 5, -20) },
                    { color: 0xffffff, intensity: baseIntensity * 0.5, distance: 50, position: new THREE.Vector3(20, 50, -45) },
                ];

            default:
                return [
                    { color: baseColor, intensity: baseIntensity * 0.5, distance: 20, position: new THREE.Vector3(0, 10, -30) },
                ];
        }
    }

    /**
     * Get eerie lighting configuration per era
     * Defines underlight colors, fog colors, orbiter behavior
     */
    private getEerieConfig(era: EraConfig): {
        underColor1: number; underIntensity1: number;
        underColor2: number; underIntensity2: number;
        underColor3: number; underIntensity3: number;
        orbiterColor: number; orbiterIntensity: number; orbiterSpeed: number; orbiterRadius: number;
        fogColor1: number; fogColor2: number; fogIntensity: number; fogPulseSpeed: number;
    } {
        switch (era.id) {
            case 1: // Jurassic - Bioluminescent swamp glow
                return {
                    underColor1: 0x30ff50, underIntensity1: 0.8,
                    underColor2: 0x20ff80, underIntensity2: 0.5,
                    underColor3: 0x40ffa0, underIntensity3: 0.3,
                    orbiterColor: 0x60ff40, orbiterIntensity: 0.6, orbiterSpeed: 0.15, orbiterRadius: 12,
                    fogColor1: 0x20a040, fogColor2: 0x083018, fogIntensity: 0.5, fogPulseSpeed: 0.6,
                };
            case 2: // Ice Age - Frozen aurora shimmer
                return {
                    underColor1: 0x4080ff, underIntensity1: 0.6,
                    underColor2: 0x40ffa0, underIntensity2: 0.4,
                    underColor3: 0xa040ff, underIntensity3: 0.3,
                    orbiterColor: 0x80c0ff, orbiterIntensity: 0.5, orbiterSpeed: 0.08, orbiterRadius: 15,
                    fogColor1: 0x3060a0, fogColor2: 0x102040, fogIntensity: 0.4, fogPulseSpeed: 0.4,
                };
            case 3: // Stone Age - Campfire shadows, spirits
                return {
                    underColor1: 0xff3000, underIntensity1: 1.0,
                    underColor2: 0xff5020, underIntensity2: 0.7,
                    underColor3: 0xff2000, underIntensity3: 0.4,
                    orbiterColor: 0xff4010, orbiterIntensity: 0.8, orbiterSpeed: 0.2, orbiterRadius: 10,
                    fogColor1: 0x601808, fogColor2: 0x200800, fogIntensity: 0.6, fogPulseSpeed: 1.2,
                };
            case 4: // Bronze Age - Temple ritual glow
                return {
                    underColor1: 0xffc040, underIntensity1: 0.7,
                    underColor2: 0xff8020, underIntensity2: 0.5,
                    underColor3: 0xffa030, underIntensity3: 0.3,
                    orbiterColor: 0xffd060, orbiterIntensity: 0.6, orbiterSpeed: 0.12, orbiterRadius: 13,
                    fogColor1: 0x806020, fogColor2: 0x302010, fogIntensity: 0.35, fogPulseSpeed: 0.8,
                };
            case 5: // Classical - Ghostly marble pillars
                return {
                    underColor1: 0xc0d0ff, underIntensity1: 0.5,
                    underColor2: 0xe0e8ff, underIntensity2: 0.4,
                    underColor3: 0xa0b0e0, underIntensity3: 0.3,
                    orbiterColor: 0xd0d8ff, orbiterIntensity: 0.4, orbiterSpeed: 0.06, orbiterRadius: 14,
                    fogColor1: 0x808890, fogColor2: 0x404860, fogIntensity: 0.3, fogPulseSpeed: 0.5,
                };
            case 6: // Medieval - Dungeon torches, dark magic
                return {
                    underColor1: 0xff5020, underIntensity1: 1.2,
                    underColor2: 0x3020a0, underIntensity2: 0.6,
                    underColor3: 0xff3010, underIntensity3: 0.5,
                    orbiterColor: 0xff6030, orbiterIntensity: 0.9, orbiterSpeed: 0.18, orbiterRadius: 11,
                    fogColor1: 0x402008, fogColor2: 0x100810, fogIntensity: 0.7, fogPulseSpeed: 1.0,
                };
            case 7: // Renaissance - Mysterious candlelight
                return {
                    underColor1: 0xffc060, underIntensity1: 0.6,
                    underColor2: 0xffa040, underIntensity2: 0.4,
                    underColor3: 0xff8020, underIntensity3: 0.3,
                    orbiterColor: 0xffd080, orbiterIntensity: 0.5, orbiterSpeed: 0.1, orbiterRadius: 12,
                    fogColor1: 0x604830, fogColor2: 0x201810, fogIntensity: 0.3, fogPulseSpeed: 0.6,
                };
            case 8: // Industrial - Hellish furnace glow
                return {
                    underColor1: 0xff3000, underIntensity1: 1.5,
                    underColor2: 0xff6020, underIntensity2: 1.0,
                    underColor3: 0xff2000, underIntensity3: 0.7,
                    orbiterColor: 0xff4010, orbiterIntensity: 1.2, orbiterSpeed: 0.25, orbiterRadius: 10,
                    fogColor1: 0x602010, fogColor2: 0x200808, fogIntensity: 0.8, fogPulseSpeed: 1.5,
                };
            case 9: // Modern - Neon sign buzz
                return {
                    underColor1: 0xff2060, underIntensity1: 0.8,
                    underColor2: 0x20ff80, underIntensity2: 0.6,
                    underColor3: 0x4060ff, underIntensity3: 0.4,
                    orbiterColor: 0xff4080, orbiterIntensity: 0.7, orbiterSpeed: 0.3, orbiterRadius: 13,
                    fogColor1: 0x601040, fogColor2: 0x100830, fogIntensity: 0.45, fogPulseSpeed: 2.0,
                };
            case 10: // Digital - Matrix rain glow
                return {
                    underColor1: 0x00ff40, underIntensity1: 1.0,
                    underColor2: 0x00ff80, underIntensity2: 0.7,
                    underColor3: 0x40ff00, underIntensity3: 0.4,
                    orbiterColor: 0x00ff60, orbiterIntensity: 0.8, orbiterSpeed: 0.35, orbiterRadius: 12,
                    fogColor1: 0x004020, fogColor2: 0x001008, fogIntensity: 0.55, fogPulseSpeed: 1.8,
                };
            case 11: // Near Future - Scanner sweep
                return {
                    underColor1: 0x40e0d0, underIntensity1: 0.7,
                    underColor2: 0xf0c030, underIntensity2: 0.5,
                    underColor3: 0x60ffb0, underIntensity3: 0.3,
                    orbiterColor: 0x80ffd0, orbiterIntensity: 0.6, orbiterSpeed: 0.2, orbiterRadius: 14,
                    fogColor1: 0x206050, fogColor2: 0x082820, fogIntensity: 0.35, fogPulseSpeed: 1.0,
                };
            case 12: // Cyberpunk - Neon rain, glitch
                return {
                    underColor1: 0xff00ff, underIntensity1: 1.3,
                    underColor2: 0x00ffff, underIntensity2: 1.0,
                    underColor3: 0xff0080, underIntensity3: 0.6,
                    orbiterColor: 0xff40ff, orbiterIntensity: 1.0, orbiterSpeed: 0.4, orbiterRadius: 11,
                    fogColor1: 0x800080, fogColor2: 0x200040, fogIntensity: 0.7, fogPulseSpeed: 2.5,
                };
            case 13: // Space Age - Emergency beacon
                return {
                    underColor1: 0xff2000, underIntensity1: 0.6,
                    underColor2: 0x4080ff, underIntensity2: 0.8,
                    underColor3: 0x2040ff, underIntensity3: 0.4,
                    orbiterColor: 0xff4020, orbiterIntensity: 0.7, orbiterSpeed: 0.15, orbiterRadius: 15,
                    fogColor1: 0x102040, fogColor2: 0x000810, fogIntensity: 0.3, fogPulseSpeed: 0.8,
                };
            case 14: // Lunar Colony - Earth glow, vacuum cold
                return {
                    underColor1: 0x4080ff, underIntensity1: 0.5,
                    underColor2: 0x80ffff, underIntensity2: 0.4,
                    underColor3: 0x2040a0, underIntensity3: 0.3,
                    orbiterColor: 0x6090ff, orbiterIntensity: 0.5, orbiterSpeed: 0.05, orbiterRadius: 16,
                    fogColor1: 0x101830, fogColor2: 0x000008, fogIntensity: 0.2, fogPulseSpeed: 0.3,
                };
            case 15: // Mars Colony - Red dust, green terraform
                return {
                    underColor1: 0xff4020, underIntensity1: 0.8,
                    underColor2: 0x40ff80, underIntensity2: 0.5,
                    underColor3: 0xc04020, underIntensity3: 0.4,
                    orbiterColor: 0xff6040, orbiterIntensity: 0.7, orbiterSpeed: 0.2, orbiterRadius: 13,
                    fogColor1: 0x602010, fogColor2: 0x200808, fogIntensity: 0.5, fogPulseSpeed: 1.2,
                };
            case 16: // Solar System - Nebula drift
                return {
                    underColor1: 0xffa040, underIntensity1: 0.6,
                    underColor2: 0x7070c0, underIntensity2: 0.5,
                    underColor3: 0xa060d0, underIntensity3: 0.4,
                    orbiterColor: 0xd0a060, orbiterIntensity: 0.6, orbiterSpeed: 0.1, orbiterRadius: 15,
                    fogColor1: 0x302050, fogColor2: 0x080818, fogIntensity: 0.35, fogPulseSpeed: 0.5,
                };
            case 17: // Type I - Dyson hum
                return {
                    underColor1: 0xffcc00, underIntensity1: 1.0,
                    underColor2: 0xffd860, underIntensity2: 0.7,
                    underColor3: 0x80c0ff, underIntensity3: 0.5,
                    orbiterColor: 0xffe060, orbiterIntensity: 0.9, orbiterSpeed: 0.12, orbiterRadius: 14,
                    fogColor1: 0x604800, fogColor2: 0x182860, fogIntensity: 0.4, fogPulseSpeed: 0.7,
                };
            case 18: // Type II - Stellar plasma
                return {
                    underColor1: 0xff4000, underIntensity1: 1.5,
                    underColor2: 0xff8040, underIntensity2: 1.0,
                    underColor3: 0xffc080, underIntensity3: 0.6,
                    orbiterColor: 0xff6020, orbiterIntensity: 1.2, orbiterSpeed: 0.18, orbiterRadius: 13,
                    fogColor1: 0x801008, fogColor2: 0x300408, fogIntensity: 0.6, fogPulseSpeed: 1.0,
                };
            case 19: // Type II.5 - Wormhole shimmer
                return {
                    underColor1: 0xf0d020, underIntensity1: 1.2,
                    underColor2: 0x8060c0, underIntensity2: 0.9,
                    underColor3: 0x6040ff, underIntensity3: 0.6,
                    orbiterColor: 0xc0a0ff, orbiterIntensity: 1.0, orbiterSpeed: 0.22, orbiterRadius: 14,
                    fogColor1: 0x402080, fogColor2: 0x100830, fogIntensity: 0.5, fogPulseSpeed: 0.8,
                };
            case 20: // Type III - Transcendent prismatic
                return {
                    underColor1: 0xff60ff, underIntensity1: 1.5,
                    underColor2: 0x60ffff, underIntensity2: 1.2,
                    underColor3: 0xffff60, underIntensity3: 0.8,
                    orbiterColor: 0xffffff, orbiterIntensity: 1.5, orbiterSpeed: 0.3, orbiterRadius: 15,
                    fogColor1: 0xa060e0, fogColor2: 0x400880, fogIntensity: 0.6, fogPulseSpeed: 1.2,
                };
            default:
                return {
                    underColor1: 0x404060, underIntensity1: 0.3,
                    underColor2: 0x304050, underIntensity2: 0.2,
                    underColor3: 0x405060, underIntensity3: 0.15,
                    orbiterColor: 0x606080, orbiterIntensity: 0.3, orbiterSpeed: 0.1, orbiterRadius: 12,
                    fogColor1: 0x303040, fogColor2: 0x101020, fogIntensity: 0.2, fogPulseSpeed: 0.5,
                };
        }
    }

    /**
     * Animate lighting each frame — EERIE edition
     * Every era has unique, unsettling animation patterns
     */
    animate(deltaTime: number): void {
        if (!this.enabled) return;
        this.time += deltaTime * 0.001;

        // Smooth transition between ELO values
        if (this.transitionProgress < 1.0) {
            this.transitionProgress = Math.min(1.0, this.transitionProgress + deltaTime * 0.002);
            const currentLerpElo = this.currentElo + (this.targetElo - this.currentElo) * this.transitionProgress;
            this.applyEraSettings(Math.round(currentLerpElo));

            if (this.transitionProgress >= 1.0) {
                this.currentElo = this.targetElo;
            }
        }

        // Animate god rays
        if (this.godRayMesh) {
            const material = this.godRayMesh.material as THREE.ShaderMaterial;
            material.uniforms.time.value = this.time;
        }

        // Animate eerie fog
        if (this.eerieFogMesh) {
            const fogMat = this.eerieFogMesh.material as THREE.ShaderMaterial;
            fogMat.uniforms.time.value = this.time;
        }

        const era = getEraForElo(this.currentElo);
        const eerieConfig = this.getEerieConfig(era);
        const t = this.time;

        // =====================================================================
        // EERIE ORBITER - slowly circles the board casting moving shadows
        // =====================================================================
        const orbitAngle = t * eerieConfig.orbiterSpeed;
        const orbitR = eerieConfig.orbiterRadius;
        this.eerieOrbiter.position.set(
            3.5 + Math.cos(orbitAngle) * orbitR,
            2 + Math.sin(t * 0.3) * 1.5,  // slowly bobs up and down
            3.5 + Math.sin(orbitAngle) * orbitR
        );

        // =====================================================================
        // PER-ERA EERIE ANIMATIONS
        // Each era has distinct, atmospheric light behavior
        // =====================================================================
        switch (era.id) {
            case 1: // Jurassic - Bioluminescent pulse, predator eye flicker
                this.accentLights.forEach((light, i) => {
                    if (light.visible) {
                        // Slow organic pulsing like bioluminescence
                        const bioLum = 0.4 + Math.sin(t * 0.8 + i * 1.7) * 0.3 + Math.sin(t * 1.3 + i * 2.9) * 0.2;
                        light.intensity = era.accentLightIntensity * bioLum;
                    }
                });
                // Underlights pulse like swamp gas
                this.eerieUnderlight1.intensity = eerieConfig.underIntensity1 * (0.5 + Math.sin(t * 0.6) * 0.3 + Math.sin(t * 1.1) * 0.2);
                this.eerieUnderlight2.intensity = eerieConfig.underIntensity2 * (0.4 + Math.sin(t * 0.9 + 1.0) * 0.35);
                this.eerieUnderlight3.intensity = eerieConfig.underIntensity3 * (0.5 + Math.sin(t * 0.7 + 2.0) * 0.3);
                // Orbiter flickers like distant eyes
                this.eerieOrbiter.intensity = eerieConfig.orbiterIntensity * (0.3 + Math.random() * 0.15 + Math.sin(t * 4) * 0.1);
                break;

            case 2: // Ice Age - Aurora shift between blue/green/purple
                this.accentLights.forEach((light, i) => {
                    if (light.visible) {
                        // Slow aurora-like color intensity wave
                        const auroraWave = 0.5 + Math.sin(t * 0.4 + i * 2.5) * 0.3 + Math.sin(t * 0.7 + i * 1.3) * 0.2;
                        light.intensity = era.accentLightIntensity * auroraWave;
                    }
                });
                // Underlights shimmer like ice crystals
                this.eerieUnderlight1.intensity = eerieConfig.underIntensity1 * (0.6 + Math.sin(t * 0.5) * 0.2);
                this.eerieUnderlight2.intensity = eerieConfig.underIntensity2 * (0.5 + Math.sin(t * 0.3 + 1.5) * 0.3);
                this.eerieUnderlight3.intensity = eerieConfig.underIntensity3 * (0.4 + Math.sin(t * 0.6 + 3.0) * 0.25);
                break;

            case 3: // Stone Age - Aggressive campfire flicker, spirit whispers
                this.accentLights.forEach((light, i) => {
                    if (light.visible) {
                        const fireFlicker = 0.5 + Math.sin(t * 12 + i * 3) * 0.2 + Math.sin(t * 19 + i * 7) * 0.15 + Math.random() * 0.1;
                        light.intensity = era.accentLightIntensity * fireFlicker;
                    }
                });
                // Underlights flicker like embers
                this.eerieUnderlight1.intensity = eerieConfig.underIntensity1 * (0.6 + Math.sin(t * 8) * 0.2 + Math.random() * 0.1);
                this.eerieUnderlight2.intensity = eerieConfig.underIntensity2 * (0.5 + Math.sin(t * 11 + 1) * 0.25);
                this.eerieUnderlight3.intensity = eerieConfig.underIntensity3 * (0.4 + Math.sin(t * 15 + 2) * 0.2 + Math.random() * 0.08);
                break;

            case 4: // Bronze Age - Ritualistic slow pulse like ceremonial drums
                this.accentLights.forEach((light, i) => {
                    if (light.visible) {
                        const drumPulse = 0.5 + Math.pow(Math.sin(t * 1.5 + i * 1.2), 2) * 0.4;
                        light.intensity = era.accentLightIntensity * drumPulse;
                    }
                });
                this.eerieUnderlight1.intensity = eerieConfig.underIntensity1 * (0.5 + Math.pow(Math.sin(t * 1.5), 4) * 0.4);
                this.eerieUnderlight2.intensity = eerieConfig.underIntensity2 * (0.4 + Math.pow(Math.sin(t * 1.5 + 0.5), 4) * 0.35);
                this.eerieUnderlight3.intensity = eerieConfig.underIntensity3 * (0.3 + Math.pow(Math.sin(t * 1.5 + 1.0), 4) * 0.3);
                break;

            case 5: // Classical - Ethereal wisps, ghostly marble glow
                this.accentLights.forEach((light, i) => {
                    if (light.visible) {
                        const wisp = 0.6 + Math.sin(t * 0.5 + i * 3.14) * 0.2 + Math.sin(t * 1.2 + i * 1.7) * 0.15;
                        light.intensity = era.accentLightIntensity * wisp;
                    }
                });
                // Very subtle breath-like underlighting
                this.eerieUnderlight1.intensity = eerieConfig.underIntensity1 * (0.7 + Math.sin(t * 0.4) * 0.15);
                this.eerieUnderlight2.intensity = eerieConfig.underIntensity2 * (0.6 + Math.sin(t * 0.35 + 1.0) * 0.2);
                this.eerieUnderlight3.intensity = eerieConfig.underIntensity3 * (0.5 + Math.sin(t * 0.45 + 2.0) * 0.15);
                break;

            case 6: // Medieval - Torchlight + dungeon horror flicker
                this.accentLights.forEach((light, i) => {
                    if (light.visible) {
                        const torch = 0.5 + Math.sin(t * 10 + i * 2) * 0.15 + Math.sin(t * 23 + i) * 0.15 + Math.random() * 0.12;
                        light.intensity = era.accentLightIntensity * torch;
                    }
                });
                // Underlights: alternating warm fire and cold shadow
                this.eerieUnderlight1.intensity = eerieConfig.underIntensity1 * (0.6 + Math.sin(t * 7) * 0.2 + Math.random() * 0.12);
                this.eerieUnderlight2.intensity = eerieConfig.underIntensity2 * (0.4 + Math.sin(t * 0.3) * 0.3); // Slow dark magic pulse
                this.eerieUnderlight3.intensity = eerieConfig.underIntensity3 * (0.5 + Math.sin(t * 9 + 1.5) * 0.2 + Math.random() * 0.1);
                break;

            case 7: // Renaissance - Candlelight sway, mysterious Da Vinci shadows
                this.accentLights.forEach((light, i) => {
                    if (light.visible) {
                        const candle = 0.7 + Math.sin(t * 3.5 + i * 1.4) * 0.12 + Math.sin(t * 7 + i * 3.3) * 0.08;
                        light.intensity = era.accentLightIntensity * candle;
                    }
                });
                this.eerieUnderlight1.intensity = eerieConfig.underIntensity1 * (0.6 + Math.sin(t * 2.5) * 0.15);
                this.eerieUnderlight2.intensity = eerieConfig.underIntensity2 * (0.5 + Math.sin(t * 3.0 + 1.0) * 0.2);
                this.eerieUnderlight3.intensity = eerieConfig.underIntensity3 * (0.4 + Math.sin(t * 2.8 + 2.0) * 0.15);
                break;

            case 8: // Industrial - Mechanical strobe, furnace surge
                this.accentLights.forEach((light, i) => {
                    if (light.visible) {
                        // Mechanical rhythm with occasional surge
                        const mech = 0.4 + Math.pow(Math.sin(t * 4 + i * 1.5), 2) * 0.3;
                        const surge = Math.sin(t * 0.3) > 0.9 ? 1.5 : 1.0; // Occasional power surge
                        light.intensity = era.accentLightIntensity * mech * surge;
                    }
                });
                // Underlights throb like a furnace heartbeat
                const furnaceBeat = Math.pow(Math.sin(t * 2.5), 8);
                this.eerieUnderlight1.intensity = eerieConfig.underIntensity1 * (0.5 + furnaceBeat * 0.5);
                this.eerieUnderlight2.intensity = eerieConfig.underIntensity2 * (0.4 + furnaceBeat * 0.4);
                this.eerieUnderlight3.intensity = eerieConfig.underIntensity3 * (0.3 + furnaceBeat * 0.35);
                break;

            case 9: // Modern - Neon sign buzz, urban flicker
                this.accentLights.forEach((light, i) => {
                    if (light.visible) {
                        // Neon buzz: mostly on, occasional brief flicker off
                        let neon = 0.85;
                        if (Math.sin(t * 15 + i * 7.77) > 0.95) neon = 0.1; // Brief dropout
                        if (Math.sin(t * 30 + i * 11.3) > 0.97) neon = 0.3; // Micro-flicker
                        light.intensity = era.accentLightIntensity * neon;
                    }
                });
                this.eerieUnderlight1.intensity = eerieConfig.underIntensity1 * (0.7 + Math.sin(t * 2.0) * 0.15);
                this.eerieUnderlight2.intensity = eerieConfig.underIntensity2 * (0.6 + Math.sin(t * 1.5 + 1.0) * 0.2);
                this.eerieUnderlight3.intensity = eerieConfig.underIntensity3 * (0.5 + Math.sin(t * 1.8 + 2.0) * 0.15);
                break;

            case 10: // Digital - Matrix cascade, data stream corruption
                this.accentLights.forEach((light, i) => {
                    if (light.visible) {
                        // Cascading pulse like data flowing downward
                        const cascade = 0.3 + Math.pow(Math.sin(t * 5 - i * 0.5), 2) * 0.6;
                        const glitch = Math.random() > 0.97 ? 2.0 : 1.0; // Random data spike
                        light.intensity = era.accentLightIntensity * cascade * glitch;
                    }
                });
                // Underlights: matrix rain effect (sequential pulse)
                this.eerieUnderlight1.intensity = eerieConfig.underIntensity1 * (0.3 + Math.pow(Math.sin(t * 6), 2) * 0.5);
                this.eerieUnderlight2.intensity = eerieConfig.underIntensity2 * (0.3 + Math.pow(Math.sin(t * 6 - 0.3), 2) * 0.5);
                this.eerieUnderlight3.intensity = eerieConfig.underIntensity3 * (0.3 + Math.pow(Math.sin(t * 6 - 0.6), 2) * 0.5);
                break;

            case 11: // Near Future - Scanner sweep, holographic shimmer
                this.accentLights.forEach((light, i) => {
                    if (light.visible) {
                        const scanSweep = 0.5 + Math.sin(t * 2 + i * 0.8) * 0.3;
                        const holo = 0.8 + Math.sin(t * 8 + i * 5.5) * 0.1; // Subtle holographic flicker
                        light.intensity = era.accentLightIntensity * scanSweep * holo;
                    }
                });
                this.eerieUnderlight1.intensity = eerieConfig.underIntensity1 * (0.5 + Math.sin(t * 1.5) * 0.25);
                this.eerieUnderlight2.intensity = eerieConfig.underIntensity2 * (0.4 + Math.sin(t * 1.2 + 1.0) * 0.2);
                this.eerieUnderlight3.intensity = eerieConfig.underIntensity3 * (0.3 + Math.sin(t * 1.8 + 2.0) * 0.2);
                break;

            case 12: // Cyberpunk - Neon rain pulse, glitch distortion
                this.accentLights.forEach((light, i) => {
                    if (light.visible) {
                        let cyber = 0.6 + Math.sin(t * 3 + i * 1.5) * 0.2;
                        // Periodic glitch: all lights simultaneously surge
                        if (Math.sin(t * 0.7) > 0.92) {
                            cyber *= 2.0 + Math.random() * 0.5;
                        }
                        light.intensity = era.accentLightIntensity * cyber;
                    }
                });
                // Underlights: rapid neon alternation
                this.eerieUnderlight1.intensity = eerieConfig.underIntensity1 * (0.5 + Math.sin(t * 4) * 0.3);
                this.eerieUnderlight2.intensity = eerieConfig.underIntensity2 * (0.5 + Math.sin(t * 4 + 2.09) * 0.3); // 120° offset
                this.eerieUnderlight3.intensity = eerieConfig.underIntensity3 * (0.5 + Math.sin(t * 4 + 4.19) * 0.3); // 240° offset
                break;

            case 13: // Space Age - Emergency beacon SOS pattern
                this.accentLights.forEach((light, i) => {
                    if (light.visible) {
                        // SOS-like pattern: 3 short, 3 long, 3 short
                        const pAng = (t * 1.5 + i * 0.3) % (Math.PI * 2);
                        const beacon = pAng < 3.0 ? Math.sin(pAng * 6) > 0 ? 1.0 : 0.1 : 0.6;
                        light.intensity = era.accentLightIntensity * beacon * 0.7;
                    }
                });
                this.eerieUnderlight1.intensity = eerieConfig.underIntensity1 * (0.4 + Math.sin(t * 1.0) * 0.2);
                this.eerieUnderlight2.intensity = eerieConfig.underIntensity2 * (0.6 + Math.sin(t * 0.8 + 1.0) * 0.2);
                this.eerieUnderlight3.intensity = eerieConfig.underIntensity3 * (0.3 + Math.sin(t * 1.2 + 2.0) * 0.15);
                break;

            case 14: // Lunar Colony - Harsh shadow rotation, Earthglow breathe
                this.accentLights.forEach((light, i) => {
                    if (light.visible) {
                        const earthGlow = 0.6 + Math.sin(t * 0.2 + i * 1.0) * 0.2;
                        light.intensity = era.accentLightIntensity * earthGlow;
                    }
                });
                // Very slow, eerie breathing
                this.eerieUnderlight1.intensity = eerieConfig.underIntensity1 * (0.5 + Math.sin(t * 0.25) * 0.2);
                this.eerieUnderlight2.intensity = eerieConfig.underIntensity2 * (0.4 + Math.sin(t * 0.2 + 1.0) * 0.2);
                this.eerieUnderlight3.intensity = eerieConfig.underIntensity3 * (0.3 + Math.sin(t * 0.3 + 2.0) * 0.15);
                break;

            case 15: // Mars Colony - Dust storm warning, red strobe
                this.accentLights.forEach((light, i) => {
                    if (light.visible) {
                        const dustStorm = 0.5 + Math.sin(t * 2.5 + i * 1.8) * 0.25 + Math.sin(t * 0.5) * 0.15;
                        light.intensity = era.accentLightIntensity * dustStorm;
                    }
                });
                // Underlights: red strobe warning pattern
                const strobeCycle = Math.sin(t * 3) > 0.7 ? 1.3 : 0.5;
                this.eerieUnderlight1.intensity = eerieConfig.underIntensity1 * strobeCycle;
                this.eerieUnderlight2.intensity = eerieConfig.underIntensity2 * (0.5 + Math.sin(t * 2 + 1.0) * 0.25);
                this.eerieUnderlight3.intensity = eerieConfig.underIntensity3 * (0.4 + Math.sin(t * 1.5 + 2.0) * 0.2);
                break;

            case 16: // Solar System - Nebula color drift, engine hum
                this.accentLights.forEach((light, i) => {
                    if (light.visible) {
                        const nebulaDrift = 0.6 + Math.sin(t * 0.6 + i * 2.2) * 0.25;
                        light.intensity = era.accentLightIntensity * nebulaDrift;
                    }
                });
                this.eerieUnderlight1.intensity = eerieConfig.underIntensity1 * (0.5 + Math.sin(t * 0.7) * 0.2);
                this.eerieUnderlight2.intensity = eerieConfig.underIntensity2 * (0.4 + Math.sin(t * 0.5 + 1.5) * 0.25);
                this.eerieUnderlight3.intensity = eerieConfig.underIntensity3 * (0.35 + Math.sin(t * 0.8 + 3.0) * 0.2);
                break;

            case 17: // Type I - Dyson energy field oscillation
                this.accentLights.forEach((light, i) => {
                    if (light.visible) {
                        const dysonHum = 0.6 + Math.sin(t * 1.5 + i * 0.7) * 0.2 + Math.sin(t * 4.5 + i * 2.1) * 0.1;
                        light.intensity = era.accentLightIntensity * dysonHum;
                    }
                });
                // Underlights: energy field hum
                this.eerieUnderlight1.intensity = eerieConfig.underIntensity1 * (0.6 + Math.sin(t * 2.0) * 0.2);
                this.eerieUnderlight2.intensity = eerieConfig.underIntensity2 * (0.5 + Math.sin(t * 1.8 + 1.0) * 0.2);
                this.eerieUnderlight3.intensity = eerieConfig.underIntensity3 * (0.4 + Math.sin(t * 2.2 + 2.0) * 0.2);
                break;

            case 18: // Type II - Stellar flare eruptions
                this.accentLights.forEach((light, i) => {
                    if (light.visible) {
                        // Base glow with periodic massive flare
                        let stellar = 0.5 + Math.sin(t * 1.0 + i * 1.2) * 0.2;
                        if (Math.sin(t * 0.4 + i * 0.7) > 0.85) stellar *= 2.5; // Solar flare!
                        light.intensity = era.accentLightIntensity * stellar;
                    }
                });
                this.eerieUnderlight1.intensity = eerieConfig.underIntensity1 * (0.6 + Math.sin(t * 1.5) * 0.3);
                this.eerieUnderlight2.intensity = eerieConfig.underIntensity2 * (0.5 + Math.sin(t * 1.2 + 1.0) * 0.25);
                this.eerieUnderlight3.intensity = eerieConfig.underIntensity3 * (0.4 + Math.sin(t * 1.8 + 2.0) * 0.2);
                break;

            case 19: // Type II.5 - Gravitational lensing shimmer, reality distortion
                this.accentLights.forEach((light, i) => {
                    if (light.visible) {
                        // Multiple overlapping frequencies = shimmering distortion
                        const gravity = 0.4 + Math.sin(t * 2.3 + i * 0.9) * 0.15
                            + Math.sin(t * 3.7 + i * 2.1) * 0.12
                            + Math.sin(t * 5.1 + i * 3.3) * 0.08;
                        light.intensity = era.accentLightIntensity * gravity;
                    }
                });
                // Underlights: warped spacetime pulse
                this.eerieUnderlight1.intensity = eerieConfig.underIntensity1 * (0.5 + Math.sin(t * 1.7 + Math.sin(t * 0.3)) * 0.25);
                this.eerieUnderlight2.intensity = eerieConfig.underIntensity2 * (0.4 + Math.sin(t * 2.1 + Math.sin(t * 0.5)) * 0.25);
                this.eerieUnderlight3.intensity = eerieConfig.underIntensity3 * (0.3 + Math.sin(t * 1.9 + Math.sin(t * 0.4)) * 0.2);
                break;

            case 20: // Type III - Transcendent prismatic cycling through all colors
                this.accentLights.forEach((light, i) => {
                    if (light.visible) {
                        // Intensity waves across all lights
                        const transcend = 0.5 + Math.sin(t * 1.5 + i * 0.5) * 0.3;
                        light.intensity = era.accentLightIntensity * transcend;
                        // Dynamic color cycling!
                        const hue = ((t * 0.1 + i * 0.15) % 1.0);
                        const tempColor = new THREE.Color();
                        tempColor.setHSL(hue, 0.8, 0.6);
                        light.color.copy(tempColor);
                    }
                });
                // Underlights: prismatic cycle
                const hue1 = (t * 0.15) % 1.0;
                const hue2 = (t * 0.15 + 0.33) % 1.0;
                const hue3 = (t * 0.15 + 0.66) % 1.0;
                const c1 = new THREE.Color(); c1.setHSL(hue1, 0.9, 0.5);
                const c2 = new THREE.Color(); c2.setHSL(hue2, 0.9, 0.5);
                const c3 = new THREE.Color(); c3.setHSL(hue3, 0.9, 0.5);
                this.eerieUnderlight1.color.copy(c1);
                this.eerieUnderlight2.color.copy(c2);
                this.eerieUnderlight3.color.copy(c3);
                this.eerieUnderlight1.intensity = eerieConfig.underIntensity1 * (0.6 + Math.sin(t * 1.2) * 0.3);
                this.eerieUnderlight2.intensity = eerieConfig.underIntensity2 * (0.6 + Math.sin(t * 1.2 + 2.09) * 0.3);
                this.eerieUnderlight3.intensity = eerieConfig.underIntensity3 * (0.6 + Math.sin(t * 1.2 + 4.19) * 0.3);
                // Orbiter also cycles
                const oHue = (t * 0.2) % 1.0;
                const oColor = new THREE.Color(); oColor.setHSL(oHue, 1.0, 0.7);
                this.eerieOrbiter.color.copy(oColor);
                break;

            default:
                // Subtle generic eerie breathing
                this.accentLights.forEach((light, i) => {
                    if (light.visible) {
                        light.intensity = era.accentLightIntensity * (0.6 + Math.sin(t * 0.8 + i) * 0.2);
                    }
                });
                this.eerieUnderlight1.intensity = eerieConfig.underIntensity1 * (0.5 + Math.sin(t * 0.5) * 0.2);
                this.eerieUnderlight2.intensity = eerieConfig.underIntensity2 * (0.4 + Math.sin(t * 0.4 + 1.0) * 0.15);
                this.eerieUnderlight3.intensity = eerieConfig.underIntensity3 * (0.3 + Math.sin(t * 0.6 + 2.0) * 0.15);
                break;
        }
    }

    /**
     * Get current era
     */
    getCurrentEra(): EraConfig {
        return getEraForElo(this.currentElo);
    }

    /**
     * Enable/disable lighting system
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        const visible = enabled;

        this.sun.visible = visible;
        this.ambient.visible = visible;
        this.rimLight.visible = visible;
        this.rimLight2.visible = visible;
        this.hemisphere.visible = visible;
        this.fillLight.visible = visible;

        this.accentLights.forEach((light) => {
            light.visible = visible;
        });

        if (this.godRayMesh) {
            this.godRayMesh.visible = visible;
        }

        if (this.eerieFogMesh) {
            this.eerieFogMesh.visible = visible;
        }

        // Eerie lights
        this.eerieUnderlight1.visible = visible;
        this.eerieUnderlight2.visible = visible;
        this.eerieUnderlight3.visible = visible;
        this.eerieOrbiter.visible = visible;
    }

    /**
     * Get sun light for shadow setup
     */
    getSun(): THREE.DirectionalLight {
        return this.sun;
    }

    dispose(): void {
        this.scene.remove(this.sun);
        this.scene.remove(this.ambient);
        this.scene.remove(this.rimLight);
        this.scene.remove(this.rimLight2);
        this.scene.remove(this.hemisphere);
        this.scene.remove(this.fillLight);
        this.scene.remove(this.boardSpotlight);
        this.scene.remove(this.boardSpotlight.target);
        this.scene.remove(this.blackSideSpotlight1);
        this.scene.remove(this.blackSideSpotlight1.target);
        this.scene.remove(this.blackSideSpotlight2);
        this.scene.remove(this.blackSideSpotlight2.target);
        this.scene.remove(this.blackSideFill);

        // Eerie lights
        this.scene.remove(this.eerieUnderlight1);
        this.scene.remove(this.eerieUnderlight2);
        this.scene.remove(this.eerieUnderlight3);
        this.scene.remove(this.eerieOrbiter);

        this.accentLights.forEach(light => this.scene.remove(light));

        if (this.godRayMesh) {
            this.scene.remove(this.godRayMesh);
            (this.godRayMesh.geometry as THREE.BufferGeometry).dispose();
            (this.godRayMesh.material as THREE.Material).dispose();
        }

        if (this.eerieFogMesh) {
            this.scene.remove(this.eerieFogMesh);
            (this.eerieFogMesh.geometry as THREE.BufferGeometry).dispose();
            (this.eerieFogMesh.material as THREE.Material).dispose();
        }
    }
}

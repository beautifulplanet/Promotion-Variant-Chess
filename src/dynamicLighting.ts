// src/dynamicLighting.ts
// Dynamic Lighting System - ELO-Based Atmospheric Lighting
// 2026 Studio Quality: Volumetric effects, god rays, era-specific atmospheres

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
    private maxAccentLights: number = 8;

    // God ray effect (volumetric light)
    private godRayMesh: THREE.Mesh | null = null;
    
    // Board spotlight - always illuminates the chess board
    private boardSpotlight: THREE.SpotLight;
    
    // Black side spotlights - illuminates black pieces for better contrast
    private blackSideSpotlight1: THREE.SpotLight;
    private blackSideSpotlight2: THREE.SpotLight;
    private blackSideFill: THREE.PointLight;

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

        // Create god ray mesh
        this.createGodRays();
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
     * Get accent light configurations for each era
     */
    private getAccentLightConfig(era: EraConfig): Array<{
        color: number;
        intensity: number;
        distance: number;
        position: THREE.Vector3;
    }> {
        const baseColor = era.accentLightColor;
        const baseIntensity = era.accentLightIntensity;

        // Different configurations based on era type
        switch (era.id) {
            case 1: // Cretaceous - Lava glow
                return [
                    { color: 0xff3300, intensity: baseIntensity, distance: 30, position: new THREE.Vector3(-20, 2, -30) },
                    { color: 0xff6600, intensity: baseIntensity * 0.7, distance: 25, position: new THREE.Vector3(25, 2, -40) },
                    { color: 0xff4400, intensity: baseIntensity * 0.5, distance: 20, position: new THREE.Vector3(0, 5, -50) },
                ];

            case 6: // Medieval - Torch lights
                return [
                    { color: 0xff8040, intensity: baseIntensity, distance: 15, position: new THREE.Vector3(-15, 8, -20) },
                    { color: 0xff6020, intensity: baseIntensity * 0.8, distance: 12, position: new THREE.Vector3(18, 10, -35) },
                ];

            case 12: // Cyberpunk - Neon glow
                return [
                    { color: 0xff00ff, intensity: baseIntensity, distance: 25, position: new THREE.Vector3(-25, 15, -20) },
                    { color: 0x00ffff, intensity: baseIntensity, distance: 25, position: new THREE.Vector3(25, 12, -30) },
                    { color: 0xff0080, intensity: baseIntensity * 0.6, distance: 20, position: new THREE.Vector3(0, 20, -40) },
                    { color: 0x00ff80, intensity: baseIntensity * 0.5, distance: 18, position: new THREE.Vector3(-30, 8, -50) },
                ];

            case 17: // Type I - Energy glow
            case 18: // Type II
            case 19: // Type II.5
            case 20: // Type III
                return [
                    { color: baseColor, intensity: baseIntensity, distance: 40, position: new THREE.Vector3(0, 30, -30) },
                    { color: 0xffff80, intensity: baseIntensity * 0.8, distance: 35, position: new THREE.Vector3(-30, 20, -40) },
                    { color: 0x80ffff, intensity: baseIntensity * 0.8, distance: 35, position: new THREE.Vector3(30, 25, -35) },
                    { color: 0xff80ff, intensity: baseIntensity * 0.6, distance: 30, position: new THREE.Vector3(0, 40, -60) },
                ];

            default:
                // Default subtle accent
                return [
                    { color: baseColor, intensity: baseIntensity * 0.5, distance: 20, position: new THREE.Vector3(0, 10, -30) },
                ];
        }
    }

    /**
     * Animate lighting each frame
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

        // Animate accent lights (flicker effect for certain eras)
        const era = getEraForElo(this.currentElo);
        if (era.id === 1 || era.id === 3 || era.id === 6) {
            // Flicker for fire-based eras
            this.accentLights.forEach((light, i) => {
                if (light.visible) {
                    const flicker = 0.7 + Math.sin(this.time * 10 + i * 2) * 0.15 + Math.sin(this.time * 23 + i) * 0.15;
                    light.intensity = era.accentLightIntensity * flicker;
                }
            });
        } else if (era.id === 12) {
            // Pulse for cyberpunk
            this.accentLights.forEach((light, i) => {
                if (light.visible) {
                    const pulse = 0.8 + Math.sin(this.time * 3 + i * 1.5) * 0.2;
                    light.intensity = era.accentLightIntensity * pulse;
                }
            });
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
        this.scene.remove(this.hemisphere);
        this.scene.remove(this.boardSpotlight);
        this.scene.remove(this.boardSpotlight.target);

        this.accentLights.forEach(light => this.scene.remove(light));

        if (this.godRayMesh) {
            this.scene.remove(this.godRayMesh);
            (this.godRayMesh.geometry as THREE.BufferGeometry).dispose();
            (this.godRayMesh.material as THREE.Material).dispose();
        }
    }
}

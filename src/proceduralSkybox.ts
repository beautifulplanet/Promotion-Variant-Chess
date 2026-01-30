// src/proceduralSkybox.ts
// High-End Procedural Skybox System - 2026 Studio Quality
// Features: Dynamic gradients, procedural stars, nebulae, aurora, atmospheric scattering

import * as THREE from 'three';
import { EraConfig, getEraForElo, getEraProgress, interpolateColor } from './eraSystem';

// =============================================================================
// SKYBOX SHADER - Procedural Multi-Layer Sky Generation
// =============================================================================

const skyVertexShader = `
varying vec3 vWorldPosition;
varying vec2 vUv;

void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const skyFragmentShader = `
uniform vec3 topColor;
uniform vec3 midColor;
uniform vec3 bottomColor;
uniform vec3 horizonGlow;
uniform float time;
uniform float starDensity;
uniform float nebulaIntensity;
uniform float auroraIntensity;
uniform vec3 sunPosition;
uniform float sunIntensity;
uniform vec3 sunColor;

varying vec3 vWorldPosition;
varying vec2 vUv;

// Pseudo-random function
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Noise function for nebula
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Fractal Brownian Motion for nebula clouds - OPTIMIZED (4 iterations instead of 6)
float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for(int i = 0; i < 4; i++) {
        value += amplitude * noise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return value;
}

// Star field generation
float stars(vec2 uv, float density) {
    vec2 pos = floor(uv * 800.0);
    float starValue = hash(pos);
    
    // Twinkle effect
    float twinkle = sin(time * 2.0 + starValue * 100.0) * 0.5 + 0.5;
    
    // Star threshold based on density
    float threshold = 1.0 - density * 0.012;
    
    if(starValue > threshold) {
        float brightness = (starValue - threshold) / (1.0 - threshold);
        brightness = pow(brightness, 2.0) * (0.7 + 0.3 * twinkle);
        
        // Star color variation
        vec3 starColor = mix(vec3(1.0, 0.9, 0.8), vec3(0.8, 0.9, 1.0), hash(pos + 0.5));
        return brightness * length(starColor);
    }
    return 0.0;
}

// Aurora effect
vec3 aurora(vec2 uv, float intensity) {
    if(intensity <= 0.0) return vec3(0.0);
    
    float auroraY = uv.y * 2.0 - 0.5;
    float waveMask = smoothstep(0.3, 0.6, auroraY) * smoothstep(0.9, 0.6, auroraY);
    
    // Flowing aurora waves
    float wave1 = sin(uv.x * 8.0 + time * 0.5) * 0.5 + 0.5;
    float wave2 = sin(uv.x * 12.0 - time * 0.3 + 1.0) * 0.5 + 0.5;
    float wave3 = sin(uv.x * 20.0 + time * 0.7 + 2.0) * 0.5 + 0.5;
    
    float waves = wave1 * wave2 * wave3;
    
    // Aurora colors (green to purple gradient)
    vec3 auroraColor1 = vec3(0.2, 1.0, 0.5);
    vec3 auroraColor2 = vec3(0.5, 0.2, 1.0);
    vec3 auroraColor = mix(auroraColor1, auroraColor2, wave2);
    
    return auroraColor * waveMask * waves * intensity * 0.4;
}

// Nebula clouds
vec3 nebula(vec2 uv, float intensity) {
    if(intensity <= 0.0) return vec3(0.0);
    
    vec2 nebulaUv = uv * 3.0 + time * 0.02;
    
    float n1 = fbm(nebulaUv);
    float n2 = fbm(nebulaUv * 2.0 + 5.0);
    float n3 = fbm(nebulaUv * 0.5 + 10.0);
    
    // Multi-colored nebula
    vec3 color1 = vec3(1.0, 0.3, 0.5) * n1;
    vec3 color2 = vec3(0.3, 0.5, 1.0) * n2;
    vec3 color3 = vec3(0.5, 0.2, 0.8) * n3;
    
    vec3 nebulaColor = (color1 + color2 + color3) * 0.4;
    
    return nebulaColor * intensity;
}

// Sun/star glow
vec3 sunGlow(vec3 worldPos, vec3 sunPos, float intensity, vec3 color) {
    vec3 sunDir = normalize(sunPos);
    vec3 viewDir = normalize(worldPos);
    
    float sunDot = max(0.0, dot(viewDir, sunDir));
    float glow = pow(sunDot, 32.0) * intensity;
    float halo = pow(sunDot, 4.0) * intensity * 0.3;
    
    return color * (glow + halo);
}

void main() {
    vec3 worldDir = normalize(vWorldPosition);
    float height = worldDir.y * 0.5 + 0.5;
    
    // Base sky gradient (3-point gradient)
    vec3 skyColor;
    if(height < 0.5) {
        skyColor = mix(bottomColor, midColor, height * 2.0);
    } else {
        skyColor = mix(midColor, topColor, (height - 0.5) * 2.0);
    }
    
    // Horizon glow effect
    float horizonFactor = 1.0 - abs(height - 0.3) * 3.0;
    horizonFactor = max(0.0, horizonFactor);
    horizonFactor = pow(horizonFactor, 2.0);
    skyColor = mix(skyColor, horizonGlow, horizonFactor * 0.6);
    
    // Add stars
    vec2 starUv = vec2(atan(worldDir.x, worldDir.z) / 6.28318 + 0.5, height);
    float starBrightness = stars(starUv + time * 0.001, starDensity);
    skyColor += vec3(starBrightness);
    
    // Add nebula
    vec2 nebulaUv = vec2(atan(worldDir.x, worldDir.z) / 6.28318, height);
    skyColor += nebula(nebulaUv, nebulaIntensity);
    
    // Add aurora
    skyColor += aurora(nebulaUv, auroraIntensity);
    
    // Add sun glow
    skyColor += sunGlow(vWorldPosition, sunPosition, sunIntensity, sunColor);
    
    // Atmospheric fog at horizon
    float fog = 1.0 - smoothstep(0.0, 0.15, abs(height - 0.3));
    skyColor = mix(skyColor, horizonGlow, fog * 0.3);
    
    gl_FragColor = vec4(skyColor, 1.0);
}
`;

// =============================================================================
// PROCEDURAL SKYBOX CLASS
// =============================================================================

export class ProceduralSkybox {
    private mesh: THREE.Mesh;
    private material: THREE.ShaderMaterial;
    private uniforms: {
        topColor: { value: THREE.Color };
        midColor: { value: THREE.Color };
        bottomColor: { value: THREE.Color };
        horizonGlow: { value: THREE.Color };
        time: { value: number };
        starDensity: { value: number };
        nebulaIntensity: { value: number };
        auroraIntensity: { value: number };
        sunPosition: { value: THREE.Vector3 };
        sunIntensity: { value: number };
        sunColor: { value: THREE.Color };
    };

    private currentElo: number = 400;
    private targetElo: number = 400;
    private transitionProgress: number = 1.0;

    constructor() {
        this.uniforms = {
            topColor: { value: new THREE.Color(0x000020) },
            midColor: { value: new THREE.Color(0x000040) },
            bottomColor: { value: new THREE.Color(0x000080) },
            horizonGlow: { value: new THREE.Color(0x4080ff) },
            time: { value: 0 },
            starDensity: { value: 0.5 },
            nebulaIntensity: { value: 0 },
            auroraIntensity: { value: 0 },
            sunPosition: { value: new THREE.Vector3(100, 50, 100) },
            sunIntensity: { value: 1.0 },
            sunColor: { value: new THREE.Color(0xffffff) },
        };

        this.material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: skyVertexShader,
            fragmentShader: skyFragmentShader,
            side: THREE.BackSide,
            depthWrite: false,
        });

        const geometry = new THREE.SphereGeometry(400, 64, 64);
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.renderOrder = -1000;
    }

    getMesh(): THREE.Mesh {
        return this.mesh;
    }

    /**
     * Update skybox for current ELO with smooth transitions
     */
    updateForElo(elo: number, instant: boolean = false): void {
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
     * Apply era-specific settings to uniforms
     */
    private applyEraSettings(elo: number): void {
        const era = getEraForElo(elo);
        const progress = getEraProgress(elo);

        // Set sky colors
        this.uniforms.topColor.value.setHex(era.skyTopColor);
        this.uniforms.midColor.value.setHex(era.skyMidColor);
        this.uniforms.bottomColor.value.setHex(era.skyBottomColor);
        this.uniforms.horizonGlow.value.setHex(era.horizonGlow);

        // Set atmospheric effects
        this.uniforms.starDensity.value = era.starDensity;
        this.uniforms.nebulaIntensity.value = era.nebulaIntensity;
        this.uniforms.auroraIntensity.value = era.auroraIntensity;

        // Set sun properties
        const sunAngle = era.sunAngleBase + progress * 0.2;
        this.uniforms.sunPosition.value.set(
            Math.cos(sunAngle) * 100,
            Math.sin(sunAngle) * 50 + 30,
            Math.sin(sunAngle * 0.5) * 100
        );
        this.uniforms.sunIntensity.value = era.sunIntensity;
        this.uniforms.sunColor.value.setHex(era.sunColor);
    }

    /**
     * Animate skybox each frame
     */
    animate(deltaTime: number): void {
        // Update time for shader animations
        this.uniforms.time.value += deltaTime * 0.001;

        // Smooth transition between ELO values
        if (this.transitionProgress < 1.0) {
            this.transitionProgress = Math.min(1.0, this.transitionProgress + deltaTime * 0.002);
            const currentLerpElo = this.currentElo + (this.targetElo - this.currentElo) * this.transitionProgress;
            this.applyEraSettings(Math.round(currentLerpElo));

            if (this.transitionProgress >= 1.0) {
                this.currentElo = this.targetElo;
            }
        }

        // Subtle sun movement
        const sunAngle = this.uniforms.time.value * 0.02;
        const era = getEraForElo(this.currentElo);
        const baseAngle = era.sunAngleBase;

        this.uniforms.sunPosition.value.x = Math.cos(baseAngle + sunAngle * 0.1) * 100;
        this.uniforms.sunPosition.value.z = Math.sin(baseAngle + sunAngle * 0.05) * 100;
    }

    /**
     * Get current era info
     */
    getCurrentEra(): EraConfig {
        return getEraForElo(this.currentElo);
    }

    dispose(): void {
        this.material.dispose();
        (this.mesh.geometry as THREE.BufferGeometry).dispose();
    }
}

// =============================================================================
// WORMHOLE TRANSITION EFFECT
// =============================================================================

const wormholeVertexShader = `
varying vec2 vUv;
varying vec3 vPosition;

void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const wormholeFragmentShader = `
uniform float time;
uniform float progress;
uniform float intensity;
uniform vec3 color1;
uniform vec3 color2;

varying vec2 vUv;
varying vec3 vPosition;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
    vec2 center = vec2(0.5, 0.5);
    vec2 uv = vUv - center;
    
    float dist = length(uv);
    float angle = atan(uv.y, uv.x);
    
    // Swirling vortex effect
    float swirl = sin(angle * 8.0 + time * 5.0 - dist * 20.0) * 0.5 + 0.5;
    float spiral = sin(angle * 3.0 - time * 3.0 + dist * 15.0) * 0.5 + 0.5;
    
    // Radial waves
    float wave = sin(dist * 30.0 - time * 10.0) * 0.5 + 0.5;
    
    // Combine effects
    float pattern = swirl * spiral * wave;
    
    // Tunnel depth effect
    float tunnel = 1.0 - smoothstep(0.0, 0.5 * progress, dist);
    tunnel = pow(tunnel, 2.0);
    
    // Color blend
    vec3 wormholeColor = mix(color1, color2, pattern);
    wormholeColor += vec3(1.0) * pow(pattern, 4.0) * 2.0;
    
    // Energy streaks
    float streak = hash(vec2(angle * 100.0 + time, dist * 50.0));
    streak = pow(streak, 8.0) * (1.0 - dist);
    wormholeColor += vec3(streak) * 3.0;
    
    // Edge glow
    float edge = smoothstep(0.4, 0.5, dist) * smoothstep(0.6, 0.5, dist);
    wormholeColor += vec3(0.5, 0.8, 1.0) * edge * 3.0;
    
    // Final alpha based on progress and tunnel
    float alpha = tunnel * intensity * (1.0 - smoothstep(0.45, 0.55, dist));
    alpha = clamp(alpha, 0.0, 1.0);
    
    // Bright center
    float centerGlow = 1.0 - smoothstep(0.0, 0.1, dist);
    wormholeColor += vec3(1.0) * centerGlow * 5.0 * intensity;
    alpha = max(alpha, centerGlow * intensity);
    
    gl_FragColor = vec4(wormholeColor, alpha);
}
`;

export class WormholeTransition {
    private mesh: THREE.Mesh;
    private material: THREE.ShaderMaterial;
    private uniforms: {
        time: { value: number };
        progress: { value: number };
        intensity: { value: number };
        color1: { value: THREE.Color };
        color2: { value: THREE.Color };
    };

    private isActive: boolean = false;
    private transitionDuration: number = 2000; // ms
    private transitionStartTime: number = 0;
    private onCompleteCallback: (() => void) | null = null;

    constructor() {
        this.uniforms = {
            time: { value: 0 },
            progress: { value: 0 },
            intensity: { value: 0 },
            color1: { value: new THREE.Color(0x00ffff) },
            color2: { value: new THREE.Color(0xff00ff) },
        };

        this.material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: wormholeVertexShader,
            fragmentShader: wormholeFragmentShader,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });

        // Full-screen quad
        const geometry = new THREE.PlaneGeometry(2, 2);
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 1000;
        this.mesh.visible = false;
    }

    getMesh(): THREE.Mesh {
        return this.mesh;
    }

    /**
     * Start wormhole transition with era colors
     */
    startTransition(fromEra: EraConfig, toEra: EraConfig, onComplete?: () => void): void {
        this.isActive = true;
        this.mesh.visible = true;
        this.transitionStartTime = performance.now();
        this.onCompleteCallback = onComplete || null;

        // Set colors based on eras
        this.uniforms.color1.value.setHex(fromEra.horizonGlow);
        this.uniforms.color2.value.setHex(toEra.horizonGlow);
    }

    /**
     * Update transition each frame
     */
    animate(deltaTime: number): void {
        this.uniforms.time.value += deltaTime * 0.001;

        if (!this.isActive) return;

        const elapsed = performance.now() - this.transitionStartTime;
        const rawProgress = elapsed / this.transitionDuration;

        if (rawProgress >= 1.0) {
            // Transition complete
            this.isActive = false;
            this.mesh.visible = false;
            this.uniforms.intensity.value = 0;
            this.uniforms.progress.value = 0;

            if (this.onCompleteCallback) {
                this.onCompleteCallback();
                this.onCompleteCallback = null;
            }
            return;
        }

        // Intensity curve: ramp up, hold, ramp down
        let intensity: number;
        if (rawProgress < 0.3) {
            // Ramp up
            intensity = rawProgress / 0.3;
        } else if (rawProgress < 0.7) {
            // Hold
            intensity = 1.0;
        } else {
            // Ramp down
            intensity = 1.0 - (rawProgress - 0.7) / 0.3;
        }

        this.uniforms.progress.value = rawProgress;
        this.uniforms.intensity.value = intensity;
    }

    isTransitioning(): boolean {
        return this.isActive;
    }

    dispose(): void {
        this.material.dispose();
        (this.mesh.geometry as THREE.BufferGeometry).dispose();
    }
}

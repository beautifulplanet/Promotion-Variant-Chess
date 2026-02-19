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
uniform float dayNightPhase;

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

// Shooting stars and comets
float shootingStar(vec2 uv, float t) {
    float result = 0.0;
    for (int i = 0; i < 5; i++) {
        float fi = float(i);
        float period = 5.0 + fi * 3.5;
        float slot = floor(t / period);
        float phase = fract(t / period);
        float duration = 0.06 + fi * 0.01;
        if (phase < duration) {
            float p = phase / duration;
            float startX = hash(vec2(slot, fi + 100.0));
            float startY = 0.55 + hash(vec2(slot + 50.0, fi + 200.0)) * 0.35;
            float angle = -0.4 - hash(vec2(fi + 300.0, slot)) * 0.6;
            float speed = 0.35 + hash(vec2(slot * 3.0, fi + 400.0)) * 0.25;
            vec2 head = vec2(startX + cos(angle) * p * speed, startY + sin(angle) * p * speed);
            float tailT = max(0.0, p - 0.35);
            vec2 tail = vec2(startX + cos(angle) * tailT * speed, startY + sin(angle) * tailT * speed);
            vec2 ab = head - tail;
            float abLen = length(ab);
            if (abLen > 0.001) {
                float proj = clamp(dot(uv - tail, ab) / dot(ab, ab), 0.0, 1.0);
                float dist = length(uv - tail - ab * proj);
                float brightness = smoothstep(0.006, 0.0, dist) * (1.0 - p * 0.4);
                brightness *= 0.2 + 0.8 * proj;
                result += brightness * 1.8;
            }
        }
    }
    // Comet: rarer, brighter, with wider glow tail
    {
        float cPeriod = 35.0;
        float cSlot = floor(t / cPeriod);
        float cPhase = fract(t / cPeriod);
        if (cPhase < 0.12) {
            float p = cPhase / 0.12;
            float sx = hash(vec2(cSlot, 999.0));
            float sy = 0.7 + hash(vec2(cSlot + 1.0, 999.0)) * 0.2;
            float ca = -0.25 - hash(vec2(cSlot, 888.0)) * 0.3;
            float cs = 0.2;
            vec2 cHead = vec2(sx + cos(ca) * p * cs, sy + sin(ca) * p * cs);
            float cTailT = max(0.0, p - 0.2);
            vec2 cTail = vec2(sx + cos(ca) * cTailT * cs, sy + sin(ca) * cTailT * cs);
            vec2 cab = cHead - cTail;
            if (length(cab) > 0.001) {
                float cProj = clamp(dot(uv - cTail, cab) / dot(cab, cab), 0.0, 1.0);
                float cDist = length(uv - cTail - cab * cProj);
                float cBright = smoothstep(0.015, 0.0, cDist) * (1.0 - p * 0.3);
                cBright *= 0.1 + 0.9 * cProj;
                // Comet glow halo
                float halo = smoothstep(0.04, 0.0, cDist) * 0.3 * (1.0 - p * 0.3) * cProj;
                result += (cBright * 2.5 + halo);
            }
        }
    }
    return min(result, 4.0);
}

// Moon glow
vec3 moonGlow(vec3 worldPos, float dayPhase) {
    // Moon is opposite the sun
    float moonAngle = dayPhase * 6.28318 + 3.14159;
    vec3 moonDir = normalize(vec3(cos(moonAngle) * 0.5, sin(moonAngle) * 0.4 + 0.3, 0.3));
    vec3 viewDir = normalize(worldPos);
    float moonDot = max(0.0, dot(viewDir, moonDir));
    float disc = smoothstep(0.997, 0.999, moonDot);
    float halo = pow(moonDot, 64.0) * 0.3;
    float outerHalo = pow(moonDot, 8.0) * 0.08;
    // Moon only visible at night (phase near 0.5)
    float nightFactor = smoothstep(0.15, 0.35, dayPhase) * smoothstep(0.85, 0.65, dayPhase);
    vec3 moonColor = vec3(0.85, 0.9, 1.0);
    return moonColor * (disc * 1.5 + halo + outerHalo) * nightFactor;
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
    
    // Day/night cycle: 0=noon 0.5=midnight
    float nightFactor = smoothstep(0.15, 0.4, dayNightPhase) * smoothstep(0.85, 0.6, dayNightPhase);
    float dayBrightness = mix(1.0, 0.12, nightFactor);
    
    // Sunset/sunrise warm tint (around phase 0.2 and 0.8)
    float sunsetFactor = max(
        smoothstep(0.1, 0.2, dayNightPhase) * smoothstep(0.35, 0.25, dayNightPhase),
        smoothstep(0.65, 0.75, dayNightPhase) * smoothstep(0.9, 0.8, dayNightPhase)
    );
    vec3 sunsetTint = vec3(1.0, 0.5, 0.2) * sunsetFactor * 0.4;
    
    // Darken sky at night, add sunset tint during transitions
    skyColor = skyColor * dayBrightness + sunsetTint;
    
    // Add stars (much brighter at night)
    vec2 starUv = vec2(atan(worldDir.x, worldDir.z) / 6.28318 + 0.5, height);
    float nightStarBoost = mix(1.0, 5.0, nightFactor);
    float starBrightness = stars(starUv + time * 0.001, starDensity) * nightStarBoost;
    skyColor += vec3(starBrightness);
    
    // Add shooting stars and comets (more visible at night)
    float meteorBoost = mix(0.6, 1.5, nightFactor);
    float meteorBrightness = shootingStar(starUv, time) * meteorBoost;
    skyColor += vec3(meteorBrightness * 0.9, meteorBrightness * 0.95, meteorBrightness);
    
    // Add moon (visible at night)
    skyColor += moonGlow(vWorldPosition, dayNightPhase);
    
    // Add nebula
    vec2 nebulaUv = vec2(atan(worldDir.x, worldDir.z) / 6.28318, height);
    skyColor += nebula(nebulaUv, nebulaIntensity) * mix(1.0, 1.5, nightFactor);
    
    // Add aurora (brighter at night)
    skyColor += aurora(nebulaUv, auroraIntensity) * mix(1.0, 1.8, nightFactor);
    
    // Add sun glow (fades at night)
    skyColor += sunGlow(vWorldPosition, sunPosition, sunIntensity * dayBrightness, sunColor);
    
    // Atmospheric fog at horizon
    float fog = 1.0 - smoothstep(0.0, 0.15, abs(height - 0.3));
    skyColor = mix(skyColor, horizonGlow * dayBrightness, fog * 0.3);
    
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
        dayNightPhase: { value: number };
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
            dayNightPhase: { value: 0 },
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

        // Day/night cycle: full cycle every ~4 minutes (240s)
        const DAY_NIGHT_PERIOD = 240.0;
        const dayNightPhase = (this.uniforms.time.value / DAY_NIGHT_PERIOD) % 1.0;
        this.uniforms.dayNightPhase.value = dayNightPhase;

        // Sun orbits with day/night cycle
        const era = getEraForElo(this.currentElo);
        const baseAngle = era.sunAngleBase;
        const dayAngle = dayNightPhase * Math.PI * 2; // Full rotation

        // Sun Y: high at noon (phase 0), below horizon at midnight (phase 0.5)
        const sunY = Math.cos(dayAngle) * 60 + 30;
        this.uniforms.sunPosition.value.set(
            Math.cos(baseAngle + dayAngle * 0.3) * 100,
            sunY,
            Math.sin(baseAngle + dayAngle * 0.15) * 100
        );

        // Dim sun intensity at night
        const nightFactor = Math.max(0, Math.min(1, (Math.cos(dayAngle) + 1) * 0.5));
        this.uniforms.sunIntensity.value = era.sunIntensity * (0.05 + 0.95 * nightFactor);
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

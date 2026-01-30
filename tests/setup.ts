/**
 * Test Setup - Global test utilities and mocks
 */

// Mock WebGL context for Three.js tests
class MockWebGLRenderingContext {
    canvas = { width: 800, height: 600 };
    drawingBufferWidth = 800;
    drawingBufferHeight = 600;

    getExtension() { return null; }
    getParameter(param: number) { return param === 7937 ? 'Mock WebGL' : 16384; }
    getShaderPrecisionFormat() { return { precision: 23, rangeMin: 127, rangeMax: 127 }; }
    createTexture() { return {}; }
    createFramebuffer() { return {}; }
    createRenderbuffer() { return {}; }
    createBuffer() { return {}; }
    createShader() { return {}; }
    createProgram() { return {}; }
    bindTexture() { }
    bindFramebuffer() { }
    bindRenderbuffer() { }
    bindBuffer() { }
    attachShader() { }
    linkProgram() { }
    getProgramParameter() { return true; }
    getShaderParameter() { return true; }
    getUniformLocation() { return {}; }
    getAttribLocation() { return 0; }
    enableVertexAttribArray() { }
    vertexAttribPointer() { }
    useProgram() { }
    uniform1i() { }
    uniform1f() { }
    uniform2f() { }
    uniform3f() { }
    uniform4f() { }
    uniformMatrix4fv() { }
    activeTexture() { }
    texImage2D() { }
    texParameteri() { }
    enable() { }
    disable() { }
    depthFunc() { }
    depthMask() { }
    blendFunc() { }
    blendEquation() { }
    cullFace() { }
    frontFace() { }
    viewport() { }
    scissor() { }
    clear() { }
    clearColor() { }
    drawElements() { }
    drawArrays() { }
    shaderSource() { }
    compileShader() { }
    pixelStorei() { }
    generateMipmap() { }
    deleteTexture() { }
    deleteBuffer() { }
    deleteShader() { }
    deleteProgram() { }
    bufferData() { }
    framebufferTexture2D() { }
    renderbufferStorage() { }
    checkFramebufferStatus() { return 36053; }
}

// Mock canvas getContext to return WebGL mock
if (typeof HTMLCanvasElement !== 'undefined') {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (contextId: string, options?: any) {
        if (contextId === 'webgl' || contextId === 'webgl2') {
            return new MockWebGLRenderingContext() as any;
        }
        return originalGetContext.call(this, contextId, options);
    };
}

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback: FrameRequestCallback) => {
    return setTimeout(() => callback(performance.now()), 16) as unknown as number;
};

global.cancelAnimationFrame = (id: number) => {
    clearTimeout(id);
};

// Mock performance.now if not available
if (typeof performance === 'undefined') {
    (global as any).performance = {
        now: () => Date.now(),
    };
}

// Export test utilities
export function createMockCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    return canvas;
}

export function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Performance measurement utility
 */
export function measurePerformance<T>(fn: () => T, iterations = 100): { result: T; avgMs: number; minMs: number; maxMs: number } {
    const times: number[] = [];
    let result: T;

    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        result = fn();
        times.push(performance.now() - start);
    }

    return {
        result: result!,
        avgMs: times.reduce((a, b) => a + b, 0) / times.length,
        minMs: Math.min(...times),
        maxMs: Math.max(...times),
    };
}

/**
 * Memory measurement utility (approximation)
 */
export function measureMemory(fn: () => void): { usedJSHeapSize?: number } {
    if ((performance as any).memory) {
        const before = (performance as any).memory.usedJSHeapSize;
        fn();
        const after = (performance as any).memory.usedJSHeapSize;
        return { usedJSHeapSize: after - before };
    }
    fn();
    return {};
}

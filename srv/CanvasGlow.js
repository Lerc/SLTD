/**
 * WebGL Glow/Bloom Shader with Dual-Filter (Downsample/Upsample) Approach
 * 
 * API:
 *   initGlow(outputCanvas, canvas2d) - Initialize WebGL context and resources
 *   glowCanvas(canvas2d) - Render the glow effect
 *   updateGlowSettings({threshold, bloom, blurLevel, exposure}) - Update effect parameters
 */

// Global gl variable (set by initWebGL)
let gl;
let width, height;
let brightPassProgram, downsampleProgram, upsampleProgram, compositeProgram;
let quadBuffer;
let sourceTexture, brightTexture, brightFB, bloomTexture, bloomFB;
let mipChain, upsampleChain;
const MAX_MIP_LEVELS = 7;

// Settings
let settings = {
    threshold: 0.0,
    bloom: 2.0,
    blurLevel: 5,
    exposure: 1.0
};

// Vertex shader - simple fullscreen quad
const vertexShaderSource = `
attribute vec2 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;

void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
    vTexCoord = aTexCoord;
}
`;

// Fragment shader - extract bright areas
const brightPassFragmentSource = `
precision mediump float;
varying vec2 vTexCoord;
uniform sampler2D uTexture;
uniform float uThreshold;

void main() {
    vec4 color = texture2D(uTexture, vTexCoord);
    float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
    
    // Soft threshold with smooth transition
    float contribution = smoothstep(uThreshold, uThreshold + 0.2, brightness);
    gl_FragColor = vec4(color.rgb * contribution, 1.0);
}
`;

// Fragment shader - Downsample with 4-tap box filter
const downsampleFragmentSource = `
precision mediump float;
varying vec2 vTexCoord;
uniform sampler2D uTexture;
uniform vec2 uTexelSize;

void main() {
    // Sample 4 points with half-texel offset for proper box filter
    vec4 sum = vec4(0.0);
    sum += texture2D(uTexture, vTexCoord + vec2(-0.5, -0.5) * uTexelSize);
    sum += texture2D(uTexture, vTexCoord + vec2( 0.5, -0.5) * uTexelSize);
    sum += texture2D(uTexture, vTexCoord + vec2(-0.5,  0.5) * uTexelSize);
    sum += texture2D(uTexture, vTexCoord + vec2( 0.5,  0.5) * uTexelSize);
    gl_FragColor = sum * 0.25;
}
`;

// Fragment shader - Upsample with tent filter
const upsampleFragmentSource = `
precision mediump float;
varying vec2 vTexCoord;
uniform sampler2D uTexture;
uniform sampler2D uAccumTexture;
uniform vec2 uTexelSize;
uniform float uUseAccum;

void main() {
    // 9-tap tent filter for smooth upsampling
    vec4 sum = vec4(0.0);
    
    // Center (weight 4)
    sum += texture2D(uTexture, vTexCoord) * 4.0;
    
    // Edges (weight 2 each)
    sum += texture2D(uTexture, vTexCoord + vec2(-1.0,  0.0) * uTexelSize) * 2.0;
    sum += texture2D(uTexture, vTexCoord + vec2( 1.0,  0.0) * uTexelSize) * 2.0;
    sum += texture2D(uTexture, vTexCoord + vec2( 0.0, -1.0) * uTexelSize) * 2.0;
    sum += texture2D(uTexture, vTexCoord + vec2( 0.0,  1.0) * uTexelSize) * 2.0;
    
    // Corners (weight 1 each)
    sum += texture2D(uTexture, vTexCoord + vec2(-1.0, -1.0) * uTexelSize);
    sum += texture2D(uTexture, vTexCoord + vec2( 1.0, -1.0) * uTexelSize);
    sum += texture2D(uTexture, vTexCoord + vec2(-1.0,  1.0) * uTexelSize);
    sum += texture2D(uTexture, vTexCoord + vec2( 1.0,  1.0) * uTexelSize);
    
    vec4 upsampled = sum / 16.0;
    
    // Add to accumulator if available
    if (uUseAccum > 0.5) {
        vec4 accum = texture2D(uAccumTexture, vTexCoord);
        gl_FragColor = upsampled + accum;
    } else {
        gl_FragColor = upsampled;
    }
}
`;

// Fragment shader - final composite with HDR tone mapping
const compositeFragmentSource = `
precision mediump float;
varying vec2 vTexCoord;
uniform sampler2D uOriginal;
uniform sampler2D uBloom;
uniform float uIntensity;
uniform float uExposure;
uniform float uPreserveAlpha;

// ACES filmic tone mapping
vec3 acesFilm(vec3 x) {
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
    vec4 source = texture2D(uOriginal, vTexCoord);
    vec3 original = source.rgb;
    vec3 bloom = texture2D(uBloom, vTexCoord).rgb;
    
    // Combine original with bloom
    vec3 hdrColor = original + bloom * uIntensity;
    
    // Apply exposure
    hdrColor *= uExposure;
    
    // Tone mapping for HDR -> LDR
    vec3 mapped = acesFilm(hdrColor);
    
    // Gamma correction
    mapped = pow(mapped, vec3(1.0 / 2.2));
    
    // Canvas expects premultiplied output. Preserve opaque sprite interiors,
    // with enough alpha around them to carry the shader's colored glow.
    float alpha = uPreserveAlpha > 0.5
        ? max(source.a, max(mapped.r, max(mapped.g, mapped.b))) : 1.0;
    gl_FragColor = vec4(mapped, alpha);
}
`;

// Create texture
function createTexture(gl, w, h) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
}

// Create framebuffer
function createFramebuffer(gl, texture) {
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    return fb;
}

/**
 * Initialize the glow shader system
 * @param {HTMLCanvasElement} outputCanvas - Canvas to render glow effect to
 * @param {HTMLCanvasElement} canvas2d - Source 2D canvas (used to set dimensions)
 */
function initGlow(outputCanvas, canvas2d) {
    // Initialize WebGL context using your boilerplate
    gl = initWebGL(outputCanvas);
    if (!gl) {
        throw new Error('WebGL not supported');
    }
    
    // Set dimensions from source canvas
    width = canvas2d.width;
    height = canvas2d.height;
    outputCanvas.width = width;
    outputCanvas.height = height;
    
    // Create shader programs using your boilerplate
    const vShader = vertexShader(vertexShaderSource);
    // Matches the quadBuffer layout below.
    const quadAttribs = ['aPosition', 'aTexCoord'];
    
    brightPassProgram = generateShaderProgram(vShader, fragmentShader(brightPassFragmentSource), quadAttribs);
    downsampleProgram = generateShaderProgram(vShader, fragmentShader(downsampleFragmentSource), quadAttribs);
    upsampleProgram = generateShaderProgram(vShader, fragmentShader(upsampleFragmentSource), quadAttribs);
    compositeProgram = generateShaderProgram(vShader, fragmentShader(compositeFragmentSource), quadAttribs);
    
    // Create fullscreen quad using your bufferFromArray
    quadBuffer = bufferFromArray([
        // position    texCoord
        -1, -1,        0, 0,
         1, -1,        1, 0,
        -1,  1,        0, 1,
         1,  1,        1, 1,
    ]);
    
    // Create source texture (from 2D canvas)
    sourceTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
    // Create bright pass texture
    brightTexture = createTexture(gl, width, height);
    brightFB = createFramebuffer(gl, brightTexture);
    
    // Create mip chain for downsample/upsample blur
    mipChain = [];
    let mipWidth = width;
    let mipHeight = height;
    for (let i = 0; i < MAX_MIP_LEVELS; i++) {
        mipWidth = Math.max(1, Math.floor(mipWidth / 2));
        mipHeight = Math.max(1, Math.floor(mipHeight / 2));
        
        const texture = createTexture(gl, mipWidth, mipHeight);
        const fb = createFramebuffer(gl, texture);
        
        mipChain.push({
            texture,
            fb,
            width: mipWidth,
            height: mipHeight
        });
    }
    
    // Create upsample accumulation buffers
    upsampleChain = [];
    mipWidth = width;
    mipHeight = height;
    for (let i = 0; i < MAX_MIP_LEVELS; i++) {
        mipWidth = Math.max(1, Math.floor(mipWidth / 2));
        mipHeight = Math.max(1, Math.floor(mipHeight / 2));
        
        const texture = createTexture(gl, mipWidth, mipHeight);
        const fb = createFramebuffer(gl, texture);
        
        upsampleChain.push({
            texture,
            fb,
            width: mipWidth,
            height: mipHeight
        });
    }
    
    // Final bloom result at full resolution
    bloomTexture = createTexture(gl, width, height);
    bloomFB = createFramebuffer(gl, bloomTexture);
}

/**
 * Render the glow effect
 * @param {HTMLCanvasElement} canvas2d - Source 2D canvas to apply glow to
 */
function glowFrame(canvas2d, preserveAlpha = false) {
    if (!gl) {
        throw new Error('Call initGlow() first');
    }
    
    // Upload source canvas to texture (flip Y for canvas->WebGL coordinate conversion)
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, preserveAlpha);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas2d);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    
    // Bind quad buffer for all passes
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    
    // ========== Pass 1: Extract bright areas ==========
    gl.bindFramebuffer(gl.FRAMEBUFFER, brightFB);
    gl.viewport(0, 0, width, height);
    brightPassProgram.use();
    brightPassProgram.setInterleaved();
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
    brightPassProgram.uTexture = 0;
    brightPassProgram.uThreshold = settings.threshold;
    
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    
    // ========== Pass 2: Downsample chain ==========
    downsampleProgram.use();
    downsampleProgram.setInterleaved();
    
    const numLevels = Math.min(settings.blurLevel, MAX_MIP_LEVELS);
    
    for (let i = 0; i < numLevels; i++) {
        const mip = mipChain[i];
        const srcTexture = (i === 0) ? brightTexture : mipChain[i - 1].texture;
        const srcWidth = (i === 0) ? width : mipChain[i - 1].width;
        const srcHeight = (i === 0) ? height : mipChain[i - 1].height;
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, mip.fb);
        gl.viewport(0, 0, mip.width, mip.height);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, srcTexture);
        downsampleProgram.uTexture = 0;
        downsampleProgram.uTexelSize = [1.0 / srcWidth, 1.0 / srcHeight];
        
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    
    // ========== Pass 3: Upsample chain with accumulation ==========
    upsampleProgram.use();
    upsampleProgram.setInterleaved();
    
    for (let i = numLevels - 1; i >= 0; i--) {
        const mip = mipChain[i];
        const isFirst = (i === numLevels - 1);
        const isLast = (i === 0);
        
        // Target: either upsample buffer or final bloom texture
        const targetFB = isLast ? bloomFB : upsampleChain[i - 1].fb;
        const targetWidth = isLast ? width : upsampleChain[i - 1].width;
        const targetHeight = isLast ? height : upsampleChain[i - 1].height;
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, targetFB);
        gl.viewport(0, 0, targetWidth, targetHeight);
        
        // Source: current mip level
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, mip.texture);
        upsampleProgram.uTexture = 0;
        upsampleProgram.uTexelSize = [1.0 / mip.width, 1.0 / mip.height];
        
        // Accumulator: previous upsample result (if not first iteration)
        if (!isFirst) {
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, upsampleChain[i].texture);
            upsampleProgram.uAccumTexture = 1;
            upsampleProgram.uUseAccum = 1.0;
        } else {
            upsampleProgram.uUseAccum = 0.0;
        }
        
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    
    // ========== Pass 4: Composite ==========
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    compositeProgram.use();
    compositeProgram.setInterleaved();
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
    compositeProgram.uOriginal = 0;
    
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, bloomTexture);
    compositeProgram.uBloom = 1;
    
    compositeProgram.uIntensity = settings.bloom;
    compositeProgram.uExposure = settings.exposure;
    compositeProgram.uPreserveAlpha = preserveAlpha ? 1 : 0;
    
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

/**
 * Update glow effect settings
 * @param {Object} newSettings - Settings object with optional properties:
 *   @param {number} newSettings.threshold - Brightness threshold (0-1, default 0)
 *   @param {number} newSettings.bloom - Bloom intensity (0-5, default 2)
 *   @param {number} newSettings.blurLevel - Blur mip levels (1-7, default 5)
 *   @param {number} newSettings.exposure - HDR exposure (0.5-4, default 1)
 */
function updateGlowSettings(newSettings) {
    if (newSettings.threshold !== undefined) settings.threshold = newSettings.threshold;
    if (newSettings.bloom !== undefined) settings.bloom = newSettings.bloom;
    if (newSettings.blurLevel !== undefined) settings.blurLevel = newSettings.blurLevel;
    if (newSettings.exposure !== undefined) settings.exposure = newSettings.exposure;
}


function createTextureTarget ( targetTextureWidth = 256, targetTextureHeight = targetTextureWidth) {
  const targetTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, targetTexture);     
  {
    // define size and format of level 0
    const level = 0;
    const internalFormat = gl.RGBA;
    const border = 0;
    const format = gl.RGBA;
    const type = gl.UNSIGNED_BYTE;
    const data = null;
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                  targetTextureWidth, targetTextureHeight, border,
                  format, type, data);
    
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  return targetTexture;
}


// Improved glow shader with better quality and configurability
// Features: dynamic resolution, smooth thresholds, higher quality blur, adjustable parameters
var horizontalBlurShader= `#version 300 es

  precision highp float;
  uniform sampler2D source;
  uniform vec2 resolution;
  uniform float glowThreshold;
  uniform float glowSoftness;
  uniform float blurRadius;

  in vec2 here;
  out vec4 FragColor;

  #define kernelSize 21

  // Higher quality 21-tap Gaussian kernel for smoother blur
  float[] kernel = float[kernelSize](
    0.0648, 0.0642, 0.0626, 0.0600, 0.0566, 0.0524, 0.0476, 0.0424, 0.0370, 0.0317,
    0.0267, 0.0220, 0.0178, 0.0141, 0.0110, 0.0084, 0.0063, 0.0046, 0.0033, 0.0023, 0.0016
  );

  // Smooth brightness extraction with configurable threshold and falloff
  vec4 glowVal(vec2 pos) {
    vec4 v = texture(source, pos);
    vec3 c = v.rgb * 2.0;

    // Use perceptual luminance
    float brightness = dot(c, vec3(0.2126, 0.7152, 0.0722));

    // Smooth threshold with configurable softness (instead of hard cutoff)
    float glowAmount = smoothstep(glowThreshold - glowSoftness, glowThreshold + glowSoftness, brightness);

    // Apply glow amount with brightness preservation
    c *= glowAmount * glowAmount; // Quadratic falloff for smoother transitions

    v.rgb = c;
    return v;
  }

  void main() {
    vec2 source_coord = (here + vec2(1.0, 1.0)) / 2.0;

    vec4 accum = glowVal(source_coord) * kernel[0];

    // Dynamic step size based on resolution and blur radius
    vec2 step = vec2(blurRadius / resolution.x, 0.0);

    for (int i = 1; i < kernelSize; i++) {
      accum += glowVal(source_coord + step * float(i)) * kernel[i];
      accum += glowVal(source_coord - step * float(i)) * kernel[i];
    }

    FragColor = accum * 0.5;
  }
  `;

  var verticalBlurShader= `#version 300 es

  precision highp float;
  uniform sampler2D glow;
  uniform sampler2D source;
  uniform vec2 resolution;
  uniform float blurRadius;
  uniform float glowIntensity;
  uniform float bloomStrength;

  in vec2 here;
  out vec4 FragColor;
  #define kernelSize 21

  // Matching 21-tap Gaussian kernel
  float[] kernel = float[kernelSize](
    0.0648, 0.0642, 0.0626, 0.0600, 0.0566, 0.0524, 0.0476, 0.0424, 0.0370, 0.0317,
    0.0267, 0.0220, 0.0178, 0.0141, 0.0110, 0.0084, 0.0063, 0.0046, 0.0033, 0.0023, 0.0016
  );

  // Improved ACES tone mapping
  vec3 ACESFilm(vec3 x) {
    const float a = 2.51;
    const float b = 0.03;
    const float c = 2.43;
    const float d = 0.59;
    const float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  vec4 tone(vec4 color) {
    color.rgb *= 2.5;
    color.rgb = ACESFilm(color.rgb / 2.0);
    return color;
  }

  vec4 hdrVal(vec2 pos) {
    return texture(glow, pos) * 2.0;
  }

  void main() {
    vec2 source_coord = (here + vec2(1.0, 1.0)) / 2.0;
    source_coord.y = 1.0 - source_coord.y;

    vec4 accum = hdrVal(source_coord) * kernel[0];

    // Dynamic step size based on resolution and blur radius
    vec2 step = vec2(0.0, blurRadius / resolution.y);

    for (int i = 1; i < kernelSize; i++) {
      accum += hdrVal(source_coord + step * float(i)) * kernel[i];
      accum += hdrVal(source_coord - step * float(i)) * kernel[i];
    }

    vec4 c = texture(source, source_coord);

    // Enhanced bloom with configurable strength
    vec3 bloom = pow(c.rgb * 1.5, vec3(4.0)) * bloomStrength;
    c.rgb += bloom;

    // Add the blurred glow with intensity control
    c.rgb += accum.rgb * glowIntensity;

    FragColor = tone(c);
  }
  `;

 var glsl3VertexShader =`#version 300 es
 in vec2 position;
 out vec2 here;

 void main() {
   gl_Position = vec4(position,0.0,1.0);
   here = position;   
   
 }
 
 `


 function initGlow(outputCanvas,frameCanvas) {
  var gl = initWebGL2(outputCanvas);
  window.gl=gl;

  window.frameTexture =createTextureTarget(frameCanvas.width,frameCanvas.height);

  window.bufferA_texture= createTextureTarget(frameCanvas.width/2,frameCanvas.height/2);

  gl.activeTexture(gl.TEXTURE0+1);
  gl.bindTexture(gl.TEXTURE_2D,bufferA_texture)

  window.bufferA = gl.createFramebuffer();
  gl.activeTexture(gl.TEXTURE0);

  gl.activeTexture(gl.TEXTURE0);

  gl.bindFramebuffer(gl.FRAMEBUFFER,bufferA);
  gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D,bufferA_texture,0);

  gl.bindTexture(gl.TEXTURE_2D,frameTexture)

  gl.bindFramebuffer(gl.FRAMEBUFFER,null)
  gl.viewport(0,0,outputCanvas.width,outputCanvas.height);
  gl.clearColor(0,1,0,1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const quadVBO = bufferFromArray([
    -1, -1,  1, 1,   -1, 1,
    -1, -1,   1,1,   1, -1]);


  let vs3= vertexShader(glsl3VertexShader);
  let hblurShader = fragmentShader(horizontalBlurShader)
  let vblurShader = fragmentShader(verticalBlurShader)

  window.hblur= generateShaderProgram(vs3,hblurShader);
  window.vblur= generateShaderProgram(vs3,vblurShader);

  // Configure horizontal blur shader with improved defaults
  hblur.use();
  hblur.source=0;
  hblur.resolution = [frameCanvas.width, frameCanvas.height];
  hblur.glowThreshold = 0.8;  // Configurable brightness threshold
  hblur.glowSoftness = 0.3;   // Smooth falloff around threshold
  hblur.blurRadius = 4.0;     // Blur spread in pixels

  // Configure vertical blur shader with improved defaults
  vblur.use();
  vblur.source=0;
  vblur.glow=1;
  vblur.resolution = [frameCanvas.width, frameCanvas.height];
  vblur.blurRadius = 4.0;       // Matching blur radius
  vblur.glowIntensity = 1.0;    // Overall glow strength
  vblur.bloomStrength = 5.0625; // Bloom intensity (preserved from original)

  // Store configuration for runtime adjustment
  window.glowConfig = {
    threshold: 0.8,
    softness: 0.3,
    radius: 4.0,
    intensity: 1.0,
    bloomStrength: 5.0625
  };

  window.drawQuad = () =>  {
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
    gl.drawArrays(gl.TRIANGLES,0,6)
  }

 }

 function glowFrame(canvas) {
  gl.bindTexture(gl.TEXTURE_2D,frameTexture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE,canvas);

  hblur.use();
  gl.viewport(0,0,outputCanvas.width/2,outputCanvas.height/2);

  gl.bindFramebuffer(gl.FRAMEBUFFER,bufferA);
  drawQuad();

  vblur.use();
  gl.viewport(0,0,outputCanvas.width,outputCanvas.height);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  drawQuad();
 }

 // Helper function to adjust glow parameters at runtime
 // Usage: updateGlowSettings({ threshold: 0.9, intensity: 1.5 })
 function updateGlowSettings(settings) {
  if (!window.hblur || !window.vblur) {
    console.error("Glow shaders not initialized");
    return;
  }

  if (settings.threshold !== undefined) {
    window.glowConfig.threshold = settings.threshold;
    hblur.use();
    hblur.glowThreshold = settings.threshold;
  }

  if (settings.softness !== undefined) {
    window.glowConfig.softness = settings.softness;
    hblur.use();
    hblur.glowSoftness = settings.softness;
  }

  if (settings.radius !== undefined) {
    window.glowConfig.radius = settings.radius;
    hblur.use();
    hblur.blurRadius = settings.radius;
    vblur.use();
    vblur.blurRadius = settings.radius;
  }

  if (settings.intensity !== undefined) {
    window.glowConfig.intensity = settings.intensity;
    vblur.use();
    vblur.glowIntensity = settings.intensity;
  }

  if (settings.bloomStrength !== undefined) {
    window.glowConfig.bloomStrength = settings.bloomStrength;
    vblur.use();
    vblur.bloomStrength = settings.bloomStrength;
  }

  console.log("Glow settings updated:", window.glowConfig);
 }


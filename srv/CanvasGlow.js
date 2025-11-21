
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


// decent kernel generator at http://demofox.org/gauss.html
var horizontalBlurShader= `#version 300 es

  precision mediump float;
  uniform sampler2D source;
  
  in vec2 here;
  out vec4 FragColor;

  #define kernelSize 15

//  float[] kernel = float[32](
//   0.0399,	0.0397,	0.0392,	0.0382,	0.0369,	0.0353,	0.0334,	0.0313,	0.0290,	0.0266,	0.0242,	0.0218,	0.0195,	0.0172,	0.0150,	0.0130,	0.0111,	0.0094,	0.0079,	0.0066,	0.0054,	0.0044,	0.0036,	0.0028,	0.0022,	0.0018,	0.0014,	0.0010,	0.0008,	0.0006,	0.0004,	0.0003
//    );
  float[] kernel = float[kernelSize](
    0.0675,	0.0665,	0.0638,	0.0596,	0.0541,	0.0477,	0.0410,	0.0342,	0.0278,	0.0220,	0.0169,	0.0126,	0.0092,	0.0065,	0.0045
  );

  vec4 tone(vec4 hcolor) {
    vec3 x=exp(hcolor.rgb*2.0);
  
    vec3 c= (x-vec3(1.0)) / (x+vec3(1.0));
  
    return  vec4(c,hcolor.a);
  }
  

  vec4 glowVal(vec2 pos) {
    vec4 v = texture(source,pos);
    vec3 c = v.rgb * 2.0;

    
    
    float brightness = dot(c, vec3(0.2126, 0.7152, 0.0722));

    if(brightness < 1.0) {
      c = vec3(0.0, 0.0, 0.0);
    }

    v.rgb = c;
    return v;
  }

  
  vec4 flatVal(vec4 c) {
    c.rgb *= 0.5;
    return c;
  }

  

  void main() {
    vec2 source_coord = (here + vec2(1.0,1.0))/2.0;

    vec4 accum = glowVal(source_coord) * kernel[0];

    vec2 step = vec2(4.0/1080.0,0);

    for (int i = 1; i< kernelSize; i++) {
      accum += glowVal(source_coord+step*float(i)) * kernel[i];
      accum += glowVal(source_coord-step*float(i)) * kernel[i];
    }

    FragColor = flatVal(accum);
    
  }
  `;

  var verticalBlurShader= `#version 300 es

  precision mediump float;
  uniform sampler2D glow;

  uniform sampler2D source;
  
  in vec2 here;
  out vec4 FragColor;
  #define kernelSize 15

  //float[] kernel = float[kernelSize](  //size = 32
  //  0.0399,	0.0397,	0.0392,	0.0382,	0.0369,	0.0353,	0.0334,	0.0313,	0.0290,	0.0266,	0.0242,	0.0218,	0.0195,	0.0172,	0.0150,	0.0130,	0.0111,	0.0094,	0.0079,	0.0066,	0.0054,	0.0044,	0.0036,	0.0028,	0.0022,	0.0018,	0.0014,	0.0010,	0.0008,	0.0006,	0.0004,	0.0003    );
  float[] kernel = float[kernelSize](
    0.0675,	0.0665,	0.0638,	0.0596,	0.0541,	0.0477,	0.0410,	0.0342,	0.0278,	0.0220,	0.0169,	0.0126,	0.0092,	0.0065,	0.0045
  );


  float Tonemap_ACES(float x) {
      // Narkowicz 2015, "ACES Filmic Tone Mapping Curve"
      const float a = 2.51;
      const float b = 0.03;
      const float c = 2.43;
      const float d = 0.59;
      const float e = 0.14;
      return (x * (a * x + b)) / (x * (c * x + d) + e);
  }

  vec4 tone(vec4 c) {
    c.rgb*=2.5;
    c.r=Tonemap_ACES(c.r/2.0);
    c.g=Tonemap_ACES(c.g/2.0);
    c.b=Tonemap_ACES(c.b/2.0);
  
    return  c;
  }
  

  vec4 hdrVal(vec2 pos) {
    vec4 c = texture(glow,pos)*2.0;
    //c.rgb += pow(c.rgb*1.5,vec3(4.0));

    return c;
  }

  
  vec4 flatVal(vec4 c) {
    c.rgb += pow(c.rgb,vec3(4.0))*5.0625;
    return c;
  }

  

  void main() {
    vec2 source_coord = (here + vec2(1.0,1.0))/2.0; 
    source_coord.y=1.0-source_coord.y;

    vec4 accum = hdrVal(source_coord) * kernel[0];
    

    vec2 step = vec2(0,4.0/1920.0);

    for (int i = 1; i< kernelSize; i++) {
      accum += hdrVal(source_coord+step*float(i)) * kernel[i];
      accum += hdrVal(source_coord-step*float(i)) * kernel[i];
    }
    vec4 c = texture(source,source_coord);
    c.rgb += pow(c.rgb*1.5,vec3(4.0));

    c.rgb += accum.rgb;
    

    
    //FragColor = tone(c);
    //FragColor= texture(glow,source_coord);
    

    
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

  hblur.use();
  hblur.source=0;

  vblur.use();
  vblur.source=0;
  vblur.glow=1;

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


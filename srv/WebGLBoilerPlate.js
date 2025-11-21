"use strict"
var allShaders=[];

function initWebGL2(canvas) {
  let gl = null;
  
  try { gl = canvas.getContext("webgl2")  }
  catch(e) {}
  
  // If we don't have a GL context, give up now
  if (!gl) {
    alert("Unable to initialize a WebGL 2 context . Your browser may not support it.");
    gl = null;
  }
  return gl;
}

function initWebGL(canvas) {
  let gl = null;
  
  try {
    // Try to grab the standard context. If it fails, fallback to experimental.
    gl = canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  }
  catch(e) {}
  
  // If we don't have a GL context, give up now
  if (!gl) {
    alert("Unable to initialize WebGL. Your browser may not support it.");
    gl = null;
  }
  
  return gl;
}

function bufferFromArray(source,mode = gl.STATIC_DRAW) {
  let buffer  =gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(source), mode);
  return buffer;
}

function vertexShader(source) {
  return compileShader(gl.createShader(gl.VERTEX_SHADER),source);
}

function fragmentShader(source) {
  return compileShader(gl.createShader(gl.FRAGMENT_SHADER),source);
}

function compileShader(shader,source) {
  gl.shaderSource(shader,source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {  
    alert("An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader));  
    return null;  
  }
  return shader;
}

function getUniformFunction(glContext,location,type) {
  switch(type) {
    case gl.FLOAT: return v=>glContext.uniform1f(location,v);
    case gl.FLOAT_VEC2: return v=>glContext.uniform2fv(location,v);
    case gl.FLOAT_VEC3: return v=>glContext.uniform3fv(location,v);
    case gl.FLOAT_VEC4: return v=>glContext.uniform4fv(location,v);
    case gl.FLOAT_MAT2: return v=>glContext.uniformMatrix2fv(location,false,v);
    case gl.FLOAT_MAT3: return v=>glContext.uniformMatrix3fv(location,false,v);
    case gl.FLOAT_MAT4: return v=>glContext.uniformMatrix4fv(location,false,v);
    case gl.SAMPLER_2D: return v=>glContext.uniform1i(location,v);

  }
  console.error("unhandled uniform type ", type);
  return a=>a;
}
function getAttribFunction(glContext,location,type) {
  switch(type) {
    case gl.FLOAT: return (stride=0,offset=0)=>glContext.vertexAttribPointer(location,1,gl.FLOAT,false,stride,offset);
    case gl.FLOAT_VEC2: return (stride=0,offset=0)=>glContext.vertexAttribPointer(location,2,gl.FLOAT,false,stride,offset);
    case gl.FLOAT_VEC3: return (stride=0,offset=0)=>glContext.vertexAttribPointer(location,3,gl.FLOAT,false,stride,offset);
    case gl.FLOAT_VEC4: return (stride=0,offset=0)=>glContext.vertexAttribPointer(location,4,gl.FLOAT,false,stride,offset);
  }
  console.error("unhandled attribute type ", type);
  return a=>a;
}
function attribSize(attribInfo) {
  switch(attribInfo.type) {
    case gl.FLOAT: return 1;
    case gl.FLOAT_VEC2: return 2;
    case gl.FLOAT_VEC3: return 3;
    case gl.FLOAT_VEC4: return 4;
  }  
  console.error("unhandled attribute type ", type);
  return 0;
}

function getInterleaveFunction(interleaveData) {
  let stride = interleaveData.reduce((a,b)=>a+b.size,0)  * 4;
  return _  => {
    let offset=0;
    for (let i of interleaveData) {
      i.set(stride,offset);
      offset+=i.size*4;
    }
  }
}

function generateShaderProgram(vertexShader,fragmentShader) {
  // Create the shader program

  let shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  // If creating the shader program failed, alert

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert("Unable to initialize the shader program.");
  }
  function use() {
    gl.useProgram(shaderProgram);
  }

  use();

  let uniformCount = gl.getProgramParameter(shaderProgram, gl.ACTIVE_UNIFORMS);
  
  for (let i=0; i<uniformCount;i++) {
    let uniform=gl.getActiveUniform(shaderProgram,i);
    let uniformLocation = gl.getUniformLocation(shaderProgram,uniform.name);
    let set = getUniformFunction(gl,uniformLocation,uniform.type);
    Object.defineProperty(shaderProgram,uniform.name.replace(/\[[^)]*\]/,"") ,{set});
    //console.log("uniform", uniform);
  }

  let attribCount = gl.getProgramParameter(shaderProgram, gl.ACTIVE_ATTRIBUTES);
  let interleaveData = [];

  for (let i=0; i<attribCount;i++) {
    let attrib=gl.getActiveAttrib(shaderProgram,i);
    let attribLocation = gl.getAttribLocation(shaderProgram,attrib.name);
    let set = getAttribFunction(gl,attribLocation,attrib.type);
    let size=attribSize(attrib);
    interleaveData.push({size,set})
    let functionName = attrib.name+"Pointer";
    shaderProgram[functionName]=set;
    gl.enableVertexAttribArray(attribLocation);
    console.log("attrib", attrib);
  }

  shaderProgram.setInterleaved=getInterleaveFunction(interleaveData);
  shaderProgram.setInterleaved();
  //vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
  //gl.enableVertexAttribArray(vertexPositionAttribute);
  shaderProgram.use = use;
  shaderProgram.index = allShaders.push(shaderProgram)-1;
  return shaderProgram;
}





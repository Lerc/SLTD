"use strict"

const PROJECTION=0
const TRANSFORM=1
const SHADER=2
const DRAW=3
const USEIMAGE=4
const COLOR=5


const GL= WebGLRenderingContext;

var textureCache;

var testInstructions = new Int32Array ([
  PROJECTION,16,            0,0,0,0,0,0,
  TRANSFORM, 16,            0,0,0,0,0,0,
  SHADER,0, 0,                0,0,0,0,0,
  COLOR,4, 0,                0,0,0,0,0,
  DRAW, 12, GL.TRIANGLES, 6,      0,0,0,0,    
]);

var testFloats = new Float32Array([
  //0.002,0,0,0, 0,-0.002,0,0, 0,0,0.1,0, -1,1,1,1,
  ...mat4.ortho(mat4.create(),0,1920,1080,0,0,1000),
  1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1,
  //1,1, -1,1, 1,-1, -1,-1, 
  0.5,0.5,1,1,
  20,20, 20,250, 250,250,   250,20, 20,20, 250,250   ]);

var identityMatrix4 = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);

function executeDrawList(glContext, operations,floatData,operationCount = operations.length/8) {
  var data=operations;
  var floatOffset =0;
  var offset=0;
  let currentShader = allShaders[0];
  currentShader.use();
  
  for (let i=0; i<operationCount; i++) {

    let opcode = data[offset];
    let floatCount = data[offset+1];
    let floats=floatData.subarray(floatOffset,floatOffset+floatCount);
    floatOffset+=floatCount;

    switch (opcode) {
      case PROJECTION: {         
        //console.log("set projection");
        currentShader.projection = floats;
      } break;
      case TRANSFORM: {         
       // console.log("set transform");
        currentShader.transform = floats;
      } break;

      case SHADER: {
        //console.log("set shader");
        currentShader = allShaders[data[offset+2]];
        currentShader.use();
      } break;

      case DRAW:{
        glContext.bufferData(gl.ARRAY_BUFFER,floats,gl.STREAM_DRAW);
        let mode = data[offset+2];
        let count = data[offset+3];
        glContext.drawArrays(mode,0,count)
        //console.log("draw something ",count);
      } break;  
      case COLOR: {                 
        //console.log("set Color",floats.toString());

        currentShader.baseColor = floats;
      } break;

    }

    offset+=8;
  }

}

function makeRenderList( intCount = 8192, floatCount=262144) {
  let instructionData = new Int32Array (intCount);
  let floatData = new Float32Array(floatCount);
  let count = 0;

  return {instructionData,floatData,count};
}

function makeSetter(setter,defaultValue) {
  let value=defaultValue;
  let get = _=>value;
  let set = newValue=>value = setter(newValue) || newValue;
  return {get,set}
}

function addSetter(object,name,setter,defaultValue) {
  Object.defineProperty(object,name,makeSetter(setter),defaultValue);
}

function makeDrawContext(gl) {
  let self = {
    render,clearRenderList,newRenderList,useShader, setTransform, applyTransform, translate, fillRect,
  };
  let currentRenderList;
  let floatOffset=0; 
  let transform = mat4.create();
  let changed=false;
  let noticeChange = _=>{changed=true};
  addSetter(self,"fillShader",noticeChange);
  addSetter(self,"fillColor",noticeChange);

  self.fillShader = allShaders[0];
  self.fillColor = [1,1,1,1];

  newRenderList();

  if (!textureCache) textureCache=makeImageTextureCache(gl);

  self.renderLists = [currentRenderList];
  
  function render(newList=true) {
    //console.log(self.renderLists);
    for (let {instructionData,floatData,count} of self.renderLists) {
      executeDrawList(gl, instructionData,floatData,count) 
    }
    if (newList==true) {
      newRenderList();
    } 
  }

  function clearRenderList() {
    currentRenderList=makeRenderList(); 
    self.renderLists = [currentRenderList];
    floatOffset=0;
  }

  function newRenderList() {
    clearRenderList();
    setProjection();    
    setTransform(mat4.create());

  }
   
  function appendFloats(floats) {
    currentRenderList.floatData.set(floats,floatOffset);
    floatOffset+=floats.length;
  }

  function setProjection(value = mat4.ortho(mat4.create(),0,1920,1080,0,0,1000)) {
    if (value.length != 16) console.error("transform must be 16 floats" )
    let offset= currentRenderList.count*8;
    let instruction = currentRenderList.instructionData;
    instruction[offset] = PROJECTION;
    instruction[offset+1] = 16;
    appendFloats(value);
    currentRenderList.count+=1;
  }

  function loadTransform(value) {
    if (value.length != 16) console.error("transform must be 16 floats" )
    let offset= currentRenderList.count*8;
    let instruction = currentRenderList.instructionData;
    instruction[offset] = TRANSFORM;
    instruction[offset+1] = 16;

    appendFloats(value);
    currentRenderList.count+=1;
  }

  function setTransform(value) {
    transform=value;
    loadTransform(transform);
  }

  function applyTransform(value) {
    mat4.multiply(transform,transform,value);
    loadTransform(transform);
  }

  function translate() {

  }

  function useShader(shaderProgram) {
    let offset= currentRenderList.count*8;
    let instruction = currentRenderList.instructionData;
    instruction[offset] = SHADER;
    instruction[offset+1] = 0;
    instruction[offset+2] = shaderProgram.index;
    currentRenderList.count+=1;
  } 

  function setColor(value) {

  }
  function setColor(value) {
    let offset= currentRenderList.count*8;
    let instruction = currentRenderList.instructionData;
    instruction[offset] = COLOR;
    instruction[offset+1] = 4;
    appendFloats(value);
    currentRenderList.count+=1;
  }

  function fillRect(x,y,w,h=w) {
    if (changed) {
      useShader(self.fillShader);
      setColor(self.fillColor);
      changed=false;
    }
    
    let floats = [x,y, x, y+h, x+w,y+h,   x+w,y, x,y, x+w,y+h];
    let offset= currentRenderList.count*8;
    let instruction = currentRenderList.instructionData;
    
    instruction[offset] = DRAW;
    instruction[offset+1] = floats.length;
    instruction[offset+2] = GL.TRIANGLES;
    instruction[offset+3] = 6;
    appendFloats(floats  );    
    currentRenderList.count+=1;

  }
  return self;
}

function makeImageTextureCache(glContext) {
  let workingSet = new Map();
  let cycleCounter = 0;


  function useImage(image) {
    if (!workingSet.has(image)) {
      addImage(image);
    } else {
      let entry = workingSet.get(image);
      entry.lastUse=cycleCounter;
      glContext.bindTexture(glContext.TEXTURE_2D,entry.texture);
    }
  }

  function addImage(image) {
    let texture = glContext.createTexture();
    let lastUse = cycleCounter;
    glContext.bindTexture(glContext.TEXTURE_2D,texture);
    glContext.texImage2d(glContext.TEXTURE_2D,0,glContext.RGBA,glContext.RGBA,glContext.UNSIGNED_BYTE,image);      
    workingSet.set(image,{texture,lastUse});
  }

  function updateImage(image) {
    if (!workingSet.has(image)) {
      addImage(image);
    } else {
      let entry = workingSet.get(image);
      entry.lastUse=cycleCounter;
      glContext.bindTexture(glContext.TEXTURE_2D,entry.texture);
      glContext.texImage2d(glContext.TEXTURE_2D,0,glContext.RGBA,glContext.RGBA,glContext.UNSIGNED_BYTE,image);      
    }
  }

  function cycle() {
    cycleCounter+=1;
  }


    return {useImage,updateImage,cycle}
}
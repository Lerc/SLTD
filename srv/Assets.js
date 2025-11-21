"use strict";
//image format is filename|FramesWide|FramesHigh|[handleX,handleY]
var imageList = [
  "Creep1.png",
  "Creep2.png",
  "Creep3.png",
  "Creep4.png",
  "Tower1.png",
  "Tower2.png",
  "Tower3.png",
  "Tower4.png",
  "Tower5.png",
  "Gun1.png",
  "Gun2.png",
  "Gun3.png",
  "Gun5.png",
  "TowerIcons.png|5",
  
  ].map(imageDetailsFromString);

var soundList = [
];

var assetsPending = [];

var Assets = {};

var audioContext = new AudioContext();

function loadImage(url) {
  assetsPending.push(url);

  var result = new Image();
  result.onload = e => assetsPending.splice(assetsPending.indexOf(url), 1);
  result.src = url;

  let name = url.slice(url.lastIndexOf("/") + 1);

  Assets[name.replace(/\.[^/.]+$/, "")] = result;
  return result;
}

function imageDetailsFromString(s) {
  let [name, framesWide = 1, framesHigh = 1, handle = "null"] = s.split("|");
  name = "images/" + name;
  return {
    name,
    framesWide: parseInt(framesWide),
    framesHigh: parseInt(framesHigh),
    handle: JSON.parse(handle)
  }
}

function playSound(buffer, offset = 0) {
  if (Array.isArray(buffer)) {
    return playSound(buffer[randInt(buffer.length)], offset);
  }
  var source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  source.start(0, offset);
  return source;
}

var audioLoops = [];

function loopSound(buffer, offset = 0) {
  var source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(audioContext.destination);
  source.start(0, offset);
  audioLoops.push(source);
  return source;
}

function stopAudioLoops() {
  for (let s of audioLoops) {
    s.stop();
  }
  audioLoops = [];
}

function loadSound(url) {
  var onError = a => (console.log(a));
  assetsPending.push(url);
  var request = new XMLHttpRequest();
  request.open('GET', url, true);
  request.responseType = 'ArrayBuffer';
  let name = url.slice(url.lastIndexOf("/") + 1).replace(/\.[^/.]+$/, "");
  Assets[name] = audioContext.createBuffer(1, 1, 44100); //temporary null buffer until loaded
  // Decode asynchronously
  request.onload = function() {
    console.log(name + " loaded");
    audioContext.decodeAudioData(request.response, function(buffer) {
      assetsPending.splice(assetsPending.indexOf(url), 1);
      Assets[name] = buffer;
    }, onError);
  }
  request.send();
}


function loadAssets() {

  for (let i of imageList) {
    console.log(i);
    let image = loadImage(i.name);
    image.framesWide = i.framesWide;
    image.framesHigh = i.framesHigh;
    if (i.handle) image.handle = i.handle;
  }

  for (let s of soundList) {
    loadSound("sounds/" + s);
  }


}

loadAssets();

function scaledImage(image, w, h = w) {
  var result = document.createElement("canvas");

  result.width = w;
  result.height = h;

  let ctx = result.getContext("2d");

  ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, w, h);
  return result;
}

function workingImage(from, paddingLeft = 0, paddingTop = paddingLeft, paddingRight = paddingLeft, paddingBottom = paddingTop) {
  var result = document.createElement("canvas");

  result.width = from.width + paddingLeft + paddingRight;
  result.height = from.height + paddingTop + paddingBottom;


  let ctx = result.getContext("2d");
  ctx.drawImage(from, paddingLeft, paddingTop);
  return result;
}

function blankCanvas(w, h = w) {
  var result = document.createElement("canvas");
  result.width = w;
  result.height = h;
  return result;
}


CanvasRenderingContext2D.prototype.clear=function() {
  let c= this.canvas;
  if(c) {
    this.setTransform(1, 0, 0, 1, 0, 0);
    this.clearRect(0,0,c.width,c.height)
  }
}

CanvasRenderingContext2D.prototype.drawSprite = function(image, x=0.0, y=0.0, frame = 0, scale = 1.0) {
  if (image === null) return;
  let frameWidth = image.width;
  let frameHeight = image.height;
  let oy = 0;
  let ox = 0;
  if (image.framesWide) {
    frameWidth = image.width / image.framesWide;
    oy = Math.floor(frame / image.framesWide);
  }
  if (image.framesHigh) {
    frameHeight = image.height / image.framesHigh;
    ox = frame % image.framesWide;
  }

  let [hx, hy] = image.handle || [frameWidth / 2, frameHeight / 2];
  this.drawImage(image, ox * frameWidth, oy * frameHeight, frameWidth, frameHeight, x - hx * scale, y - hy * scale, frameWidth * scale, frameHeight * scale);

}


CanvasRenderingContext2D.prototype.circle = function(x, y, radius) {
  this.beginPath();
  this.ellipse(x, y, radius, radius, 0, 0, Math.PI * 2);
}

function makeTestImage(w=256,h=w) {
  let canvas = document.createElement("canvas");
  let ctx = canvas.getContext("2d");
  ctx.beginPath();
  ctx.fillStyle="orange";
  ctx.ellipse(w/2,h/2,w/2,h/2,0,0,Math.PI*2);
  ctx.fill();
  return canvas;
}


function toggleFullScreen(selector="#main") {
  var canvas = document.querySelector(selector);
  if (document.fullScreenElement || document.webkitFullScreenElement || document.mozFullScreenElement || document.msFullScreenElement) {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitCancelFullScreen) {
      document.webkitCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  } else {
    if (canvas.requestFullscreen) {
      canvas.requestFullscreen();
    } else if (canvas.mozRequestFullScreen) {
      canvas.mozRequestFullScreen();
    } else if (canvas.webkitRequestFullScreen) {
      canvas.webkitRequestFullScreen();
    } else if (canvas.msRequestFullscreen) {
      canvas.msRequestFullscreen();
    }
  }
}


function getImageData(image) {
  let canvas = document.createElement('canvas');

  canvas.width = image.width;
  canvas.height = image.height;

  let ctx = canvas.getContext('2d');

  ctx.drawImage(image, 0, 0);

  let imageData = ctx.getImageData(0, 0, image.width, image.height);

  let pixels = new Uint32Array(imageData.data.buffer);

  return pixels;
}

function moveDefaultParticle() {
  let delta = vdiff(this.position, this.lastPosition);
  this.lastPosition = this.position;
  this.position = vadd(this.position, vscale(delta, 0.99));

  this.age += 1;

  if (this.age > 30) {

    if (probability(0.05)) this.dead = true;
  }
}

function drawDefaultParticle(ctx) {
  let {x, y} = this.position;
  ctx.fillStyle="#876";
  ctx.circle(x,y,3);
  ctx.fill();
}

function makeDefaultParticle(state) {
  let lastPosition = state.pos;
  let position = vadd(lastPosition, v2((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5));

  let {
    image = Assets.particle, age = 0
  } = state;
  let dead = false;

  return {
    position,
    lastPosition,
    image,
    dead,
    age,
    move: moveDefaultParticle,
    draw: drawDefaultParticle,
  }
}

function particleSystem(count, state, makeParticle = makeDefaultParticle) {
  var points = [];
  for (let i of intRange(0, count)) {
    points.push(makeParticle(state));
  }

  function draw(ctx) {
    ctx.globalCompositeOperation = "lighter";
    for (let p of points) {
      p.draw(ctx);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function move() {
    for (let p of points) {
      p.move();
    }
    points = points.filter(a => a.dead == false);
  }

  function isActive() {
    return points.length > 0;
  }
  return {
    move,
    draw,
    isActive
  };
}

var multiLine = function(f) {
  return f.toString().split('\n').slice(1, -1).join('\n');
}

var defaultVertexShader= `
uniform mat4 transform;
uniform mat4 projection;
attribute vec2 position;
varying vec2 here;

void main() {
  gl_Position = projection*transform*vec4(position,0.0,1.0);

  here=position;
}
`;

var defaultFragmentShader= `
precision mediump float;

uniform vec4 baseColor;

varying vec2 here;

void main() {
  gl_FragColor = baseColor+vec4(0,here,length(here));  

  //comment out if not using   gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl_FragColor=vec4(gl_FragColor.rgb * gl_FragColor.a,gl_FragColor.a);  

}
`;

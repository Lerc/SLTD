"use strict";

var min = Math.min;
var max = Math.max;
let median = (a, b, c) => max(min(a, b), min(max(a, b), c));

const TWOPI = Math.PI * 2;

function randInt(below) {
  return Math.floor(Math.random() * below);
}

function randFloat(scale = 1.0, offset = 0) {
  return Math.random() * scale + offset;
}

function probability(amount = 0.5) {
  return Math.random() < amount;
}

function* intRange(start, end) {
  let current = start;
  while (current < end) {
    yield current++;
  }
}

let intHash = x => {
  x *= 0xed5ad4bb;
  x ^= x >> 11;
  x = Math.imul(x,0xac4c1b51);
  x ^= x >> 15;
  x = Math.imul(x,0x31848bab);
  x ^= x >> 14;
  return x;
}

let makeRandom = seed => {
  let index=0;
  let random = (x=index) => {
    let pattern = intHash( (x + seed) & 0x7fffffff)
    let intValue = intHash( (x + pattern)  & 0x7fffffff);
    index=++x;
    return intValue / 0x7fffffff;
  }
  return random;
}

var identityFn = a => a;



function randomPoint(scale = 1.0, offset = [0, 0, 0]) {
  return offset.map(a => randFloat(scale, a));
}

var v2 = (x,y)=>({x,y})
var vdiff = (a,b) => ({
  x:a.x-b.x,
  y:a.y-b.y
});
var vadd = (a,b) => ({
  x:a.x+b.x,
  y:a.y+b.y
});
var vdot = (a,b) => a.x*b.x+a.y*b.y;
var vlength = a => Math.sqrt(vdot(a, a));

var vscale = (a,b) => ({
  x:a.x*b,
  y:a.y*b
});

var vnormalize = (a,desiredLength=1.0) => vscale(a,desiredLength/vlength(a))
var vdistance = (a, b) => vlength(vdiff(a, b));

var vangle = ({x,y})=>Math.PI*0.5+Math.atan2(y,x);

var vFromAngle = (a,size=1) =>v2(Math.cos(a-Math.PI/2)*size,Math.sin(a-Math.PI/2)*size);

var vrandom = (size=1)=> vFromAngle(Math.random()*TWOPI,size);


var vsame = (a,b) => a.x===b.x && a.y==b.y;


function pTime(fn) {
  let start = performance.now();
  fn();
  let end = performance.now();

  return (end - start)
}

function easeOutElastic(t) {
  var p = 0.3;
  return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
}

// Export to global environment (works in both browser and Node.js)
if (typeof module !== 'undefined' && module.exports) {
  globalThis.min = min;
  globalThis.max = max;
  globalThis.median = median;
  globalThis.TWOPI = TWOPI;
  globalThis.randInt = randInt;
  globalThis.randFloat = randFloat;
  globalThis.probability = probability;
  globalThis.intRange = intRange;
  globalThis.intHash = intHash;
  globalThis.makeRandom = makeRandom;
  globalThis.identityFn = identityFn;
  globalThis.randomPoint = randomPoint;
  globalThis.v2 = v2;
  globalThis.vdiff = vdiff;
  globalThis.vadd = vadd;
  globalThis.vdot = vdot;
  globalThis.vlength = vlength;
  globalThis.vscale = vscale;
  globalThis.vnormalize = vnormalize;
  globalThis.vdistance = vdistance;
  globalThis.vangle = vangle;
  globalThis.vFromAngle = vFromAngle;
  globalThis.vrandom = vrandom;
  globalThis.vsame = vsame;
  globalThis.pTime = pTime;
  globalThis.easeOutElastic = easeOutElastic;
}

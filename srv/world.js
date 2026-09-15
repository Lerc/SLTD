"use strict"

let mapToWorld = ({x,y})=>v2((x+0.5)*cellSize,(y+0.5)*cellSize);
let worldToMap = ({x,y})=>v2(Math.floor(x/cellSize),Math.floor(y/cellSize));

function createWorld(textRepresentation) {
  let height = textRepresentation.length;
  let width = textRepresentation[0].length;

  let voidCell = {char:" "};

  let mapData=textRepresentation.flatMap(line => Array.from(line).map(char => ({char}) ))

  let startPoint = findMapStart();

  let path = generatePath();

  function at({x,y}) {
    if (!Number.isInteger(x) || !Number.isInteger(y)) return voidCell;
    if (x<0 || y<0 || x>=width || y>=height) return voidCell;
    return mapData[y*width+x];
  }
  
  function isSolid(pos) {
    return at(pos).char!==".";
  }

  function canBuildHere(pos) {
    return at(pos).char=="#";
  }

  function findMapStart() {
    for (let tx=0; tx < width;tx++) {
      if (!isSolid(v2(tx,0))) return v2(tx,-1);
    }

    for (let ty=0; ty<height;ty++) {
      if (!isSolid(v2(0,ty))) return v2(-1,ty);
    }
    throw new Error("could not find start of map");

  }
  
  function generatePath() {
    let result = [startPoint];
    let last = startPoint;
    let current = startPoint.x<0?v2(0,startPoint.y):v2(startPoint.x,0);
    let fail = 999;
    while (current) {
      result.push(current);
      let neighbours = [
        v2(current.x-1,current.y),
        v2(current.x+1,current.y),
        v2(current.x,current.y-1),
        v2(current.x,current.y+1)
      ];
      let candidates=neighbours.filter(v=>vdistance(last,v)>0);      
      last=current;
      current=candidates.find(v=>!isSolid(v));
      if (fail--<0) current=null;
    }
    result.push(vadd(last,vdiff(result[result.length-1],result[result.length-2])));
    return result;

  }


  function draw() {

    ctx.lineWidth = 2;
    ctx.fillStyle = '#020706';
    ctx.fillRect(0, 0, width * cellSize, height * cellSize);
    // Quiet grid, brighter route: threats and tower effects carry the light.
    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        if (isSolid(v2(tx, ty))) {
          ctx.fillStyle = (tx + ty) % 2 ? '#020504' : '#030605';
          ctx.fillRect(tx * cellSize + 3, ty * cellSize + 3, cellSize - 6, cellSize - 6);
          ctx.strokeStyle = '#06100c';
          ctx.strokeRect(tx * cellSize + 3, ty * cellSize + 3, cellSize - 6, cellSize - 6);
        } else {
          ctx.fillStyle = '#070c0c';
          ctx.fillRect(tx * cellSize, ty * cellSize, cellSize, cellSize);
        }
      }
    }
    ctx.strokeStyle = '#0c201c';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 22]);
    ctx.beginPath();
    path.forEach((p, i) => {
      const w = mapToWorld(p);
      if (i === 0) ctx.moveTo(w.x, w.y); else ctx.lineTo(w.x, w.y);
    });
    ctx.stroke(); ctx.setLineDash([]);
    const entry = mapToWorld(path[1]);
    const exit = mapToWorld(path[path.length - 2]);
    ctx.fillStyle = '#103c28'; ctx.fillRect(entry.x - 30, 0, 60, 8);
    ctx.fillStyle = '#482014'; ctx.fillRect(exit.x - 30, height * cellSize - 8, 60, 8);

  }

  return {mapData,startPoint,at,isSolid,canBuildHere,generatePath,path,draw}
}

// Export to global environment (works in both browser and Node.js)
if (typeof module !== 'undefined' && module.exports) {
  globalThis.mapToWorld = mapToWorld;
  globalThis.worldToMap = worldToMap;
  globalThis.createWorld = createWorld;
}


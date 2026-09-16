"use strict"

let mapToWorld = ({x,y})=>v2((x+0.5)*cellSize,(y+0.5)*cellSize);
let worldToMap = ({x,y})=>v2(Math.floor(x/cellSize),Math.floor(y/cellSize));

function createWorld(textRepresentation, orderedPath = null) {
  let height = textRepresentation.length;
  let width = textRepresentation[0].length;

  let voidCell = {char:" "};

  let mapData=textRepresentation.flatMap(line => Array.from(line).map(char => ({char}) ))

  // Explicit paths retain their order through crossings and can enter any edge.
  let startPoint = orderedPath ? {...orderedPath[0]} : findMapStart();

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
    if (orderedPath) return orderedPath.map(p => ({...p}));
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
    drawGate(path[1], path[0], '#103c28', true);
    drawGate(path[path.length - 2], path[path.length - 1], '#482014', false);

  }

  function drawGate(inside, outside, color, entry) {
    const p = mapToWorld(inside), dx = outside.x - inside.x, dy = outside.y - inside.y;
    ctx.save();
    ctx.translate(p.x + dx * cellSize / 2, p.y + dy * cellSize / 2);
    ctx.rotate(Math.atan2(dy, dx));
    ctx.fillStyle = color;
    ctx.fillRect(-4, -30, 8, 60);
    // Directional triangle stays inside the map at either entrance or exit.
    const tip = entry ? -40 : -10, base = entry ? -16 : -36;
    ctx.beginPath(); ctx.moveTo(tip, 0); ctx.lineTo(base, -14); ctx.lineTo(base, 14); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  return {mapData,startPoint,at,isSolid,canBuildHere,generatePath,path,draw}
}

// Export to global environment (works in both browser and Node.js)
if (typeof module !== 'undefined' && module.exports) {
  globalThis.mapToWorld = mapToWorld;
  globalThis.worldToMap = worldToMap;
  globalThis.createWorld = createWorld;
}

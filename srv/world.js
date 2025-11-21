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
    x|=0;
    y|=0;
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

    for (let ty=0; y<height;ty++) {
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

    ctx.strokeWidth=1;
    ctx.strokeStyle="#060";
    ctx.fillStyle="#001800";
  
    for (let ty=0; ty<height;ty++) {
      for (let tx=0;tx<width;tx++) {
        if (isSolid(v2(tx,ty))) {
          ctx.fillRect(tx*cellSize,ty*cellSize,cellSize,cellSize)
          ctx.strokeRect(tx*cellSize,ty*cellSize,cellSize,cellSize);  
        }
      }
    }

    for (let p of path) {
      let {x,y} = mapToWorld(p);
      ctx.fillStyle="#ffaa88";
      //ctx.fillRect(x-2,y-2,4,4)
    }
  }

  return {mapData,startPoint,at,isSolid,canBuildHere,generatePath,path,draw}
}


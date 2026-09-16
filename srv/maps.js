"use strict";

// Every map uses the same 11 × 16 board; changing maps never changes the view.
function routeMap(points) {
  const cells = Array.from({length:16}, () => Array(11).fill('#'));
  let [x,y] = points[0];
  cells[y][x] = '.';
  for (const [toX,toY] of points.slice(1)) {
    if (x !== toX && y !== toY) throw new Error('Map routes must be axis aligned');
    while (x !== toX || y !== toY) {
      x += Math.sign(toX-x); y += Math.sign(toY-y);
      cells[y][x] = '.';
    }
  }
  return cells.map(row => row.join(''));
}
const originalMap = [
  '##.########',
  '##.########',
  '##.###....#',
  '##.....##.#',
  '#########.#',
  '#########.#',
  '#########.#',
  '#########.#',
  '#########.#',
  '###.......#',
  '###.#######',
  '###.#######',
  '###.....###',
  '#######.###',
  '#######.###',
  '#######.###',
]

var mapCatalog = [
  {id:'foundry', name:'Foundry', description:'The original route. Cover the bends and the long eastern approach.', cells:originalMap},
  {id:'switchback', name:'Switchback', description:'Three long passes. Shared firing lanes reward careful placement.', cells:routeMap([[1,0],[1,3],[9,3],[9,7],[1,7],[1,11],[9,11],[9,15]])},
  {id:'crosswind', name:'Crosswind', description:'A shorter route with tighter turns. Catch runners before the final descent.', cells:routeMap([[8,0],[8,2],[2,2],[2,6],[8,6],[8,10],[4,10],[4,15]])}
];
if (typeof module !== 'undefined' && module.exports) Object.assign(globalThis, {mapCatalog, routeMap});

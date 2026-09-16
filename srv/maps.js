"use strict";

// Every map uses the same 11 × 16 board; changing maps never changes the view.
function traceRoute(points) {
  const path = [];
  let [x,y] = points[0];
  path.push({x,y});
  for (const [toX,toY] of points.slice(1)) {
    if (x !== toX && y !== toY) throw new Error('Map routes must be axis aligned');
    while (x !== toX || y !== toY) {
      x += Math.sign(toX-x); y += Math.sign(toY-y);
      path.push({x,y});
    }
  }
  return path;
}
function routeMap(points) {
  const cells = Array.from({length:16}, () => Array(11).fill('#'));
  for (const {x,y} of traceRoute(points)) {
    if (x >= 0 && x < 11 && y >= 0 && y < 16) cells[y][x] = '.';
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

const switchbackRoute = [[9,16],[9,2],[6,2],[6,6],[3,6],[3,2],[1,2],[1,9],[7,9],[7,12],[1,12],[1,16]];
const crosswindRoute = [[5,-1],[5,9],[9,9],[9,3],[1,3],[1,12],[7,12],[7,16]];
var mapCatalog = [
  {id:'foundry', name:'Foundry', description:'The original route. Cover the bends and the long eastern approach.', cells:originalMap},
  {id:'switchback', name:'Switchback', description:'Enter bottom right. Wind through the inner bends to the bottom-left exit.', cells:routeMap(switchbackRoute), path:traceRoute(switchbackRoute)},
  {id:'crosswind', name:'Crosswind', description:'The route crosses itself. Cover both passes through the central junction.', cells:routeMap(crosswindRoute), path:traceRoute(crosswindRoute)}
];
if (typeof module !== 'undefined' && module.exports) Object.assign(globalThis, {mapCatalog, routeMap, traceRoute});

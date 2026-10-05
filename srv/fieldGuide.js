"use strict";

// Browser-only dossiers. Preview objects never enter the simulation collections.
const guideCreeps = [
  {type: Basic, name: 'Scout', role: 'Bog standard unit', strength: 'No frills, just your average creep.', weakness: 'Low health, no armor and no shield. If these give you trouble, reassess your life choices.'},
  {type: Zipper, name: 'Runner', role: 'Fast assault', strength: 'Small and speedy.', weakness: 'Extremely fragile. It might die if you look at it too hard.'},
  {type: Ball, name: 'Armor', role: 'Armored escort', strength: 'Armored against physical damage.', weakness: 'Slow moving. Energy, fire, explosives and piercing bypass its armor.'},
  {type: Shieldbug, name: 'Shieldbug', role: 'Shielded infantry', strength: 'Has an energy shield that absorbs damage and prevents debuffs. Recharges after 3 seconds without damage.', weakness: 'Energy deals double damage to shields. Piercing bypasses shields and reaches health directly.'},
  {type: BigBall, name: 'Guardian', role: 'Heavy command unit', strength: 'Huge health pool, 35% physical armor and half-strength slows. Costs 3 lives if it escapes.', weakness: 'Very slow. Burning and vulnerability help wear it down.'},
  {type: Mender, name: 'Mender', role: 'Regenerating infantry', strength: 'Slowly heals over time.', weakness: 'Healing stops while burning. Other damage does not stop its regeneration.'},
  {type: Splitter, name: 'Splitter', role: 'Brood carrier', strength: 'Releases two fast Runners when defeated.', weakness: 'No armor or shields.'},
  {type: Skimmer, name: 'Skimmer', role: 'Shielded sprinter', strength: 'Fast with an energy shield. Cannot be slowed while the shield is active.', weakness: 'Fragile beneath the bubble. Piercing can kill it without popping the shield.'},
  {type: Capacitor, name: 'Capacitor', role: 'Charging shield unit', strength: 'After 10 seconds without damage, charges a hardy shield.', weakness: 'Enters unshielded. Keep hitting it to interrupt charging; piercing can kill it through an active shield.'},
  {type: Spikey, name: 'Spikey', role: 'Durable infantry', strength: 'Five times a Scout’s base health. Can soak up weak shots while other creeps advance.', weakness: 'Slow and unarmored. Heavy hits and focused fire work well; slows increase time under fire.'},
  {type: Bulwark, name: 'Bulwark', role: 'Armored shield escort', strength: 'Energy shield and armor! Must be costing someone a pretty penny.', weakness: 'Very slow. Energy strips its shield; piercing bypasses both shield and armor.'},
  {type: Flyer, name: 'Flyer', role: 'Light mobile infantry', strength: 'Charges an energy bank over 15 seconds. Damage spends it in a 2-second speed burst: up to 3 times normal speed, fading as the bank drains.', weakness: 'Enters with an empty bank. Slows reduce boosted speed too. It has the soul of a spathi, so it is quite good at running away.'},
];
const guideInk = {cyan:'#73ecff', blue:'#74acff', pink:'#ff8fab', amber:'#ffcf79', green:'#99edb4', violet:'#c5a0ff', dim:'#8aaeb9', line:'#244956', frame:'#397384', selected:'#123c4d'};
const guideStats = [
  {key:'power', label:'Damage / hit', color:guideInk.amber, value:s=>s.power},
  {key:'rate', label:'Fire rate / s', color:guideInk.pink, value:s=>s.rate * 60 / 1000},
  {key:'range', label:'Range', color:guideInk.cyan, value:s=>s.range},
  {key:'splash', label:'Splash radius', color:guideInk.green, value:s=>s.splash},
  {key:'burnPower', label:'Burn / s', color:guideInk.violet, value:s=>s.burnPower * 60},
  {key:'burnDuration', label:'Burn seconds', color:guideInk.blue, value:s=>s.burnDuration / 60},
  {key:'slowFactor', label:'Slow %', color:guideInk.green, value:s=>(1-s.slowFactor) * 100},
  {key:'slowDuration', label:'Slow seconds', color:guideInk.violet, value:s=>s.slowDuration / 60},
  {key:'chainCount', label:'Chain targets', color:guideInk.green, value:s=>s.chainCount},
  {key:'chainRange', label:'Chain reach', color:guideInk.violet, value:s=>s.chainRange},
  {key:'minimumRange', label:'Blind spot', color:guideInk.green, value:s=>s.minimumRange}
];
let guideData = null;
const guideTraceDuration = 650;
const guideTraceFadeDuration = 350;
const guideTraceMaxDelay = 400;
const guideTraces = new Map();
let guideLayout = null;
let guideSurface = null;
let guidePortraitBackdrop = null;
const guideWipeDuration = 150;
const guideWipeLeadDuration = 45;
const guideWipeMaxDelay = 350;
const guideWipeBlockSize = 48;
const guideWipeRowWeight = 2;
let guideSurfacePage = null;
let guideSurfaceTransform = null;
let guidePageChange = null;
let guideWipeFrom = null;
let guideWipes = [];
let guideWipeDelays = new Map();
const guidePortraits = new Map();
const guideSpecimens = new Map();
let guidePortraitSource = null;

function guideSpecimen(info) {
  if (!guideSpecimens.has(info.type)) {
    const specimen=info.type.prototype instanceof Creep ? new info.type({preview:true}) : new info.type(0,0);
    guideSpecimens.set(info.type,specimen);
  }
  return guideSpecimens.get(info.type);
}

function guideEntries() {
  return [...towerInfo.map(info=>({kind:'tower', info, name:info.name})),
    ...guideCreeps.map(info=>({kind:'creep', info, name:info.name})), {kind:'controls', name:'Operations'}];
}
function guideOpen() {
  uiGuidePage = 0;
  guideTraces.clear();
  guideLayout = null;
  guideSurfacePage = null;
  guidePageChange = null;
  guideWipes = [];
  guideWipeDelays.clear();
  guideWipeFrom = null;
  uiDrawSignature = '';
  uiOverlay = 'guide';
}
function guideRelevantStats(tower) {
  const keys = ['power', 'rate', 'range'];
  if (tower.behavior === 'splash' || tower.behavior === 'burn') keys.push('splash');
  if (tower.behavior === 'burn') keys.push('burnPower', 'burnDuration');
  if (tower.behavior === 'slow' || tower.behavior === 'quake') keys.push('slowFactor', 'slowDuration');
  if (tower.behavior === 'chain') keys.push('chainCount', 'chainRange');
  if (tower.minimumRange > 0) keys.push('minimumRange');
  return guideStats.filter(stat=>keys.includes(stat.key));
}
function guideTowerData() {
  if (guideData) return guideData;
  const rows = towerInfo.map(info=> {
    const tower = new info.type(0, 0);
    return {info, tower, stats:guideRelevantStats(tower), levels:Array.from({length:10}, (_,i)=>towerLevelStats(tower, i+1))};
  });
  const caps = {};
  for (const stat of guideStats) {
    const maximum = Math.max(0, ...rows.filter(row=>row.stats.includes(stat)).flatMap(row=>row.levels.map(stat.value)));
    const step = Math.pow(10, Math.floor(Math.log10(maximum || 1)));
    caps[stat.key] = Math.ceil(maximum / step) * step || 1;
  }
  guideData = {rows, caps};
  return guideData;
}
function guidePolygon(id, points, fill = '#0b202c') { return {id, points, fill}; }
function guideBevel(id, x, y, w, h) {
  return guidePolygon(id, [[x,y],[x+w-26,y],[x+w,y+26],[x+w,y+h],[x+26,y+h],[x,y+h-26]]);
}
function guideButtonShape(shape, label, sub = '', extra = {}) {
  const xs=shape.points.map(p=>p[0]), ys=shape.points.map(p=>p[1]);
  return {...uiButton(shape.id, Math.min(...xs), Math.min(...ys), Math.max(...xs)-Math.min(...xs), Math.max(...ys)-Math.min(...ys), label, sub, extra), ...shape, guide:true};
}
function guideGeometry(entry) {
  const frame=guidePolygon('frame', [[80,140],[760,140],[780,120],[996,120],[1032,158],[1032,1742],[998,1776],[80,1776],[48,1744],[48,172]]);
  const panels=[guidePolygon('archive',[[48,172],[80,140],[760,140],[794,170],[1006,170],[1032,196],[1032,210],[48,210]]),
    guidePolygon('counter',[[48,210],[288,210],[198,306],[80,306],[48,274]])];
  const buttons=[
    guideButtonShape(guidePolygon('guide-tab-tower',[[288,210],[570,210],[426,366],[144,366]]),'Towers','',{selected:entry.kind==='tower',textX:354}),
    guideButtonShape(guidePolygon('guide-tab-creep',[[570,210],[852,210],[708,366],[426,366]]),'Creeps','',{selected:entry.kind==='creep',textX:636}),
    guideButtonShape(guidePolygon('guide-tab-controls',[[852,210],[1032,210],[1032,332],[998,366],[708,366]]),'Operations','',{selected:entry.kind==='controls',textX:890}),
    guideButtonShape(guidePolygon('guide-prev',[[206,1608],[390,1608],[258,1764],[74,1764]]),'‹'),
    guideButtonShape(guidePolygon('guide-close',[[412,1608],[668,1608],[800,1764],[280,1764]]),'Back','',{textX:540}),
    guideButtonShape(guidePolygon('guide-next',[[690,1608],[874,1608],[1006,1764],[822,1764]]),'›')
  ];
  if (entry.kind==='tower') {
    const parent=towerInfo.find(info=>info.upgrades?.includes(entry.info.type.name));
    const branches=entry.info.upgrades?.map(name=>towerInfo.find(info=>info.type.name===name)) || (parent ? [parent] : []);
    const start=branches.length===2 ? 610 : 756, width=(1032-start)/Math.max(1,branches.length);
    panels.push(guidePolygon('title',[[48,374],[start,374],[start+8,530],[48,530]]));
    branches.forEach((info,i)=> {
      const x=start+i*width;
      // Slot identity is geometric: changing an upgrade name does not retrace it.
      const shape=guidePolygon('branch-'+i,[[x,374],[x+width-4,374],[Math.min(1032,x+width+4),530],[x+8,530]]);
      buttons.push({...guideButtonShape(shape, info.name,
        entry.info.upgrades ? 'UPGRADE' : 'FROM', {compact:true}), id:'guide-link-'+info.type.name, traceId:shape.id});
    });
    panels.push(guidePolygon('tower-details',[[48,530],[610,530],[648,736],[718,838],[92,838],[48,790]]),
      guidePolygon('tower-portrait',[[610,530],[1032,530],[1032,738],[976,838],[718,838],[648,736]]),
      guidePolygon('graph',[[48,838],[1032,838],[1032,1742],[998,1776],[80,1776],[48,1744]]));
  } else if (entry.kind==='creep') {
    panels.push(guideBevel('title',48,374,984,156),
      guidePolygon('creep-stats',[[48,530],[562,530],[598,886],[632,970],[82,970],[48,936]]),
      guidePolygon('creep-portrait',[[562,530],[1032,530],[1032,930],[992,970],[632,970],[598,886]]),
      guideBevel('strengths',48,988,984,254), guideBevel('weaknesses',48,1260,984,304));
  } else {
    panels.push(guideBevel('title',48,374,984,156));
    for(let i=0;i<4;i++) panels.push(guideBevel('operation-'+i,48,548+i*256,984,244));
  }
  return {entry,frame,panels,buttons};
}
function guideControls() { return guideGeometry(guideEntries()[uiGuidePage]).buttons; }
function guideContains(points, pos) {
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const [xi,yi]=points[i], [xj,yj]=points[j];
    if ((yi>pos.y)!==(yj>pos.y) && pos.x<(xj-xi)*(pos.y-yi)/(yj-yi)+xi) inside=!inside;
  }
  return inside;
}
function guideSyncLayout(now) {
  guideLayout=guideGeometry(guideEntries()[uiGuidePage]);
  const xs=guideLayout.frame.points.map(p=>p[0]), ys=guideLayout.frame.points.map(p=>p[1]);
  const bounds={left:Math.min(...xs),top:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
  guideLayout.bounds=bounds;
  const shapes=[guideLayout.frame,...guideLayout.panels,...guideLayout.buttons], active=new Set();
  for(const shape of shapes) {
    const id=shape.traceId || shape.id, signature=JSON.stringify(shape.points);
    active.add(id);
    if(guideTraces.get(id)?.signature!==signature) guideTraces.set(id,{
      signature,startedAt:now+guideTraceDelay(shape.points[0],bounds),points:shape.points
    });
  }
  for(const id of guideTraces.keys()) if(!active.has(id)) guideTraces.delete(id);
}
function guideTraceDelay([x,y], bounds) {
  // Normalize 2y+x within the display frame: top-left 0 ms, bottom-right 400 ms.
  const fraction=(2*(y-bounds.top)+x-bounds.left)/(2*bounds.height+bounds.width);
  return guideTraceMaxDelay*Math.max(0,Math.min(1,fraction));
}
function guideAnimationFrame(now) {
  guideSyncLayout(now);
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'settled';
  return guideWipes.some(wipe=>now<wipe.startedAt+guideWipeDuration) ||
    [...guideTraces.values()].some(trace=>now-trace.startedAt<guideTraceDuration+guideTraceFadeDuration) ? now : 'settled';
}
function guideCopySurface(source) {
  const copy=document.createElement('canvas');copy.width=source.width;copy.height=source.height;
  copy.getContext('2d').drawImage(source,0,0);
  return copy;
}
function guideScheduleWipes(regions, changedAt) {
  const order=[...regions];
  for(let i=order.length-1;i>0;i--) {
    const j=Math.floor(Math.random()*(i+1));
    [order[i],order[j]]=[order[j],order[i]];
  }
  const delayAt=i=>order.length>1 ? i*guideWipeMaxDelay/(order.length-1) : 0;
  // Previous slots are unique, so swapping a repeated slot with any other
  // panel changes both assignments without introducing another repeat.
  if(order.length>1) for(let i=0;i<order.length;i++) {
    if(guideWipeDelays.get(order[i].id)!==delayAt(i)) continue;
    let j=Math.floor(Math.random()*(order.length-1));
    if(j>=i) j++;
    [order[i],order[j]]=[order[j],order[i]];
  }
  guideWipeDelays=new Map(order.map((region,i)=>[region.id,delayAt(i)]));
  return order.map((region,i)=>({...region,startedAt:changedAt+delayAt(i)}));
}
function guideContentRegions() {
  const buttons=guideLayout.buttons;
  return [...guideLayout.panels,...buttons].map(shape=> {
    const xs=shape.points.map(p=>p[0]),ys=shape.points.map(p=>p[1]);
    return {id:shape.traceId || shape.id,points:shape.points,
      // A large panel can sit behind controls; each control transitions independently.
      exclusions:buttons.includes(shape) ? [] : buttons.map(button=>button.points),
      x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
  });
}
function guideRegionChanged(region, before, after, width, height, transform) {
  const left=Math.max(0,Math.floor(region.x*transform.a+transform.e));
  const top=Math.max(0,Math.floor(region.y*transform.d+transform.f));
  const right=Math.min(width,Math.ceil((region.x+region.w)*transform.a+transform.e));
  const bottom=Math.min(height,Math.ceil((region.y+region.h)*transform.d+transform.f));
  for(let y=top;y<bottom;y++) for(let x=left;x<right;x++) {
    const i=(y*width+x)*4;
    // Canvas copies can round antialiased edges by a color step in Firefox.
    // Those rounding differences are not a change in panel contents.
    if(Math.abs(before[i]-after[i])<=2 && Math.abs(before[i+1]-after[i+1])<=2 &&
      Math.abs(before[i+2]-after[i+2])<=2 && Math.abs(before[i+3]-after[i+3])<=2) continue;
    const point={x:(x+.5-transform.e)/transform.a,y:(y+.5-transform.f)/transform.d};
    if(guideContains(region.points,point) && !region.exclusions.some(points=>guideContains(points,point))) return true;
  }
  return false;
}
function guideClipRegion(c, region) {
  guidePath(c,region.points);c.clip();
  if(region.exclusions.length) {
    c.beginPath();c.rect(0,0,1080,1848);
    for(const points of region.exclusions) {
      points.forEach((p,i)=>i ? c.lineTo(...p) : c.moveTo(...p));c.closePath();
    }
    c.clip('evenodd');
  }
}
function guidePaintWipes(c, now, glow=true) {
  if(!guideWipeFrom || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for(const wipe of guideWipes) {
    const elapsed=Math.max(0,now-wipe.startedAt);
    if(elapsed>=guideWipeDuration) continue;
    const columns=Math.ceil(wipe.w/guideWipeBlockSize),rows=Math.ceil(wipe.h/guideWipeBlockSize);
    // Weight rows twice as much for a shallower, more horizontal front.
    const span=columns+(rows-1)*guideWipeRowWeight;
    // Keep the 45 ms entrance, then clear and ease out over the remaining 105 ms.
    const leading=Math.min(1,elapsed/guideWipeLeadDuration)*span;
    const exit=Math.max(0,(elapsed-guideWipeLeadDuration)/(guideWipeDuration-guideWipeLeadDuration));
    const trailing=exit*span;
    const opacity=1-exit*exit*(3-2*exit);
    c.save();guideClipRegion(c,wipe);
    // Swap contents at full coverage so the fading body reveals the new image.
    if(elapsed<guideWipeLeadDuration) {
      c.save();c.setTransform(1,0,0,1,0,0);c.drawImage(guideWipeFrom,0,0);c.restore();
    }
    if(glow && now>=wipe.startedAt) {
      // Flat translucent blocks avoid expensive per-frame shadow filters.
      for(let row=0;row<rows;row++) for(let column=0;column<columns;column++) {
        const rank=columns-1-column+row*guideWipeRowWeight;
        const brightness=Math.max(0,Math.min(1,leading-rank))*(1-Math.max(0,Math.min(1,trailing-rank)));
        if(!brightness) continue;
        c.globalAlpha=brightness*opacity;c.fillStyle=guideInk.selected;
        c.fillRect(wipe.x+column*guideWipeBlockSize,wipe.y+row*guideWipeBlockSize,guideWipeBlockSize,guideWipeBlockSize);
      }
      if(elapsed>0 && elapsed<guideWipeLeadDuration) {
        const transform=c.getTransform();
        const pixel=(x,y)=>[Math.round(x*transform.a+y*transform.c+transform.e)+.5,
          Math.round(x*transform.b+y*transform.d+transform.f)+.5];
        c.save();c.setTransform(1,0,0,1,0,0);
        c.globalAlpha=1;c.strokeStyle='#fff';c.lineWidth=1;c.beginPath();
        // Only the exposed left/bottom edges form the advancing stair step.
        // Draw in backing pixels so the stroke stays one pixel at every scale.
        for(let row=0;row<rows;row++) for(let column=0;column<columns;column++) {
          const rank=columns-1-column+row*guideWipeRowWeight;
          if(rank>=leading) continue;
          const x=wipe.x+column*guideWipeBlockSize,y=wipe.y+row*guideWipeBlockSize;
          const right=Math.min(x+guideWipeBlockSize,wipe.x+wipe.w),bottom=Math.min(y+guideWipeBlockSize,wipe.y+wipe.h);
          if(rank+1>=leading) {c.moveTo(...pixel(x,y));c.lineTo(...pixel(x,bottom));}
          if(rank+guideWipeRowWeight>=leading) {c.moveTo(...pixel(x,bottom));c.lineTo(...pixel(right,bottom));}
        }
        c.stroke();c.restore();
      }
    }
    c.restore();
  }
}
function guideComposite(c, now, refresh) {
  // Cache the complete interface at its backing resolution, without the glow.
  // Static text, portraits and graphs do not need repainting on animation frames.
  if(refresh) {
    let previous=null;
    const sameSize=guideSurface?.width===c.canvas.width && guideSurface?.height===c.canvas.height;
    const transform=c.getTransform();
    const sameTransform=guideSurfaceTransform && ['a','d','e','f'].every(key=>guideSurfaceTransform[key]===transform[key]);
    if(sameSize && sameTransform && guideSurfacePage!==null && guideSurfacePage!==uiGuidePage &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      previous=guideCopySurface(guideSurface);
      const paint=previous.getContext('2d');paint.setTransform(guideSurfaceTransform);
      // If paging interrupts a wipe, start from its current contents, without its glow.
      guidePaintWipes(paint,now,false);
    }
    if(!sameSize || !sameTransform) {guideWipes=[];guideWipeFrom=null;}
    if(!guideSurface) guideSurface=document.createElement('canvas');
    if(guideSurface.width!==c.canvas.width) guideSurface.width=c.canvas.width;
    if(guideSurface.height!==c.canvas.height) guideSurface.height=c.canvas.height;
    const paint=guideSurface.getContext('2d');
    paint.clearRect(0,0,guideSurface.width,guideSurface.height);
    paint.drawImage(c.canvas,0,0);
    guideSurfaceTransform=transform;
    guidePortraitBackdrop=guideTurretAnimating() ? guideCopySurface(guideSurface) : null;
    guideUpdatePortrait(now);
    if(previous) {
      const before=previous.getContext('2d').getImageData(0,0,previous.width,previous.height).data;
      const after=paint.getImageData(0,0,guideSurface.width,guideSurface.height).data;
      const changedAt=guidePageChange?.page===uiGuidePage ? Math.min(now,guidePageChange.at) : now;
      const changed=guideContentRegions().filter(region=>guideRegionChanged(region,before,after,guideSurface.width,guideSurface.height,transform));
      guideWipes=guideScheduleWipes(changed,changedAt);
      guideWipeFrom=previous;
    }
    guideSurfacePage=uiGuidePage;
  } else guideUpdatePortrait(now);
  c.save();c.setTransform(1,0,0,1,0,0);
  c.clearRect(0,0,c.canvas.width,c.canvas.height);
  c.drawImage(guideSurface,0,0);c.restore();
  guidePaintWipes(c,now);
  guideWipes=guideWipes.filter(wipe=>now<wipe.startedAt+guideWipeDuration);
  if(!guideWipes.length) guideWipeFrom=null;
  for(const trace of guideTraces.values()) guideDrawTrace(c,trace,now);
}
function guideUpdatePortrait(now) {
  if(!guidePortraitBackdrop) return;
  // Restore backing pixels exactly so antialiased borders cannot accumulate.
  const paint=guideSurface.getContext('2d'), transform=guideSurfaceTransform;
  const x=Math.floor(610*transform.a+transform.e), y=Math.floor(530*transform.d+transform.f);
  const w=Math.ceil(1032*transform.a+transform.e)-x, h=Math.ceil(838*transform.d+transform.f)-y;
  paint.save();paint.setTransform(1,0,0,1,0,0);
  paint.clearRect(x,y,w,h);
  paint.drawImage(guidePortraitBackdrop,x,y,w,h,x,y,w,h);
  paint.setTransform(transform);
  guidePortrait(paint,guideLayout.entry,838,679,270,now);
  paint.restore();
}
function guideActivate(id, now=performance.now()) {
  const previousPage=uiGuidePage;
  const entries = guideEntries();
  if (id === 'guide-prev') uiGuidePage = (uiGuidePage + entries.length - 1) % entries.length;
  else if (id === 'guide-next') uiGuidePage = (uiGuidePage + 1) % entries.length;
  else if (id.startsWith('guide-tab-')) {
    const kind = id.slice(10);
    const focused = kind === 'tower' && selectedTower && getTowerInfo(selectedTower);
    uiGuidePage = entries.findIndex(entry=>entry.kind===kind && (!focused || entry.info===focused));
  } else if (id.startsWith('guide-link-')) uiGuidePage = entries.findIndex(entry=>entry.info?.type.name===id.slice(11));
  if(uiGuidePage!==previousPage) guidePageChange={page:uiGuidePage,at:now};
}
function guidePath(c, points) {
  c.beginPath(); points.forEach((p,i)=>i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath();
}
function guideDrawShape(c, shape, fill=shape.fill, edge=guideInk.frame) {
  guidePath(c,shape.points);
  if(fill) { c.fillStyle=fill; c.fill(); }
  c.strokeStyle=edge; c.lineWidth=2; c.stroke();
}
function guideDrawButton(c, button) {
  const pressed=uiGesture?.button?.id===button.id;
  c.save();
  guideDrawShape(c,button,button.selected || pressed ? guideInk.selected : '#0b222d');
  const center=button.textX ?? button.x+button.w/2;
  const color=button.selected ? guideInk.cyan : uiColors.text;
  let size=button.compact ? 31 : 35;
  c.font='500 '+size+'px system-ui, sans-serif';
  if(c.measureText(button.label).width>button.w-20) size*= (button.w-20)/c.measureText(button.label).width;
  uiText(c,button.label,center,button.y+(button.compact ? 102 : button.h/2),size,button.compact ? '#fff' : color,'center');
  if(button.sub) uiText(c,button.sub,center,button.y+46,25,guideInk.amber,'center');
  c.restore();
}
function guideDrawTrace(c, trace, now) {
  if(!trace || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const elapsed=now-trace.startedAt;
  if(elapsed<0 || elapsed>=guideTraceDuration+guideTraceFadeDuration) return;
  const progress=Math.min(1,elapsed/guideTraceDuration);
  const fade=Math.max(0,(elapsed-guideTraceDuration)/guideTraceFadeDuration);
  const points=[...trace.points,trace.points[0]];
  const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
  const perimeter=lengths.reduce((a,b)=>a+b,0), end=perimeter*progress;
  const pointAt=distance=> {
    let i=0;
    while(i<lengths.length-1 && distance>lengths[i]) distance-=lengths[i++];
    const t=distance/lengths[i];
    return [points[i][0]+(points[i+1][0]-points[i][0])*t,points[i][1]+(points[i+1][1]-points[i][1])*t];
  };
  c.save();
  c.globalAlpha*=Math.pow(1-fade,2);
  // Reveal the outline once, with a short bright trail and a moving drawing point.
  c.strokeStyle='#73c4d5'; c.lineWidth=2; c.beginPath(); c.moveTo(...points[0]);
  let remaining=end;
  for(let i=0;i<lengths.length;i++) {
    if(remaining<=lengths[i]) {c.lineTo(...pointAt(end));break;}
    c.lineTo(...points[i+1]); remaining-=lengths[i];
  }
  c.stroke();
  c.shadowColor=guideInk.cyan; c.shadowBlur=12;
  c.strokeStyle=guideInk.cyan; c.lineWidth=3; c.beginPath();
  const start=Math.max(0,end-90*(1-fade)); c.moveTo(...pointAt(start));
  for(let d=start+5;d<end;d+=5) c.lineTo(...pointAt(d));
  const head=pointAt(end); c.lineTo(...head); c.stroke();
  c.fillStyle='#e5fcff'; c.beginPath(); c.arc(...head,4,0,TWOPI); c.fill();
  c.restore();
}
function guideTurretAnimating(entry=guideEntries()[uiGuidePage]) {
  return entry.kind==='tower' && entry.info.type!==Star && entry.info.type!==Thumper &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function guideRenderPortrait(preview, picture) {
  // Match the shader's source dimensions so its bloom has the same pixel scale
  // as gameplay. Reuse one staging canvas for all archive specimens.
  if (!guidePortraitSource) {
    guidePortraitSource = document.createElement('canvas');
    guidePortraitSource.width = frameCanvas.width;
    guidePortraitSource.height = frameCanvas.height;
  }
  // Readback optimization avoids Firefox's accelerated-canvas portrait fringes.
  const paint = guidePortraitSource.getContext('2d', {willReadFrequently: true}), previous = ctx;
  paint.clearRect(0, 0, guidePortraitSource.width, guidePortraitSource.height);
  // draw() omits the entity scale normally applied by drawMain(). Keep that
  // scale here while centering the specimen independently of its world position.
  const scale = 2.25 * preview.scale;
  paint.save(); paint.translate(160,160); paint.scale(scale,scale);
  try {
    ctx = paint;
    preview.draw();
    glowFrame(guidePortraitSource, true);
    const destination = picture.getContext('2d');
    destination.clearRect(0,0,picture.width,picture.height);
    // Copy before WebGL discards the drawing buffer; alpha retains the halo.
    destination.drawImage(outputCanvas,0,0,320,320,0,0,320,320);
  } finally {
    paint.restore(); ctx = previous;
    // The shared renderer must leave the paused gameplay backdrop intact.
    glowFrame(frameCanvas);
  }
}
function guidePortrait(c, entry, x, y, size, now=0) {
  const key = entry.info.type.name;
  let picture = guidePortraits.get(key);
  const rotating=guideTurretAnimating(entry);
  if (!picture || rotating) {
    const preview = guideSpecimen(entry.info);
    preview.angle = entry.kind === 'tower' ? Math.PI/6+(rotating ? now*TWOPI/20000 : 0) : 0;
    if(!picture) {
      picture = document.createElement('canvas'); picture.width = picture.height = 320;
    }
    guideRenderPortrait(preview, picture);
    guidePortraits.set(key,picture);
  }
  c.save();
  c.strokeStyle = '#214553'; c.lineWidth = 2;
  c.beginPath(); c.arc(x,y,size*.44,0,TWOPI); c.stroke();
  c.setLineDash([5,12]); c.beginPath(); c.arc(x,y,size*.49,0,TWOPI); c.stroke(); c.setLineDash([]);
  for (const sign of [-1,1]) {
    c.beginPath(); c.moveTo(x+sign*size*.38,y); c.lineTo(x+sign*size*.54,y); c.stroke();
    c.beginPath(); c.moveTo(x,y+sign*size*.38); c.lineTo(x,y+sign*size*.54); c.stroke();
  }
  c.drawImage(picture,x-size/2,y-size/2,size,size);
  c.restore();
}
function guideNumber(value) { return Number(value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)).toString(); }
function guideGraph(c, info) {
  const {rows,caps}=guideTowerData(), row=rows.find(row=>row.info===info);
  const x=82,y=880,w=894,h=628;
  for(const percent of [0,50,100]) {
    const yy=y+h-h*percent/100;
    c.strokeStyle=guideInk.line;c.lineWidth=2;c.beginPath();c.moveTo(x,yy);c.lineTo(x+w,yy);c.stroke();
  }
  for(let i=0;i<row.levels.length;i++) {
    const xx=x+i*w/(row.levels.length-1);
    c.strokeStyle='#183440';c.beginPath();c.moveTo(xx,y);c.lineTo(xx,y+h);c.stroke();
    uiText(c,'L'+(i+1),xx,y+h+42,32,guideInk.dim,'center');
  }
  for(const stat of row.stats) {
    c.strokeStyle=stat.color;c.fillStyle=stat.color;c.lineWidth=4;
    const points=row.levels.map((s,i)=>[x+i*w/(row.levels.length-1),y+h-stat.value(s)/caps[stat.key]*h]);
    c.beginPath();points.forEach((p,i)=>i ? c.lineTo(...p) : c.moveTo(...p));c.stroke();
    points.forEach(p=>{c.beginPath();c.arc(...p,5,0,TWOPI);c.fill();});
  }
  // The compact key sits inside the plot, just right of the vertical axis.
  c.fillStyle='#0b202ce8'; c.fillRect(x+18,y+16,242,row.stats.length*40+16);
  row.stats.forEach((stat,i)=> {
    const xx=x+30, yy=y+40+i*40;
    c.fillStyle=stat.color; c.fillRect(xx,yy-9,18,18);
    uiText(c,stat.label.split('/')[0].trim(),xx+30,yy,27,stat.color);
  });
}
function guideDrawTower(c, entry) {
  const {info}=entry, row=guideTowerData().rows.find(row=>row.info===info);
  uiText(c,(info.buildable ? '$' : '+$')+info.cost,82,566,29,guideInk.cyan);
  if(!guideTurretAnimating(entry)) guidePortrait(c,entry,838,679,270);
  const kind=row.tower.damageKind || (['burn'].includes(row.tower.behavior) ? 'fire' : ['chain','slow','quake'].includes(row.tower.behavior) || info.type===Zappy ? 'energy' : info.type===Thumper || row.tower.behavior==='splash' ? 'explosive' : 'physical');
  uiText(c,kind.toUpperCase()+' DAMAGE',82,618,33,guideInk.amber);
  uiWrap(c,info.desc,82,676,500,36,44);
  guideGraph(c,info);
}
function guideDrawCreep(c, entry) {
  const info=entry.info,specimen=guideSpecimen(info);
  uiText(c,'BASE STATS',82,570,28,guideInk.cyan);
  guidePortrait(c,entry,802,743,330);
  const stats=[
    ['HEALTH',info.type.hitPoints,String(info.type.hitPoints)],
    ['SPEED',specimen.speed,guideNumber(specimen.speed*60)],
    ['ARMOR',specimen.armor,Math.round(specimen.armor*100)+'%'],
    ['SHIELD CAP.',info.type.hitPoints*specimen.shieldRatio,guideNumber(info.type.hitPoints*specimen.shieldRatio)],
    ['ESCAPE COST',specimen.leakDamage ?? 1,(specimen.leakDamage ?? 1)+(specimen.leakDamage>1 ? ' lives' : ' life')]
  ].filter(([,value])=>value!==0);
  stats.forEach(([label,,value],i)=>{uiText(c,label,82,636+i*62,28,guideInk.dim);uiText(c,value,534,636+i*62,34,guideInk.cyan,'right');});
  uiText(c,'STRENGTHS',82,1032,29,guideInk.amber);
  uiWrap(c,info.strength,82,1094,884,35,48);
  uiText(c,'WEAKNESSES / COUNTERS',82,1304,29,guideInk.green);
  uiWrap(c,info.weakness,82,1366,884,35,48);
}
function guideDrawOperations(c) {
  const sections=[
    ['01 / DEPLOY','Tap a tower in the build strip, then tap a tile twice to build. Or drag a tower onto a tile.'],
    ['02 / DEVELOP','Level up towers or upgrade them to a new type. Levels carry through upgrades. Sell twice to confirm a 70% refund.'],
    ['03 / TARGET','First aims closest to the exit. Strong picks the most health. Near picks the nearest enemy. Mix weapons to cover each other’s weaknesses.'],
    ['04 / CONTROL','Send waves early for bonus money. Clear all active and queued creeps to collect the wave bonus. Any escape wipes the accumulated bonus.'],
  ];
  sections.forEach(([label,text],i)=>{ const y=548+i*256;uiText(c,label,82,y+36,29,guideInk.cyan);uiWrap(c,text,82,y+96,884,35,45); });
}
function uiDrawGuide(c, now=performance.now()) {
  guideSyncLayout(now);
  const {entry,frame,panels}=guideLayout,entries=guideEntries();
  c.save();
  guideDrawShape(c,frame,'#081922');
  c.save();guidePath(c,frame.points);c.clip();
  c.strokeStyle='#0c2531';c.lineWidth=1;
  for(let x=66;x<1032;x+=36){c.beginPath();c.moveTo(x,140);c.lineTo(x,1800);c.stroke();}
  for(let y=140;y<1800;y+=36){c.beginPath();c.moveTo(48,y);c.lineTo(1032,y);c.stroke();}
  c.restore();
  for(const panel of panels) guideDrawShape(c,panel);
  uiText(c,'TACTICAL ARCHIVE',82,179,27,guideInk.dim);
  uiText(c,gameMode===mainGame ? '● SIM PAUSED' : '● ARCHIVE',990,143,26,guideInk.green,'right');
  const group=entries.filter(e=>e.kind===entry.kind),index=group.findIndex(e=>e.name===entry.name)+1;
  uiText(c,String(index).padStart(2,'0')+' / '+String(group.length).padStart(2,'0'),84,266,28,guideInk.dim);
  uiText(c,entry.name,74,418,49,uiColors.text);
  if(entry.kind==='tower') {
    if(entry.info.upgrades) {
      const text='Can be converted into a more powerful tower';
      c.font='500 30px system-ui, sans-serif';
      const size=Math.min(30,Math.floor(30*510/c.measureText(text).width));
      uiText(c,text,74,476,size,uiColors.muted);
    }
  } else uiWrap(c,entry.kind==='controls' ? 'Build. Adapt. Hold the line.' : entry.info.role,
    74,476,884,30,37);
  if(entry.kind==='tower') guideDrawTower(c,entry);
  else if(entry.kind==='creep') guideDrawCreep(c,entry);
  else guideDrawOperations(c);
  c.restore();
}

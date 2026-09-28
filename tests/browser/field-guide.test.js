// Run through browser-bridge; exercises the real display and pointer controls.
const check = (condition, message) => { if (!condition) throw new Error(message); };
const tap = async id => {
  const b = uiControls().find(button=>button.id===id);
  check(b, 'Control exists: '+id);
  await gameControl.tapCanvas(b.x+b.w/2,b.y+b.h/2);
};
gameMode=globalThis.gameMode=titleScreen;paused=false;initUI();
await tap('guide');
check(uiModal()==='guide' && gameMode===titleScreen && !paused,'Launch screen opens the guide without starting a game');
await tap('guide-tab-tower');
document.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowRight'}));
check(guideEntries()[uiGuidePage].info.type===Stubby,'Launch guide supports keyboard paging');
await tap('guide-close');
check(uiModal()==='welcome','Back returns to the launch screen');
await tap('guide');
document.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape'}));
check(uiModal()==='welcome','Escape returns to the launch screen');
startGame('foundry'); paused=true; uiOverlay='pause';
const before=JSON.stringify([money,lives,score,towers,creeps,hopper,backlog,buildTicks]);
await tap('guide');
check(uiOverlay==='guide' && paused, 'Guide opens paused');
const entries=guideEntries();
check(entries.filter(e=>e.kind==='creep').length===12, 'All twelve creep dossiers');
check(entries.filter(e=>e.kind==='tower').length===towerInfo.length, 'Every tower has a dossier');
await tap('guide-tab-creep'); check(entries[uiGuidePage].kind==='creep','Creep tab');
await tap('guide-tab-tower'); check(entries[uiGuidePage].info===towerInfo[0],'Tower tab');
check(uiControls().filter(b=>b.id.startsWith('guide-link-')).every(b=>b.sub==='UPGRADE' && !b.label.includes('→')),'Upgrade slots have a separate heading above the tower name');
await tap('guide-link-Ranger'); check(entries[uiGuidePage].info.type===Ranger,'Upgrade link opens Ranger');
await tap('guide-link-Tower'); check(entries[uiGuidePage].info.type===Tower,'Parent link returns to Sentry');
await tap('guide-tab-controls'); await tap('guide-prev'); check(uiGuidePage===entries.length-1,'Previous wraps');
await tap('guide-next'); check(uiGuidePage===0,'Next wraps');
document.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowRight'}));
check(uiGuidePage===1,'Keyboard changes dossier');

const canvas=document.createElement('canvas'); canvas.width=1080; canvas.height=1848;
const c=canvas.getContext('2d');
const text=[];
const recording=new Proxy(c, {
  get(object,key) {
    if(key==='fillText') return (label,x,y)=>{
      const width=object.measureText(label).width;
      const left=x-(object.textAlign==='center' ? width/2 : object.textAlign==='right' ? width : 0);
      text.push({label,x,y,left,right:left+width}); object.fillText(label,x,y);
    };
    const value=object[key]; return typeof value==='function' ? value.bind(object) : value;
  },
  set(object,key,value){object[key]=value;return true;}
});
for(let page=0;page<entries.length;page++) {
  uiGuidePage=page; text.length=0;
  uiDrawGuide(recording);
  for(const b of uiControls()) {
    check(b.x>=48 && b.x+b.w<=1032 && b.y>=146 && b.y+b.h<=1800,'Controls stay inside frame');
    check(b.w>=156 && b.h>=156,'Phone-sized touch targets');
  }
  check(text.every(t=>t.left>=48 && t.right<=1032),'Text fits horizontally: '+entries[page].name);
  check(text.every(t=>t.y<1616),'Body fits above navigation: '+entries[page].name);
  if(entries[page].kind==='creep') {
    check(text.some(t=>t.label==='STRENGTHS') && text.some(t=>t.label==='WEAKNESSES / COUNTERS'),'Creep tactics panels');
  }
  if(entries[page].kind==='tower') {
    const ticks=text.filter(t=>/^L\d+$/.test(t.label));
    check(ticks.length===10 && ticks[0].label==='L1' && ticks[9].label==='L10','Graph labels cover levels 1–10');
    check(ticks[0].x===82 && ticks[9].x===976,'Graph expands across the space freed by Y-axis labels');
    check(!text.some(t=>/^\d+%$/.test(t.label)),'Graph has no Y-axis percentage labels');
  }
}
// Geometry, not text or selected-tab colors, owns each one-shot outline trace.
guideOpen(); uiGuidePage=13; guideSyncLayout(1000);
const scheduledAt=(id,time)=>Math.abs(guideTraces.get(id).startedAt-time-guideTraceDelay(guideTraces.get(id).points[0],guideLayout.bounds))<1e-9;
const initial=new Map([...guideTraces].map(([id,trace])=>[id,trace.startedAt]));
check(guideAnimationFrame(2400)==='settled','Opening trace finishes');
uiGuidePage=14; guideSyncLayout(2500); // Sentry -> Cannon: same panel arrangement.
check([...guideTraces].every(([id,trace])=>trace.startedAt===initial.get(id)),'Different text, image and data do not replay outlines');
check(guideAnimationFrame(2500)==='settled','Same layout remains still');
uiGuidePage=18; guideSyncLayout(2700); // Ranger: two upgrade slots become one parent slot.
check(guideTraces.get('frame').startedAt===initial.get('frame'),'Outer frame does not restart');
check(guideTraces.get('graph').startedAt===initial.get('graph'),'Unchanged graph panel does not restart');
check(scheduledAt('title',2700) && scheduledAt('branch-0',2700),'Only resized panels restart');
check(!guideTraces.has('branch-1'),'Removed panel has no stale trace');
check(guideAnimationFrame(4100)==='settled','Layout transition also settles');
uiGuidePage=1; guideSyncLayout(4200);
check(guideTraces.get('frame').startedAt===initial.get('frame'),'Category switch keeps frame still');
check(scheduledAt('strengths',4200),'New content panels trace once');
const trace=guideTraces.get('strengths');
let heads=0;
const traced=new Proxy(c,{get(object,key){if(key==='arc') return ()=>{heads++;};const value=object[key];return typeof value==='function' ? value.bind(object) : value;},set(object,key,value){object[key]=value;return true;}});
guideDrawTrace(traced,trace,trace.startedAt+guideTraceDuration+guideTraceFadeDuration);
guideDrawTrace(traced,trace,trace.startedAt+5000);
check(heads===0,'Moving highlights disappear at completion and never loop');
guideOpen(); guideSyncLayout(6000);
check([...guideTraces.keys()].every(id=>scheduledAt(id,6000)),'Reopening starts a fresh drawing');
// Angled tabs must use polygon hit testing, including their overlapping bounds.
const tabs=guideControls().filter(b=>b.id.startsWith('guide-tab'));
check(!uiRectContains(tabs[0],{x:550,y:350}) && uiRectContains(tabs[1],{x:550,y:350}),'Slanted shared edge selects the visible tab');
guideOpen();
const {rows,caps}=guideTowerData();
for(const row of rows) {
  check(row.levels.length===10,'Ten levels');
  check(new Set(row.stats.map(stat=>stat.color)).size===row.stats.length,'Distinct colors on each graph');
  for(const stat of row.stats) for(let i=0;i<10;i++) {
    const value=stat.value(row.levels[i]);
    check(Number.isFinite(value) && value>=0 && value<=caps[stat.key],'Shared scale contains '+row.info.name+' '+stat.key);
    const actual=new row.info.type(0,0); applyTowerLevel(actual,i+1);
    check(value===stat.value(actual),'Graph matches applied gameplay level');
  }
  if(row.tower.behavior==='burn') check(row.stats.some(s=>s.key==='burnPower'),'Burning shown');
  if(row.tower.behavior==='slow') check(row.stats.some(s=>s.key==='slowFactor'),'Slowing shown');
  if(row.tower.behavior==='chain') check(row.stats.some(s=>s.key==='chainCount'),'Chains shown');
}
check(JSON.stringify([money,lives,score,towers,creeps,hopper,backlog,buildTicks])===before,'Reading every dossier leaves the simulation unchanged');
check(ctx===frameCanvas.ctx,'Preview drawing restores game context');
await tap('guide-close'); check(uiOverlay==='pause' && paused,'Back keeps game paused');
uiActivate({id:'guide'}); guideActivate('guide-tab-tower');
await gameControl.screenshot('field-guide-tower');
check(running,'Render loop remains healthy');
wslog({result:'PASS',dossiers:entries.length,towers:rows.length,sharedScales:caps,simulationUnchanged:true});

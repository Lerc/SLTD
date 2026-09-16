const check=(condition,message)=>{if(!condition)throw new Error(message);};
async function settle(){
  do { await new Promise(r=>requestAnimationFrame(r)); } while(Math.abs(uiSlide-(selectedTower?1:0))>.001);
}
async function tap(id){await settle();const b=uiControls().find(b=>b.id===id);check(b&&!b.disabled,'Available: '+id);await gameControl.tapCanvas(b.x+b.w/2,b.y+b.h/2);await settle();}
startGame('foundry');paused=true;money=10000;
await settle();const bounds=JSON.stringify(outputCanvas.getBoundingClientRect().toJSON());
check(uiControls().filter(b=>b.id.startsWith('build-')).length===5,'Five foundation buttons');
check(!uiControls().some(b=>b.id==='build-Star'),'Orbital is unavailable as a foundation');
await tap('build-Incinerator');await gameControl.tapCell(3,2);await gameControl.tapCell(3,2);
check(towers[0] instanceof Incinerator,'Incinerator is directly buildable');
await gameControl.tapTower(towers[0]);await settle();
await tap('level-up');await tap('upgrade-Inferno');
check(selectedTower instanceof Inferno&&selectedTower.level===2,'Fire branch retains its level');
const burn=selectedTower.burnPower;
await tap('level-up');check(selectedTower.burnPower>burn,'Fire levels strengthen burning');
const saved=gameControl.saveState();gameControl.loadState(saved);paused=true;
check(towers[0].level===3&&towers[0].burnPower>burn,'Browser snapshot retains level stats');
await tap('build-Stubby');await gameControl.tapCell(5,4);await gameControl.tapCell(5,4);
await gameControl.tapTower(towers[1]);await settle();
await tap('level-up');await tap('upgrade-Star');
check(selectedTower instanceof Star&&selectedTower.level===2,'Cannon upgrades into a leveled Orbital');
check(uiControls().some(b=>b.id==='upgrade-Railgun'),'Orbital retains its further branches');
await tap('upgrade-Railgun');check(selectedTower instanceof Railgun&&selectedTower.level===2,'Second branch retains levels');
check(!uiControls().some(b=>b.id==='close-tower'),'No X button');
await gameControl.tapCell(6,4);await settle();check(!selectedTower,'Map tap dismisses the panel');
check(JSON.stringify(outputCanvas.getBoundingClientRect().toJSON())===bounds,'Levels and branch depth never resize the game');
wslog({result:'PASS',foundations:5,levelPersistence:true,orbital:'Cannon → Orbital → Railgun',viewport:[innerWidth,innerHeight]});

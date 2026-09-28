// Run immediately after a browser reload, before any level or guide is opened.
const check=(value,message)=>{if(!value) throw Error(message);};
check(gameMode===titleScreen && typeof levelMap==='undefined','Test requires a fresh launch with no initialized level');
check(guideData===null && guideSpecimens.size===0,'Preview caches start empty');
const before=JSON.stringify([money,lives,score,towers,creeps,hopper,backlog]);
try {
  uiActivate(uiControls().find(button=>button.id==='guide'));
  check(uiModal()==='guide','Guide opens from the launch screen');
  drawUI(1000);
  uiActivate({id:'guide-tab-creep'});
  drawUI(1600);
  const entries=guideEntries();
  for(let page=0;page<entries.length;page++) {
    uiGuidePage=page;drawUI(2200+page*600);
    check(guideSurfacePage===page,'Dossier initialized: '+entries[page].name);
  }
  check(typeof levelMap==='undefined' && gameMode===titleScreen,'Reading the guide does not create or start a level');
  for(const info of guideCreeps) {
    const specimen=guideSpecimen(info);
    check(specimen.hitPoints===info.type.hitPoints && !specimen.dead,'Preview uses living base stats: '+info.name);
    check(Number.isFinite(specimen.maxShield) && specimen.pathIndex===0,'Preview initializes shields without starting a route: '+info.name);
  }
  check(JSON.stringify([money,lives,score,towers,creeps,hopper,backlog])===before,'Preview initialization leaves the simulation unchanged');
  uiActivate({id:'guide-close'});drawUI(22000);
  check(uiModal()==='welcome','Back returns to the launch screen');
  wslog({result:'PASS',freshLaunch:true,dossiers:entries.length,levelUninitialized:true});
} finally {
  uiActivate({id:'guide-close'});uiDrawSignature='';uiLastFrame=performance.now();
}

const check=(condition,message)=>{if(!condition)throw new Error(message);};
const send=()=>uiControls().find(b=>b.id==='send');
startGame('crosswind');
const geometry=JSON.stringify(outputCanvas.getBoundingClientRect().toJSON());
uiActivate(send());
for(let i=0;i<179;i++) mainGame_core();
check(send().disabled,'Send remains locked until three game-seconds');
mainGame_core();
check(!send().disabled&&send().label==='2'&&send().sub==='+$'+waveSendBonus(),'Send offers wave two and the remaining-time bonus after three seconds');
for(let wave=2;wave<=4;wave++) {
  const b=send();
  await gameControl.tapCanvas(b.x+b.w/2,b.y+b.h/2);
  check(waveCounter===wave&&activeWaves.length===wave,'Canvas Send launches wave '+wave+' alongside earlier waves');
  check(send().disabled,'Every new launch restarts the cooldown');
  for(let i=0;i<180;i++)mainGame_core();
}
paused=true;
await new Promise(resolve=>requestAnimationFrame(resolve));
check(new Set(creeps.map(c=>c.waveNumber)).size===4,'Four wave formations are on the map together');
check(send().disabled,'Pause disables sending even after the cooldown');
check(JSON.stringify(outputCanvas.getBoundingClientRect().toJSON())===geometry,'Overlapping waves never change viewport geometry');
check(running,'Rendering continues during overlapping waves');
wslog({result:'PASS',waves:activeWaves.map(w=>w.number),map:selectedMapId,viewport:[innerWidth,innerHeight]});

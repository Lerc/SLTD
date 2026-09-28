// Real page changes plus deterministic pixel checks for the diagonal reveal.
const check=(value,message)=>{if(!value)throw Error(message);};
const originalRandom=Math.random;
try {
  startGame('foundry');paused=true;guideOpen();uiGuidePage=13;uiLastFrame=1000;uiSlide=0;uiDrawSignature='';
  drawUI(1000);drawUI(2500);
  Math.random=()=>.5;
  guideActivate('guide-next',2501);drawUI(2501);
  check(guideWipes.length>=5,'Changed tower panels each receive a wipe');
  const starts=guideWipes.map(w=>w.startedAt).sort((a,b)=>a-b);
  check(starts.every((time,i)=>Math.abs(time-2501-i*350/(starts.length-1))<1e-9),'Start times are evenly spaced across the full 350 ms period');
  const scheduled=new Map(guideWipes.map(w=>[w.id,w.startedAt]));
  check(!guideWipes.some(w=>['archive','guide-close','guide-prev','guide-next'].includes(w.id)),'Unchanged panels remain still');
  check(guideAnimationFrame(2550)!=='settled','Pending wipes keep the renderer scheduled');
  const from=guideWipeFrom;
  drawUI(2550);
  check(guideWipeFrom===from && guideWipes.every(w=>w.startedAt===scheduled.get(w.id)),'Redrawing does not reroll delays or replace snapshots');
  drawUI(2750);drawUI(3001);
  check(guideWipes.length===0 && guideWipeFrom===null,'All panels finish within half a second');
  const pixels=()=>interfaceCtx.getImageData(0,0,interfaceCanvas.width,interfaceCanvas.height).data;
  const target=()=>guideSurface.getContext('2d').getImageData(0,0,guideSurface.width,guideSurface.height).data;
  let actual=pixels(), expected=target();
  check(actual.every((v,i)=>v===expected[i]),'The settled display contains only the new page');

  let randomIndex=0;Math.random=()=>[0,.25,.5,.75,.99][randomIndex++%5];
  guideActivate('guide-next',3100);drawUI(3100);
  check(new Set(guideWipes.map(w=>w.startedAt)).size>1,'Each panel receives a distinct shuffled slot');
  check(guideWipes.every(w=>w.startedAt>=3100 && w.startedAt+guideWipeDuration<=3600),'Every slot respects the 500 ms deadline');
  const interrupted=guideWipeFrom;
  drawUI(3200);guideActivate('guide-next',3200);drawUI(3200);
  check(guideWipeFrom!==interrupted,'Rapid paging captures the current mixed contents');
  check(guideWipes.every(w=>w.startedAt>=3200 && w.startedAt+guideWipeDuration<=3700),'Rapid paging uses the latest page deadline');
  drawUI(3700);actual=pixels();expected=target();
  check(actual.every((v,i)=>v===expected[i]),'Rapid paging cannot restore a stale page');

  const regions=Array.from({length:6},(_,i)=>({id:'slot-'+i}));
  const firstOrder=guideScheduleWipes(regions,4000);
  const firstDelays=new Map(firstOrder.map(w=>[w.id,w.startedAt-4000]));
  const secondOrder=guideScheduleWipes(regions,5000);
  check(secondOrder.every(w=>w.startedAt-5000!==firstDelays.get(w.id)),'A panel receives a different delay on the next shuffle');
  check(secondOrder.map(w=>w.startedAt-5000).every((delay,i)=>delay===i*70),'Shuffling preserves even slot spacing');
  check(guideScheduleWipes([{id:'single'}],6000)[0].startedAt===6000,'A lone changed panel starts immediately');
  check(guideScheduleWipes([],6000).length===0,'No changed panels need no schedule');

  // A colored fixture makes old/new content, clipping and direction unambiguous.
  const old=document.createElement('canvas');old.width=old.height=256;
  old.getContext('2d').fillStyle='#ff0000';old.getContext('2d').fillRect(0,0,256,256);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const c=canvas.getContext('2d');
  guideWipeFrom=old;
  guideWipes=[{id:'fixture',x:0,y:0,w:192,h:192,points:[[0,0],[192,0],[192,192],[0,192]],exclusions:[],startedAt:1000}];
  const pixel=(x,y)=>Array.from(c.getImageData(x,y,1,1).data).slice(0,3).join(',');
  const paint=(time,glow=false)=>{c.fillStyle='#0000ff';c.fillRect(0,0,256,256);guidePaintWipes(c,time,glow);};
  paint(999);check(pixel(168,24)==='255,0,0','Old content remains until the delay elapses');
  paint(1045);
  check(pixel(168,24)==='0,0,255' && pixel(24,168)==='0,0,255','New contents replace the old image once the leading edge completes');
  check(pixel(224,224)==='0,0,255','Wipe stays clipped to its panel');
  paint(1025,true);
  check(pixel(168,24)==='18,60,77' && pixel(24,168)==='255,0,0','The leading edge fills without clearing behind it');
  paint(1045,true);
  check(pixel(168,24)==='18,60,77' && pixel(24,168)==='18,60,77','The whole panel is filled before the trailing edge starts');
  paint(1000+guideWipeDuration*.7,true);
  const fading=Array.from(c.getImageData(24,168,1,1).data);
  check(pixel(168,24)==='0,0,255' && fading[0]>0 && fading[0]<18 && fading[2]>77,'The slower trailing edge clears toward bottom left while its body fades to the new image');
  paint(1046,true);
  check(pixel(24,168)==='18,60,77','The fade starts gently at full coverage');
  paint(1140,true);
  check(c.getImageData(24,168,1,1).data[0]<3,'The final blocks ease almost completely away before the wipe ends');
  paint(1006.75,true);
  check(pixel(120,24)!=='255,0,0' && pixel(168,72)==='255,0,0','The front advances twice as far horizontally as vertically');
  paint(1003,true);
  check(pixel(168,48)==='255,255,255','Leading edge has a white stroke');
  check(pixel(168,47)!=='255,255,255' && pixel(168,49)!=='255,255,255','White stroke is exactly one pixel thick');
  // Backing-pixel alignment is independent of display scale.
  canvas.width=canvas.height=512;old.width=old.height=512;
  old.getContext('2d').fillStyle='#ff0000';old.getContext('2d').fillRect(0,0,512,512);
  c.scale(2,2);paint(1003,true);
  check(pixel(336,96)==='255,255,255' && pixel(336,95)!=='255,255,255' && pixel(336,97)!=='255,255,255','Scaled display retains a one-pixel white edge');
  c.setTransform(1,0,0,1,0,0);
  paint(1000+guideWipeDuration,true);check(pixel(24,168)==='0,0,255','No old content or glow remains at 150 ms');
  wslog({result:'PASS',direction:'top-right to bottom-left',duration:guideWipeDuration,maxDelay:guideWipeMaxDelay,deadline:500,evenlySpaced:true,shuffled:true,fillBeforeClear:true,softExit:true,leadDuration:guideWipeLeadDuration,whiteEdgePixels:1,rapidPaging:true});
} finally {
  Math.random=originalRandom;guideOpen();uiGuidePage=13;uiDrawSignature='';uiLastFrame=performance.now();
}

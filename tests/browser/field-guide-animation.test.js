const pageFor = Type => guideEntries().findIndex(entry=>entry.info?.type===Type);
// Deterministic regression: preserve the fading trace and use every browser frame.
const check=(value,message)=>{if(!value) throw Error(message);};
const savedPage=uiGuidePage;
const failures=[];
try {
  uiGuidePage=pageFor(Tower); guideTraces.clear(); guideSyncLayout(1000);
  const bounds=guideLayout.bounds, {left,top,width,height}=bounds;
  check(guideTraceDelay([left,top],bounds)===0,'Top-left starts without delay');
  check(guideTraceDelay([left+width,top+height],bounds)===400,'Bottom-right starts after 400 ms');
  check(guideTraceDelay([left+width/2,top+height/2],bounds)===200,'Center has half the delay');
  check(guideTraceDelay([left,top+100],bounds)===2*guideTraceDelay([left+100,top],bounds),'Vertical position contributes twice horizontal position');
  for(const trace of guideTraces.values()) {
    const [x,y]=trace.points[0];
    const expected=1000+400*(2*(y-top)+x-left)/(2*height+width);
    check(Math.abs(trace.startedAt-expected)<1e-9,'Each outline is scheduled from its own starting point');
  }
  const latestStart=Math.max(...[...guideTraces.values()].map(trace=>trace.startedAt));
  const first=guideAnimationFrame(1001), second=guideAnimationFrame(1006);
  if(first===second) failures.push('Distinct browser frames are discarded by the animation clock');
  if(guideAnimationFrame(latestStart+guideTraceDuration+100)==='settled') failures.push('Redrawing stops before the trailing glow fades');
  const canvas=document.createElement('canvas'); canvas.width=1080;canvas.height=1848;
  const c=canvas.getContext('2d'), trace=guideTraces.get('frame');
  const opacityAt=time=>{
    c.clearRect(0,0,canvas.width,canvas.height);
    guideDrawTrace(c,trace,time);
    const pixels=c.getImageData(0,0,canvas.width,canvas.height).data;
    let sum=0;for(let i=3;i<pixels.length;i+=4) sum+=pixels[i];
    return sum;
  };
  check(opacityAt(trace.startedAt-1)===0,'No glow appears before its delayed start');
  check(opacityAt(trace.startedAt+1)>0,'Glow appears when its scheduled start arrives');
  const crossing=opacityAt(trace.startedAt+guideTraceDuration);
  const tail=opacityAt(trace.startedAt+guideTraceDuration+100);
  if(!(crossing>tail && tail>0)) failures.push('The trace disappears at the endpoint instead of fading after it');
  check(opacityAt(6000)===0,'Completed traces leave no persistent glow');
  check(guideAnimationFrame(6000)==='settled','Rendering settles after the complete effect');
  if(failures.length) throw Error(failures.join('; '));
  // Exercise the real UI cache: fade frames must composite, then clear fully.
  startGame('foundry');paused=true;guideOpen();uiGuidePage=pageFor(Tower);
  guideSyncLayout(1000);uiDrawSignature='';uiLastFrame=1000;uiSlide=0;
  const original=uiDrawGuide;
  let staticDraws=0;
  uiDrawGuide=(...args)=>{staticDraws++;return original(...args);};
  try {
    drawUI(1000);drawUI(latestStart+guideTraceDuration);
    const image=()=>interfaceCtx.getImageData(0,0,interfaceCanvas.width,interfaceCanvas.height).data;
    const atEndpoint=image();
    drawUI(latestStart+guideTraceDuration+100);
    const fading=image();
    check(atEndpoint.some((v,i)=>v!==fading[i]),'The displayed trace keeps changing after reaching the endpoint');
    drawUI(latestStart+guideTraceDuration+guideTraceFadeDuration);
    const settled=image(), background=guideSurface.getContext('2d').getImageData(0,0,guideSurface.width,guideSurface.height).data;
    check(settled.every((v,i)=>v===background[i]),'Final composite removes every fading pixel');
    drawUI(6000);
    check(staticDraws===1,'Animation reuses the static display instead of repainting it');
    const beforeTurn=image();
    const traceStarts=[...guideTraces.values()].map(trace=>trace.startedAt).join(',');
    drawUI(11000);
    const afterTurn=image();
    check(beforeTurn.some((v,i)=>v!==afterTurn[i]),'The turret keeps rotating after outlines settle');
    const transform=interfaceCtx.getTransform();
    const panel=guideLayout.panels.find(panel=>panel.id==='tower-portrait');
    let outsideChanges=0;
    for(let y=0;y<interfaceCanvas.height;y++) for(let x=0;x<interfaceCanvas.width;x++) {
      if(guideContains(panel.points,{x:(x-transform.e)/transform.a,y:(y-transform.f)/transform.d})) continue;
      const i=(y*interfaceCanvas.width+x)*4;
      if(beforeTurn.slice(i,i+4).some((v,j)=>v!==afterTurn[i+j])) outsideChanges++;
    }
    check(outsideChanges===0,'Rotation leaves the other panels unchanged');
    check(staticDraws===1 && traceStarts===[...guideTraces.values()].map(trace=>trace.startedAt).join(','),'Turrets reuse the display cache without retriggering outlines');
    for(const type of [Star,Thumper]) {
      uiGuidePage=guideEntries().findIndex(entry=>entry.info?.type===type);
      check(!guideTurretAnimating(),'Towers without turrets remain static');
    }
  } finally {uiDrawGuide=original;}
  wslog({result:'PASS',staggeredStart:true,fullFrameCadence:true,fadeAfterEndpoint:true,crossingOpacity:crossing,tailOpacity:tail});
} finally {
  uiGuidePage=savedPage;guideTraces.clear();guideLayout=null;uiDrawSignature='';uiLastFrame=performance.now();
}

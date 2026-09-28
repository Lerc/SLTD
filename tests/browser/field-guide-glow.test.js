const check = (value, message) => { if (!value) throw new Error(message); };
startGame('foundry'); paused=true;
const canvas = () => {
  const result=document.createElement('canvas');
  result.width=frameCanvas.width; result.height=frameCanvas.height;
  return result;
};
const capture = () => {
  const result=canvas(); result.getContext('2d').drawImage(outputCanvas,0,0); return result;
};
const pixels = image => image.getContext('2d').getImageData(0,0,image.width,image.height).data;
const energy = data => {
  const sum=[0,0,0];
  for(let i=0;i<data.length;i+=4) for(let channel=0;channel<3;channel++) sum[channel]+=data[i+channel];
  return sum;
};
const display=canvas().getContext('2d'), previous=ctx;
const beforeState=JSON.stringify([money,lives,score,towers,creeps,hopper,backlog,buildTicks]);
guidePortraits.clear();
try {
  for(const entry of guideEntries().filter(e=>e.info)) {
    glowFrame(frameCanvas);
    const before=pixels(capture());
    guidePortrait(display,entry,160,160,320,5000);
    check(ctx===previous,'Portrait restores drawing context: '+entry.name);
    check(pixels(capture()).every((v,i)=>v===before[i]),'Portrait preserves gameplay frame: '+entry.name);
    const portrait=guidePortraits.get(entry.info.type.name), rgba=pixels(portrait);
    check(rgba[3]===0,'Portrait background stays transparent: '+entry.name);
    check(rgba.some((v,i)=>i%4===3&&v>0&&v<255),'Portrait retains a translucent halo: '+entry.name);
    const black=document.createElement('canvas'); black.width=black.height=320;
    const paint=black.getContext('2d'); paint.fillStyle='#000'; paint.fillRect(0,0,320,320); paint.drawImage(portrait,0,0);
    const portraitEnergy=energy(pixels(black));
    const raw=canvas(); ctx=raw.getContext('2d'); ctx.fillStyle='#000'; ctx.fillRect(0,0,raw.width,raw.height);
    const specimen=guideSpecimen(entry.info);
    ctx.translate(160,160); ctx.scale(2.25,2.25);
    ctx.translate(-specimen.x,-specimen.y); specimen.drawMain();
    glowFrame(raw);
    const gameEnergy=energy(capture().getContext('2d').getImageData(0,0,320,320).data);
    for(let channel=0;channel<3;channel++) check(Math.abs(portraitEnergy[channel]-gameEnergy[channel])<=Math.max(100,gameEnergy[channel]*.03),
      'Portrait matches gameplay shader color and brightness: '+entry.name+' channel '+channel);
    ctx=previous;
  }
} finally {ctx=previous; glowFrame(frameCanvas);}
const bodyWidth = Type => {
  const picture=guidePortraits.get(Type.name), data=pixels(picture);
  let left=picture.width, right=-1;
  for(let y=0;y<picture.height;y++) for(let x=0;x<picture.width;x++) {
    if(data[(y*picture.width+x)*4+3]<250) continue;
    left=Math.min(left,x); right=Math.max(right,x);
  }
  return right-left+1;
};
check(Math.abs(bodyWidth(Zipper)/bodyWidth(Basic)-.5)<.03,'Runner renders at half the Scout size');
check(Math.abs(bodyWidth(BigBall)/bodyWidth(Ball)-2)<.1,'Guardian renders at twice the Armour size');
check(JSON.stringify([money,lives,score,towers,creeps,hopper,backlog,buildTicks])===beforeState,'Shader previews leave simulation untouched');
wslog({result:'PASS',portraits:guidePortraits.size,gameplayShader:true,transparentGlow:true,backdropPreserved:true});

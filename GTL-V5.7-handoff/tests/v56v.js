const {open,OUT}=require('./lib.js');
const fs=require('fs');
(async()=>{
 const vps=[[1600,1000],[1440,900],[1366,768],[1280,800],[1100,720]];
 const res={};
 for(const [vw,vh] of vps){
  const t0=Date.now(); const {b,p}=await open(vw,vh); const R={}; const k=vw+'x'+vh; R.loadMs=Date.now()-t0;
  const ev=(f,a)=>p.evaluate(f,a);
  R.overflowX=await ev(()=>document.documentElement.scrollWidth>innerWidth||document.body.scrollWidth>innerWidth);
  R.rail=await ev(()=>{const r=document.querySelector('.rail').getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height),fits:r.bottom<=innerHeight+1&&r.right<innerWidth}});
  R.lcd=await ev(()=>{const l=[...document.querySelectorAll('.lband .lline,.lmain,.lz')];return {clipped:l.filter(e=>e.scrollWidth>e.clientWidth+1).length,h:Math.round(document.querySelector('.deck').getBoundingClientRect().height)}});
  R.board=await ev(()=>{const b=document.querySelector('.board').getBoundingClientRect();const mk=document.querySelector('.mk').getBoundingClientRect();return {frets:document.querySelectorAll('.fretw').length+1,nums:document.querySelectorAll('.nums span').length,w:Math.round(b.width),h:Math.round(b.height),marker:Math.round(mk.width),coreMin:Math.round(mk.width*.74)}});
  // perf/anal
  await p.click('.vzbtn'); const perfN=await ev(()=>document.querySelectorAll('.mk').length);
  const sum1=await ev(()=>document.querySelector('.vzread').textContent.trim());
  await p.click('.pop .segbtn:has-text("Analisi")'); await p.waitForTimeout(100);
  const sum2=await ev(()=>document.querySelector('.vzread').textContent.trim());
  const popFits=await ev(()=>{const r=document.querySelector('.pop').getBoundingClientRect();return r.bottom<=innerHeight&&r.right<=innerWidth});
  await p.keyboard.press('Escape'); await p.waitForTimeout(80);
  await p.click('#gtl-tab-1'); await p.selectOption('select[aria-label="Accordo attivo"]','d4'); await p.waitForTimeout(100);
  const analN=await ev(()=>document.querySelectorAll('.mk').length);
  R.modes={perfSummary:sum1,analSummary:sum2,popFits,tensionsInAnal:await ev(()=>document.querySelectorAll('.mk svg path[style*="a77bf0"],.mk svg path[style*="marker-tension"]').length)};
  // legend rows by mode
  await p.click('#gtl-tab-3'); R.legendRowsAnal=await ev(()=>document.querySelectorAll('.lgrow').length);
  // divider
  const fb=()=>ev(()=>Math.round(document.querySelector('.fbpanel').getBoundingClientRect().height));
  const s=await p.locator('.split').boundingBox(); const h0=await fb();
  await p.mouse.move(s.x+s.width/2,s.y+7);await p.mouse.down();await p.mouse.move(s.x+s.width/2,s.y+90,{steps:6});await p.mouse.up();const h1=await fb();
  await p.focus('.split'); await p.keyboard.press('ArrowUp');await p.keyboard.press('ArrowUp');const h2=await fb();
  await p.keyboard.press('End');const hMax=await fb();await p.keyboard.press('Home');const hMin=await fb();
  const geo=await ev(()=>({frets:document.querySelectorAll('.fretw').length+1,ox:document.documentElement.scrollWidth>innerWidth,nb:Math.round(document.querySelector('.nb').getBoundingClientRect().height)}));
  await p.keyboard.press('Home'); // reset via dblclick
  await p.dblclick('.split'); const hR=await fb();
  R.divider={start:h0,drag:h1,keyUp2:h2,end:hMax,home:hMin,afterHome:geo,reset:hR};
  // tabs keyboard
  await p.focus('#gtl-tab-0'); const t=[];
  for(const key of ['ArrowRight','End','ArrowLeft','Home']){await p.keyboard.press(key);await p.waitForTimeout(120);t.push(await ev(()=>document.querySelector('[role=tab][aria-selected=true]').textContent.trim()));}
  R.tabs=t;
  // next fretboard
  await p.click('#gtl-tab-1'); await p.click('.pb:has-text("ii–V–I")'); await p.click('.rb[aria-label="Harmony Lab"]'); await p.click('#gtl-tab-4'); await p.waitForTimeout(200);
  R.next=await ev(()=>{const b=document.querySelector('.nxb');const r=b.getBoundingClientRect();const pg=document.querySelector('.pg').getBoundingClientRect();return {dots:document.querySelectorAll('.nmk').length,w:Math.round(r.width),inside:r.right<=pg.right+1&&r.bottom<=pg.bottom+40,now:document.querySelector('.nxc b').textContent,next:document.querySelector('.nxt b').textContent}});
  await p.screenshot({path:OUT+`v56f-next-${k}.png`});
  await p.click('.rb[aria-label="Fretboard Lab"]'); await p.click('#gtl-tab-0');
  // overlays
  R.overlays={};
  for(const [lab,id] of [['Analog Mixer','mixer'],['Amplifier / NAM','amp'],['Chromatic Tuner','tuner'],['Guitar Input','iface']]){
   await p.click(`.rb[aria-label="${lab}"]`); await p.waitForTimeout(550);
   const o=await ev(()=>{const d=document.querySelector('.dv'),nb=document.querySelector('.nb').getBoundingClientRect(),r=d.getBoundingClientRect();return {inNb:r.top>=nb.top-1&&r.bottom<=nb.bottom+1&&r.left>=nb.left-1&&r.right<=nb.right+1,scroll:d.scrollHeight>d.clientHeight+1||d.scrollWidth>d.clientWidth+1,w:Math.round(r.width),h:Math.round(r.height),focus:document.activeElement.className}});
   await p.screenshot({path:OUT+`v56f-${id}-${k}.png`});
   await p.keyboard.press('Escape'); await p.waitForTimeout(350);
   o.closed=(await ev(()=>document.querySelectorAll('.dv').length))===0;
   o.focusBack=await ev(()=>document.activeElement.getAttribute('aria-label'));
   R.overlays[id]=o;
  }
  // V5.6 hardware interactions
  { const H={};
   await p.click('.rb[aria-label="Analog Mixer"]'); await p.waitForTimeout(500);
   const hit=p.locator('.m6hit').first(); const bb=await hit.boundingBox(); const v0=await hit.getAttribute('aria-valuenow');
   await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height*0.9); await p.mouse.down(); await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height*0.2,{steps:6}); await p.mouse.up();
   const v1=await hit.getAttribute('aria-valuenow'); await hit.focus(); await p.keyboard.press('ArrowDown'); const v2=await hit.getAttribute('aria-valuenow');
   const capMoved=await p.evaluate(()=>document.querySelector('.m6cap').style.top);
   const mute=p.locator('.m6btn.mute').first(); await mute.click(); const mp=await mute.getAttribute('aria-pressed'); await mute.click();
   H.mixer={fader:[v0,v1,v2],capTop:capMoved,mute:mp,soloDisabled:await p.locator('.m6btn.solo').first().isDisabled(),edgesVisible:await p.evaluate(()=>{const r=document.querySelector('.m6wrap').getBoundingClientRect(),nb=document.querySelector('.nb').getBoundingClientRect();return r.left>=nb.left&&r.right<=nb.right&&r.top>=nb.top-1&&r.bottom<=nb.bottom+1}),scale:await p.evaluate(()=>document.querySelector('.m6').style.transform)};
   await p.keyboard.press('Escape'); await p.waitForTimeout(350);
   await p.click('.rb[aria-label="Amplifier / NAM"]'); await p.waitForTimeout(500);
   const k=p.locator('.a6 .rk-hit').first(); const kb=await k.boundingBox(); const k0=await k.getAttribute('aria-valuenow');
   await p.mouse.move(kb.x+kb.width/2,kb.y+kb.height/2); await p.mouse.down(); await p.mouse.move(kb.x+kb.width/2,kb.y-30,{steps:5}); await p.mouse.up();
   H.amp={knob:[k0,await k.getAttribute('aria-valuenow')],ptr:await p.evaluate(()=>document.querySelector('.a6 .rk-ptr').style.transform),inNb:await p.evaluate(()=>{const r=document.querySelector('.rwrap').getBoundingClientRect(),nb=document.querySelector('.nb').getBoundingClientRect();return r.top>=nb.top-1&&r.bottom<=nb.bottom+1})};
   await p.keyboard.press('Escape'); await p.waitForTimeout(350);
   await p.click('.rb[aria-label="Chromatic Tuner"]'); await p.waitForTimeout(500);
   await p.click('.t6fsh'); H.tuner={on:await p.locator('.t6fsh').getAttribute('aria-pressed'),inNb:await p.evaluate(()=>{const r=document.querySelector('.rwrap').getBoundingClientRect(),nb=document.querySelector('.nb').getBoundingClientRect();return r.top>=nb.top-1&&r.bottom<=nb.bottom+1})}; await p.click('.t6fsh');
   await p.keyboard.press('Escape'); await p.waitForTimeout(350);
   await p.click('.rb[aria-label="Guitar Input"]'); await p.waitForTimeout(500);
   H.iface={inNb:await p.evaluate(()=>{const r=document.querySelector('.rwrap').getBoundingClientRect(),nb=document.querySelector('.nb').getBoundingClientRect();return r.top>=nb.top-1&&r.bottom<=nb.bottom+1}),liveDefault:await p.locator('.i6btn').first().getAttribute('aria-pressed')};
   await p.keyboard.press('Escape'); await p.waitForTimeout(350);
   R.hw=H; }
  // tooltip on focus
  await p.focus('.rb[aria-label="Harmony Lab"]'); await p.keyboard.press('Tab'); await p.keyboard.press('Shift+Tab'); await p.waitForTimeout(250);
  R.tipFocus=await ev(()=>getComputedStyle(document.activeElement.querySelector('.tip')).opacity);
  // reduced motion
  await p.emulateMedia({reducedMotion:'reduce'}); await p.click('.rb[aria-label="Analog Mixer"]'); await p.waitForTimeout(60);
  R.reduced={anim:await ev(()=>getComputedStyle(document.querySelector('.dv')).animationName)}; await p.keyboard.press('Escape'); await p.waitForTimeout(40); R.reduced.closedAtOnce=(await ev(()=>document.querySelectorAll('.dv').length))===0;
  await p.screenshot({path:OUT+`v56f-main-${k}.png`});
  res[k]=R; await b.close();
 }
 fs.writeFileSync(OUT+'v56-validation.json',JSON.stringify(res,null,1));
 console.log(JSON.stringify(res));
})();

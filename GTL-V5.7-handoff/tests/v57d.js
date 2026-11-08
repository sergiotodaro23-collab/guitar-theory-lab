const {open,OUT}=require('./lib.js');
(async()=>{const vw=+process.argv[2]||1440,vh=+process.argv[3]||900;const {b,p}=await open(vw,vh);
await p.click('#gtl-tab-2'); 
for(const [lab,id] of [['Analog Mixer','mixer'],['Amplifier / NAM','amp'],['Chromatic Tuner','tuner'],['Guitar Input','iface']]){
 await p.click(`.rb[aria-label="${lab}"]`); await p.waitForTimeout(150);
 await p.screenshot({path:OUT+`v57d-${id}-mid-${vw}.png`});
 await p.waitForTimeout(500);
 const r=await p.evaluate(()=>{const nb=document.querySelector('.nb').getBoundingClientRect();const w=document.querySelector('.rwrap,.m6wrap').getBoundingClientRect();const pg=document.querySelector('.pg').getBoundingClientRect();return {nb:[nb.top,nb.bottom].map(Math.round),dev:[w.left,w.top,w.right,w.bottom].map(Math.round),pgTop:Math.round(pg.top),tab:document.querySelector('[role=tab][aria-selected=true]').textContent.trim(),focus:document.activeElement.className}});
 console.log(id,JSON.stringify(r));
 await p.screenshot({path:OUT+`v57d-${id}-${vw}.png`});
 await p.keyboard.press('Escape'); await p.waitForTimeout(400);
 console.log(' after',await p.evaluate(()=>[document.querySelectorAll('.dv').length,document.activeElement.getAttribute('aria-label'),document.querySelector('[role=tab][aria-selected=true]').textContent.trim()]));
}
await b.close();})();

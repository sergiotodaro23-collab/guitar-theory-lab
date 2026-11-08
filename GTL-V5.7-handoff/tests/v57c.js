const {open,OUT}=require('./lib.js');
(async()=>{const vw=+process.argv[2]||1440,vh=+process.argv[3]||900;const {b,p}=await open(vw,vh);
const info=async()=>p.evaluate(()=>{const r=e=>{const b=document.querySelector(e).getBoundingClientRect();return [Math.round(b.x),Math.round(b.y),Math.round(b.width),Math.round(b.height)]};return {deck:r('.deck'),lcd:r('.lcdscreen'),ctl:r('.lctl'),ox:document.documentElement.scrollWidth>innerWidth,clip:[...document.querySelectorAll('.lz,.lctx,.lctl')].filter(e=>e.scrollWidth>e.clientWidth+1).length}});
console.log('exp',JSON.stringify(await info())); await p.screenshot({path:OUT+`v57-lcd-exp-${vw}.png`,clip:{x:0,y:0,width:vw,height:150}});
await p.click('.tsep button'); await p.waitForTimeout(200);
console.log('cmp',JSON.stringify(await info())); await p.screenshot({path:OUT+`v57-lcd-cmp-${vw}.png`,clip:{x:0,y:0,width:vw,height:150}});
await p.click('.tsep button'); await b.close();})();

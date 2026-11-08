const { chromium } = require('playwright');const fs=require('fs');
const FD='/tmp/claude-0/-home-claude/fecb535e-9d56-576d-a6fc-f24f8474f021/scratchpad/fonts/node_modules/@fontsource';
exports.OUT='/tmp/claude-0/-home-claude/fecb535e-9d56-576d-a6fc-f24f8474f021/scratchpad/shots/';
function css(){const fams=[['barlow','Barlow',[400,500,600]],['barlow-condensed','Barlow Condensed',[500,600]],['cormorant-garamond','Cormorant Garamond',[500,600]],['ibm-plex-mono','IBM Plex Mono',[400,500,600]]];let o='';
 for(const [d,n,ws] of fams) for(const w of ws){const f=`${FD}/${d}/files/${d}-latin-${w}-normal.woff2`;if(fs.existsSync(f))o+=`@font-face{font-family:"${n}";font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync(f).toString('base64')}) format("woff2")}\n`;}return o;}
exports.open=async function(vw,vh,url){
 const b=await chromium.launch(); const fc=css();
 const p=await b.newPage({viewport:{width:vw,height:vh}});
 await p.route('**/fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:fc}));
 await p.route('**/fonts.gstatic.com/**',r=>r.abort());
 p.on('pageerror',e=>console.log('pageerror',e.message));
 p.on('console',m=>{ if(m.type()==='error') console.log('console.error',m.text().slice(0,200)); });
 await p.goto(url||'http://localhost:8766/Main.dc.html'); await p.waitForTimeout(1800);
 return {b,p};
};

const {chromium}=require('playwright');
// node zenrec.js mode seconds [actions]  -> кадры 30 fps (виртуальные часы) в /tmp/claude-0/ig/rec_<mode>/
const fs=require('fs');
(async()=>{const [m,secs,act]=[process.argv[2],+process.argv[3]||8,process.argv[4]||''];
const dir=`/tmp/claude-0/ig/rec_${m}${act?'_'+act:''}`;fs.mkdirSync(dir,{recursive:true});
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:405,height:720},deviceScaleFactor:1080/405,isMobile:true,hasTouch:true});
const p=await ctx.newPage();
await p.clock.install();
await p.goto(`http://localhost:8765/voices/?zen=${m}`,{waitUntil:'load'});
await p.clock.runFor(3000);
if(act==='open'){ // тап по центру: открыть вопрос
  await p.mouse.click(202,360); }
const N=Math.round(secs*30);
for(let i=0;i<N;i++){await p.clock.runFor(33.333);await p.screenshot({path:`${dir}/${String(i).padStart(4,'0')}.png`});}
await b.close();console.log(dir,N);})();

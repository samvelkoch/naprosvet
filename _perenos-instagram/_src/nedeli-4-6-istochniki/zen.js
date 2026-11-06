const {chromium}=require('playwright');
// node zen.js  -> скриншоты режимов Zen в мобильном вьюпорте (1080×1920 при dpr 2.6667)
(async()=>{const b=await chromium.launch();
const modes=(process.argv[2]||'universe,drum,light,custom').split(',');
for(const m of modes){
  const ctx=await b.newContext({viewport:{width:405,height:720},deviceScaleFactor:1080/405,isMobile:true,hasTouch:true});
  const p=await ctx.newPage();
  await p.goto(`http://localhost:8765/voices/?zen=${m}`,{waitUntil:'networkidle'});
  await p.waitForTimeout(4000);
  await p.screenshot({path:`/tmp/claude-0/ig/zen_${m}.png`});
  await ctx.close();
}
await b.close();})();

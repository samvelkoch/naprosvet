const {chromium}=require('playwright');
// node zenrec2.js mode outdir script.json  — сценарий: [[frame, 'down'|'move'|'up'|'click', x, y], ...], кадры 30 fps на виртуальных часах
const fs=require('fs');
(async()=>{const [m,out,sc,secs,w]=[process.argv[2],process.argv[3],JSON.parse(fs.readFileSync(process.argv[4])),+process.argv[5]||12,process.argv[6]||''];
fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:405,height:720},deviceScaleFactor:1080/405});
const p=await ctx.newPage();
await p.clock.install();
await p.goto(`http://localhost:8765/voices/?zen=${m}${w}`,{waitUntil:'load'});
await p.clock.runFor(3000);
const N=Math.round(secs*30); let k=0;
for(let i=0;i<N;i++){
  while(k<sc.length && sc[k][0]<=i){const [f,a,x,y]=sc[k++];
    if(a==='down'){await p.mouse.move(x,y);await p.mouse.down();}
    else if(a==='move'){await p.mouse.move(x,y,{steps:1});}
    else if(a==='up'){await p.mouse.up();}
    else if(a==='click'){await p.mouse.click(x,y);}
    else if(a==='key'){await p.keyboard.press(x);}
  }
  await p.clock.runFor(33.333);
  if(!process.env.NOSHOT || i%15===0) await p.screenshot({path:`${out}/${String(i).padStart(4,'0')}.png`});
}
await b.close();console.log(out,N);})();

const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1000,height:1200},deviceScaleFactor:2});
await p.goto('http://localhost:8765/brodsky/#venecia',{waitUntil:'networkidle'});await p.waitForTimeout(2000);
const m=await p.$('#venecia svg.vm');await m.scrollIntoViewIfNeeded();await p.waitForTimeout(800);await m.screenshot({path:'/tmp/claude-0/ig/ven_map.png'});await p.addStyleTag({content:'.vm-mk,.vm-pt,.vm-rip,.vm-no{display:none!important}'});await p.waitForTimeout(300);await m.screenshot({path:'/tmp/claude-0/ig/ven_map_clean.png'});
await b.close();})();

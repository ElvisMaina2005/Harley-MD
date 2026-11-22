const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs'), os=require('os'), path=require('path');
test('compact batches, settings, mode restrictions and disconnect',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'harley-greetings-'));
 const timers=[]; const original=global.setTimeout, clear=global.clearTimeout;
 try {
 for(const f of ['memberGreetings.js','botMode.js']) fs.copyFileSync(path.join(__dirname,'../lib',f),path.join(dir,f));
 fs.writeFileSync(path.join(dir,'index.js'),`exports.on=true; exports.isWelcomeOn=exports.isGoodByeOn=async()=>exports.on; exports.getWelcome=exports.getGoodbye=async()=>exports.custom;`);
 fs.writeFileSync(path.join(dir,'jidHelper.js'),`exports.lidToMention=ids=>({jid:ids[0],text:'@'+ids[0].split('@')[0]});`);
 // Isolate botMode data path inside the temporary directory.
 const modePath=path.join(dir,'botMode.js'); fs.writeFileSync(modePath,fs.readFileSync(modePath,'utf8').replaceAll('../data/','data/'));
 const g=require(path.join(dir,'memberGreetings')), mode=require(modePath), settings=require(path.join(dir,'index'));
 global.setTimeout=(fn,ms)=>{assert.equal(ms,30000); const t={fn,unref(){}};timers.push(t);return t;}; global.clearTimeout=t=>{t.cancelled=true;};
 const jid='123@g.us', people=Array.from({length:12},(_,i)=>({id:`2547000000${i}@s.whatsapp.net`}));
 const sent=[];const sock={groupMetadata:async()=>({subject:'Actual Group',participants:people}),sendMessage:async(j,p)=>sent.push(p)};
 const tick=async()=>{const t=timers.shift();if(!t.cancelled)t.fn();await new Promise(r=>setImmediate(r));};
 g.start(sock); await g.enqueue(sock,jid,'join',[people[0]]); await g.enqueue(sock,jid,'join',[people[1],people[0]]); assert.equal(timers.length,1); await tick(); assert.equal(sent.length,1); assert.equal(sent[0].mentions.length,2);assert.match(sent[0].text,/Actual Group/);assert.match(sent[0].text,/Members: 12/);assert.equal(sent[0].image,undefined);
 await g.enqueue(sock,jid,'leave',people); await tick();assert.equal(sent[1].mentions.length,0);assert.match(sent[1].text,/12 members left/);
 settings.custom='Hello {user} in {group}';await g.enqueue(sock,jid,'join',[people[0]]);await tick();assert.match(sent[2].text,/Hello @.* in Actual Group/);
 await g.enqueue(sock,jid,'join',[people[0]]);settings.on=false;await tick();assert.equal(sent.length,3);settings.on=true;
 await g.enqueue(sock,jid,'join',[people[0]]);mode.setGroup(jid,'silent');await tick();assert.equal(sent.length,3);mode.setGroup(jid,'admin');
 await g.enqueue(sock,jid,'join',[people[0]]);mode.set('dms');await tick();assert.equal(sent.length,3);mode.set('public');
 await g.enqueue(sock,jid,'join',[people[0]]);g.stop(sock);await tick();assert.equal(sent.length,3);
 } finally {global.setTimeout=original;global.clearTimeout=clear;fs.rmSync(dir,{recursive:true,force:true});}
});

const {test}=require('node:test'); const assert=require('node:assert/strict'); const fs=require('fs');const path=require('path');const os=require('os');
test('private controls, stable selection, admin authorization, silent guard and reset',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'harley-owner-'));try{
 fs.mkdirSync(path.join(root,'lib'));for(const f of ['botMode.js','ownerGroups.js'])fs.copyFileSync(path.join(__dirname,'../lib',f),path.join(root,'lib',f));
 const m=require(path.join(root,'lib/botMode'));const c=require(path.join(root,'lib/ownerGroups'));const self='789@s.whatsapp.net',g='123@g.us',other='456@g.us',admin='111@lid';const replies=[];let groups={[g]:{subject:'Alpha'},[other]:{subject:'Beta'}};
 const sock={user:{id:self},groupFetchAllParticipating:async()=>groups,groupMetadata:async()=>({participants:[{id:admin,admin:'admin'}]}),sendMessage:async(j,p)=>replies.push([j,p])};m.install(sock);
 const msg={key:{remoteJid:self,fromMe:true}};const run=t=>c.handle(sock,msg,t,'.');
 await c.handle(sock,{key:{remoteJid:self,fromMe:false}},'.mygroups','.');assert.equal(replies.length,0);
 await run('.mygroups');groups[other].subject='Aardvark';await run('.mode admin 1');assert.equal(m.groupMode(g),'admin');assert.equal(m.groupMode(other),null);
 assert.equal(await m.groupCommandAllowed(sock,{key:{remoteJid:g,participant:admin}}),true);assert.equal(await m.groupCommandAllowed(sock,{key:{remoteJid:g,participant:'222@lid'}}),false);
 await run('.mode silent Alpha');assert.equal(m.allowsChat('public',g),false);await assert.rejects(sock.sendMessage(g,{}),{code:'BOT_MODE_BLOCKED'});
 await run('.mode reset 1');assert.equal(m.groupMode(g),null);m.set('dms');await run('.mode public 1');assert.equal(m.allowsChat(m.read(),g),false);assert.ok(replies.every(r=>r[0]===self));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

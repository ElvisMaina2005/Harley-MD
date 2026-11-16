const botMode = require('../lib/botMode');
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '../data/group-management.json');
const names = new Set('lock unlock poll grouplink tagadmin invite getgpp getdesc getparticipants listinactive approveall rejectall'.split(' '));
const day = 86400000;
let state;
function load() { if (!state) { try { state = JSON.parse(fs.readFileSync(file)); } catch(e) { if(e.code !== 'ENOENT') throw e; state = {}; } } return state; }
function save() { fs.mkdirSync(path.dirname(file), {recursive:true}); const tmp=file+'.tmp'; fs.writeFileSync(tmp, JSON.stringify(load()), {mode:0o600}); fs.renameSync(tmp,file); }
function group(id) { const s=load(); return s[id] ||= {since:Date.now(), seen:{}, unlockAt:0}; }
function norm(id) { return String(id||'').replace(/:\d+@/,'@'); }
function ids(p) { return [p.id,p.lid,p.phoneNumber].filter(Boolean).map(norm); }
function admin(p) { return p.admin === 'admin' || p.admin === 'superadmin'; }
function matches(p, values) { return ids(p).some(id=>values.includes(id)); }
function botAdmin(sock,m) { return m.participants.some(p=>admin(p)&&matches(p,[sock.user?.id,sock.user?.lid].map(norm))); }
let timer, active, ticking=false; const busy=new Set();
const queued = new Map();
let requestListener;
function enqueue(sock, event) {
 if(active!==sock || !botMode.allowsChat(botMode.read(),event?.id) || event?.action!=='created' || !botMode.group(event.id))return;
 try {
  if(load()[event.id]?.autoApprove!==true)return;
  const jid=event.participant;
  if(typeof jid!=='string'||!botMode.dm(jid))return;
  if(!queued.has(event.id)) {if(queued.size>=1000)return;queued.set(event.id,new Set());}
  const list=queued.get(event.id); if(list.size<1000)list.add(jid);
  void drain(sock,event.id);
 } catch {console.error('Auto approval state unavailable');}
}
async function drain(sock,id) {
 if(active!==sock||busy.has(id))return;
 const list=queued.get(id); if(!list?.size)return;
 busy.add(id);
 try {
  if(!botMode.allowsChat(botMode.read(),id)||load()[id]?.autoApprove!==true){queued.delete(id);return;}
  const m=await sock.groupMetadata(id);
  if(active!==sock||!botMode.allowsChat(botMode.read(),id)||load()[id]?.autoApprove!==true||!botAdmin(sock,m)){queued.delete(id);return;}
  const pending=await sock.groupRequestParticipantsList(id);
  const current=new Set(pending.map(p=>norm(p.jid||p.id)));
  const batch=[...list].slice(0,50); for(const jid of batch)list.delete(jid);
  const eligible=batch.filter(jid=>current.has(norm(jid)));
  if(eligible.length&&active===sock&&botMode.allowsChat(botMode.read(),id)&&load()[id]?.autoApprove===true)await sock.groupRequestParticipantsUpdate(id,eligible,'approve');
 } catch {console.error('Automatic group approval failed; requests may remain pending'); queued.delete(id);}
 finally {if(!list.size&&queued.get(id)===list)queued.delete(id);busy.delete(id);}
}
function approvalText(m,status,mode,counts='') {
 const name=String(m.subject||'Unknown group').replace(/[\r\n\u2028\u2029]/g,' ').slice(0,200);
 return `╭━━━〔 ⚡ 𝐇𝐀𝐑𝐋𝐄𝐘-𝐌𝐃 〕━━━╮\n┃ 🤖 𝐀𝐔𝐓𝐎 𝐀𝐏𝐏𝐑𝐎𝐕𝐀𝐋\n┃\n┃ ${status}\n┃ 🏠 Group: ${name}${counts}\n┃ ⚙️ Mode: ${mode}\n╰━━━━━━━━━━━━━━━━━━╯`;
}
async function approveAll(sock,id,m) {
 const pending=await sock.groupRequestParticipantsList(id);
 if(!pending.length)return approvalText(m,'🟡 Status: NO REQUESTS','Manual','\n┃ 👥 Approved: 0 requests');
 const jids=[...new Set(pending.map(p=>p.jid||p.id).filter(j=>typeof j==='string'&&botMode.dm(j)))];
 let ok=0;
 for(let i=0;i<jids.length;i+=50){
  if(!botMode.allowsChat(botMode.read(),id))break;
  const batch=jids.slice(i,i+50);
  try {const results=await sock.groupRequestParticipantsUpdate(id,batch,'approve');
   if(Array.isArray(results))ok+=Math.min(batch.length,results.filter(r=>String(r.status)==='200').length);
  } catch {break;}
 }
 const failed=Math.max(0,pending.length-ok);
 return approvalText(m,failed?'🟡 Status: '+(ok?'PARTIAL':'NOT CONFIRMED'):'🟢 Status: SUCCESS','Manual',`\n┃ 👥 Approved: ${ok} requests${failed?`\n┃ ⚠️ Unconfirmed: ${failed}`:''}`);
}
function start(sock) { stop(); active=sock; requestListener=event=>enqueue(sock,event); sock.ev.on('group.join-request',requestListener); timer=setInterval(()=>{void tick(sock); for(const id of queued.keys())void drain(sock,id);},15000); timer.unref?.(); void tick(sock); }
function stop(sock) { if(sock && active!==sock)return; clearInterval(timer); if(active&&requestListener)active.ev.off('group.join-request',requestListener); requestListener=null; queued.clear(); active=null; }
async function tick(sock) { if(ticking||active!==sock||botMode.read()==='dms')return; ticking=true; try { for(const [id,g] of Object.entries(load())) { if(active!==sock)break; if(!botMode.allowsChat(botMode.read(),id)||!g.unlockAt||g.unlockAt>Date.now()||busy.has(id))continue; busy.add(id); try { const m=await sock.groupMetadata(id); if(active!==sock||!botMode.allowsChat(botMode.read(),id)||!botAdmin(sock,m))continue; if(m.announce)await sock.groupSettingUpdate(id,'not_announcement'); g.unlockAt=0; save(); await sock.sendMessage(id,{text:'🔓 Scheduled group lock expired.'}); } catch { /* retry next tick */ } finally {busy.delete(id);} } } catch {console.error('Group management state unavailable');} finally {ticking=false;} }
function observe(message) { const id=message.key?.remoteJid; if(!id?.endsWith('@g.us')||message.key.fromMe||!message.key.participant||message.message?.protocolMessage)return; try { const g=load()[id]; if(!g)return; const sender=norm(message.key.participant); const now=Date.now(); if(now-(g.seen[sender]||0)<60000)return; for(const [k,t] of Object.entries(g.seen))if(now-t>90*day)delete g.seen[k]; if(Object.keys(g.seen).length>=5000&&!g.seen[sender])return; g.seen[sender]=now; save(); } catch {console.error('Group activity state unavailable');} }
async function run(sock,id,message,cmd,args) {
 const reply=(text)=>sock.sendMessage(id,{text},{quoted:message});
 if(botMode.group(id)&&!botMode.allowsChat(botMode.read(),id))return;
 if(!id.endsWith('@g.us'))return reply('This command is for groups only.');
 if(busy.has(id))return reply('Another group operation is running. Try again shortly.');
 busy.add(id);
 try {
 const m=await sock.groupMetadata(id); const sender=[message.key.participant,message.key.participantAlt].map(norm); if(message.key.fromMe)sender.push(norm(sock.user?.id),norm(sock.user?.lid));
 if(!m.participants.some(p=>admin(p)&&matches(p,sender)))return reply('Only group admins can use this command.');
 if(!botAdmin(sock,m))return reply('Make the bot a group admin first.');
 const g=group(id);
 switch(cmd) {
 case 'lock': { let duration=0; if(args){const a=/^(\d+)(m|h)$/i.exec(args); if(!a)return reply('Use .lock or .lock 30m / .lock 2h'); duration=Number(a[1])*(a[2].toLowerCase()==='h'?3600000:60000); if(duration<60000||duration>7*day)return reply('Choose 1 minute to 7 days.');} if(duration&&m.announce&&!g.unlockAt)return reply('Group is already locked manually. Unlock it before scheduling a timed lock.'); const old=g.unlockAt; g.unlockAt=duration?Date.now()+duration:0; save(); try{await sock.groupSettingUpdate(id,'announcement');}catch(e){g.unlockAt=old;save();throw e;} return reply(duration?`🔒 Group locked until ${new Date(g.unlockAt).toISOString()} (UTC).`:'🔒 Group locked.'); }
 case 'unlock': await sock.groupSettingUpdate(id,'not_announcement');g.unlockAt=0;save();return reply('🔓 Group unlocked.');
 case 'poll': {const [name,...values]=args.split('|').map(x=>x.trim()); if(!name||name.length>200||values.length<2||values.length>12||values.some(v=>!v||v.length>100)||new Set(values).size!==values.length)return reply('Use .poll Question | Option 1 | Option 2 (2–12 distinct options).');return sock.sendMessage(id,{poll:{name,values,selectableCount:1}});}
 case 'grouplink': case 'invite': {const code=await sock.groupInviteCode(id);return reply(`${cmd==='invite'?'Share this invitation privately with a contact who wants to join:':'Group invitation link:'}\nhttps://chat.whatsapp.com/${code}`);}
 case 'tagadmin': {const mentioned=m.participants.filter(admin).map(p=>p.id);return sock.sendMessage(id,{text:`👮 Group admins\n${args.slice(0,500)}\n${mentioned.map(j=>'@'+j.split('@')[0]).join(' ')}`,mentions:mentioned},{quoted:message});}
 case 'getgpp': {const url=await sock.profilePictureUrl(id,'image');if(!url)return reply('No accessible group photo.');return sock.sendMessage(id,{image:{url},caption:'Group profile picture'},{quoted:message});}
 case 'getdesc': return reply(m.desc||'No group description.');
 case 'getparticipants': return reply(`Group: ${m.subject}\nMembers: ${m.participants.length}\nAdmins: ${m.participants.filter(admin).length}\nOther members: ${m.participants.filter(p=>!admin(p)).length}`);
 case 'listinactive': {const n=args?Number(args):7;if(!Number.isInteger(n)||n<1||n>30)return reply('Use .listinactive 7 (1–30 days).');save();if(Date.now()-g.since<n*day)return reply(`Activity tracking enabled. Wait ${n} days for a meaningful report. Only messages observed by this bot are counted.`);const cutoff=Date.now()-n*day;const candidates=m.participants.filter(p=>!admin(p)&&!ids(p).some(j=>(g.seen[j]||0)>=cutoff));return reply(`No observed messages in ${n} days: ${candidates.length} non-admin members. This is not proof of inactivity: offline periods, new members and identity changes can affect counts.`);}
 case 'approveall': {
 const option=args.trim().toLowerCase();
 if(!option)return reply(await approveAll(sock,id,m));
 if(option!=='on'&&option!=='off')return reply('Use .approveall, .approveall on or .approveall off.');
 const old=g.autoApprove; g.autoApprove=option==='on';
 try{save();}catch(e){g.autoApprove=old;throw e;}
 if(!g.autoApprove)queued.delete(id);
 return reply(approvalText(m,g.autoApprove?'🟢 Status: ENABLED':'🔴 Status: DISABLED',g.autoApprove?'Automatic':'Manual'));
 }
 case 'rejectall': {const pending=await sock.groupRequestParticipantsList(id);if(!pending.length)return reply('No pending requests.');if(args!=='confirm')return reply(`${pending.length} pending requests. Send .${cmd} confirm to process up to 50.`);const action='reject';const batch=pending.slice(0,50).map(p=>p.jid||p.id).filter(Boolean);if(!batch.length)return reply('No usable request identifiers.');const results=await sock.groupRequestParticipantsUpdate(id,batch,action);const ok=Array.isArray(results)?results.filter(r=>String(r.status)==='200').length:0;return reply(`Processed ${batch.length} requests. Confirmed successful: ${ok}. Check pending requests for remaining or failed entries.`);}
 }
 } catch {return reply('Group operation failed. Check bot permissions and WhatsApp support.');} finally {busy.delete(id);}
}
module.exports={names,run,start,stop,observe};

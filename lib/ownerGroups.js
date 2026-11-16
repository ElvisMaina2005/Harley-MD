const mode=require('./botMode');
const lists=new WeakMap();
const clean=s=>String(s||'Unnamed group').replace(/[\r\n\u2028\u2029]/g,' ').slice(0,200);
const frame=lines=>['╭━━━〔 ⚡ 𝐇𝐀𝐑𝐋𝐄𝐘-𝐌𝐃 〕━━━╮',...lines.map(x=>'┃ '+x),'╰━━━━━━━━━━━━━━━━━━╯'].join('\n');
function parse(text,prefix='.') {
 const raw=String(text||'').trim(); const normalized=raw.startsWith('.')?raw:raw.startsWith(prefix)?'.'+raw.slice(prefix.length):'';
 const [cmd,action,...target]=normalized.split(/\s+/);
 if(['.ownermenu','.mygroups'].includes(cmd.toLowerCase())) return {cmd:cmd.toLowerCase()};
 if(cmd.toLowerCase()==='.mode' && target.length) return {cmd:'.mode',action:action.toLowerCase(),target:target.join(' ')};
 return null;
}
async function handle(sock,message,text,prefix) {
 const req=parse(text,prefix); if(!req)return false;
 const jid=message.key.remoteJid;
 if(!message.key.fromMe||!mode.self(sock,jid))return true;
 const reply=lines=>sock.sendMessage(jid,{text:frame(lines)});
 try {
 if(req.cmd==='.ownermenu') {await reply(['🔐 𝐎𝐖𝐍𝐄𝐑 𝐂𝐎𝐍𝐓𝐑𝐎𝐋','','.mygroups','.mode admin <group>','.mode public <group>','.mode private <group>','.mode silent <group>','.mode status <group>','.mode reset <group>','','Global: .mode public/private/groups/dms','🔒 Access: Owner Only']);return true;}
 const groups=Object.entries(await sock.groupFetchAllParticipating()).filter(([id])=>mode.group(id)).map(([id,g])=>({id,name:clean(g.subject),participants:g.participants||[]})).sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
 if(req.cmd==='.mygroups') {
 lists.set(sock,{ids:groups.map(g=>g.id),expires:Date.now()+600000});
 for(let i=0;i<Math.max(1,groups.length);i+=20) await reply(['📋 𝐌𝐘 𝐆𝐑𝐎𝐔𝐏𝐒','',...groups.slice(i,i+20).flatMap((g,j)=>[`${i+j+1}. ${g.name}`,`⚙️ Mode: ${mode.groupMode(g.id)||'Inherited'}`,`👑 Bot Admin: ${g.participants.some(p=>['admin','superadmin'].includes(p.admin)&&[p.id,p.lid,p.phoneNumber].some(id=>mode.self(sock,id)))?'Yes':'No'}`,'']),`Total: ${groups.length}`,'Numbers expire after 10 minutes.']);
 return true;
 }
 if(!['admin','public','private','silent','status','reset'].includes(req.action)){await reply(['Invalid group mode. Use .ownermenu']);return true;}
 let matches;
 if(/^\d+$/.test(req.target)){const list=lists.get(sock);if(!list||list.expires<Date.now()){await reply(['Run .mygroups first.']);return true;}matches=groups.filter(g=>g.id===list.ids[Number(req.target)-1]);}
 else matches=groups.filter(g=>g.id===req.target||g.name.toLowerCase()===req.target.toLowerCase());
 if(matches.length!==1){await reply([matches.length?'Duplicate group name. Use .mygroups and select a number.':'Group not found. Run .mygroups.']);return true;}
 const g=matches[0];
 if(req.action!=='status')mode.setGroup(g.id,req.action==='reset'?null:req.action);
 const selected=mode.groupMode(g.id); const global=mode.read();
 await reply(['⚙️ 𝐆𝐑𝐎𝐔𝐏 𝐌𝐎𝐃𝐄','','🟢 Status: '+(req.action==='status'?'CURRENT':'UPDATED'),'🏠 Group: '+g.name,'👑 Mode: '+(selected||'Inherited').toUpperCase(),'🌐 Global: '+global.toUpperCase(),'⚙️ Effective: '+(global==='dms'||selected==='silent'?'SILENT':global==='private'?'PRIVATE'+(selected==='admin'?' + ADMIN':''):selected||global).toUpperCase(),'🔇 Notification: Private']);
 }catch{await reply(['⚠️ Unable to complete group control. Check connection or saved settings.']);}
 return true;
}
module.exports={parse,handle};

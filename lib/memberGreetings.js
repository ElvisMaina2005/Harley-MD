const botMode = require('./botMode');
const settings = require('./index');
const { lidToMention } = require('./jidHelper');
const queues = new WeakMap();
const WINDOW = 30000;
const defaults = new Set(['Welcome {user} to {group}! 🎉','Goodbye {user} 👋']);
const ids = p => (typeof p === 'string' ? [p] : [p?.phoneNumber,p?.jid,p?.id,p?.lid]).filter(x=>typeof x==='string' && /@(?:s\.whatsapp\.net|c\.us|lid|hosted|hosted\.lid)$/.test(x)).map(x=>x.replace(/:\d+@/,'@'));
const allowed = jid => botMode.group(jid) && botMode.allowsChat(botMode.read(),jid);
const enabled = (kind,jid) => kind==='join' ? settings.isWelcomeOn(jid) : settings.isGoodByeOn(jid);
const compact = (s,n) => Array.from(String(s||'').replace(/\s+/g,' ').trim()).slice(0,n).join('');
function render(kind, members, meta, custom) {
    const join=kind==='join', count=members.length, large=count>10;
    const name=compact(meta.subject,120)||'Group';
    const mentions=[], tags=[];
    if(!large) for(const candidates of members) {
        const p=meta.participants.find(p=>ids(p).some(x=>candidates.includes(x)));
        const m=lidToMention([...ids(p),...candidates]);
        if(m.jid && !mentions.includes(m.jid)) { mentions.push(m.jid); tags.push(m.text || '@'+m.jid.split('@')[0]); }
    }
    const who=large ? `${count} members` : tags.join(', ') || `${count} member${count===1?'':'s'}`;
    const lines=[`╭─〔 👋 𝐖𝐄𝐋𝐂𝐎𝐌𝐄 〕─╮`];
    if(!join) lines[0]='╭─〔 👋 𝐆𝐎𝐎𝐃𝐁𝐘𝐄 〕─╮';
    if(large) lines.push(`┃ ${count} members ${join?'joined':'left'}!`);
    else lines.push(`┃ ${who}`);
    let body=join?`Welcome to ${name}!`:`Thanks for being with us!`;
    if(custom && !defaults.has(custom)) body=compact(custom.replace(/\{user\}/g,()=>large?who:tags.join(', ')||who).replace(/\{group\}/g,()=>name).replace(/\{description\}/g,()=>compact(meta.desc,120)),240)||body;
    lines.push(`┃ ${body}`);
    if(!join || large || (custom && !defaults.has(custom))) lines.push(`┃ 🏠 ${name}`);
    if(count>1 && !large) lines.push(`┃ ${join?'New members':'Members left'}: ${count}`);
    lines.push(`┃ 👥 Members: ${meta.participants.length}`,'╰────────────────╯');
    return {text:lines.join('\n'),mentions};
}
async function enqueue(sock,jid,kind,participants) {
    if(!allowed(jid)||!Array.isArray(participants)) return;
    let state=queues.get(sock);
    if(!state) { state={active:true,batches:new Map()}; queues.set(sock,state); }
    if(!state.active || !await enabled(kind,jid) || !state.active || !allowed(jid)) return;
    const key=jid+':'+kind;
    let batch=state.batches.get(key);
    if(!batch) {
        batch={members:[],timer:null}; state.batches.set(key,batch);
        batch.timer=setTimeout(()=>{state.batches.delete(key); void flush(sock,state,jid,kind,batch).catch(e=>{if(e.code!=='BOT_MODE_BLOCKED') console.error('Member greeting failed:',e.message);});},WINDOW);
        batch.timer.unref?.();
    }
    for(const p of participants) {
        const candidates=ids(p); if(!candidates.length) continue;
        const existing=batch.members.find(a=>a.some(x=>candidates.includes(x)));
        if(existing) { for(const x of candidates) if(!existing.includes(x)) existing.push(x); }
        else batch.members.push(candidates);
    }
}
async function flush(sock,state,jid,kind,batch) {
    if(!batch.members.length||!state.active||!allowed(jid)||!await enabled(kind,jid)) return;
    const meta=await sock.groupMetadata(jid);
    if(!Array.isArray(meta.participants)) return;
    const custom=await (kind==='join'?settings.getWelcome(jid):settings.getGoodbye(jid));
    if(!state.active||!allowed(jid)||!await enabled(kind,jid)||!state.active||!allowed(jid)) return;
    await sock.sendMessage(jid,render(kind,batch.members,meta,custom));
}
function stop(sock) {
    if(!sock) return;
    const state=queues.get(sock); if(!state) return;
    state.active=false; for(const b of state.batches.values()) clearTimeout(b.timer); state.batches.clear();
}
function start(sock) { stop(sock); queues.set(sock,{active:true,batches:new Map()}); }
module.exports={enqueue,start,stop,render};

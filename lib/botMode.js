const fs = require('fs');
const path = require('path');
const modes = new Set(['public','private','groups','dms']);
const file = path.join(__dirname, '../data/bot-mode.json');
const legacy = path.join(__dirname, '../data/messageCount.json');
function read() {
    try { const value = JSON.parse(fs.readFileSync(file,'utf8')).mode; return modes.has(value) ? value : 'dms'; }
    catch (e) { if (e.code !== 'ENOENT') return 'dms'; }
    try { return JSON.parse(fs.readFileSync(legacy,'utf8')).isPublic === false ? 'private' : 'public'; }
    catch (e) { return e.code === 'ENOENT' ? 'public' : 'dms'; }
}
function set(mode) {
    if (!modes.has(mode)) throw new Error('Invalid mode');
    fs.mkdirSync(path.dirname(file), {recursive:true});
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({mode}), {mode:0o600});
    fs.renameSync(tmp,file);
}
const group = jid => typeof jid === 'string' && jid.endsWith('@g.us');
const dm = jid => typeof jid === 'string' && /@(?:s\.whatsapp\.net|lid)$/.test(jid);
const norm = jid => String(jid || '').replace(/:\d+@/,'@');
function self(sock,jid) { return dm(jid) && [sock.user?.id,sock.user?.lid].filter(Boolean).map(norm).includes(norm(jid)); }
function allowsChat(mode,jid) { if (group(jid) && groupMode(jid) === "silent") return false; return mode === 'dms' ? dm(jid) : mode === 'groups' ? group(jid) : true; }
function allowsCommand(mode,jid,privileged,ownerRecovery=false) { return ownerRecovery || (allowsChat(mode,jid) && (mode !== 'private' || privileged)); }
function label() { return ({public:'Public',private:'Private',groups:'Groups',dms:'DMs'})[read()]; }
function install(sock) {
    // Guard at the socket boundary, including delayed callbacks and relayMessage.
    const outgoing = ['sendMessage','relayMessage','sendPresenceUpdate'];
    const mutations = ['groupParticipantsUpdate','groupSettingUpdate','groupRequestParticipantsUpdate','groupUpdateSubject','groupUpdateDescription','groupRevokeInvite','groupLeave','updateProfilePicture','removeProfilePicture','updateBlockStatus'];
    for (const name of [...outgoing,...mutations,'readMessages']) {
        if (typeof sock[name] !== 'function') continue;
        const original = sock[name].bind(sock);
        sock[name] = async (...args) => {
            const mode = read();
            const jid = name === 'sendPresenceUpdate' ? args[1] : args[0];
            const blocked = target => (group(target) && groupMode(target) === "silent") || (mode === 'dms' ? group(target) || target === 'status@broadcast' : mode === 'groups' ? dm(target) && !self(sock,target) || target === 'status@broadcast' : false);
            if (name === 'readMessages') {
                const keys = Array.isArray(args[0]) ? args[0].filter(k => !blocked(k.remoteJid)) : [];
                if (!keys.length) return;
                args[0] = keys;
            } else if (blocked(jid) || (['sendMessage','relayMessage'].includes(name) && (mode === 'dms' && !dm(jid) || mode === 'groups' && !group(jid) && !self(sock,jid)))) { const e = new Error('Operation paused by bot mode'); e.code = 'BOT_MODE_BLOCKED'; throw e; }
            return original(...args);
        };
    }
}
const groupFile = path.join(__dirname,'../data/group-modes.json');
const groupModes = new Set(['admin','public','private','silent']);
function groupState() {
    try { const state=JSON.parse(fs.readFileSync(groupFile,'utf8')); if (!state || typeof state !== 'object' || Array.isArray(state)) throw Error('Invalid group modes'); return state; }
    catch(e) { if(e.code==='ENOENT') return {}; throw e; }
}
function groupMode(jid) { try { const v=groupState()[jid]; return v===undefined ? null : groupModes.has(v)?v:'silent'; } catch { return 'silent'; } }
function setGroup(jid,mode) {
    if(!group(jid)|| (mode!==null&&!groupModes.has(mode))) throw Error('Invalid group mode');
    const state=groupState(); if(mode===null) delete state[jid]; else state[jid]=mode;
    fs.mkdirSync(path.dirname(groupFile),{recursive:true}); fs.writeFileSync(groupFile+'.tmp',JSON.stringify(state),{mode:0o600}); fs.renameSync(groupFile+'.tmp',groupFile);
}
async function groupCommandAllowed(sock,message,privileged) {
    const jid=message.key.remoteJid, mode=groupMode(jid);
    if(!allowsChat(read(),jid)) return false;
    if(mode==='private') return message.key.fromMe===true;
    if(mode!=='admin') return true;
    try {
        const keys=[message.key.participant,message.key.participantAlt];
        if(message.key.fromMe) keys.push(sock.user?.id,sock.user?.lid);
        const identities=keys.filter(dm).map(norm);
        const metadata=await sock.groupMetadata(jid);
        return groupMode(jid)==='admin' && allowsChat(read(),jid) && metadata.participants.some(p=>['admin','superadmin'].includes(p.admin)&&[p.id,p.lid,p.phoneNumber].filter(dm).map(norm).some(id=>identities.includes(id)));
    } catch { return false; }
}
module.exports = {modes,read,set,group,dm,self,allowsChat,allowsCommand,label,install,groupMode,setGroup,groupCommandAllowed};

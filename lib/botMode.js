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
function allowsChat(mode,jid) { return mode === 'dms' ? dm(jid) : mode === 'groups' ? group(jid) : true; }
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
            const blocked = target => mode === 'dms' ? group(target) || target === 'status@broadcast' : mode === 'groups' ? dm(target) && !self(sock,target) || target === 'status@broadcast' : false;
            if (name === 'readMessages') {
                const keys = Array.isArray(args[0]) ? args[0].filter(k => !blocked(k.remoteJid)) : [];
                if (!keys.length) return;
                args[0] = keys;
            } else if (blocked(jid) || (['sendMessage','relayMessage'].includes(name) && (mode === 'dms' && !dm(jid) || mode === 'groups' && !group(jid) && !self(sock,jid)))) { const e = new Error('Operation paused by bot mode'); e.code = 'BOT_MODE_BLOCKED'; throw e; }
            return original(...args);
        };
    }
}
module.exports = {modes,read,set,group,dm,self,allowsChat,allowsCommand,label,install};

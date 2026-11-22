const c = require('../lib/ownerCustomization');
const settings = require('../settings');
const names = new Set(['setbotname','resetbotname','setowner','resetowner','setprefix','prefix','about','setfooter','setchannel','resetchannel','block','unblock','silent']);
async function run(sock,chatId,message,cmd,arg) {
 const send=text=>sock.sendMessage(chatId,{text},{quoted:message});
 const d=c.read();
 if(cmd==='prefix') return send(`Current prefix: ${d.prefix}\nThe dot prefix remains available for compatibility and recovery.`);
 if(cmd==='about') return send(`*${d.name}*\nOwner: ${d.owner}\nVersion: ${settings.version}\nPrefix: ${d.prefix}\nChannel: ${d.channel}\n\n${d.footer}`);
 if(!message.key.fromMe || chatId.endsWith('@g.us')) return send('Only the connected account owner can change these settings in a private chat.');
 const fields={setbotname:['name',60],setowner:['owner',60],setfooter:['footer',120]};
 if(fields[cmd]) {const [key,max]=fields[cmd];const v=c.clean(arg,max);if(!v||arg.length>max)return send(`Provide text of 1–${max} characters.`);c.change(key,v);return send(`Updated ${key}: ${v}`);}
 if(cmd==='resetbotname'||cmd==='resetowner'||cmd==='resetchannel'){const [key,v]=cmd==='resetbotname'?['name',settings.botName||'Harley-MD']:cmd==='resetowner'?['owner',settings.botOwner||'Harley-MD User']:['channel',c.defaultChannel];c.change(key,v);return send(`Restored ${key}: ${v}`);}
 if(cmd==='setprefix'){if(!c.validPrefix(arg))return send('Use one of: . ! # ? $ % & + - : ;');c.change('prefix',arg);return send(`Preferred prefix: ${arg}\nDot commands still work.`);}
 if(cmd==='setchannel'){if(!c.validChannel(arg))return send('Provide a valid https://whatsapp.com/channel/ link.');c.change('channel',arg);return send('Channel link updated.');}
 if(cmd==='silent'){if(!['on','off'].includes(arg.toLowerCase()))return send(`Silent reactions: ${d.silent?'on':'off'}\nUsage: .silent on/off`);c.change('silent',arg.toLowerCase()==='on');return send('Command reactions '+(arg.toLowerCase()==='on'?'disabled.':'enabled.'));}
 if(cmd==='block'||cmd==='unblock'){if(!/^\+?[1-9]\d{7,14}$/.test(arg))return send(`Usage: .${cmd} +2547XXXXXXXX (international number)`);const jid=arg.replace(/^\+/,'')+'@s.whatsapp.net';if(jid.split('@')[0]===String(sock.user?.id||'').split(/[:@]/)[0])return send('Cannot block your own account.');await sock.updateBlockStatus(jid,cmd);return send(`Contact ${cmd==='block'?'blocked':'unblocked'}.`);}
}
module.exports={names,run};

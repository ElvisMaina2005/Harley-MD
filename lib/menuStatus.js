const fs = require('fs');
const path = require('path');
const settings = require('../settings');
const customization = require('./ownerCustomization');
const clean = (s, fallback) => String(s || fallback).replace(/[\r\n\x00-\x1f*_~`]/g, ' ').slice(0, 60);
function mode() { try { return JSON.parse(fs.readFileSync(path.join(__dirname,'../data/messageCount.json'),'utf8')).isPublic === false ? 'Private' : 'Public'; } catch { return 'Public'; } }
function uptime() { const s = Math.floor(process.uptime()); return `${Math.floor(s/86400)}d ${Math.floor(s/3600)%24}h ${Math.floor(s/60)%60}m ${s%60}s`; }
function limit() {
    for (const file of ['/sys/fs/cgroup/memory.max','/sys/fs/cgroup/memory/memory.limit_in_bytes']) {
        try { const n = Number(fs.readFileSync(file,'utf8').trim()); if (Number.isSafeInteger(n) && n > 0 && n < 2**50) return n; } catch {}
    }
    return null;
}
function status(sock) {
    let zone = 'UTC';
    try { zone = require('./timezone').ownerTimezone(sock.user?.id || '').zone; } catch { try { zone = new Intl.DateTimeFormat('en-US',{timeZone:process.env.GREETINGS_TIMEZONE || 'UTC'}).resolvedOptions().timeZone; } catch {} }
    const d = customization.read();
    const rss = process.memoryUsage().rss; const cap = limit();
    const mb = n => (n/1048576).toFixed(1)+' MiB';
    const platform = clean(process.env.HARLEY_HOST_PLATFORM || (process.env.P_SERVER_UUID ? 'Pterodactyl-compatible panel' : process.platform), 'Unknown');
    return { name:clean(d.name,'Harley-MD'), owner:clean(d.owner,'Harley-MD User'), version:clean(settings.version,'Unknown'), mode:mode(), uptime:uptime(), memory:mb(rss), limit:cap ? mb(cap) : 'Not detected', platform, zone, date:new Intl.DateTimeFormat('en-GB',{timeZone:zone,dateStyle:'medium',timeStyle:'medium'}).format(new Date()), node:process.version };
}
const contextInfo = { forwardingScore:1,isForwarded:true,forwardedNewsletterMessageInfo:{newsletterJid:'120363432540825616@newsletter',newsletterName:'Harley-MD',serverMessageId:-1} };
module.exports = { status, clean, contextInfo };

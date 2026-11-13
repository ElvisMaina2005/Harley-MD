const fs = require('fs'); 
const path = require('path');
const { ownerTimezone } = require('./timezone');
const stateFile = path.join(__dirname, '..', 'data', 'greetings.json');
let current = null;
let busy = false;
const morning = ['Start strong, stay focused and make today count! 🏆', 'A new day brings new opportunities. Keep moving forward! 🌻', 'Small steps today can lead to great things tomorrow. ✨'];
const night = ['Rest well and recharge for a fresh tomorrow. 💫', 'Celebrate your progress today and enjoy a peaceful night. ⭐', 'Leave today behind and welcome tomorrow with renewed energy. 🌙'];
function localParts(now, zone) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour)*60+Number(p.minute) };
}
function readState() {
    try { const value = JSON.parse(fs.readFileSync(stateFile, 'utf8')); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid greeting state'); return value; }
    catch (e) { if (e.code === 'ENOENT') return {}; throw e; }
}
function saveState(state) {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    const tmp = stateFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, stateFile);
}
function antideleteStatus() {
    try {
        const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'antidelete.json'), 'utf8'));
        return config?.enabled ? 'Enabled' : 'Disabled';
    } catch { return 'Disabled'; }
}
function buildGreeting(kind, name, zone, now) {
    const am = kind === 'morning';
    const date = new Intl.DateTimeFormat('en-GB', { timeZone: zone, weekday: 'long', day: 'numeric', month: 'long' }).format(now);
    const time = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: true }).format(now);
    const wishes = am ? morning : night;
    const wish = wishes[Number(localParts(now, zone).date.slice(-2)) % wishes.length];
    return [`╭━━〔 ${am ? '☀️ *GOOD MORNING*' : '🌙 *GOOD NIGHT*'} 〕━━╮`, '┃', `┃ 👑 *Owner:* ${name}`, `┃ 📅 *Date:* ${date}`, `┃ ⏰ *Local time:* ${time}`, `┃ 🌍 *Timezone:* ${zone}`, '┃', `┣━━〔 ${am ? '🌻 *DAILY INSPIRATION*' : '💫 *NIGHT MESSAGE*'} 〕`, '┃', `┃ ${wish}`, '┃', '┣━━〔 ⚡ *HARLEY-MD STATUS* 〕', '┃ 🟢 Connection: Online', '┃ 🤖 Bot: Running', `┃ 🛡️ Anti-delete: ${antideleteStatus()}`, '┃ ⏰ Greetings: Active', '╰━━━━━━━━━━━━━━━━━━╯', '', '> 💚 *POWERED BY HARLEY-MD*', '', am ? '_Have a wonderful day!_ ☀️' : '_Have a peaceful night!_ 🌙'].join('\n');
}
async function tick(ctx, now = new Date()) {
    if (current !== ctx || busy) return;
    const p = localParts(now, ctx.zone);
    // Catch up for up to 15 minutes, never send old greetings later in the day.
    const kind = p.minute >= 420 && p.minute < 435 ? 'morning' : p.minute >= 1320 && p.minute < 1335 ? 'night' : null;
    if (!kind) return;
    busy = true;
    try {
        const state = readState();
        const key = `${ctx.jid}:${kind}`;
        if (state[key] === p.date) return;
        // Reserve before sending to avoid duplicates after a crash. A failed send is not retried automatically.
        state[key] = p.date;
        saveState(state);
        if (current !== ctx) return;
        await ctx.sock.sendMessage(ctx.jid, { text: buildGreeting(kind, ctx.name, ctx.zone, now) });
        console.log(`[GREETINGS] ${kind} sent (${ctx.zone})`);
    } catch (e) { console.error('[GREETINGS] Could not send or save greeting:', e?.code || e?.name || 'Error'); }
    finally { busy = false; }
}
function stopDailyGreetings(sock) {
    if (current && (!sock || current.sock === sock)) { clearInterval(current.timer); current = null; }
}
function startDailyGreetings(sock) {
    if (current?.sock === sock) return;
    stopDailyGreetings();
    const raw = String(sock.user?.id || '');
    const jid = raw.replace(/:\d+@/, '@');
    if (!/^\d+@(s\.whatsapp\.net|lid)$/.test(jid)) { console.warn('[GREETINGS] No valid connected owner JID'); return; }
    const { zone, source } = ownerTimezone(jid);
    const name = String(sock.user?.name || sock.user?.verifiedName || 'Owner').replace(/[\r\n*~_`]/g, ' ').trim().slice(0, 60) || 'Owner';
    const ctx = { sock, jid, zone, name };
    current = ctx;
    ctx.timer = setInterval(() => { void tick(ctx); }, 30000);
    console.log(`[GREETINGS] Active | ${zone} (${source}) | 07:00 and 22:00`);
    void tick(ctx);
}
module.exports = { startDailyGreetings, stopDailyGreetings, localParts, buildGreeting };

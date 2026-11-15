const { status, contextInfo } = require('../lib/menuStatus');
const customization = require('../lib/ownerCustomization');
const { performance } = require('node:perf_hooks');

async function aliveCommand(sock, chatId, message) {
    const start = performance.now();
    const s = status(sock);
    const now = new Date();
    const date = new Intl.DateTimeFormat('en-GB', {
        timeZone: s.zone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).format(now);
    const time = new Intl.DateTimeFormat('en-GB', {
        timeZone: s.zone, hour: 'numeric', minute: '2-digit', hour12: true
    }).format(now);
    const ram = parseFloat(s.memory);
    const limit = parseFloat(s.limit);
    const hasLimit = Number.isFinite(limit) && limit > 0 && Number.isFinite(ram);
    const percent = hasLimit ? Math.round(ram / limit * 100) : null;
    const filled = hasLimit ? Math.max(0, Math.min(10, Math.round(percent / 10))) : 0;
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
    const elapsed = (performance.now() - start).toFixed(1);
    const text = [
        `⚡ *${s.name.toUpperCase()}*`,
        '🟢 SYSTEM ONLINE • BOT RESPONDING',
        '',
        '╭───「 *BOT INFORMATION* 」',
        `│ 👑 Owner: ${s.owner}`,
        `│ 📦 Version: ${s.version}`,
        `│ ⚙️ Mode: ${s.mode}`,
        `│ 🖥️ Host: ${s.platform}`,
        `│ 🌍 Zone: ${s.zone}`,
        '╰─────────────────',
        '',
        '╭───「 *PERFORMANCE* 」',
        `│ ⏳ Uptime: ${s.uptime}`,
        `│ ⚡ Processing: ${elapsed} ms`,
        `│ 💾 RAM: ${s.memory}`,
        `│ 📊 Limit: ${s.limit}`,
        ...(hasLimit ? [`│ ${bar} ${percent}%`] : []),
        '╰─────────────────',
        '',
        '╭───「 *DATE & TIME* 」',
        `│ 📅 ${date}`,
        `│ 🕒 ${time}`,
        '╰─────────────────',
        '',
        `*${customization.read().footer}*`
    ].join('\n');
    await sock.sendMessage(chatId, { text, contextInfo }, { quoted: message });
}
module.exports = aliveCommand;

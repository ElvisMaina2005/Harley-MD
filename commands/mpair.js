const axios = require('axios');
const BASE = 'https://harley-md-pair.onrender.com';
const active = new Set();
const cooldown = new Map();
const MAX_ACTIVE = 5;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const phone = jid => /^(\d{7,15})(?::\d+)?@s\.whatsapp\.net$/.exec(jid || '')?.[1];
const normalize = jid => String(jid || '').replace(/:\d+@/, '@');
const privateJid = jid => /^\d+(?::\d+)?@(s\.whatsapp\.net|lid)$/.test(jid || '');

// Use only identities supplied by the authenticated WhatsApp connection.
// Never accept a phone number from command text or a quoted message.
async function ownNumber(sock, chatId, message) {
    const key = message.key || {};
    if (key.fromMe) {
        const self = [sock.user?.id, sock.user?.lid].filter(Boolean).map(normalize);
        if (!self.includes(normalize(chatId))) return null;
        return phone(sock.user?.id) || phone(chatId) || null;
    }
    if (phone(chatId)) return phone(chatId);
    if (chatId.endsWith('@lid')) {
        if (phone(key.remoteJidAlt)) return phone(key.remoteJidAlt);
        const mapping = sock.signalRepository?.lidMapping;
        if (typeof mapping?.getPNForLID === 'function') {
            try { return phone(await mapping.getPNForLID(chatId)) || null; } catch { return null; }
        }
    }
    return null;
}

async function waitForSession(sock, chatId, id) {
    const deadline = Date.now() + 16 * 60 * 1000;
    const url = `${BASE}/session/${id}`;
    while (Date.now() < deadline) {
        await sleep(5000);
        let status;
        try {
            const response = await axios.get(url, { timeout: 20000, maxRedirects: 0 });
            status = response.data?.status;
        } catch { continue; }
        if (status === 'failed' || status === 'not_found') {
            await sock.sendMessage(chatId, { text: 'Pairing expired or failed. Send .mpair again to retry.' });
            return;
        }
        if (status !== 'ready') continue;
        // This endpoint consumes the website copy once. The server's private
        // backup link is independent and can be used if delivery fails.
        const response = await axios.get(`${url}/fetch`, { timeout: 30000, maxRedirects: 0, maxContentLength: 16 * 1024 * 1024 });
        const session = response.data?.session;
        if (response.data?.status !== 'ready' || typeof session !== 'string' || !session.startsWith('HARLEY-MD:~')) {
            throw new Error('Session unavailable');
        }
        await sock.sendMessage(chatId, {
            document: Buffer.from(session, 'utf8'),
            mimetype: 'text/plain',
            fileName: 'Harley-MD-Session.txt',
            caption: '*✅ HARLEY-MD PAIRING SUCCESSFUL*\n\nYour session ID is in this file. Keep it private: it grants access to your linked WhatsApp account. Use it only on a bot host you trust.\n\nPairing does not automatically start a hosted bot.'
        });
        return;
    }
    await sock.sendMessage(chatId, { text: 'Pairing timed out. If you linked successfully, check your own WhatsApp chat for the private backup link. Otherwise send .mpair again.' });
}

async function mpairCommand(sock, chatId, message, args = '') {
    const reply = text => sock.sendMessage(chatId, { text }, { quoted: message });
    if (!privateJid(chatId)) return reply('🔒 Please send .mpair in a private chat with the bot. Pairing codes are never sent to groups.');
    if (args.trim()) return reply('Use .mpair without a phone number. Only your own WhatsApp account can be paired.');
    const number = await ownNumber(sock, chatId, message);
    if (!number) return reply('I could not safely identify your own phone number. Use .pair to pair through the website. If you are the bot owner, try .mpair in your WhatsApp self-chat.');
    const now = Date.now();
    for (const [n, until] of cooldown) if (until <= now) cooldown.delete(n);
    if (active.has(number)) return reply('A pairing request is already active for your account. Finish it or wait for it to expire.');
    if (cooldown.has(number)) return reply('Please wait a minute before requesting another pairing code.');
    if (active.size >= MAX_ACTIVE) return reply('The pairing service is busy. Please try again shortly.');
    active.add(number);
    cooldown.set(number, now + 60000);
    let background = false;
    try {
        await reply('*🔗 HARLEY-MD MOBILE PAIRING*\n\nGenerating a code for your own account. Please wait; the server may need to wake up.');
        const response = await axios.get(`${BASE}/code`, { params: { number }, timeout: 90000, maxRedirects: 0 });
        const { id, code } = response.data || {};
        if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id) || typeof code !== 'string' || !/^[A-Z0-9]{4}-?[A-Z0-9]{4}$/i.test(code)) throw new Error('Invalid pairing response');
        await reply('*🔐 HARLEY-MD PAIRING CODE*\n\n' + code + '\n\nOpen WhatsApp > Linked devices > Link a device > Link with phone number instead. Enter this code only if you requested it.\n\nNever share this code. Your session file will arrive here after successful linking.');
        background = true;
        void waitForSession(sock, chatId, id).catch(async () => {
            console.warn('[MPAIR] Session retrieval or delivery failed');
            try { await sock.sendMessage(chatId, { text: 'Could not deliver your session file. If pairing succeeded, check your own WhatsApp chat for the private backup link. Otherwise try .mpair again.' }); } catch {}
        }).finally(() => active.delete(number));
    } catch {
        console.warn('[MPAIR] Pairing request failed');
        await reply('Could not generate a pairing code. Please try again later or use .pair.');
    } finally {
        if (!background) active.delete(number);
    }
}
module.exports = mpairCommand;

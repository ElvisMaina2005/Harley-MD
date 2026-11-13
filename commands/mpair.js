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

async function waitForSession(sock, chatId, id, backupUrl) {
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
            caption: '*✅ HARLEY-MD | SESSION READY*\n\nYour session file is ready. Use it on a trusted bot host.\n🔒 Keep this file private.\n\n_Harley-MD • Pairing complete_'
        });
        return;
    }
    await sock.sendMessage(chatId, { text: 'Pairing timed out. If linked, recover your session privately:\n' + (backupUrl || 'Check your self-chat for the backup link.') + '\nOtherwise send .mpair again.' });
}

// Deliver the reliable text first. Native flow is optional and must never
// block the pairing/session workflow, even if WhatsApp silently drops it.
async function sendPairingCode(sock, chatId, message, code) {
    const text = '*🔐 HARLEY-MD | PAIRING*\n\n*Code:*\n```' + code + '```\n\nWhatsApp → Linked Devices → Link a Device → Link with phone number instead.\n\n🔒 Keep your code private.';
    await withTimeout(sock.sendMessage(chatId, { text }, { quoted: message }), 20000, 'Code delivery');
}
async function sendOptionalCopyButton(sock, chatId, code) {
    const { generateWAMessageFromContent, proto } = await import('@whiskeysockets/baileys');
    const interactive = proto.Message.InteractiveMessage.create({
        header: { title: 'HARLEY-MD | PAIRING', hasMediaAttachment: false },
        body: { text: 'Tap below to copy your pairing code.' },
        footer: { text: 'Keep your pairing code private.' },
        nativeFlowMessage: {
            messageVersion: 1,
            buttons: [{
                name: 'cta_copy',
                buttonParamsJson: JSON.stringify({ display_text: 'Copy Code', copy_code: code })
            }]
        }
    });
    const outgoing = generateWAMessageFromContent(chatId, {
        viewOnceMessage: { message: {
            messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
            interactiveMessage: interactive
        } }
    }, { userJid: sock.user.id });
    console.log('[MPAIR] Relaying native copy button');
    await sock.relayMessage(chatId, outgoing.message, {
        messageId: outgoing.key.id,
        additionalNodes: [{
            tag: 'biz', attrs: {}, content: [{
                tag: 'interactive', attrs: { type: 'native_flow', v: '1' },
                content: [{ tag: 'native_flow', attrs: { name: 'cta_copy', v: '1' } }]
            }]
        }]
    });
    console.log('[MPAIR] Copy button relay completed (client rendering unconfirmed)');
}
function withTimeout(promise, ms, label) {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(label + ' timed out')), ms);
    })]).finally(() => clearTimeout(timer));
}

async function mpairCommand(sock, chatId, message, args = '') {
    const reply = text => sock.sendMessage(chatId, { text }, { quoted: message });
    if (!privateJid(chatId)) return reply('🔒 Please send .mpair in a private chat with the bot. Pairing codes are never sent to groups.');
    if (args.trim()) return reply('Use .mpair without a phone number. Only your own WhatsApp account can be paired.');
    let number;
    try { number = await withTimeout(ownNumber(sock, chatId, message), 10000, 'Identity lookup'); }
    catch { return reply('Could not identify your account in time. Please try again or use .pair.'); }
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
        console.log('[MPAIR] Requesting pairing code');
        const response = await withTimeout(axios.get(`${BASE}/code`, { params: { number, delivery: 'mobile' }, timeout: 90000, maxRedirects: 0, signal: AbortSignal.timeout(90000) }), 95000, 'Pairing API');
        const { id, code, backupToken } = response.data || {};
        if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id) || typeof code !== 'string' || !/^[A-Z0-9]{4}-?[A-Z0-9]{4}$/i.test(code)) throw new Error('Invalid pairing response');
        const backupUrl = typeof backupToken === 'string' && /^[a-f0-9]{64}$/.test(backupToken) ? `${BASE}/backup#${backupToken}` : null;
        console.log('[MPAIR] Code received; sending text');
        await sendPairingCode(sock, chatId, message, code);
        console.log('[MPAIR] Code sent; waiting for linking');
        // Best effort only: the code is already visible in the reliable text.
        void withTimeout(sendOptionalCopyButton(sock, chatId, code), 8000, 'Copy button').catch(error => {
            const reason = error?.message === 'Copy button timed out' ? 'timeout' : error?.name === 'TypeError' ? 'TypeError' : 'relay or construction error';
            console.warn('[MPAIR] Optional copy button unavailable: ' + reason + '; text code already sent');
        });
        background = true;
        void waitForSession(sock, chatId, id, backupUrl).catch(async () => {
            console.warn('[MPAIR] Session retrieval or delivery failed');
            try { await sock.sendMessage(chatId, { text: 'Session delivery failed. If linked, recover your session privately:\n' + (backupUrl || 'Check your self-chat for the backup link.') + '\nOtherwise try .mpair again.' }); } catch {}
        }).finally(() => active.delete(number));
    } catch (error) {
        console.warn('[MPAIR] Pairing request failed:', error?.code === 'ECONNABORTED' ? 'API timeout' : error?.response?.status ? 'HTTP ' + error.response.status : 'Request or delivery failed');
        await reply('Could not generate a pairing code. Please try again later or use .pair.');
    } finally {
        if (!background) active.delete(number);
    }
}
module.exports = mpairCommand;

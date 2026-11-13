const PAIR_URL = 'https://harley-md-pair.onrender.com/';

async function pairCommand(sock, chatId, message) {
    await sock.sendMessage(chatId, {
        text: '*🔗 HARLEY-MD PAIRING*\n\nConnect your own WhatsApp account using our pairing website:\n' + PAIR_URL + '\n\nFor pairing directly in WhatsApp, send .mpair in a private chat with the bot.\n\nOnly link your own account. Never share your pairing code or session ID.'
    }, { quoted: message });
}
module.exports = pairCommand;

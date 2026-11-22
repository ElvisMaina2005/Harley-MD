const { handleGoodbye } = require('../lib/welcome');
const greetings = require('../lib/memberGreetings');

async function goodbyeCommand(sock, chatId, message, match) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: 'This command can only be used in groups.' });
        return;
    }

    const text = message.message?.conversation ||
                message.message?.extendedTextMessage?.text || '';
    const matchText = text.split(' ').slice(1).join(' ');

    await handleGoodbye(sock, chatId, message, matchText);
}

async function handleLeaveEvent(sock,id,participants) {
    return greetings.enqueue(sock,id,'leave',participants);
}
module.exports = { goodbyeCommand, handleLeaveEvent };

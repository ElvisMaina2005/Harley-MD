const { handleWelcome } = require('../lib/welcome');
const greetings = require('../lib/memberGreetings');

async function welcomeCommand(sock, chatId, message, match) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: 'This command can only be used in groups.' });
        return;
    }

    const text = message.message?.conversation ||
                message.message?.extendedTextMessage?.text || '';
    const matchText = text.split(' ').slice(1).join(' ');

    await handleWelcome(sock, chatId, message, matchText);
}

async function handleJoinEvent(sock,id,participants) {
    return greetings.enqueue(sock,id,'join',participants);
}
module.exports = { welcomeCommand, handleJoinEvent };

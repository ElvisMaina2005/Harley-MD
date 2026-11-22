const prefs = require('../lib/menuState');
let imageBusy = false;
async function menuSettingsCommand(sock, chatId, message, command, args) {
    const reply = text => sock.sendMessage(chatId,{text},{quoted:message});
    if (!message.key?.fromMe || chatId.endsWith('@g.us') || chatId === 'status@broadcast') return reply('Only the connected account owner can change menu settings in a private chat.');
    if (command === 'restoremenuimage') {
        if (imageBusy) return reply('An image update is in progress. Try again shortly.');
        prefs.restore(); return reply('Custom menu image removed. Default image restored if available.');
    }
    if (command !== 'setmenuimage') return;
    if (imageBusy) return reply('An image update is in progress. Try again shortly.');
    const image = message.message?.imageMessage || message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    if (!image) return reply('Reply to a normal JPEG/PNG image with .setmenuimage. Maximum 5 MiB.');
    if (Number(image.fileLength || 0) > 5*1024*1024) return reply('Image is too large. Maximum 5 MiB.');
    imageBusy = true;
    try {
        const { downloadContentFromMessage } = await import('@whiskeysockets/baileys');
        const stream = await downloadContentFromMessage(image,'image');
        const chunks=[]; let total=0;
        const timer = setTimeout(()=>stream.destroy(new Error('Download timeout')),30000);
        try { for await (const chunk of stream) { total+=chunk.length; if(total>5*1024*1024) { stream.destroy(); throw new Error('Image too large'); } chunks.push(chunk); } } finally { clearTimeout(timer); }
        const sharp = require('sharp');
        const input = Buffer.concat(chunks);
        const pipeline = sharp(input,{limitInputPixels:16000000,failOn:'error'});
        const meta = await pipeline.metadata();
        if (!['jpeg','png'].includes(meta.format)) throw new Error('Unsupported format');
        const output = await pipeline.rotate().resize(1200,1200,{fit:'inside',withoutEnlargement:true}).jpeg({quality:82}).toBuffer();
        prefs.setImage(output);
        await reply('Menu image saved. Use .menu to view it.');
    } catch { await reply('Could not save the image. Use a valid JPEG/PNG under 5 MiB and try again.'); }
    finally { imageBusy=false; }
}
module.exports = menuSettingsCommand;

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { execFile } = require('child_process'); 

// FFmpeg does not need WhatsApp credentials or the large SESSION_ID.
function runFFmpeg(args) {
    const env = {};
    for (const key of ['PATH', 'HOME', 'LANG', 'LC_ALL', 'LD_LIBRARY_PATH', 'SystemRoot', 'TEMP', 'TMP']) {
        if (process.env[key] !== undefined) env[key] = process.env[key];
    }
    return new Promise((resolve, reject) => {
        execFile('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...args],
            { env, timeout: 120000, maxBuffer: 1024 * 1024 },
            (error) => error ? reject(error) : resolve());
    });
}

function convertSticker(input, output, { size = 512, fps, duration, quality = 75 } = {}) {
    const filter = `scale=${size}:${size}:force_original_aspect_ratio=decrease,${fps ? `fps=${fps},` : 'format=rgba,'}pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=0x00000000`;
    return runFFmpeg(['-i', input, ...(duration ? ['-t', String(duration)] : []), '-an', '-vf', filter, '-c:v', 'libwebp', '-preset', 'default', '-loop', '0', '-pix_fmt', 'yuva420p', '-quality', String(quality), '-compression_level', '6', ...(fps ? [] : ['-frames:v', '1']), output]);
}
const fs = require('fs');
const path = require('path');
const settings = require('../settings');
const webp = require('node-webpmux');
const crypto = require('crypto');

async function stickerCommand(sock, chatId, message) {
    // The message that will be quoted in the reply.
    const messageToQuote = message;
    
    // The message object that contains the media to be downloaded.
    let targetMessage = message;

    // If the message is a reply, the target media is in the quoted message.
    if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        // We need to build a new message object for downloadMediaMessage to work correctly.
        const quotedInfo = message.message.extendedTextMessage.contextInfo;
        targetMessage = {
            key: {
                remoteJid: chatId,
                id: quotedInfo.stanzaId,
                participant: quotedInfo.participant
            },
            message: quotedInfo.quotedMessage
        };
    }

    const mediaMessage = targetMessage.message?.imageMessage || targetMessage.message?.videoMessage || targetMessage.message?.documentMessage;

    if (!mediaMessage) {
        await sock.sendMessage(chatId, { 
            text: 'Please reply to an image/video with .sticker, or send an image/video with .sticker as the caption.',
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363432540825616@newsletter',
                    newsletterName: 'Harley-MD',
                    serverMessageId: -1
                }
            }
        },{ quoted: messageToQuote });
        return;
    }

    let workDir;
    try {
        const mediaBuffer = await downloadMediaMessage(targetMessage, 'buffer', {}, { 
            logger: undefined, 
            reuploadRequest: sock.updateMediaMessage 
        });

        if (!mediaBuffer) {
            await sock.sendMessage(chatId, { 
                text: 'Failed to download media. Please try again.',
                contextInfo: {
                    forwardingScore: 999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363432540825616@newsletter',
                        newsletterName: 'Harley-MD',
                        serverMessageId: -1
                    }
                }
            });
            return;
        }

        const tmpDir = path.join(process.cwd(), 'tmp');
        fs.mkdirSync(tmpDir, { recursive: true });
        workDir = fs.mkdtempSync(path.join(tmpDir, 'sticker-'));
        const tempInput = path.join(workDir, 'input');
        const tempOutput = path.join(workDir, 'output.webp');
        fs.writeFileSync(tempInput, mediaBuffer);

        const isAnimated = mediaMessage.mimetype?.includes('gif') ||
                           mediaMessage.mimetype?.includes('video') ||
                           mediaMessage.seconds > 0;
        await convertSticker(tempInput, tempOutput, isAnimated ? { fps: 15, duration: 10 } : {});
        let webpBuffer = fs.readFileSync(tempOutput);
        if (isAnimated && webpBuffer.length > 1000 * 1024) {
            const fallback = path.join(workDir, 'fallback.webp');
            const large = mediaBuffer.length > 5000 * 1024;
            try {
                await convertSticker(tempInput, fallback, { fps: large ? 8 : 12, duration: large ? 2 : 3, quality: large ? 30 : 45 });
                const compressed = fs.readFileSync(fallback);
                if (compressed.length < webpBuffer.length) webpBuffer = compressed;
            } catch (error) { console.warn('Sticker compression fallback failed:', error.code || error.message); }
        }

        // Add metadata using webpmux
        const img = new webp.Image();
        await img.load(webpBuffer);

        // Create metadata
        const json = {
            'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
            'sticker-pack-name': settings.packname || 'Harley-MD',
            'emojis': ['🤖']
        };

        // Create exif buffer
        const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
        const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
        const exif = Buffer.concat([exifAttr, jsonBuffer]);
        exif.writeUIntLE(jsonBuffer.length, 14, 4);

        // Set the exif data
        img.exif = exif;

        // Get the final buffer with metadata
        let finalBuffer = await img.save(null);

        // Final safety: if still too large, make a tiny 320/256px pass
        if (isAnimated && finalBuffer.length > 900 * 1024) {
            try {
                const tempOutput3 = path.join(workDir, 'small.webp');
                await convertSticker(tempInput, tempOutput3, { size: 320, fps: 8, duration: 2, quality: 30 });
                if (fs.existsSync(tempOutput3)) {
                    const smallWebp = fs.readFileSync(tempOutput3);
                    const img2 = new webp.Image();
                    await img2.load(smallWebp);
                    const json2 = {
                        'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
                        'sticker-pack-name': settings.packname || 'Harley-MD',
                        'emojis': ['🤖']
                    };
                    const exifAttr2 = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
                    const jsonBuffer2 = Buffer.from(JSON.stringify(json2), 'utf8');
                    const exif2 = Buffer.concat([exifAttr2, jsonBuffer2]);
                    exif2.writeUIntLE(jsonBuffer2.length, 14, 4);
                    img2.exif = exif2;
                    const smaller = await img2.save(null);
                    if (smaller.length < finalBuffer.length) finalBuffer = smaller;
                    try { fs.unlinkSync(tempOutput3); } catch {}
                }
            } catch {}
        }

        // Send the sticker
        await sock.sendMessage(chatId, { 
            sticker: finalBuffer
        },{ quoted: messageToQuote });

    } catch (error) {
        console.error('Error in sticker command:', error.code || error.message);
        await sock.sendMessage(chatId, { 
            text: 'Failed to create sticker! Try again later.',
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363432540825616@newsletter',
                    newsletterName: 'Harley-MD',
                    serverMessageId: -1
                }
            }
        });
    } finally {
        if (workDir) {
            try { fs.rmSync(workDir, { recursive: true, force: true }); }
            catch (error) { console.warn('Sticker cleanup failed:', error.code || error.message); }
        }
    }
}

module.exports = stickerCommand;

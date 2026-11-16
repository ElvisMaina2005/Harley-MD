const ownerGroups = require('./lib/ownerGroups');
const botMode = require('./lib/botMode');
// 🧹 Fix for ENOSPC / temp overflow in hosted panels
const fs = require('fs');
const path = require('path');

// Redirect temp storage away from system /tmp
const customTemp = path.join(process.cwd(), 'temp');
if (!fs.existsSync(customTemp)) fs.mkdirSync(customTemp, { recursive: true });
process.env.TMPDIR = customTemp;
process.env.TEMP = customTemp;
process.env.TMP = customTemp;

// Auto-cleaner every 3 hours
setInterval(() => {
    fs.readdir(customTemp, (err, files) => {
        if (err) return;
        for (const file of files) {
            const filePath = path.join(customTemp, file);
            fs.stat(filePath, (err, stats) => {
                if (!err && Date.now() - stats.mtimeMs > 3 * 60 * 60 * 1000) {
                    fs.unlink(filePath, () => { });
                }
            });
        }
    });
    console.log('🧹 Temp folder auto-cleaned');
}, 3 * 60 * 60 * 1000);

const settings = require('./settings');
const analytics = require('./lib/analytics');
require('./config.js');
const { isBanned } = require('./lib/isBanned');
const yts = require('yt-search');
const { fetchBuffer } = require('./lib/myfunc');
const fetch = require('node-fetch');
const ytdl = require('ytdl-core');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const { isSudo } = require('./lib/index');
const isOwnerOrSudo = require('./lib/isOwner');
const { autotypingCommand, isAutotypingEnabled, handleAutotypingForMessage, handleAutotypingForCommand, showTypingAfterCommand } = require('./commands/autotyping');
const { autoreadCommand, isAutoreadEnabled, handleAutoread } = require('./commands/autoread');

// Command imports
const tagAllCommand = require('./commands/tagall');
const helpCommand = require('./commands/help');
const groupManagement = require('./commands/groupManagement');
const moderation = require('./commands/moderation');
const automation = require('./commands/automation');
const sports = require('./commands/sports');
const ownerCustomization = require('./commands/ownerCustomization');
const customization = require('./lib/ownerCustomization');
const menuSettingsCommand = require('./commands/menuSettings');
const banCommand = require('./commands/ban');
const { promoteCommand } = require('./commands/promote');
const { demoteCommand } = require('./commands/demote');
const muteCommand = require('./commands/mute');
const unmuteCommand = require('./commands/unmute');
const stickerCommand = require('./commands/sticker');
const isAdmin = require('./lib/isAdmin');
const warnCommand = require('./commands/warn');
const warningsCommand = require('./commands/warnings');
const ttsCommand = require('./commands/tts');
const { tictactoeCommand, handleTicTacToeMove } = require('./commands/tictactoe');
const { incrementMessageCount, topMembers } = require('./commands/topmembers');
const ownerCommand = require('./commands/owner');
const deleteCommand = require('./commands/delete');
const { handleAntilinkCommand, handleLinkDetection } = require('./commands/antilink');
const { handleAntitagCommand, handleTagDetection } = require('./commands/antitag');
const { Antilink } = require('./lib/antilink');
const { handleMentionDetection, mentionToggleCommand, setMentionCommand } = require('./commands/mention');
const memeCommand = require('./commands/meme');
const tagCommand = require('./commands/tag');
const tagNotAdminCommand = require('./commands/tagnotadmin');
const hideTagCommand = require('./commands/hidetag');
const jokeCommand = require('./commands/joke');
const quoteCommand = require('./commands/quote');
const factCommand = require('./commands/fact');
const weatherCommand = require('./commands/weather');
const newsCommand = require('./commands/news');
const kickCommand = require('./commands/kick');
const simageCommand = require('./commands/simage');
const attpCommand = require('./commands/attp');
const { startHangman, guessLetter } = require('./commands/hangman');
const { startTrivia, answerTrivia } = require('./commands/trivia');
const { complimentCommand } = require('./commands/compliment');
const { insultCommand } = require('./commands/insult');
const { eightBallCommand } = require('./commands/eightball');
const { lyricsCommand } = require('./commands/lyrics');
const { dareCommand } = require('./commands/dare');
const { truthCommand } = require('./commands/truth');
const { clearCommand } = require('./commands/clear');
const pingCommand = require('./commands/ping');
const aliveCommand = require('./commands/alive');
const blurCommand = require('./commands/img-blur');
const { welcomeCommand, handleJoinEvent } = require('./commands/welcome');
const { goodbyeCommand, handleLeaveEvent } = require('./commands/goodbye');
const githubCommand = require('./commands/github');
const { handleAntiBadwordCommand, handleBadwordDetection } = require('./lib/antibadword');
const antibadwordCommand = require('./commands/antibadword');
const { handleChatbotCommand, handleChatbotResponse } = require('./commands/chatbot');
const takeCommand = require('./commands/take');
const { flirtCommand } = require('./commands/flirt');
const characterCommand = require('./commands/character');
const wastedCommand = require('./commands/wasted');
const shipCommand = require('./commands/ship');
const groupInfoCommand = require('./commands/groupinfo');
const resetlinkCommand = require('./commands/resetlink');
const staffCommand = require('./commands/staff');
const unbanCommand = require('./commands/unban');
const emojimixCommand = require('./commands/emojimix');
const { handlePromotionEvent } = require('./commands/promote');
const { handleDemotionEvent } = require('./commands/demote');
const viewOnceCommand = require('./commands/viewonce');
const vv2Command = require('./commands/vv2');
const clearSessionCommand = require('./commands/clearsession');
const { autoStatusCommand, handleStatusUpdate } = require('./commands/autostatus');
const savestatusCommand = require('./commands/savestatus');
const { autoSave: savestatusAutoSave } = savestatusCommand;
const groupstatusCommand = require('./commands/groupstatus');
const antibotCommand = require('./commands/antibot');
const { handleAntibotDetection } = antibotCommand;
const { simpCommand } = require('./commands/simp');
const { stupidCommand } = require('./commands/stupid');
const stickerTelegramCommand = require('./commands/stickertelegram');
const textmakerCommand = require('./commands/textmaker');
const { handleAntideleteCommand, handleMessageRevocation, storeMessage } = require('./commands/antidelete');
const clearTmpCommand = require('./commands/cleartmp');
const setProfilePicture = require('./commands/setpp');
const { setGroupDescription, setGroupName, setGroupPhoto } = require('./commands/groupmanage');
const instagramCommand = require('./commands/instagram');
const facebookCommand = require('./commands/facebook');
const twitterCommand = require('./commands/twitter');
const spotifyCommand = require('./commands/spotify');
const playCommand = require('./commands/play');
const tiktokCommand = require('./commands/tiktok');
const songCommand = require('./commands/song');
const aiCommand = require('./commands/ai');
const urlCommand = require('./commands/url');
const { handleTranslateCommand } = require('./commands/translate');
const { handleSsCommand } = require('./commands/ss');
const { addCommandReaction, handleAreactCommand } = require('./lib/reactions');
const { goodnightCommand } = require('./commands/goodnight');
const { shayariCommand } = require('./commands/shayari');
const { rosedayCommand } = require('./commands/roseday');
const imagineCommand = require('./commands/imagine');
const videoCommand = require('./commands/video');
const sudoCommand = require('./commands/sudo');
const { miscCommand, handleHeart } = require('./commands/misc');
const { animeCommand } = require('./commands/anime');
const { piesCommand, piesAlias } = require('./commands/pies');
const stickercropCommand = require('./commands/stickercrop');
const updateCommand = require('./commands/update');
const removebgCommand = require('./commands/removebg');
const { reminiCommand } = require('./commands/remini');
const { igsCommand } = require('./commands/igs');
const { anticallCommand, readState: readAnticallState } = require('./commands/anticall');
const { pmblockerCommand, readState: readPmBlockerState } = require('./commands/pmblocker');
const settingsCommand = require('./commands/settings');
const soraCommand = require('./commands/sora');
const pairCommand = require('./commands/pair');
const mpairCommand = require('./commands/mpair');

// Global settings
global.packname = settings.packname;
global.author = settings.author;
global.channelLink = "https://whatsapp.com/channel/0029VbF1pVnInlqWtDAR6O0Q";
global.ytch = "Elvis";

// Add this near the top of main.js with other global configurations
const channelInfo = {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363432540825616@newsletter',
            newsletterName: 'Harley-MD',
            serverMessageId: -1
        }
    }
};

async function handleMessages(sock, messageUpdate, printLog) {
    let chatId;
    let analyticsCommand = null;
    let analyticsSuccess = true;
    try {
        const { messages, type } = messageUpdate;
        let message = messages[0];
        if (!message?.message) return;
        if (type !== 'notify') return;

        chatId = message.key?.remoteJid;
        if (!chatId) return;
        const mode = botMode.read();
        const recoveryChat = mode === 'groups' && message.key.fromMe && botMode.self(sock,chatId);
        if (!botMode.allowsChat(mode,chatId) && !recoveryChat) return;
        const controlText = message.message.conversation || message.message.extendedTextMessage?.text || message.message.imageMessage?.caption || message.message.videoMessage?.caption || "";
        if (await ownerGroups.handle(sock,message,controlText,customization.read().prefix)) return;
        if (recoveryChat) {
            const text = (message.message.conversation || message.message.extendedTextMessage?.text || '').trim().toLowerCase();
            const prefix = customization.read().prefix;
            if (!/^\.mode(?:\s|$)/.test(text) && !(text.startsWith(prefix) && /^mode(?:\s|$)/.test(text.slice(prefix.length).trimStart()))) return;
        }
        // Handle autoread functionality
        await handleAutoread(sock, message);

        // Store message for antidelete feature
        if (message.message) {
            storeMessage(sock, message);
        }

        // Handle message revocation
        if (message.message?.protocolMessage?.type === 0) {
            await handleMessageRevocation(sock, message);
            return;
        }

        chatId = message.key?.remoteJid;
        if (!chatId) return;
        const senderId = message.key.participant || message.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        if (isGroup) { groupManagement.observe(message); if (await moderation.observe(sock, message)) return; }
        const senderIsSudo = await isSudo(senderId);
        const senderIsOwnerOrSudo = await isOwnerOrSudo(senderId, sock, chatId);

        const groupAccess = !isGroup || await botMode.groupCommandAllowed(sock,message,senderIsOwnerOrSudo);
        // Handle button responses
        if (message.message?.buttonsResponseMessage) {
            if (!groupAccess || (mode === 'private' && !message.key.fromMe && !senderIsOwnerOrSudo)) return;
            const buttonId = message.message.buttonsResponseMessage.selectedButtonId;
            const chatId = message.key.remoteJid;

            if (buttonId === 'channel') {
                await sock.sendMessage(chatId, {
                    text: '📢 *Join our Channel:*\n' + customization.read().channel
                }, { quoted: message });
                return;
            } else if (buttonId === 'owner') {
                const ownerCommand = require('./commands/owner');
                await ownerCommand(sock, chatId);
                return;
            } else if (buttonId === 'support') {
                await sock.sendMessage(chatId, {
                    text: `🔗 *Support*\n\nhttps://chat.whatsapp.com/R4Y6LYYHQV6JA1?mode=wwt`
                }, { quoted: message });
                return;
            }
        }

        let userMessage = (
            message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            message.message?.imageMessage?.caption?.trim() ||
            message.message?.videoMessage?.caption?.trim() ||
            message.message?.buttonsResponseMessage?.selectedButtonId?.trim() ||
            ''
        ).toLowerCase().replace(/\.\s+/g, '.').trim();

        // Preserve raw message for commands like .tag that need original casing
        let rawText = message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            message.message?.imageMessage?.caption?.trim() ||
            message.message?.videoMessage?.caption?.trim() ||
            '';

        const preferredPrefix = customization.read().prefix;
        if (preferredPrefix !== '.' && rawText.startsWith(preferredPrefix)) {
            const normalized = '.' + rawText.slice(1).trimStart();
            // Normalize a copy for legacy command modules that parse the original text.
            const content = { ...message.message };
            if (typeof content.conversation === 'string') content.conversation = normalized;
            else for (const key of ['extendedTextMessage','imageMessage','videoMessage']) {
                if (content[key]) { const field = key === 'extendedTextMessage' ? 'text' : 'caption'; content[key] = { ...content[key], [field]: normalized }; break; }
            }
            message = { ...message, message: content };
            rawText = normalized;
            userMessage = normalized.toLowerCase();
        }

        // Only log command usage
        if (userMessage.startsWith('.')) {
            console.log(`📝 Command used in ${isGroup ? 'group' : 'private'}: ${userMessage.split(/\s+/)[0]}`);
        }
        const isPublic = mode !== 'private';
        const isOwnerOrSudoCheck = message.key.fromMe || senderIsOwnerOrSudo;
        const modeCommand = /^\.mode(?:\s|$)/.test(userMessage);
        // Private mode still runs existing group moderation, but not games or commands for others.
        const commandAllowed = groupAccess && botMode.allowsCommand(mode,chatId,isOwnerOrSudoCheck,recoveryChat && modeCommand);
        // Check if user is banned (skip ban check for unban command)
        if (!message.key.fromMe && commandAllowed && isBanned(senderId) && !userMessage.startsWith('.unban')) {
            // Only respond occasionally to avoid spam
            if (Math.random() < 0.1) {
                await sock.sendMessage(chatId, {
                    text: '❌ You are banned from using the bot. Contact an admin to get unbanned.',
                    ...channelInfo
                });
            }
            return;
        }

        // First check if it's a game move
        if (commandAllowed && (/^[1-9]$/.test(userMessage) || userMessage.toLowerCase() === 'surrender')) {
            await handleTicTacToeMove(sock, chatId, senderId, userMessage);
            return;
        }

        /*  // Basic message response in private chat
          if (!isGroup && (userMessage === 'hi' || userMessage === 'hello' || userMessage === 'bot' || userMessage === 'hlo' || userMessage === 'hey' || userMessage === 'bro')) {
              await sock.sendMessage(chatId, {
                  text: 'Hi, How can I help you?\nYou can use .menu for more info and commands.',
                  ...channelInfo
              });
              return;
          } */

        if (!message.key.fromMe) incrementMessageCount(chatId, senderId);

        // Check for bad words and antilink FIRST, before ANY other processing
        // Always run moderation in groups, regardless of mode
        if (isGroup) {
            // Catch non-BAE5 bot IDs (3EB0 etc.) that weren't dropped in index.js
            await handleAntibotDetection(sock, message);
            if (userMessage) {
                await handleBadwordDetection(sock, chatId, message, userMessage, senderId);
            }
            // Antilink checks message text internally, so run it even if userMessage is empty
            await Antilink(message, sock);
        }

        // PM blocker: block non-owner DMs when enabled (do not ban)
        if (!isGroup && !message.key.fromMe && !senderIsSudo) {
            try {
                const pmState = readPmBlockerState();
                if (pmState.enabled) {
                    // Inform user, delay, then block without banning globally
                    await sock.sendMessage(chatId, { text: pmState.message || 'Private messages are blocked. Please contact the owner in groups only.' });
                    await new Promise(r => setTimeout(r, 1500));
                    try { await sock.updateBlockStatus(chatId, 'block'); } catch (e) { }
                    return;
                }
            } catch (e) { }
        }

        // Then check for command prefix
        if (!userMessage.startsWith('.')) {
            if (await automation.observe(sock, chatId, message, rawText, isPublic)) return;
            // Show typing indicator if autotyping is enabled
            await handleAutotypingForMessage(sock, chatId, userMessage);

            if (isGroup) {
                // Always run moderation features (antitag) regardless of mode
                await handleTagDetection(sock, chatId, message, senderId);
                await handleMentionDetection(sock, chatId, message);

                // Only run chatbot in public mode or for owner/sudo
                if (isPublic || isOwnerOrSudoCheck) {
                    await handleChatbotResponse(sock, chatId, message, userMessage, senderId);
                }
            }
            return;
        }
        // In private mode, only owner/sudo can run commands
        if (!commandAllowed) {
            return;
        }

        // List of admin commands
        const adminCommands = ['.mute', '.unmute', '.ban', '.unban', '.promote', '.demote', '.kick', '.tagall', '.tagnotadmin', '.hidetag', '.antilink', '.antitag', '.antibot', '.nobot', '.setgdesc', '.setgname', '.setgpp', '.groupstatus', '.togstatus', '.swgc', '.gstatus', '.gs'];
        const isAdminCommand = adminCommands.some(cmd => userMessage.startsWith(cmd));

        // List of owner commands
        const ownerCommands = ['.mode', '.autostatus', '.savestatus', '.savesm', '.savest', '.antidelete', '.cleartmp', '.setpp', '.clearsession', '.areact', '.autoreact', '.autotyping', '.autoread', '.pmblocker'];
        const isOwnerCommand = ownerCommands.some(cmd => userMessage.startsWith(cmd));

        let isSenderAdmin = false;
        let isBotAdmin = false;

        // Check admin status only for admin commands in groups
        if (isGroup && isAdminCommand) {
            const adminStatus = await isAdmin(sock, chatId, senderId);
            isSenderAdmin = adminStatus.isSenderAdmin;
            isBotAdmin = adminStatus.isBotAdmin;

            if (!isBotAdmin) {
                await sock.sendMessage(chatId, { text: 'Please make the bot an admin to use admin commands.', ...channelInfo }, { quoted: message });
                return;
            }

            if (
                userMessage.startsWith('.mute') ||
                userMessage === '.unmute' ||
                userMessage.startsWith('.ban') ||
                userMessage.startsWith('.unban') ||
                userMessage.startsWith('.promote') ||
                userMessage.startsWith('.demote')
            ) {
                if (!isSenderAdmin && !message.key.fromMe) {
                    await sock.sendMessage(chatId, {
                        text: 'Sorry, only group admins can use this command.',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
            }
        }

        // Check owner status for owner commands
        if (isOwnerCommand) {
            if (!message.key.fromMe && !senderIsOwnerOrSudo) {
                await sock.sendMessage(chatId, { text: '❌ This command is only available for the owner or sudo!' }, { quoted: message });
                return;
            }
        }

        // Command handlers - Execute commands immediately without waiting for typing indicator
        // We'll show typing indicator after command execution if needed
        let commandExecuted = false;

        switch (true) {
            case sports.names.has(userMessage.split(/\s+/)[0].slice(1)):
                analyticsCommand = userMessage.split(/\s+/)[0].slice(1);
                analyticsSuccess = await sports.run(sock, chatId, message, analyticsCommand, rawText.trim().split(/\s+/).slice(1).join(' '));
                commandExecuted = true;
                break;
            case automation.names.has(userMessage.split(/\s+/)[0].slice(1)):
                analyticsCommand = userMessage.split(/\s+/)[0].slice(1);
                await automation.run(sock, chatId, message, analyticsCommand, rawText.trim().split(/\s+/).slice(1).join(' '));
                commandExecuted = true;
                break;
            case moderation.names.has(userMessage.split(/\s+/)[0].slice(1)):
                analyticsCommand = userMessage.split(/\s+/)[0].slice(1);
                await moderation.run(sock, chatId, message, analyticsCommand, rawText.trim().split(/\s+/).slice(1).join(' '));
                commandExecuted = true;
                break;
            case groupManagement.names.has(userMessage.split(/\s+/)[0].slice(1)):
                analyticsCommand = userMessage.split(/\s+/)[0].slice(1);
                await groupManagement.run(sock, chatId, message, analyticsCommand, rawText.trim().split(/\s+/).slice(1).join(' '));
                commandExecuted = true;
                break;
            case ownerCustomization.names.has(userMessage.split(/\s+/)[0].slice(1)):
                analyticsCommand = userMessage.split(/\s+/)[0].slice(1);
                await ownerCustomization.run(sock, chatId, message, analyticsCommand, rawText.trim().split(/\s+/).slice(1).join(' '));
                commandExecuted = true;
                break;
            case userMessage === '.pair' || userMessage.startsWith('.pair '):
                analyticsCommand = 'pair';
                await pairCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '.mpair' || userMessage.startsWith('.mpair '):
                analyticsCommand = 'mpair';
                await mpairCommand(sock, chatId, message, rawText.slice(6).trim());
                commandExecuted = true;
                break;
            case userMessage === '.simage': {
                analyticsCommand = 'simage';
                const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                if (quotedMessage?.stickerMessage) {
                    await simageCommand(sock, quotedMessage, chatId);
                } else {
                    await sock.sendMessage(chatId, { text: 'Please reply to a sticker with the .simage command to convert it.', ...channelInfo }, { quoted: message });
                }
                commandExecuted = true;
                break;
            }
            case userMessage.startsWith('.kick'):
                analyticsCommand = 'kick';
                const mentionedJidListKick = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await kickCommand(sock, chatId, senderId, mentionedJidListKick, message);
                break;
            case userMessage.startsWith('.mute'):
                analyticsCommand = 'mute';
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const muteArg = parts[1];
                    const muteDuration = muteArg !== undefined ? parseInt(muteArg, 10) : undefined;
                    if (muteArg !== undefined && (isNaN(muteDuration) || muteDuration <= 0)) {
                        await sock.sendMessage(chatId, { text: 'Please provide a valid number of minutes or use .mute with no number to mute immediately.', ...channelInfo }, { quoted: message });
                    } else {
                        await muteCommand(sock, chatId, senderId, message, muteDuration);
                    }
                }
                break;
            case userMessage === '.unmute':
                analyticsCommand = 'unmute';
                await unmuteCommand(sock, chatId, senderId);
                break;
            case userMessage.startsWith('.ban'):
                analyticsCommand = 'ban';
                if (!isGroup) {
                    if (!message.key.fromMe && !senderIsSudo) {
                        await sock.sendMessage(chatId, { text: 'Only owner/sudo can use .ban in private chat.' }, { quoted: message });
                        break;
                    }
                }
                await banCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.unban'):
                analyticsCommand = 'unban';
                if (!isGroup) {
                    if (!message.key.fromMe && !senderIsSudo) {
                        await sock.sendMessage(chatId, { text: 'Only owner/sudo can use .unban in private chat.' }, { quoted: message });
                        break;
                    }
                }
                await unbanCommand(sock, chatId, message);
                break;
            case /^\.(setmenuimage|restoremenuimage)(?:\s|$)/.test(userMessage):
                analyticsCommand = userMessage.split(/\s+/)[0].slice(1);
                await menuSettingsCommand(sock, chatId, message, analyticsCommand, rawText.trim().split(/\s+/).slice(1).join(' '));
                commandExecuted = true;
                break;
            case userMessage === '.help' || userMessage === '.menu' || userMessage === '.bot' || userMessage === '.list':
                analyticsCommand = 'help';
                await helpCommand(sock, chatId, message, global.channelLink);
                commandExecuted = true;
                break;
            case userMessage === '.sticker' || userMessage === '.s':
                analyticsCommand = 'sticker';
                await stickerCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.warnings'):
                analyticsCommand = 'warnings';
                const mentionedJidListWarnings = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await warningsCommand(sock, chatId, mentionedJidListWarnings);
                break;
            case userMessage.startsWith('.warn'):
                analyticsCommand = 'warn';
                const mentionedJidListWarn = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await warnCommand(sock, chatId, senderId, mentionedJidListWarn, message);
                break;
            case userMessage.startsWith('.tts'):
                analyticsCommand = 'tts';
                const text = userMessage.slice(4).trim();
                await ttsCommand(sock, chatId, text, message);
                break;
            case userMessage.startsWith('.delete') || userMessage.startsWith('.del'):
                analyticsCommand = 'delete';
                await deleteCommand(sock, chatId, message, senderId);
                break;
            case userMessage.startsWith('.attp'):
                analyticsCommand = 'attp';
                await attpCommand(sock, chatId, message);
                break;

            case userMessage === '.settings':
                analyticsCommand = 'settings';
                await settingsCommand(sock, chatId, message);
                break;
            case modeCommand: {
                analyticsCommand = 'mode';
                if (!message.key.fromMe) {
                    await sock.sendMessage(chatId,{text:'Only the connected bot owner can change mode.', ...channelInfo},{quoted:message});
                    return;
                }
                const action = userMessage.split(/\s+/)[1];
                const usage = `*HARLEY-MD MODE*\nCurrent: ${botMode.label()}\n\n.mode public — Everyone, groups and DMs\n.mode private — Owner / authorized sudo\n.mode groups — Groups only\n.mode dms — DMs only; group automation paused\n\nChange mode anytime in Message Yourself.`;
                if (!action || !botMode.modes.has(action) || userMessage.split(/\s+/).length !== 2) {
                    await sock.sendMessage(chatId,{text:usage,...channelInfo},{quoted:message}); return;
                }
                // Confirm a switch to DMs in self-chat, never in the group after activation.
                const destination = action === 'dms' && isGroup ? String(sock.user?.id || '').replace(/:\d+@/,'@') : chatId;
                if (!botMode.dm(destination) && action === 'dms') return;
                botMode.set(action);
                const text = `*MODE UPDATED*\nMode: ${botMode.label()}\nGroup commands: ${action === 'dms' ? 'OFF' : 'ON'}\nGroup automation: ${action === 'dms' ? 'PAUSED' : 'Existing settings'}\nDM commands: ${action === 'groups' ? 'OFF (owner mode control in self-chat)' : action === 'private' ? 'Owner / sudo only' : 'ON'}\n\nPOWERED BY HARLEY-MD`;
                // When switching to groups from a non-self DM, confirm in self-chat.
                const target = action === 'groups' && !isGroup ? String(sock.user?.id || '').replace(/:\d+@/,'@') : destination;
                await sock.sendMessage(target,{text,...channelInfo});
                break;
            }
            case userMessage.startsWith('.anticall'):
                analyticsCommand = 'anticall';
                if (!message.key.fromMe && !senderIsOwnerOrSudo) {
                    await sock.sendMessage(chatId, { text: 'Only owner/sudo can use anticall.' }, { quoted: message });
                    break;
                }
                {
                    const args = userMessage.split(' ').slice(1).join(' ');
                    await anticallCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('.pmblocker'):
                analyticsCommand = 'pmblocker';
                {
                    const args = userMessage.split(' ').slice(1).join(' ');
                    await pmblockerCommand(sock, chatId, message, args);
                }
                commandExecuted = true;
                break;
            case userMessage === '.owner':
                analyticsCommand = 'owner';
                await ownerCommand(sock, chatId);
                break;
            case userMessage === '.tagall':
                analyticsCommand = 'tagall';
                await tagAllCommand(sock, chatId, senderId, message);
                break;
            case userMessage === '.tagnotadmin':
                analyticsCommand = 'tagnotadmin';
                await tagNotAdminCommand(sock, chatId, senderId, message);
                break;
            case userMessage.startsWith('.hidetag'):
                analyticsCommand = 'hidetag';
                {
                    const messageText = rawText.slice(8).trim();
                    const replyMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
                    await hideTagCommand(sock, chatId, senderId, messageText, replyMessage, message);
                }
                break;
            case userMessage.startsWith('.tag'):
                analyticsCommand = 'tag';
                const messageText = rawText.slice(4).trim();  // use rawText here, not userMessage
                const replyMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
                await tagCommand(sock, chatId, senderId, messageText, replyMessage, message);
                break;
            case userMessage.startsWith('.antibot') || userMessage.startsWith('.nobot'):
                analyticsCommand = 'antibot';
                await antibotCommand(sock, chatId, message, senderId);
                break;
            case userMessage.startsWith('.antilink'):
                analyticsCommand = 'antilink';
                if (!isGroup) {
                    await sock.sendMessage(chatId, {
                        text: 'This command can only be used in groups.',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
                if (!isBotAdmin) {
                    await sock.sendMessage(chatId, {
                        text: 'Please make the bot an admin first.',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
                await handleAntilinkCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message);
                break;
            case userMessage.startsWith('.antitag'):
                analyticsCommand = 'antitag';
                if (!isGroup) {
                    await sock.sendMessage(chatId, {
                        text: 'This command can only be used in groups.',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
                if (!isBotAdmin) {
                    await sock.sendMessage(chatId, {
                        text: 'Please make the bot an admin first.',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
                await handleAntitagCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message);
                break;
            case userMessage === '.meme':
                analyticsCommand = 'meme';
                await memeCommand(sock, chatId, message);
                break;
            case userMessage === '.joke':
                analyticsCommand = 'joke';
                await jokeCommand(sock, chatId, message);
                break;
            case userMessage === '.quote':
                analyticsCommand = 'quote';
                await quoteCommand(sock, chatId, message);
                break;
            case userMessage === '.fact':
                analyticsCommand = 'fact';
                await factCommand(sock, chatId, message, message);
                break;
            case userMessage.startsWith('.weather'):
                analyticsCommand = 'weather';
                const city = userMessage.slice(9).trim();
                if (city) {
                    await weatherCommand(sock, chatId, message, city);
                } else {
                    await sock.sendMessage(chatId, { text: 'Please specify a city, e.g., .weather London', ...channelInfo }, { quoted: message });
                }
                break;
            case userMessage === '.news':
                analyticsCommand = 'news';
                await newsCommand(sock, chatId);
                break;
            case userMessage.startsWith('.ttt') || userMessage.startsWith('.tictactoe'):
                analyticsCommand = 'ttt';
                const tttText = userMessage.split(' ').slice(1).join(' ');
                await tictactoeCommand(sock, chatId, senderId, tttText);
                break;
            case userMessage.startsWith('.move'):
                analyticsCommand = 'move';
                const position = parseInt(userMessage.split(' ')[1]);
                if (isNaN(position)) {
                    await sock.sendMessage(chatId, { text: 'Please provide a valid position number for Tic-Tac-Toe move.', ...channelInfo }, { quoted: message });
                } else {
                    tictactoeMove(sock, chatId, senderId, position);
                }
                break;
            case userMessage === '.topmembers':
                analyticsCommand = 'topmembers';
                topMembers(sock, chatId, isGroup);
                break;
            case userMessage.startsWith('.hangman'):
                analyticsCommand = 'hangman';
                startHangman(sock, chatId);
                break;
            case userMessage.startsWith('.guess'):
                analyticsCommand = 'guess';
                const guessedLetter = userMessage.split(' ')[1];
                if (guessedLetter) {
                    guessLetter(sock, chatId, guessedLetter);
                } else {
                    sock.sendMessage(chatId, { text: 'Please guess a letter using .guess <letter>', ...channelInfo }, { quoted: message });
                }
                break;
            case userMessage.startsWith('.trivia'):
                analyticsCommand = 'trivia';
                startTrivia(sock, chatId);
                break;
            case userMessage.startsWith('.answer'):
                analyticsCommand = 'answer';
                const answer = userMessage.split(' ').slice(1).join(' ');
                if (answer) {
                    answerTrivia(sock, chatId, answer);
                } else {
                    sock.sendMessage(chatId, { text: 'Please provide an answer using .answer <answer>', ...channelInfo }, { quoted: message });
                }
                break;
            case userMessage.startsWith('.compliment'):
                analyticsCommand = 'compliment';
                await complimentCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.insult'):
                analyticsCommand = 'insult';
                await insultCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.8ball'):
                analyticsCommand = '8ball';
                const question = userMessage.split(' ').slice(1).join(' ');
                await eightBallCommand(sock, chatId, question);
                break;
            case userMessage.startsWith('.lyrics'):
                analyticsCommand = 'lyrics';
                const songTitle = userMessage.split(' ').slice(1).join(' ');
                await lyricsCommand(sock, chatId, songTitle, message);
                break;
            case userMessage.startsWith('.simp'):
                analyticsCommand = 'simp';
                const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await simpCommand(sock, chatId, quotedMsg, mentionedJid, senderId);
                break;
            case userMessage.startsWith('.stupid') || userMessage.startsWith('.itssostupid') || userMessage.startsWith('.iss'):
                analyticsCommand = 'stupid';
                const stupidQuotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const stupidMentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                const stupidArgs = userMessage.split(' ').slice(1);
                await stupidCommand(sock, chatId, stupidQuotedMsg, stupidMentionedJid, senderId, stupidArgs);
                break;
            case userMessage === '.dare':
                analyticsCommand = 'dare';
                await dareCommand(sock, chatId, message);
                break;
            case userMessage === '.truth':
                analyticsCommand = 'truth';
                await truthCommand(sock, chatId, message);
                break;
            case userMessage === '.clear':
                analyticsCommand = 'clear';
                if (isGroup) await clearCommand(sock, chatId);
                break;
            case userMessage.startsWith('.promote'):
                analyticsCommand = 'promote';
                const mentionedJidListPromote = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await promoteCommand(sock, chatId, mentionedJidListPromote, message);
                break;
            case userMessage.startsWith('.demote'):
                analyticsCommand = 'demote';
                const mentionedJidListDemote = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await demoteCommand(sock, chatId, mentionedJidListDemote, message);
                break;
            case userMessage === '.ping':
                analyticsCommand = 'ping';
                await pingCommand(sock, chatId, message);
                break;
            case userMessage === '.alive':
                analyticsCommand = 'alive';
                await aliveCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.mention '):
                analyticsCommand = 'mention';
                {
                    const args = userMessage.split(' ').slice(1).join(' ');
                    const isOwner = message.key.fromMe || senderIsSudo;
                    await mentionToggleCommand(sock, chatId, message, args, isOwner);
                }
                break;
            case userMessage === '.setmention':
                analyticsCommand = 'setmention';
                {
                    const isOwner = message.key.fromMe || senderIsSudo;
                    await setMentionCommand(sock, chatId, message, isOwner);
                }
                break;
            case userMessage.startsWith('.blur'):
                analyticsCommand = 'blur';
                const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                await blurCommand(sock, chatId, message, quotedMessage);
                break;
            case userMessage.startsWith('.welcome'):
                analyticsCommand = 'welcome';
                if (isGroup) {
                    // Check admin status if not already checked
                    if (!isSenderAdmin) {
                        const adminStatus = await isAdmin(sock, chatId, senderId);
                        isSenderAdmin = adminStatus.isSenderAdmin;
                    }

                    if (isSenderAdmin || message.key.fromMe) {
                        await welcomeCommand(sock, chatId, message);
                    } else {
                        await sock.sendMessage(chatId, { text: 'Sorry, only group admins can use this command.', ...channelInfo }, { quoted: message });
                    }
                } else {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo }, { quoted: message });
                }
                break;
            case userMessage.startsWith('.goodbye'):
                analyticsCommand = 'goodbye';
                if (isGroup) {
                    // Check admin status if not already checked
                    if (!isSenderAdmin) {
                        const adminStatus = await isAdmin(sock, chatId, senderId);
                        isSenderAdmin = adminStatus.isSenderAdmin;
                    }

                    if (isSenderAdmin || message.key.fromMe) {
                        await goodbyeCommand(sock, chatId, message);
                    } else {
                        await sock.sendMessage(chatId, { text: 'Sorry, only group admins can use this command.', ...channelInfo }, { quoted: message });
                    }
                } else {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo }, { quoted: message });
                }
                break;
            case userMessage === '.git':
            case userMessage === '.github':
            case userMessage === '.sc':
            case userMessage === '.script':
            case userMessage === '.repo':
                analyticsCommand = 'git';
                await githubCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.antibadword'):
                analyticsCommand = 'antibadword';
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo }, { quoted: message });
                    return;
                }

                const adminStatus = await isAdmin(sock, chatId, senderId);
                isSenderAdmin = adminStatus.isSenderAdmin;
                isBotAdmin = adminStatus.isBotAdmin;

                if (!isBotAdmin) {
                    await sock.sendMessage(chatId, { text: '*Bot must be admin to use this feature*', ...channelInfo }, { quoted: message });
                    return;
                }

                await antibadwordCommand(sock, chatId, message, senderId, isSenderAdmin);
                break;
            case userMessage.startsWith('.chatbot'):
                analyticsCommand = 'chatbot';
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo }, { quoted: message });
                    return;
                }

                // Check if sender is admin or bot owner
                const chatbotAdminStatus = await isAdmin(sock, chatId, senderId);
                if (!chatbotAdminStatus.isSenderAdmin && !message.key.fromMe) {
                    await sock.sendMessage(chatId, { text: '*Only admins or bot owner can use this command*', ...channelInfo }, { quoted: message });
                    return;
                }

                const match = userMessage.slice(8).trim();
                await handleChatbotCommand(sock, chatId, message, match);
                break;
            case userMessage.startsWith('.take') || userMessage.startsWith('.steal'):
                analyticsCommand = 'take';
                {
                    const isSteal = userMessage.startsWith('.steal');
                    const sliceLen = isSteal ? 6 : 5; // '.steal' vs '.take'
                    const takeArgs = rawText.slice(sliceLen).trim().split(' ');
                    await takeCommand(sock, chatId, message, takeArgs);
                }
                break;
            case userMessage === '.flirt':
                analyticsCommand = 'flirt';
                await flirtCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.character'):
                analyticsCommand = 'character';
                await characterCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.waste'):
                analyticsCommand = 'waste';
                await wastedCommand(sock, chatId, message);
                break;
            case userMessage === '.ship':
                analyticsCommand = 'ship';
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo }, { quoted: message });
                    return;
                }
                await shipCommand(sock, chatId, message);
                break;
            case userMessage === '.groupinfo' || userMessage === '.infogp' || userMessage === '.infogrupo':
                analyticsCommand = 'groupinfo';
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo }, { quoted: message });
                    return;
                }
                await groupInfoCommand(sock, chatId, message);
                break;
            case userMessage === '.resetlink' || userMessage === '.revoke' || userMessage === '.anularlink':
                analyticsCommand = 'resetlink';
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo }, { quoted: message });
                    return;
                }
                await resetlinkCommand(sock, chatId, senderId);
                break;
            case userMessage === '.staff' || userMessage === '.admins' || userMessage === '.listadmin':
                analyticsCommand = 'staff';
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo }, { quoted: message });
                    return;
                }
                await staffCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.tourl') || userMessage.startsWith('.url'):
                analyticsCommand = 'tourl';
                await urlCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.emojimix') || userMessage.startsWith('.emix'):
                analyticsCommand = 'emojimix';
                await emojimixCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.tg') || userMessage.startsWith('.stickertelegram') || userMessage.startsWith('.tgsticker') || userMessage.startsWith('.telesticker'):
                analyticsCommand = 'tg';
                await stickerTelegramCommand(sock, chatId, message);
                break;

            case userMessage === '.vv':
                analyticsCommand = 'vv';
                await viewOnceCommand(sock, chatId, message);
                break;
            case userMessage === '.vv2':
                analyticsCommand = 'vv2';
                await vv2Command(sock, chatId, message, senderId);
                break;
            case userMessage === '.clearsession' || userMessage === '.clearsesi':
                analyticsCommand = 'clearsession';
                await clearSessionCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.autostatus'):
                analyticsCommand = 'autostatus';
                const autoStatusArgs = userMessage.split(' ').slice(1);
                await autoStatusCommand(sock, chatId, message, autoStatusArgs);
                break;
            case userMessage.startsWith('.savestatus') || userMessage.startsWith('.savesm') || userMessage.startsWith('.savest'):
                analyticsCommand = 'savestatus';
                await savestatusCommand(sock, chatId, message, senderId);
                break;
            case userMessage.startsWith('.groupstatus') || userMessage.startsWith('.togstatus') || userMessage.startsWith('.swgc') || userMessage.startsWith('.gstatus') || userMessage === '.gs' || userMessage.startsWith('.gs '):
                analyticsCommand = 'groupstatus';
                await groupstatusCommand(sock, chatId, message, senderId);
                break;
            case userMessage.startsWith('.simp'):
                analyticsCommand = 'simp';
                await simpCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.metallic'):
                analyticsCommand = 'metallic';
                await textmakerCommand(sock, chatId, message, userMessage, 'metallic');
                break;
            case userMessage.startsWith('.ice'):
                analyticsCommand = 'ice';
                await textmakerCommand(sock, chatId, message, userMessage, 'ice');
                break;
            case userMessage.startsWith('.snow'):
                analyticsCommand = 'snow';
                await textmakerCommand(sock, chatId, message, userMessage, 'snow');
                break;
            case userMessage.startsWith('.impressive'):
                analyticsCommand = 'impressive';
                await textmakerCommand(sock, chatId, message, userMessage, 'impressive');
                break;
            case userMessage.startsWith('.matrix'):
                analyticsCommand = 'matrix';
                await textmakerCommand(sock, chatId, message, userMessage, 'matrix');
                break;
            case userMessage.startsWith('.light'):
                analyticsCommand = 'light';
                await textmakerCommand(sock, chatId, message, userMessage, 'light');
                break;
            case userMessage.startsWith('.neon'):
                analyticsCommand = 'neon';
                await textmakerCommand(sock, chatId, message, userMessage, 'neon');
                break;
            case userMessage.startsWith('.devil'):
                analyticsCommand = 'devil';
                await textmakerCommand(sock, chatId, message, userMessage, 'devil');
                break;
            case userMessage.startsWith('.purple'):
                analyticsCommand = 'purple';
                await textmakerCommand(sock, chatId, message, userMessage, 'purple');
                break;
            case userMessage.startsWith('.thunder'):
                analyticsCommand = 'thunder';
                await textmakerCommand(sock, chatId, message, userMessage, 'thunder');
                break;
            case userMessage.startsWith('.leaves'):
                analyticsCommand = 'leaves';
                await textmakerCommand(sock, chatId, message, userMessage, 'leaves');
                break;
            case userMessage.startsWith('.1917'):
                analyticsCommand = '1917';
                await textmakerCommand(sock, chatId, message, userMessage, '1917');
                break;
            case userMessage.startsWith('.arena'):
                analyticsCommand = 'arena';
                await textmakerCommand(sock, chatId, message, userMessage, 'arena');
                break;
            case userMessage.startsWith('.hacker'):
                analyticsCommand = 'hacker';
                await textmakerCommand(sock, chatId, message, userMessage, 'hacker');
                break;
            case userMessage.startsWith('.sand'):
                analyticsCommand = 'sand';
                await textmakerCommand(sock, chatId, message, userMessage, 'sand');
                break;
            case userMessage.startsWith('.blackpink'):
                analyticsCommand = 'blackpink';
                await textmakerCommand(sock, chatId, message, userMessage, 'blackpink');
                break;
            case userMessage.startsWith('.glitch'):
                analyticsCommand = 'glitch';
                await textmakerCommand(sock, chatId, message, userMessage, 'glitch');
                break;
            case userMessage.startsWith('.fire'):
                analyticsCommand = 'fire';
                await textmakerCommand(sock, chatId, message, userMessage, 'fire');
                break;
            case userMessage.startsWith('.antidelete'):
                analyticsCommand = 'antidelete';
                const antideleteMatch = userMessage.slice(11).trim();
                await handleAntideleteCommand(sock, chatId, message, antideleteMatch);
                break;
            case userMessage === '.surrender':
                analyticsCommand = 'surrender';
                // Handle surrender command for tictactoe game
                await handleTicTacToeMove(sock, chatId, senderId, 'surrender');
                break;
            case userMessage === '.cleartmp':
                analyticsCommand = 'cleartmp';
                await clearTmpCommand(sock, chatId, message);
                break;
            case userMessage === '.setpp':
                analyticsCommand = 'setpp';
                await setProfilePicture(sock, chatId, message);
                break;
            case userMessage.startsWith('.setgdesc'):
                analyticsCommand = 'setgdesc';
                {
                    const text = rawText.slice(9).trim();
                    await setGroupDescription(sock, chatId, senderId, text, message);
                }
                break;
            case userMessage.startsWith('.setgname'):
                analyticsCommand = 'setgname';
                {
                    const text = rawText.slice(9).trim();
                    await setGroupName(sock, chatId, senderId, text, message);
                }
                break;
            case userMessage.startsWith('.setgpp'):
                analyticsCommand = 'setgpp';
                await setGroupPhoto(sock, chatId, senderId, message);
                break;
            case userMessage.startsWith('.instagram') || userMessage.startsWith('.insta') || (userMessage === '.ig' || userMessage.startsWith('.ig ')):
                analyticsCommand = 'instagram';
                await instagramCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.igsc'):
                analyticsCommand = 'igsc';
                await igsCommand(sock, chatId, message, true);
                break;
            case userMessage.startsWith('.igs'):
                analyticsCommand = 'igs';
                await igsCommand(sock, chatId, message, false);
                break;
            case userMessage.startsWith('.fb') || userMessage.startsWith('.facebook'):
                analyticsCommand = 'fb';
                await facebookCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.twitter') || userMessage.startsWith('.x ') || userMessage === '.x' || userMessage.startsWith('.xdl') || userMessage.startsWith('.twdl'):
                analyticsCommand = 'twitter';
                await twitterCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.music'):
                analyticsCommand = 'music';
                await playCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.spotify'):
                analyticsCommand = 'spotify';
                await spotifyCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.play') || userMessage.startsWith('.mp3') || userMessage.startsWith('.ytmp3') || userMessage.startsWith('.song'):
                analyticsCommand = 'play';
                await songCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.video') || userMessage.startsWith('.ytmp4'):
                analyticsCommand = 'video';
                await videoCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.tiktok') || userMessage.startsWith('.tt'):
                analyticsCommand = 'tiktok';
                await tiktokCommand(sock, chatId, message);
                break;
            case userMessage === '.ai' || userMessage.startsWith('.ai ') || userMessage.startsWith('.gpt') || userMessage.startsWith('.gemini'):
                analyticsCommand = 'ai';
                await aiCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.translate') || userMessage.startsWith('.trt'):
                analyticsCommand = 'translate';
                const commandLength = userMessage.startsWith('.translate') ? 10 : 4;
                await handleTranslateCommand(sock, chatId, message, userMessage.slice(commandLength));
                return;
            case userMessage.startsWith('.ss') || userMessage.startsWith('.ssweb') || userMessage.startsWith('.screenshot'):
                analyticsCommand = 'ss';
                const ssCommandLength = userMessage.startsWith('.screenshot') ? 11 : (userMessage.startsWith('.ssweb') ? 6 : 3);
                await handleSsCommand(sock, chatId, message, userMessage.slice(ssCommandLength).trim());
                break;
            case userMessage.startsWith('.areact') || userMessage.startsWith('.autoreact') || userMessage.startsWith('.autoreaction'):
                analyticsCommand = 'areact';
                await handleAreactCommand(sock, chatId, message, isOwnerOrSudoCheck);
                break;
            case userMessage.startsWith('.sudo'):
                analyticsCommand = 'sudo';
                await sudoCommand(sock, chatId, message);
                break;
            case userMessage === '.goodnight' || userMessage === '.lovenight' || userMessage === '.gn':
                analyticsCommand = 'goodnight';
                await goodnightCommand(sock, chatId, message);
                break;
            case userMessage === '.shayari' || userMessage === '.shayri':
                analyticsCommand = 'shayari';
                await shayariCommand(sock, chatId, message);
                break;
            case userMessage === '.roseday':
                analyticsCommand = 'roseday';
                await rosedayCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.imagine') || userMessage.startsWith('.flux') || userMessage.startsWith('.dalle'): await imagineCommand(sock, chatId, message);
                analyticsCommand = 'imagine';
                break;
            case userMessage === '.jid': await groupJidCommand(sock, chatId, message);
                analyticsCommand = 'jid';
                break;
            case userMessage.startsWith('.autotyping'):
                analyticsCommand = 'autotyping';
                await autotypingCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.autoread'):
                analyticsCommand = 'autoread';
                await autoreadCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.heart'):
                analyticsCommand = 'heart';
                await handleHeart(sock, chatId, message);
                break;
            case userMessage.startsWith('.horny'):
                analyticsCommand = 'horny';
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['horny', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('.circle'):
                analyticsCommand = 'circle';
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['circle', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('.lgbt'):
                analyticsCommand = 'lgbt';
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['lgbt', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('.lolice'):
                analyticsCommand = 'lolice';
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['lolice', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('.simpcard'):
                analyticsCommand = 'simpcard';
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['simpcard', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('.tonikawa'):
                analyticsCommand = 'tonikawa';
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['tonikawa', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('.its-so-stupid'):
                analyticsCommand = 'its-so-stupid';
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['its-so-stupid', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('.namecard'):
                analyticsCommand = 'namecard';
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['namecard', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;

            case userMessage.startsWith('.oogway2'):
            case userMessage.startsWith('.oogway'):
                analyticsCommand = 'oogway2';
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const sub = userMessage.startsWith('.oogway2') ? 'oogway2' : 'oogway';
                    const args = [sub, ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('.tweet'):
                analyticsCommand = 'tweet';
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['tweet', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('.ytcomment'):
                analyticsCommand = 'ytcomment';
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['youtube-comment', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('.comrade'):
            case userMessage.startsWith('.gay'):
            case userMessage.startsWith('.glass'):
            case userMessage.startsWith('.jail'):
            case userMessage.startsWith('.passed'):
            case userMessage.startsWith('.triggered'):
                analyticsCommand = 'comrade';
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const sub = userMessage.slice(1).split(/\s+/)[0];
                    const args = [sub, ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('.animu'):
                analyticsCommand = 'animu';
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = parts.slice(1);
                    await animeCommand(sock, chatId, message, args);
                }
                break;
            // animu aliases
            case userMessage.startsWith('.nom'):
            case userMessage.startsWith('.poke'):
            case userMessage.startsWith('.cry'):
            case userMessage.startsWith('.kiss'):
            case userMessage.startsWith('.pat'):
            case userMessage.startsWith('.hug'):
            case userMessage.startsWith('.wink'):
            case userMessage.startsWith('.facepalm'):
            case userMessage.startsWith('.face-palm'):
            case userMessage.startsWith('.animuquote'):
            case userMessage.startsWith('.quote'):
            case userMessage.startsWith('.loli'):
                analyticsCommand = 'nom';
                {
                    const parts = userMessage.trim().split(/\s+/);
                    let sub = parts[0].slice(1);
                    if (sub === 'facepalm') sub = 'face-palm';
                    if (sub === 'quote' || sub === 'animuquote') sub = 'quote';
                    await animeCommand(sock, chatId, message, [sub]);
                }
                break;
            case userMessage === '.crop':
                analyticsCommand = 'crop';
                await stickercropCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.pies'):
                analyticsCommand = 'pies';
                {
                    const parts = rawText.trim().split(/\s+/);
                    const args = parts.slice(1);
                    await piesCommand(sock, chatId, message, args);
                    commandExecuted = true;
                }
                break;
            case userMessage === '.china':
                analyticsCommand = 'china';
                await piesAlias(sock, chatId, message, 'china');
                commandExecuted = true;
                break;
            case userMessage === '.indonesia':
                analyticsCommand = 'indonesia';
                await piesAlias(sock, chatId, message, 'indonesia');
                commandExecuted = true;
                break;
            case userMessage === '.japan':
                analyticsCommand = 'japan';
                await piesAlias(sock, chatId, message, 'japan');
                commandExecuted = true;
                break;
            case userMessage === '.korea':
                analyticsCommand = 'korea';
                await piesAlias(sock, chatId, message, 'korea');
                commandExecuted = true;
                break;
            case userMessage === '.india':
                analyticsCommand = 'india';
                await piesAlias(sock, chatId, message, 'india');
                commandExecuted = true;
                break;
            case userMessage === '.malaysia':
                analyticsCommand = 'malaysia';
                await piesAlias(sock, chatId, message, 'malaysia');
                commandExecuted = true;
                break;
            case userMessage === '.thailand':
                analyticsCommand = 'thailand';
                await piesAlias(sock, chatId, message, 'thailand');
                commandExecuted = true;
                break;
            case userMessage.startsWith('.update'):
                analyticsCommand = 'update';
                {
                    const parts = rawText.trim().split(/\s+/);
                    const zipArg = parts[1] && parts[1].startsWith('http') ? parts[1] : '';
                    await updateCommand(sock, chatId, message, zipArg);
                }
                commandExecuted = true;
                break;
            case userMessage.startsWith('.removebg') || userMessage.startsWith('.rmbg') || userMessage.startsWith('.nobg'):
                analyticsCommand = 'removebg';
                await removebgCommand.exec(sock, message, userMessage.split(' ').slice(1));
                break;
            case userMessage.startsWith('.remini') || userMessage.startsWith('.enhance') || userMessage.startsWith('.upscale'):
                analyticsCommand = 'remini';
                await reminiCommand(sock, chatId, message, userMessage.split(' ').slice(1));
                break;
            case userMessage.startsWith('.sora'):
                analyticsCommand = 'sora';
                await soraCommand(sock, chatId, message);
                break;
            default:
                if (isGroup) {
                    // Handle non-command group messages
                    if (userMessage) {  // Make sure there's a message
                        await handleChatbotResponse(sock, chatId, message, userMessage, senderId);
                    }
                    await handleTagDetection(sock, chatId, message, senderId);
                    await handleMentionDetection(sock, chatId, message);
                }
                commandExecuted = false;
                break;
        }

        // If a command was executed, show typing status after command execution
        if (commandExecuted !== false) {
            // Command was executed, now show typing status after command execution
            await showTypingAfterCommand(sock, chatId);
        }

        // Function to handle .groupjid command
        async function groupJidCommand(sock, chatId, message) {
            const groupJid = message.key.remoteJid;

            if (!groupJid.endsWith('@g.us')) {
                return await sock.sendMessage(chatId, {
                    text: "❌ This command can only be used in a group."
                });
            }

            await sock.sendMessage(chatId, {
                text: `✅ Group JID: ${groupJid}`
            }, {
                quoted: message
            });
        }

        if (userMessage.startsWith('.')) {
            // After command is processed successfully
            if (!customization.read().silent) await addCommandReaction(sock, message);
        }
    } catch (error) {
        analyticsSuccess = false;
        analytics.recordError(analyticsCommand ? 'COMMAND_EXCEPTION' : 'MESSAGE_HANDLER');
        console.error('❌ Error in message handler:', error.message);
        // Only try to send error message if we have a valid chatId
        if (chatId && error?.output?.statusCode !== 428 && !/connection closed/i.test(error?.message || '')) {
            try { await sock.sendMessage(chatId, { text: '❌ Failed to process command!', ...channelInfo }); } catch {}
        }
    } finally {
        if (analyticsCommand) analytics.recordCommand(analyticsCommand, analyticsSuccess);
    }
}

async function handleGroupParticipantUpdate(sock, update) {
    try {
        const { id, participants, action, author } = update;

        // Check if it's a group
        if (!id.endsWith('@g.us') || !botMode.allowsChat(botMode.read(),id)) return;

        await moderation.participant(sock, update);

        // Handle promotion events
        if (action === 'promote') {
            await handlePromotionEvent(sock, id, participants, author);
            return;
        }

        // Handle demotion events
        if (action === 'demote') {
            await handleDemotionEvent(sock, id, participants, author);
            return;
        }

        // Handle join events
        if (action === 'add') {
            await handleJoinEvent(sock, id, participants);
        }

        // Handle leave events
        if (action === 'remove') {
            await handleLeaveEvent(sock, id, participants);
        }
    } catch (error) {
        console.error('Error in handleGroupParticipantUpdate:', error);
    }
}

// Instead, export the handlers along with handleMessages
module.exports = {
    handleMessages,
    handleGroupParticipantUpdate,
    handleStatus: async (sock, status) => {
        if (['groups','dms'].includes(botMode.read())) return;
        await handleStatusUpdate(sock, status);
        try {
            // Only full status messages (messages.upsert) — never reactions / empty updates
            const msg = status.messages?.[0];
            if (msg?.message && msg.key?.remoteJid === 'status@broadcast') {
                await savestatusAutoSave(sock, msg);
            }
        } catch (e) {
            console.error('[savestatus] hook:', e?.message || e);
        }
    }
};

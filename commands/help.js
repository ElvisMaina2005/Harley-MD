const settings = require('../settings');
const customization = require('../lib/ownerCustomization');
const { getImage } = require('../lib/menuState');

async function helpCommand(sock, chatId, message) {
    const d = customization.read();
    let helpMessage = `
╔═══════════════════╗
   *🤖 ${d.name}*  
   Version: *${settings.version || '3.0.0'}*
   by ${d.owner}
   YT : ${global.ytch}
╚═══════════════════╝

*Available Commands:*

╔═══════════════════╗
🌐 *General Commands*:
║ ➤ .help or .menu
║ ➤ .ping
║ ➤ .alive
║ ➤ .tts <text>
║ ➤ .owner
║ ➤ .joke
║ ➤ .quote
║ ➤ .fact
║ ➤ .weather <city>
║ ➤ .news
║ ➤ .attp <text>
║ ➤ .lyrics <song_title>
║ ➤ .8ball <question>
║ ➤ .groupinfo
║ ➤ .staff or .admins 
║ ➤ .vv
║ ➤ .vv2
║ ➤ .trt <text> <lang>
║ ➤ .ss <link>
║ ➤ .jid
║ ➤ .url
╚═══════════════════╝ 

╔═══════════════════╗
👮‍♂️ *Admin Commands*:
║ ➤ .ban @user
║ ➤ .promote @user
║ ➤ .demote @user
║ ➤ .mute <minutes>
║ ➤ .unmute
║ ➤ .delete or .del
║ ➤ .kick @user
║ ➤ .warnings @user
║ ➤ .warn @user
║ ➤ .antilink
║ ➤ .antibadword
║ ➤ .clear
║ ➤ .tag <message>
║ ➤ .tagall
║ ➤ .tagnotadmin
║ ➤ .hidetag <message>
║ ➤ .chatbot
║ ➤ .resetlink
║ ➤ .antitag <on/off>
║ ➤ .welcome <on/off>
║ ➤ .goodbye <on/off>
║ ➤ .antibot <on/off/set/get>
║ ➤ .setgdesc <description>
║ ➤ .setgname <new name>
║ ➤ .setgpp (reply to image)
║ ➤ .groupstatus [caption/text]
║ ➤ .lock [30m]
║ ➤ .unlock
║ ➤ .poll Question | Option | Option
║ ➤ .grouplink
║ ➤ .tagadmin
║ ➤ .invite
║ ➤ .getgpp
║ ➤ .getdesc
║ ➤ .getparticipants
║ ➤ .listinactive [days]
║ ➤ .approveall
║ ➤ .approveall on
║ ➤ .approveall off
║ ➤ .rejectall
║ ➤ .antispam <on/off/status/limit>
║ ➤ .antistatusmention <on/off>
║ ➤ .antidemote <on/off>
║ ➤ .antipromote <on/off>
║ ➤ .moderation
╚═══════════════════╝

╔═══════════════════╗
🔒 *Owner Commands*:
║ ➤ .remind
║ ➤ .schedule
║ ➤ .autoreply
║ ➤ .autorecording
║ ➤ .autorecordtyping
║ ➤ .autorec
║ ➤ .autobio
║ ➤ .reactowner
║ ➤ .setbotname / .resetbotname
║ ➤ .setowner / .resetowner
║ ➤ .setprefix / .prefix
║ ➤ .setfooter
║ ➤ .setchannel / .resetchannel
║ ➤ .block / .unblock
║ ➤ .silent <on/off>
║ ➤ .about
║ ➤ .mode <public/private/groups/dms>
║ ➤ .clearsession
║ ➤ .antidelete
║ ➤ .cleartmp
║ ➤ .update
║ ➤ .settings
║ ➤ .setmenuimage
║ ➤ .restoremenuimage
║ ➤ .setpp <reply to image>
║ ➤ .autoreact <on/off>
║ ➤ .autostatus <on/off>
║ ➤ .autostatus react <on/off>
║ ➤ .savestatus [on/off]
║ ➤ .autotyping <on/off>
║ ➤ .autoread <on/off>
║ ➤ .anticall <on/off>
║ ➤ .pmblocker <on/off/status>
║ ➤ .pmblocker setmsg <text>
║ ➤ .setmention <reply to msg>
║ ➤ .mention <on/off>
╚═══════════════════╝

╔═══════════════════╗
🎨 *Image/Sticker Commands*:
║ ➤ .blur <image>
║ ➤ .simage <reply to sticker>
║ ➤ .sticker <reply to image>
║ ➤ .removebg
║ ➤ .remini
║ ➤ .crop (reply sticker/image/video)
║ ➤ .tgsticker <Link>
║ ➤ .meme
║ ➤ .take <packname> 
║ ➤ .emojimix <emj1>+<emj2>
║ ➤ .igs <insta link>
║ ➤ .igsc <insta link>
╚═══════════════════╝  

╔═══════════════════╗
🖼️ *Pies Commands*:
║ ➤ .pies <country>
║ ➤ .china 
║ ➤ .indonesia 
║ ➤ .japan 
║ ➤ .korea 
║ ➤ .hijab
╚═══════════════════╝

╔═══════════════════╗
🎮 *Game Commands*:
║ ➤ .tictactoe @user
║ ➤ .hangman
║ ➤ .guess <letter>
║ ➤ .trivia
║ ➤ .answer <answer>
║ ➤ .truth
║ ➤ .dare
╚═══════════════════╝

╔═══════════════════╗
🤖 *AI Commands*:
║ ➤ .ai <question>
║ ➤ .gpt <question>
║ ➤ .gemini <question>
║ ➤ .imagine <prompt>
║ ➤ .flux <prompt>
║ ➤ .sora <prompt>
╚═══════════════════╝

╔═══════════════════╗
🎯 *Fun Commands*:
║ ➤ .compliment @user
║ ➤ .insult @user
║ ➤ .flirt 
║ ➤ .shayari
║ ➤ .goodnight
║ ➤ .roseday
║ ➤ .character @user
║ ➤ .wasted @user
║ ➤ .ship @user
║ ➤ .simp @user
║ ➤ .stupid @user [text]
╚═══════════════════╝

╔═══════════════════╗
🔤 *Textmaker*:
║ ➤ .metallic <text>
║ ➤ .ice <text>
║ ➤ .snow <text>
║ ➤ .impressive <text>
║ ➤ .matrix <text>
║ ➤ .light <text>
║ ➤ .neon <text>
║ ➤ .devil <text>
║ ➤ .purple <text>
║ ➤ .thunder <text>
║ ➤ .leaves <text>
║ ➤ .1917 <text>
║ ➤ .arena <text>
║ ➤ .hacker <text>
║ ➤ .sand <text>
║ ➤ .blackpink <text>
║ ➤ .glitch <text>
║ ➤ .fire <text>
╚═══════════════════╝

╔═══════════════════╗
📥 *Downloader*:
║ ➤ .play <song_name>
║ ➤ .song <song_name>
║ ➤ .spotify <query>
║ ➤ .instagram <link>
║ ➤ .facebook <link>
║ ➤ .twitter <link>
║ ➤ .tiktok <link>
║ ➤ .video <song name>
║ ➤ .ytmp4 <Link>
╚═══════════════════╝

╔═══════════════════╗
🧩 *MISC*:
║ ➤ .heart
║ ➤ .circle
║ ➤ .lgbt
║ ➤ .lolice
║ ➤ .its-so-stupid
║ ➤ .namecard 
║ ➤ .oogway
║ ➤ .tweet
║ ➤ .ytcomment 
║ ➤ .comrade 
║ ➤ .gay 
║ ➤ .glass 
║ ➤ .jail 
║ ➤ .passed 
║ ➤ .triggered
╚═══════════════════╝

╔═══════════════════╗
🖼️ *ANIME*:
║ ➤ .nom 
║ ➤ .poke 
║ ➤ .cry 
║ ➤ .kiss 
║ ➤ .pat 
║ ➤ .hug 
║ ➤ .wink 
║ ➤ .facepalm 
╚═══════════════════╝

╔═══════════════════╗
💻 *Github Commands:*
║ ➤ .git
║ ➤ .github
║ ➤ .sc
║ ➤ .script
║ ➤ .repo
╚═══════════════════╝

╔═══════════════════╗
🏆 *Sports Commands:*
║ ➤ .sportsmenu
║ ➤ .football
║ ➤ .matchstats
║ ➤ .teamnews
║ ➤ .basketball
║ ➤ .f1
║ ➤ .tennis
║ ➤ .cricket
║ ➤ .nfl
║ ➤ .mma
║ ➤ .baseball
║ ➤ .hockey
║ ➤ .golf
║ ➤ .sportsnews
╚═══════════════════╝

Join our channel for updates: ${d.channel}\n${d.footer}`;

    if (d.prefix !== ".") helpMessage = helpMessage.replace(/(^|\s)\.(?=[a-z0-9])/g, (_,space)=>space+d.prefix);
    try {
        const imageBuffer = getImage();
        
        if (imageBuffer) {
            
            await sock.sendMessage(chatId, {
                image: imageBuffer,
                caption: helpMessage,
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363432540825616@newsletter',
                        newsletterName: 'Harley-MD',
                        serverMessageId: -1
                    }
                }
            },{ quoted: message });
        } else {
            console.warn('Menu image unavailable; using text menu.');
            await sock.sendMessage(chatId, { 
                text: helpMessage,
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363432540825616@newsletter',
                        newsletterName: 'Harley-MD by Elvis',
                        serverMessageId: -1
                    } 
                }
            });
        }
    } catch (error) {
        console.error('Error in help command:', error);
        await sock.sendMessage(chatId, { text: helpMessage });
    }
}

module.exports = helpCommand;

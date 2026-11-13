const moment = require('moment-timezone'); 
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const repoUrl = 'https://github.com/ElvisMaina2005/Harley-MD';
const apiUrl = 'https://api.github.com/repos/ElvisMaina2005/Harley-MD';

async function githubCommand(sock, chatId, message) {
    let txt = '*乂  Harley-MD  乂*\n\n';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
        const headers = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'Harley-MD', 'X-GitHub-Api-Version': '2022-11-28' };
        const token = process.env.GITHUB_TOKEN?.trim();
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(apiUrl, { headers, signal: controller.signal });
        if (!res.ok) throw new Error(`GitHub API HTTP ${res.status}`);
        const json = await res.json();
        // Do not publish private repository statistics to arbitrary WhatsApp chats.
        if (json.private) {
            txt += `✩  *Name* : Harley-MD\n✩  *URL* : ${repoUrl}\n✩  *Visibility* : Private\n\n`;
            txt += 'Live statistics are not displayed for private repositories.\n';
        } else {
            txt += `✩  *Name* : ${json.name}\n`;
            txt += `✩  *Watchers* : ${json.subscribers_count ?? 'Unavailable'}\n`;
            txt += `✩  *Size* : ${(json.size / 1024).toFixed(2)} MB\n`;
            txt += `✩  *Last Updated* : ${moment(json.updated_at).format('DD/MM/YY - HH:mm:ss')}\n`;
            txt += `✩  *URL* : ${repoUrl}\n`;
            txt += `✩  *Forks* : ${json.forks_count}\n`;
            txt += `✩  *Stars* : ${json.stargazers_count}\n`;
        }
    } catch (error) {
        console.warn('GitHub repository lookup:', error.message);
        txt += `✩  *Name* : Harley-MD\n✩  *URL* : ${repoUrl}\n\nLive repository statistics are currently unavailable.\n`;
    } finally {
        clearTimeout(timer);
    }
    txt += '\n💥 *Harley-MD*';
    try {
        const imgBuffer = fs.readFileSync(path.join(__dirname, '../assets/bot_image.jpg'));
        await sock.sendMessage(chatId, { image: imgBuffer, caption: txt }, { quoted: message });
    } catch (error) {
        await sock.sendMessage(chatId, { text: txt }, { quoted: message });
    }
}

module.exports = githubCommand;

const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const { toAudio } = require('../lib/converter');
const APIs = require('../lib/api');
const Media = require('../lib/mediaEngine');

const {
  UA,
  isIpLockedCdn,
  knightSongDownload,
  hectorSongDownload,
  princeSongDownload,
  prexzySongDownload,
} = APIs;

function extractYouTubeId(input) {
  const text = String(input || '').trim();
  const m =
    text.match(/(?:youtube\.com\/(?:watch\?.*?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i) ||
    text.match(/^([a-zA-Z0-9_-]{11})$/);
  return m?.[1] || null;
}

async function resolveVideoInfo(text) {
  if (/youtube\.com|youtu\.be/i.test(text)) {
    const videoId = extractYouTubeId(text);
    if (videoId) {
      try {
        const info = await yts({ videoId });
        if (info?.videoId || info?.url) {
          return {
            url: info.url || `https://www.youtube.com/watch?v=${videoId}`,
            title: info.title || 'YouTube Audio',
            thumbnail: info.thumbnail || info.image || null,
            timestamp: info.timestamp || info.duration?.timestamp || '—',
          };
        }
      } catch (err) {
        console.log('[song] yts videoId lookup failed:', err?.message || err);
      }
    }
    return { url: text.trim(), title: 'YouTube Audio', thumbnail: null, timestamp: '—' };
  }

  const search = await yts(text);
  if (!search?.videos?.length) return null;
  return search.videos[0];
}

async function fetchAudioBuffer(audioUrl, headers, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await axios.get(audioUrl, {
        responseType: 'arraybuffer',
        timeout: 120000,
        maxContentLength: 100 * 1024 * 1024,
        maxBodyLength: 100 * 1024 * 1024,
        decompress: true,
        validateStatus: (s) => s >= 200 && s < 400,
        headers,
      });
      const buf = Buffer.from(res.data);
      if (buf.length > 0) return buf;
      throw new Error('Empty audio buffer');
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      if ([402,403,404,429,451].includes(status)) throw err;
      console.log(`[song] file fetch ${attempt}/${attempts}:`, status || err.code || err.message);
      if (attempt < attempts) await APIs.sleep(1200 * attempt);
    }
  }
  throw lastError || new Error('Failed to fetch audio file');
}

function detectAudioFormat(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf.toString('ascii', 4, 8) === 'ftyp') return { name: 'M4A/MP4', ext: 'm4a' };
  if (buf.toString('ascii', 0, 3) === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) {
    return { name: 'MP3', ext: 'mp3' };
  }
  if (buf.toString('ascii', 0, 4) === 'OggS') return { name: 'OGG/Opus', ext: 'ogg' };
  if (buf.toString('ascii', 0, 4) === 'RIFF') return { name: 'WAV', ext: 'wav' };
  if (buf.readUInt32BE(0) === 0x1a45dfa3) return { name: 'WebM', ext: 'webm' };
  return null;
}

async function songCommand(sock, chatId, message) {
  try {
    const raw =
      message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      '';
    const text = raw.replace(/^\.(?:play|song|mp3|ytmp3)\s*/i, '').trim();

    if (!text) {
      await sock.sendMessage(chatId, { text: 'Usage: .song <song name or YouTube link>' }, { quoted: message });
      return;
    }

    const video = await resolveVideoInfo(text);
    if (!video?.url) {
      await sock.sendMessage(chatId, { text: 'No results found.' }, { quoted: message });
      return;
    }

    const caption = `🎵 Downloading: *${video.title || 'YouTube Audio'}*\n⏱ Duration: ${video.timestamp || '—'}`;
    if (video.thumbnail && /^https?:\/\//i.test(video.thumbnail)) {
      await sock.sendMessage(chatId, { image: { url: video.thumbnail }, caption }, { quoted: message });
    } else {
      await sock.sendMessage(chatId, { text: caption }, { quoted: message });
    }

    let audioData;
    let audioBuffer;

    // Knight first; rest are fallbacks (same sources as mini)
    const apiMethods = [
      { name: 'Knight', method: () => knightSongDownload(video.url) },
      { name: 'Hector', method: () => hectorSongDownload(video.url) },
      { name: 'Prince', method: () => princeSongDownload(video.url) },
      { name: 'Prexzy', method: () => prexzySongDownload(video.url) },
      { name: 'EliteProTech', method: () => APIs.getEliteProTechDownloadByUrl(video.url) },
      { name: 'Yupra', method: () => APIs.getYupraDownloadByUrl(video.url) },
      { name: 'Okatsu', method: () => APIs.getOkatsuDownloadByUrl(video.url) },
      { name: 'Izumi', method: () => APIs.getIzumiDownloadByUrl(video.url) },
    ];

    const result = await Media.tryProviders(apiMethods.map(({name, method}) => [name, method]), async (url, data) => {
      const headers = { 'User-Agent': UA, Accept: '*/*', 'Accept-Encoding': 'identity' };
      if (data.referer) headers.Referer = data.referer;
      const buffer = await fetchAudioBuffer(url, headers);
      if (!detectAudioFormat(buffer)) throw new Error('Not an audio file');
      return buffer;
    });
    if (result) { audioBuffer = result.buffer; audioData = result; }
    else {
      await sock.sendMessage(chatId, { text: '🔎 Trying local audio download fallback...' }, { quoted: message });
      audioBuffer = await Media.localDownload(video.url, 'audio');
      audioData = { title: video.title };
    }

    const detected = detectAudioFormat(audioBuffer);
    if (!detected) throw new Error('Invalid audio file');
    let finalBuffer = audioBuffer;
    let finalExtension = 'mp3';

    if (detected.ext !== 'mp3') {
      finalBuffer = await toAudio(audioBuffer, detected.ext);
      if (!finalBuffer?.length) throw new Error(`Failed to convert ${detected.name} to MP3`);
    }

    await sock.sendMessage(
      chatId,
      {
        audio: finalBuffer,
        mimetype: 'audio/mpeg',
        fileName: `${(audioData.title || video.title || 'song').replace(/[^\w\s-]/g, '')}.${finalExtension}`,
        ptt: false,
      },
      { quoted: message }
    );

    try {
      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) return;
      const now = Date.now();
      for (const file of fs.readdirSync(tempDir)) {
        if (!(file.endsWith('.mp3') || file.endsWith('.m4a') || /^\d+\.(mp3|m4a)$/.test(file))) continue;
        const filePath = path.join(tempDir, file);
        try {
          if (now - fs.statSync(filePath).mtimeMs > 10000) fs.unlinkSync(filePath);
        } catch {}
      }
    } catch {}
  } catch (err) {
    console.error('Song command error:', err?.message || 'Unknown error');
    let errorMessage = '❌ Failed to download song.';
    if (err.message?.includes('All download sources failed')) {
      errorMessage = '❌ All download sources failed. The content may be unavailable or blocked.';
    } else if (err.message?.includes('blocked') || err.response?.status === 451) {
      errorMessage = '❌ Download blocked or unavailable in your region.';
    }
    await sock.sendMessage(chatId, { text: errorMessage }, { quoted: message });
  }
}

module.exports = songCommand;

const yts = require('yt-search');
const settings = require('../settings');
const APIs = require('../lib/api');
const Media = require('../lib/mediaEngine');
const { fetchWhatsAppVideo } = require('../lib/waVideo');

function isYouTubeUrl(text) {
  return /youtube\.com|youtu\.be/i.test(text);
}

function extractUrl(text) {
  const match = String(text || '').match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : String(text || '').trim();
}

function formatInfo(video) {
  const views = Number(video.views || 0).toLocaleString('en-US');
  return `🎬 *${video.title}*\n⏱ Duration: ${video.timestamp || '—'}\n👀 Views: ${views}`;
}

async function resolveVideo(videoUrl, consume, report) {
  const steps = [
    ['Knight', () => APIs.knightVideoDownload(videoUrl)],
    ['Prince', () => APIs.princeVideoDownload(videoUrl)],
    ['Hector', () => APIs.hectorVideoDownload(videoUrl)],
    ['EliteProTech', () => APIs.getEliteProTechVideoByUrl(videoUrl)],
    ['Yupra', () => APIs.getYupraVideoByUrl(videoUrl)],
    ['Okatsu', () => APIs.getOkatsuVideoByUrl(videoUrl)],
  ];

  return Media.tryProviders(steps, consume, report);
}

async function videoCommand(sock, chatId, message) {
  let statusKey;
  let pending = Promise.resolve();
  let lastUpdate = 0;
  let lastText = '';
  const update = (text, force = false) => {
    if (text === lastText || (!force && Date.now() - lastUpdate < 5000)) return pending;
    lastText = text;
    lastUpdate = Date.now();
    console.log(`[VIDEO] ${text.replace(/\n/g, " | ")}`);
    pending = pending.then(async () => {
      try {
        if (statusKey) await sock.sendMessage(chatId, { text, edit: statusKey });
        else {
          const sent = await sock.sendMessage(chatId, { text }, { quoted: message });
          statusKey = sent?.key;
        }
      } catch (err) {
        console.warn("[VIDEO] Progress message failed:", err?.message || err);
      }
    });
    return pending;
  };
  try {
    const text =
      message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const query = text.replace(/^\.(?:video|ytmp4|ytv|ytvid)\s*/i, '').trim();

    if (!query) {
      return sock.sendMessage(
        chatId,
        { text: 'Usage: `.video <name or YouTube URL>`' },
        { quoted: message }
      );
    }

    await update("🎬 Searching for video...", true);
    let preview;
    let videoUrl;

    if (isYouTubeUrl(query)) {
      videoUrl = extractUrl(query);
      const ytId = (videoUrl.match(/(?:youtu\.be\/|v=|shorts\/)([a-zA-Z0-9_-]{11})/) || [])[1];
      preview = {
        title: 'YouTube Video',
        thumbnail: ytId ? `https://i.ytimg.com/vi/${ytId}/sddefault.jpg` : null,
      };
    } else {
      const search = await yts(query);
      preview = search?.videos?.[0];
      if (!preview) {
        await update('❌ No results found.', true);
        return;
      }
      videoUrl = preview.url;
    }

    if (preview.thumbnail) {
      try {
        await sock.sendMessage(
          chatId,
          {
            image: { url: preview.thumbnail },
            caption: `${formatInfo(preview)}\n\nFinding download source...`,
          },
          { quoted: message }
        );
      } catch {
        await sock.sendMessage(
          chatId,
          { text: `${formatInfo(preview)}\n\nFinding download source...` },
          { quoted: message }
        );
      }
    }

    await update('🔎 Finding download source...', true);
    const mb = (bytes) => (bytes / (1024 * 1024)).toFixed(1);
    const progress = (event) => {
      if (event.stage === 'local') { update(`📥 Downloading video locally... ${Math.floor(event.percent)}%`); return; }
      if (event.stage === 'convert') {
        if (!event.mode) update('⚙️ Inspecting video codecs...', true);
        else {
          const label = event.mode === 'remux' ? '⚙️ Preparing MP4 (no video re-encoding)...' : '⚙️ Converting video to WhatsApp MP4...';
          const detail = event.duration > 0
            ? `${Math.min(99, Math.floor(event.seconds / event.duration * 100))}% — ${Math.floor(event.seconds)} / ${Math.ceil(event.duration)} seconds processed`
            : `${Math.floor(event.seconds)} seconds processed`;
          update(`${label}\n${detail}`, event.seconds === 0);
        }
      } else if (event.stage === 'download') {
        const { loaded, total, complete } = event;
        if (!loaded && !complete) return;
        const percent = total ? Math.min(complete ? 100 : 99, Math.floor(loaded / total * 100)) : null;
        const detail = percent === null
          ? `${mb(loaded)} MB downloaded`
          : `${percent}% — ${mb(loaded)} / ${mb(total)} MB`;
        update(`📥 Downloading video...\n${detail}`, !!complete);
      }
    };
    let dl = await resolveVideo(videoUrl, (url, result) => fetchWhatsAppVideo(url, result.referer ? { Referer: result.referer } : {}, progress), name => update(`📥 Downloading via ${name}...`, true));
    if (!dl) {
      await update('🔎 Trying local download fallback...', true);
      dl = { buffer: await Media.localDownload(videoUrl, 'video', progress), title: preview.title };
    }
    const video = dl.buffer;
    await update('📤 Sending video to WhatsApp...', true);
    const botName = settings.botName || 'Knight Bot';
    const title = dl.title || preview.title || 'Video';
    const fileName = `${title.replace(/[^\w\s-]/g, '').trim() || 'video'}.mp4`;

    await sock.sendMessage(
      chatId,
      {
        video,
        mimetype: 'video/mp4',
        fileName,
        caption: `*${title}*\n\n> *_Downloaded by ${botName}_*`,
      },
      { quoted: message }
    );
    await update("✅ Video sent successfully!", true);
  } catch (err) {
    await pending;
    if (statusKey) await update("❌ Video request failed.", true);
    console.error('[video]', err?.message || err);
    await sock.sendMessage(
      chatId,
      { text: '❌ Video unavailable right now. Please try again later or choose another authorized video.' },
      { quoted: message }
    );
  }
}

module.exports = videoCommand;

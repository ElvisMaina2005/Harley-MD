const yts = require('yt-search'); 
const settings = require('../settings');
const APIs = require('../lib/api');
const Media = require('../lib/mediaEngine');
const {createOperation}=require("../lib/mediaTelemetry");
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

async function resolveVideo(videoUrl, consume, report, telemetry) {
  const steps = [
    ['Knight', () => APIs.knightVideoDownload(videoUrl)],
    ['Prince', () => APIs.princeVideoDownload(videoUrl)],
    ['Hector', () => APIs.hectorVideoDownload(videoUrl)],
    ['EliteProTech', () => APIs.getEliteProTechVideoByUrl(videoUrl)],
    ['Yupra', () => APIs.getYupraVideoByUrl(videoUrl)],
    ['Okatsu', () => APIs.getOkatsuVideoByUrl(videoUrl)],
  ];

  return Media.tryProviders(steps, consume, report, telemetry);
}

async function videoCommand(sock, chatId, message) {
  let telemetry;
  let downloadingReaction = false;

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

    telemetry = createOperation("video");

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
        telemetry.finish(false, 'NO_RESULTS');
        await sock.sendMessage(
          chatId,
          { text: 'No video results found for your search.' },
          { quoted: message }
        );
        return;
      }

      videoUrl = preview.url;
    }

    // Always send the preview before starting the download.
    if (preview.thumbnail) {
      try {
        await sock.sendMessage(
          chatId,
          {
            image: { url: preview.thumbnail },
            caption: formatInfo(preview),
          },
          { quoted: message }
        );
      } catch (previewError) {
        console.warn('[VIDEO] Thumbnail preview failed:', previewError?.message || previewError);
        await sock.sendMessage(
          chatId,
          { text: formatInfo(preview) },
          { quoted: message }
        );
      }
    } else {
      await sock.sendMessage(
        chatId,
        { text: formatInfo(preview) },
        { quoted: message }
      );
    }

    try {
      await sock.sendMessage(chatId, { react: { text: '⬇️', key: message.key } });
      downloadingReaction = true;
    } catch (reactionError) {
      console.warn('[video] Download reaction failed:', reactionError?.message || reactionError);
    }

    // Progress callbacks are intentionally silent.
    const progress = () => {};

    let dl = await resolveVideo(
      videoUrl,
      (url, result) => fetchWhatsAppVideo(
        url,
        result.referer ? { Referer: result.referer } : {},
        progress
      ),
      () => {},
      telemetry
    );

    if (!dl) {
      dl = {
        buffer: await Media.localDownload(videoUrl, 'video', progress, telemetry),
        title: preview.title,
      };
    }

    const video = dl.buffer;
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

    telemetry.finish(true);
  } catch (err) {
    telemetry?.finish(false);
    console.error('[video]', err?.message || err);

    await sock.sendMessage(
      chatId,
      { text: 'Video unavailable right now. Please try again later or choose another authorized video.' },
      { quoted: message }
    );
  } finally {
    if (downloadingReaction) {
      try {
        await sock.sendMessage(chatId, { react: { text: '', key: message.key } });
      } catch (reactionError) {
        console.warn('[video] Could not clear download reaction:', reactionError?.message || reactionError);
      }
    }
  }
}
module.exports = videoCommand;

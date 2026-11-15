const fs = require('fs'); 
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');

function looksLikeMedia(buf) {
  if (!buf || buf.length < 16) return false;
  if (buf.slice(4, 8).toString('ascii') === 'ftyp') return true;
  return buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
}

// Keep the bot's session in the parent process, not in FFmpeg's environment.
function ffmpegOptions() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.toUpperCase() === 'SESSION_ID') delete env[key];
  }
  return { windowsHide: true, env, stdio: ['ignore', 'ignore', 'pipe'] };
}

// Bound subprocess runtime and keep only a small diagnostic tail.
function runProcess(args, { timeout = 300000, inspect = false, onTime = () => {} } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-nostdin', ...args], ffmpegOptions());
    let err = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeout);
    child.stderr.on('data', (chunk) => {
      err = (err + chunk.toString()).slice(-32768);
      const times = [...err.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)];
      const t = times.at(-1);
      if (t) {
        try { onTime(Number(t[1])*3600 + Number(t[2])*60 + Number(t[3])); } catch {}
      }
    });
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) return reject(new Error(`FFmpeg timed out after ${timeout / 1000} seconds`));
      if (inspect || code === 0) return resolve(err);
      reject(new Error(err.trim().split(/[\r\n]+/).slice(-2).join(' ') || `ffmpeg exited ${code}`));
    });
  });
}

function runFfmpeg(args, onTime, timeout = 300000) {
  return runProcess(['-hide_banner', '-stats_period', '5', ...args], { onTime, timeout });
}

async function inspectMedia(file) {
  const err = await runProcess(['-hide_banner', '-i', file], { timeout: 20000, inspect: true });
  const video = /Stream #\d+:\d+.*Video:\s*([a-z0-9]+)/i.exec(err)?.[1]?.toLowerCase() || '';
  const audio = /Stream #\d+:\d+.*Audio:\s*([a-z0-9]+)/i.exec(err)?.[1]?.toLowerCase() || '';
  const size = /Video:.*?(\d{2,5})x(\d{2,5})/i.exec(err);
  const duration = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(err);
  if (!video) throw new Error('FFmpeg could not identify a video stream');
  return { video, audio, height: size ? Number(size[2]) : 0,
    duration: duration ? Number(duration[1])*3600 + Number(duration[2])*60 + Number(duration[3]) : 0 };
}

async function toWhatsAppMp4(input, output, report = () => {}) {
  const info = await inspectMedia(input);
  const h264 = info.video === 'h264';
  const aac = !info.audio || info.audio === 'aac';
  const mode = h264 && aac ? 'remux' : 'encode';
  report({ stage: 'convert', mode, duration: info.duration, seconds: 0 });
  const onTime = seconds => report({ stage: 'convert', mode, duration: info.duration, seconds });
  const args = ['-y', '-i', input, '-map', '0:v:0', '-map', '0:a:0?'];
  if (h264) args.push('-c:v', 'copy');
  else {
    args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '26', '-pix_fmt', 'yuv420p', '-threads', '2');
    if (info.height > 480) args.push('-vf', 'scale=-2:480');
  }
  if (info.audio && !aac) args.push('-c:a', 'aac', '-b:a', '128k');
  else if (info.audio) args.push('-c:a', 'copy');
  else args.push('-an');
  args.push('-movflags', '+faststart', output);
  // Allow up to 15 minutes on CPU-limited hosting.
  await runFfmpeg(args, onTime, 900000);
}

/**
 * Download a video URL, remux/convert for WhatsApp, return MP4 buffer.
 */
async function fetchWhatsAppVideo(videoUrl, headers = {}, onProgress = () => {}) {
  const report = (event) => {
    try { onProgress(event); } catch { /* progress must not interrupt download */ }
  };
  report({ stage: 'download', loaded: 0, total: null });
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const input = path.join(os.tmpdir(), `wa-${stamp}.mp4`);
  const output = path.join(os.tmpdir(), `wa-${stamp}-out.mp4`);

  try {
    const { data, status, headers: resHeaders } = await axios.get(videoUrl, {
      responseType: 'arraybuffer',
      onDownloadProgress: ({ loaded, total }) => {
        report({ stage: 'download', loaded, total: total > 0 ? total : null });
      },
      timeout: 180000,
      maxContentLength: 100 * 1024 * 1024,
      maxBodyLength: 100 * 1024 * 1024,
      maxRedirects: 5,
      validateStatus: (s) => s >= 200 && s < 400,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'video/mp4,video/*,*/*;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'identity',
        ...headers,
      },
    });
    const source = Buffer.from(data);
    const ctype = String(resHeaders['content-type'] || '');
    if (!looksLikeMedia(source)) {
      const head = source.slice(0, 80).toString('utf8').replace(/\s+/g, ' ');
      throw new Error(
        `Download was not a video file (HTTP ${status}, ${ctype || 'unknown'}, ${source.length}b): ${head}`
      );
    }

    report({ stage: 'download', loaded: source.length, total: source.length, complete: true });
    fs.writeFileSync(input, source);
    report({ stage: 'convert' });
    await toWhatsAppMp4(input, output, report);
    const video = fs.readFileSync(output);
    if (!looksLikeMedia(video)) throw new Error('Converted file is not a video');
    return video;
  } finally {
    for (const file of [input, output]) {
      try {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } catch {}
    }
  }
}

async function downloadBuffer(url, headers = {}) {
  const { data } = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60000,
    maxRedirects: 5,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Encoding': 'identity',
      ...headers,
    },
  });
  return Buffer.from(data);
}

/**
 * Build a WhatsApp MP4 from TikTok photo-mode images (+ optional audio).
 * TikTok plays these as video; CDN only gives stills + mp3.
 */
async function slideshowToWhatsAppVideo(imageUrls, audioUrl = null, headers = {}) {
  if (!imageUrls?.length) throw new Error('No images for slideshow');

  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const dir = path.join(os.tmpdir(), `ttslide-${stamp}`);
  const output = path.join(os.tmpdir(), `ttslide-${stamp}.mp4`);
  const files = [];

  try {
    fs.mkdirSync(dir, { recursive: true });

    for (let i = 0; i < imageUrls.length; i++) {
      const buf = await downloadBuffer(imageUrls[i], headers);
      const imgPath = path.join(dir, `img-${i}.jpg`);
      fs.writeFileSync(imgPath, buf);
      files.push(imgPath);
    }

    let audioPath = null;
    if (audioUrl) {
      try {
        const abuf = await downloadBuffer(audioUrl, headers);
        audioPath = path.join(dir, 'audio.mp3');
        fs.writeFileSync(audioPath, abuf);
      } catch {
        audioPath = null;
      }
    }

    const perImage = audioPath ? Math.max(2, 3) : 3;
    // Single image: loop still + audio (TikTok photo post)
    if (files.length === 1) {
      const args = ['-y', '-loop', '1', '-i', files[0]];
      if (audioPath) args.push('-i', audioPath);
      args.push(
        '-c:v', 'libx264',
        '-tune', 'stillimage',
        '-pix_fmt', 'yuv420p',
        '-vf', 'scale=720:-2:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2',
        '-r', '30'
      );
      if (audioPath) {
        args.push('-c:a', 'aac', '-b:a', '128k', '-shortest');
      } else {
        args.push('-t', String(perImage), '-an');
      }
      args.push('-movflags', '+faststart', output);
      await runFfmpeg(args);
    } else {
      // Multi-image slideshow
      const listPath = path.join(dir, 'list.txt');
      const listBody = files
        .map((f) => `file '${f.replace(/\\/g, '/')}'\nduration ${perImage}`)
        .concat(`file '${files[files.length - 1].replace(/\\/g, '/')}'`)
        .join('\n');
      fs.writeFileSync(listPath, listBody);

      const slideOut = path.join(dir, 'slides.mp4');
      await runFfmpeg([
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', listPath,
        '-vf', 'scale=720:-2:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,format=yuv420p',
        '-r', '30',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-movflags', '+faststart',
        slideOut,
      ]);

      if (audioPath) {
        await runFfmpeg([
          '-y',
          '-i', slideOut,
          '-i', audioPath,
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-shortest',
          '-movflags', '+faststart',
          output,
        ]);
      } else {
        fs.copyFileSync(slideOut, output);
      }
    }

    const video = fs.readFileSync(output);
    if (!looksLikeMedia(video)) throw new Error('Slideshow render failed');
    return video;
  } finally {
    try {
      if (fs.existsSync(output)) fs.unlinkSync(output);
    } catch {}
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {}
  }
}

module.exports = {
  looksLikeMedia,
  toWhatsAppMp4,
  fetchWhatsAppVideo,
  slideshowToWhatsAppVideo,
};
